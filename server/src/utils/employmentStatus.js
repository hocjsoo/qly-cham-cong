const INACTIVE_EMPLOYMENT_STATUSES = Object.freeze([
  'Đã nghỉ việc', 'Da nghi viec', 'Nghỉ việc', 'Nghi viec', 'resigned', 'inactive',
  'Đang nghỉ ốm', 'Dang nghi om', 'Nghỉ ốm', 'Nghi om',
  'Nghỉ thai sản', 'Nghi thai san', 'Khác', 'Khac',
]);

const normalizeEmploymentStatus = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/đ/g, 'd');

const inactiveNormalized = new Set(INACTIVE_EMPLOYMENT_STATUSES.map(normalizeEmploymentStatus));

const isInactiveEmploymentStatus = status => inactiveNormalized.has(normalizeEmploymentStatus(status));

const getActiveEmploymentFilter = (extra = {}) => ({
  ...extra,
  is_active: { $ne: false },
  employment_status: { $nin: [...INACTIVE_EMPLOYMENT_STATUSES] },
});

module.exports = {
  INACTIVE_EMPLOYMENT_STATUSES,
  normalizeEmploymentStatus,
  isInactiveEmploymentStatus,
  getActiveEmploymentFilter,
};
