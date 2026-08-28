const fs = require('fs');
const path = require('path');
const { isResignedEmploymentStatus } = require('../../src/utils/employmentStatus');
const userController = require('../../src/controllers/userController');
const authController = require('../../src/controllers/authController');
const emailService = require('../../src/services/emailService');

function runEmailSecurityTests(assert) {
  console.log('\n📧 [TEST SUITE: EMAIL & OTP SECURITY]');

  assert(
    isResignedEmploymentStatus('Đã nghỉ việc') &&
      isResignedEmploymentStatus('Da nghi viec') &&
      isResignedEmploymentStatus('resigned'),
    'TC-EMAIL-01: Nhận diện đầy đủ trạng thái nhân sự đã nghỉ việc'
  );

  assert(
    !isResignedEmploymentStatus('Nghỉ thai sản') &&
      !isResignedEmploymentStatus('Nghỉ ốm') &&
      !isResignedEmploymentStatus('Đang làm việc'),
    'TC-EMAIL-02: Không khóa nhầm nhân sự nghỉ tạm thời hoặc đang làm việc'
  );

  assert(
    userController.__test.containsPasswordVariable('Thông báo', 'Mật khẩu: {MAT_KHAU}'),
    'TC-EMAIL-03: Phát hiện biến mật khẩu không phân biệt hoa thường'
  );

  assert(
    !userController.__test.containsPasswordVariable('Thông báo', 'Thiết lập mật khẩu bằng OTP qua Gmail'),
    'TC-EMAIL-04: Chấp nhận nội dung email OTP an toàn'
  );

  const otpPayload = authController.__test.buildOtpRequestPayload('Đã gửi OTP');
  assert(
    otpPayload.message === 'Đã gửi OTP' &&
      otpPayload.expires_in === '30 phút' &&
      !Object.prototype.hasOwnProperty.call(otpPayload, 'reset_code') &&
      !Object.prototype.hasOwnProperty.call(otpPayload, 'user_name'),
    'TC-EMAIL-05: API yêu cầu OTP không trả mã bí mật về trình duyệt'
  );

  const smtpOptions = emailService.__test.buildTransportOptions('user', 'pass', {});
  assert(
    smtpOptions.host === 'smtp.gmail.com' &&
      smtpOptions.port === 587 &&
      smtpOptions.family === 4 &&
      smtpOptions.connectionTimeout === 15000 &&
      smtpOptions.greetingTimeout === 15000 &&
      smtpOptions.socketTimeout === 30000,
    'TC-EMAIL-06: SMTP có timeout hữu hạn và ưu tiên IPv4 ổn định'
  );

  const smtp465Options = emailService.__test.buildTransportOptions('user', 'pass', { SMTP_PORT: '465' });
  assert(
    smtp465Options.secure === true && smtp465Options.requireTLS === false,
    'TC-EMAIL-07: SMTP cổng 465 tự bật kết nối bảo mật'
  );

  assert(
    emailService.__test.normalizeSmtpPassword('abcd efgh ijkl mnop', 'smtp.gmail.com') === 'abcdefghijklmnop' &&
      emailService.__test.normalizeSmtpPassword('keep spaces', 'smtp.example.com') === 'keep spaces',
    'TC-EMAIL-07.1: Gmail App Password tự loại bỏ khoảng trắng khi kết nối'
  );

  assert(
    userController.__test.isSmtpTransportFailure({ code: 'EAUTH' }) &&
      userController.__test.isSmtpTransportFailure({ responseCode: 535 }) &&
      !userController.__test.isSmtpTransportFailure({ code: 'EENVELOPE' }),
    'TC-EMAIL-07.2: Phân biệt lỗi SMTP hệ thống để dừng gửi hàng loạt an toàn'
  );

  const broadcastSource = String(userController.broadcastCustomEmail);
  assert(
    !broadcastSource.includes('password_hash') &&
      !broadcastSource.includes('must_change_password') &&
      !broadcastSource.includes('tempPassword'),
    'TC-EMAIL-08: Gửi email hàng loạt tuyệt đối không sửa mật khẩu'
  );

  const forgotSource = String(authController.forgotPassword);
  assert(
    !/reset_code\s*:/.test(forgotSource) && !/user_name\s*:/.test(forgotSource),
    'TC-EMAIL-09: Luồng quên mật khẩu không làm lộ OTP trong response'
  );

  const emailsPageSource = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/EmailsPage.jsx'),
    'utf8'
  );
  const staffPageSource = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/StaffPage.jsx'),
    'utf8'
  );
  assert(
    !emailsPageSource.includes('tag: "mat_khau"') &&
      !emailsPageSource.includes('Mật khẩu tạm thời:') &&
      !staffPageSource.includes('data.reset_code') &&
      !staffPageSource.includes('resetCodeModal'),
    'TC-EMAIL-10: Giao diện không chèn, hiển thị hoặc cấp mật khẩu qua email'
  );

  const seedSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/database/seed.js'),
    'utf8'
  );
  assert(
    !seedSource.includes("INITIAL_ADMIN_PASSWORD ||") &&
      seedSource.includes('Thiếu INITIAL_ADMIN_EMAIL hoặc INITIAL_ADMIN_PASSWORD'),
    'TC-EMAIL-11: Production không còn mật khẩu Admin mặc định dự phòng'
  );
}

module.exports = runEmailSecurityTests;
