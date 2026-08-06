'use strict';

const ROLES = ['super_admin', 'admin', 'operator', 'user'];

const ROLE_RANK = Object.fromEntries(ROLES.map((role, index) => [role, ROLES.length - index]));

function isSuperAdmin(user) {
  return user?.role === 'super_admin';
}

function isAdminOrAbove(user) {
  return user?.role === 'super_admin' || user?.role === 'admin';
}

function canManageUsers(user) {
  return isAdminOrAbove(user);
}

function canManageStudies(user) {
  return isAdminOrAbove(user);
}

function canRecordAnyStudy(user) {
  return user?.role !== 'user';
}

function rolesAssignableBy(actor) {
  if (isSuperAdmin(actor)) return ROLES;
  if (actor?.role === 'admin') return ['operator', 'user'];
  return [];
}

function canChangeRole(actor, targetUser, newRole) {
  if (!ROLES.includes(newRole)) return false;
  if (actor.id === targetUser.id && newRole !== targetUser.role) return false;
  if (isSuperAdmin(actor)) return true;
  if (actor.role === 'admin') {
    if (['super_admin', 'admin'].includes(targetUser.role)) return false;
    return ['operator', 'user'].includes(newRole);
  }
  return false;
}

function canAssignStudies(user) {
  return isAdminOrAbove(user);
}

module.exports = {
  ROLES,
  ROLE_RANK,
  isSuperAdmin,
  isAdminOrAbove,
  canManageUsers,
  canManageStudies,
  canRecordAnyStudy,
  rolesAssignableBy,
  canChangeRole,
  canAssignStudies,
};
