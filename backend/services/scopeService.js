'use strict';

const UserModel = require('../models/UserModel');

function accessibleStudyIds(user) {
  if (user.role === 'user') {
    return UserModel.getStudyIds(user.id);
  }
  return null;
}

function scopeClause(user, alias = 'b') {
  const allowed = accessibleStudyIds(user);
  if (allowed === null) return { sql: '', params: [], empty: false };
  if (allowed.length === 0) return { sql: '', params: [], empty: true };
  return {
    sql: `${alias}.study_id IN (${allowed.map(() => '?').join(',')})`,
    params: allowed,
    empty: false,
  };
}

module.exports = { accessibleStudyIds, scopeClause };
