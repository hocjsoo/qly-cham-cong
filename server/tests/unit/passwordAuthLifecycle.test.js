// ==============================================
// tests/unit/passwordAuthLifecycle.test.js
// Kiểm thử Quy trình Đổi Mật Khẩu, Quên Mật Khẩu & Bảo mật Dữ liệu
// ==============================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function generateResetToken() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ sau
  return { resetToken, tokenHash, expires };
}

function verifyResetToken(inputToken, storedHash, storedExpires) {
  if (new Date() > new Date(storedExpires)) {
    return { valid: false, error: 'Token đặt lại mật khẩu đã hết hạn.' };
  }
  const inputHash = crypto.createHash('sha256').update(inputToken).digest('hex');
  if (inputHash !== storedHash) {
    return { valid: false, error: 'Token không hợp lệ hoặc đã qua sử dụng.' };
  }
  return { valid: true };
}

function sanitizeUserResponse(userDoc) {
  const userObject = { ...userDoc };
  delete userObject.password_hash;
  delete userObject.reset_token;
  delete userObject.reset_token_expires;
  return userObject;
}

async function runPasswordAuthTests(assert) {
  console.log('\n🔑 [TEST SUITE: AUTH & PASSWORD LIFECYCLE]');

  // TC-AUTH-01: Tạo Token Đặt lại Mật khẩu an toàn
  const { resetToken, tokenHash, expires } = generateResetToken();
  assert(resetToken && resetToken.length === 64 && tokenHash && tokenHash.length === 64,
    'TC-AUTH-01: Sinh mã Token ngẫu nhiên chuẩn 64 ký tự hex an toàn');

  // TC-AUTH-02: Xác thực Token còn hạn
  const validCheck = verifyResetToken(resetToken, tokenHash, expires);
  assert(validCheck.valid === true, 'TC-AUTH-02: Token đúng & còn hạn -> Xác thực thành công');

  // TC-AUTH-03: Chặn Token hết hạn
  const expiredDate = new Date(Date.now() - 1000);
  const expiredCheck = verifyResetToken(resetToken, tokenHash, expiredDate);
  assert(expiredCheck.valid === false && expiredCheck.error.includes('hết hạn'),
    'TC-AUTH-03: Chặn Token khi đã quá thời gian 1 giờ');

  // TC-AUTH-04: Chặn Token sai mã hash
  const wrongTokenCheck = verifyResetToken('fake_invalid_token', tokenHash, expires);
  assert(wrongTokenCheck.valid === false && wrongTokenCheck.error.includes('không hợp lệ'),
    'TC-AUTH-04: Chặn Token không khớp');

  // TC-AUTH-05: Bảo mật — Xóa sạch password_hash khỏi API Response
  const mockDbUser = {
    _id: 'u_test',
    full_name: 'Test User',
    email: 'test@et.vn',
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    reset_token: 'secret_token_123',
    reset_token_expires: expires
  };
  const sanitized = sanitizeUserResponse(mockDbUser);
  assert(!sanitized.password_hash && !sanitized.reset_token && sanitized.email === 'test@et.vn',
    'TC-AUTH-05: Bảo mật thông tin tuyệt đối — Loại bỏ toàn bộ password_hash & reset_token khi trả về Client');
}

module.exports = runPasswordAuthTests;
