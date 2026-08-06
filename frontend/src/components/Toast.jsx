import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, kind = 'ok') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          className={`banner fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 banner-${toast.kind === 'error' ? 'error' : toast.kind}`}
          style={{ boxShadow: 'var(--shadow)' }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
