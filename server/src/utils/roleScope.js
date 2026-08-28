const User = require('../models/User');

const LEADER_ROLES = new Set(['leader', 'manager']);
const EMPLOYEE_ROLES = new Set(['employee', 'staff']);

const getRole = userOrRole => (
  typeof userOrRole === 'string' ? userOrRole : userOrRole?.role
);

const normalizeId = value => {
  if (!value) return null;
  return String(value._id || value);
};

const isLeaderRole = userOrRole => LEADER_ROLES.has(getRole(userOrRole));
const isEmployeeRole = userOrRole => EMPLOYEE_ROLES.has(getRole(userOrRole));

const getDepartmentIds = user => {
  if (!user) return [];
  const values = Array.isArray(user.department_ids) && user.department_ids.length > 0
    ? user.department_ids
    : (user.department_id ? [user.department_id] : []);

  return [...new Set(values.map(normalizeId).filter(Boolean))];
};

const buildLeaderUserScope = (leader, { includeSelf = false, excludeAdmins = true } = {}) => {
  const leaderId = normalizeId(leader?._id);
  const departmentIds = getDepartmentIds(leader);
  const relationships = [];

  if (leaderId) relationships.push({ manager_id: leaderId });
  if (departmentIds.length > 0) {
    relationships.push(
      { department_ids: { $in: departmentIds } },
      { department_id: { $in: departmentIds } }
    );
  }
  if (includeSelf && leaderId) relationships.push({ _id: leaderId });

  const scope = relationships.length > 0
    ? { $or: relationships }
    : { _id: null };

  if (excludeAdmins) {
    scope.role = { $ne: 'admin' };
  }

  return scope;
};

const combineUserFilters = (...filters) => {
  const usableFilters = filters.filter(filter => filter && Object.keys(filter).length > 0);
  if (usableFilters.length === 0) return {};
  if (usableFilters.length === 1) return usableFilters[0];
  return { $and: usableFilters };
};

const canManageUserId = async (actor, targetUserId, { allowSelf = false } = {}) => {
  if (!actor || !targetUserId) return false;
  if (actor.role === 'admin') return true;
  if (!isLeaderRole(actor)) return false;

  const actorId = normalizeId(actor._id);
  if (actorId && actorId === normalizeId(targetUserId)) return allowSelf;

  const target = await User.exists(combineUserFilters(
    { _id: targetUserId },
    buildLeaderUserScope(actor, { includeSelf: allowSelf, excludeAdmins: true })
  ));

  return Boolean(target);
};

module.exports = {
  isLeaderRole,
  isEmployeeRole,
  getDepartmentIds,
  buildLeaderUserScope,
  combineUserFilters,
  canManageUserId,
};
