// utils/auditLogger.js - Helper ghi audit log
const AuditLog = require('../models/AuditLog');

const getClientIP = (req) => {
  return req?.headers?.['x-forwarded-for']?.split(',')[0] || req?.socket?.remoteAddress || '127.0.0.1';
};

/**
 * Ghi một hành động vào audit log
 * @param {Object} params
 * @param {ObjectId} params.performed_by - ID người thực hiện
 * @param {string} params.action - Tên hành động (VD: 'REQUEST_APPROVED')
 * @param {string} [params.target_model] - Tên model bị ảnh hưởng
 * @param {string} [params.target_id] - ID bản ghi bị ảnh hưởng
 * @param {string} [params.description] - Mô tả chi tiết
 * @param {Object} [params.old_values] - Giá trị cũ trước khi thay đổi
 * @param {Object} [params.new_values] - Giá trị mới sau khi thay đổi
 * @param {Object} [params.req] - Express request object (để lấy IP)
 */
const logAction = async ({
  performed_by,
  action,
  target_model = null,
  target_id = null,
  description = null,
  old_values = null,
  new_values = null,
  req = null,
}) => {
  try {
    await AuditLog.create({
      performed_by,
      action,
      target_model,
      target_id: target_id ? String(target_id) : null,
      description,
      old_values,
      new_values,
      ip_address: req ? getClientIP(req) : null,
    });
  } catch (err) {
    // Lỗi audit log không được block request chính
    console.error('[AuditLog] Error:', err.message);
  }
};

module.exports = { logAction };
