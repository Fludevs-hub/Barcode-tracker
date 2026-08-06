'use strict';

const UserModel = require('../models/UserModel');
const { ROLES } = require('../utils/permissions');
const { rolesAssignableBy, canChangeRole } = require('../utils/permissions');

exports.list = (req, res) => {
  res.json({
    users: UserModel.listForAdmin(),
    assignable_roles: rolesAssignableBy(req.user),
  });
};

exports.create = (req, res) => {
  const { username, password, display_name, role = 'user', study_ids = [], email = null } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (!rolesAssignableBy(req.user).includes(role)) {
    return res.status(403).json({ error: 'You cannot create a user with that role.' });
  }
  try {
    const info = UserModel.create({
      username,
      passwordHash: UserModel.hashPassword(password),
      displayName: display_name || username,
      role,
      email: email?.trim().toLowerCase() || null,
    });
    if (role === 'user' && Array.isArray(study_ids)) {
      UserModel.setStudyLinks(info.lastInsertRowid, study_ids);
    }
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'That username is taken.' });
  }
};

exports.updateProfile = (req, res) => {
  const target = UserModel.findById(Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const { display_name, email, password } = req.body || {};
  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ error: 'Display name is required.' });
  }
  const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : null;

  try {
    UserModel.updateProfile(target.id, { displayName: display_name.trim(), email: normalizedEmail });
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      UserModel.updatePassword(target.id, UserModel.hashPassword(password));
    }
  } catch {
    return res.status(409).json({ error: 'That email is already used by another account.' });
  }
  res.json({ ok: true });
};

exports.updateRole = (req, res) => {
  const target = UserModel.findById(Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const role = (req.body || {}).role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (!canChangeRole(req.user, target, role)) {
    return res.status(403).json({ error: 'You cannot assign that role to this user.' });
  }
  if (target.role === 'super_admin' && role !== 'super_admin' && UserModel.countByRole('super_admin') <= 1) {
    return res.status(403).json({ error: 'Cannot change the last super admin.' });
  }
  if (target.role === 'admin' && role !== 'admin' && UserModel.countByRole('admin') <= 1 && UserModel.countByRole('super_admin') === 0) {
    return res.status(403).json({ error: 'Cannot change the last admin.' });
  }

  UserModel.updateRole(target.id, role);
  if (role !== 'user') UserModel.clearStudyLinks(target.id);
  res.json({ ok: true, role });
};

exports.updateStudies = (req, res) => {
  const userId = Number(req.params.id);
  const { study_ids } = req.body || {};
  if (!Array.isArray(study_ids)) return res.status(400).json({ error: 'study_ids must be an array.' });

  const target = UserModel.findById(userId);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.role !== 'user') return res.status(400).json({ error: 'Study access applies only to User role accounts.' });

  UserModel.setStudyLinks(userId, study_ids);
  res.json({ ok: true });
};
