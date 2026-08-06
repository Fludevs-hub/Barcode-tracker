export function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

// Scanning always works thanks to the ZXing fallback below, so this is kept
// only as a hint that the faster native path is available.
export function barcodeScanSupported() {
  return true;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image for scanning.'));
    img.src = src;
  });
}

const cleanScan = (v) => (v || '').replace(/[^0-9A-Za-z]/g, '');

async function detectNative(dataUrl) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return [];
  try {
    let formats = [];
    if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
      formats = await window.BarcodeDetector.getSupportedFormats();
    }
    const detector = new window.BarcodeDetector(formats.length ? { formats } : undefined);
    const img = await loadImage(dataUrl);
    const results = await detector.detect(img);
    return results
      // Strip spaces and hidden control chars (e.g. Code128/GS1 FNC1) that
      // inflate the length even though they render invisibly.
      .map((r) => ({ rawValue: cleanScan(r.rawValue), y: r.boundingBox?.y ?? 0 }))
      .filter((r) => r.rawValue)
      .sort((a, b) => a.y - b.y);
  } catch {
    return [];
  }
}

// Crop a fractional region and upscale small crops so ZXing can lock onto
// barcodes that are tiny in the frame (e.g. two labels side-by-side).
function cropToDataUrl(img, sx, sy, sw, sh) {
  const x = Math.round(img.width * sx);
  const y = Math.round(img.height * sy);
  const w = Math.round(img.width * sw);
  const h = Math.round(img.height * sh);
  const scale = w < 900 ? Math.min(3, 900 / w) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

// Cross-browser fallback (desktop Chrome/Edge on Windows lack BarcodeDetector).
// We try a set of regions: full top/bottom halves (single-label photos) and
// the four quadrants (two labels side-by-side), each tagged with a vertical
// position so the top barcode maps to the serial and the bottom to the code.
async function detectZxing(dataUrl) {
  try {
    const [{ BrowserMultiFormatReader }, zxLib] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const hints = new Map();
    if (zxLib.DecodeHintType) hints.set(zxLib.DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);
    const img = await loadImage(dataUrl);

    const regions = [
      { sx: 0, sy: 0, sw: 1, sh: 0.6, y: 0 },
      { sx: 0, sy: 0.4, sw: 1, sh: 0.6, y: 1 },
      { sx: 0, sy: 0, sw: 0.55, sh: 0.6, y: 0 },
      { sx: 0.45, sy: 0, sw: 0.55, sh: 0.6, y: 0 },
      { sx: 0, sy: 0.4, sw: 0.55, sh: 0.6, y: 1 },
      { sx: 0.45, sy: 0.4, sw: 0.55, sh: 0.6, y: 1 },
      { sx: 0, sy: 0, sw: 1, sh: 1, y: 0.5 },
    ];
    const found = [];
    for (const region of regions) {
      let cropUrl;
      try { cropUrl = cropToDataUrl(img, region.sx, region.sy, region.sw, region.sh); } catch { continue; }
      try {
        const res = await reader.decodeFromImageUrl(cropUrl);
        const raw = cleanScan(res?.getText?.());
        if (raw) found.push({ rawValue: raw, y: region.y });
      } catch {
        // No barcode in this region — keep going.
      }
    }
    const seen = new Set();
    return found
      .filter((f) => (seen.has(f.rawValue) ? false : seen.add(f.rawValue)))
      .sort((a, b) => a.y - b.y);
  } catch {
    return [];
  }
}

/**
 * Detect barcodes in an image (data URL). Uses the fast native BarcodeDetector
 * when present, otherwise falls back to ZXing. Returns an array of
 * { rawValue, y } sorted top-to-bottom.
 */
export async function detectBarcodes(dataUrl) {
  const native = await detectNative(dataUrl);
  if (native.length) return native;
  return detectZxing(dataUrl);
}

/**
 * Map detected barcodes to the two values on a label: the top barcode is the
 * numeric serial (e.g. "2025041198") and the bottom is the alphanumeric code
 * (e.g. "KH25BCEPW"). Falls back to vertical order when content is ambiguous.
 */
export function classifyBarcodeScans(scans) {
  const values = scans.map((s) => s.rawValue).filter(Boolean);
  // Top serial: all digits (optionally one letter prefix), ~10 chars.
  const serial = values.find((v) => /^[A-Za-z]?\d{8,12}$/.test(v))
    || values.find((v) => /^[A-Za-z]?\d{4,}$/.test(v))
    || '';
  // Bottom code: contains letters, ~9 chars.
  const code = values.find((v) => v !== serial && /[A-Za-z]/.test(v) && v.length >= 6 && v.length <= 12)
    || values.find((v) => v !== serial && /[A-Za-z]/.test(v))
    || '';
  return { serial, code };
}
