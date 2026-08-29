const fs = require('fs');
const path = require('path');
const { isResignedEmploymentStatus } = require('../../src/utils/employmentStatus');
const userController = require('../../src/controllers/userController');
const authController = require('../../src/controllers/authController');
const emailService = require('../../src/services/emailService');

async function runEmailSecurityTests(assert) {
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
      userController.__test.isEmailProviderFailure({ code: 'BREVO_RATE_LIMIT' }) &&
      !userController.__test.isEmailProviderFailure({ code: 'EENVELOPE' }),
    'TC-EMAIL-07.2: Phân biệt lỗi provider hệ thống để dừng gửi hàng loạt an toàn'
  );

  const brevoEnv = {
    BREVO_API_KEY: 'test-api-key-never-send',
    BREVO_SENDER_EMAIL: 'verified@example.com',
    BREVO_SENDER_NAME: 'Kiến trúc ET',
    BREVO_REPLY_TO_EMAIL: 'reply@example.com',
    EMAIL_LOGO_URL: 'https://qly-cham-cong.vercel.app/logo.png',
    SMTP_USER: 'smtp@example.com',
    SMTP_PASS: 'smtp-password',
  };
  assert(
    emailService.__test.getConfiguredEmailProvider(brevoEnv) === 'brevo' &&
      emailService.__test.getConfiguredEmailProvider({ SMTP_USER: 'smtp@example.com', SMTP_PASS: 'smtp-password' }) === 'smtp' &&
      emailService.__test.getConfiguredEmailProvider({}) === null,
    'TC-EMAIL-07.3: Brevo được ưu tiên và SMTP chỉ làm phương án dự phòng'
  );

  const brevoPayload = emailService.__test.buildBrevoPayload({
    toEmail: 'EMPLOYEE@example.com',
    toName: 'Nguyễn Văn A',
    subject: 'Thông báo\r\nBcc: attacker@example.com',
    htmlContent: '<img src="cid:company_logo"><img src="cid:inline_image_0@etoffice">',
    attachments: [
      { filename: 'logo.png', content: Buffer.from('logo'), cid: 'company_logo', contentType: 'image/png' },
      { filename: 'photo.png', content: Buffer.from('safe-image'), cid: 'inline_image_0@etoffice', contentType: 'image/png' },
    ],
  }, brevoEnv);
  assert(
    brevoPayload.sender.email === 'verified@example.com' &&
      brevoPayload.to[0].email === 'employee@example.com' &&
      brevoPayload.subject === 'Thông báo Bcc: attacker@example.com' &&
      brevoPayload.htmlContent.includes('https://qly-cham-cong.vercel.app/logo.png') &&
      brevoPayload.htmlContent.includes('data:image/png;base64,') &&
      brevoPayload.attachment[0].name === 'photo.png' &&
      !JSON.stringify(brevoPayload).includes('test-api-key-never-send'),
    'TC-EMAIL-07.4: Payload Brevo giữ logo, ảnh nội dung và không làm lộ API key'
  );

  let capturedBrevoRequest = null;
  const brevoSendResult = await emailService.__test.sendViaBrevo({
    toEmail: 'employee@example.com',
    subject: 'Kiểm thử Brevo',
    htmlContent: '<p>Nội dung thử nghiệm</p>',
  }, brevoEnv, async (url, options) => {
    capturedBrevoRequest = { url, options };
    return {
      ok: true,
      status: 201,
      json: async () => ({ messageId: 'mock-message-id' }),
    };
  });
  assert(
    brevoSendResult.sent === true &&
      brevoSendResult.provider === 'brevo' &&
      capturedBrevoRequest.url === 'https://api.brevo.com/v3/smtp/email' &&
      capturedBrevoRequest.options.method === 'POST' &&
      capturedBrevoRequest.options.headers['api-key'] === 'test-api-key-never-send' &&
      JSON.parse(capturedBrevoRequest.options.body).to[0].email === 'employee@example.com',
    'TC-EMAIL-07.4.1: Brevo gọi đúng HTTPS endpoint và header xác thực'
  );

  const brevoAuthFailure = emailService.__test.buildBrevoErrorResult(401);
  const brevoQuotaFailure = emailService.__test.buildBrevoErrorResult(429);
  const brevoTimeoutFailure = emailService.__test.buildBrevoNetworkErrorResult({ name: 'AbortError', message: 'secret detail' });
  assert(
    brevoAuthFailure.code === 'BREVO_AUTH' &&
      brevoQuotaFailure.code === 'BREVO_RATE_LIMIT' &&
      brevoTimeoutFailure.code === 'BREVO_TIMEOUT' &&
      !brevoTimeoutFailure.error.includes('secret detail'),
    'TC-EMAIL-07.5: Lỗi Brevo được chuẩn hóa và không lộ chi tiết nội bộ'
  );

  const broadcastSource = String(userController.broadcastCustomEmail);
  assert(
    !broadcastSource.includes('password_hash') &&
      !broadcastSource.includes('must_change_password') &&
      !broadcastSource.includes('tempPassword'),
    'TC-EMAIL-08: Gửi email hàng loạt tuyệt đối không sửa mật khẩu'
  );

  const forgotSource = String(authController.forgotPassword);
  const emailServiceSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/services/emailService.js'),
    'utf8'
  );
  const safeSmtpFailure = emailService.__test.buildEmailErrorResult({
    code: 'EAUTH',
    responseCode: 535,
    message: 'SMTP secret detail must never reach the browser',
  });
  assert(
    !/reset_code\s*:/.test(forgotSource) &&
      !/user_name\s*:/.test(forgotSource) &&
      !emailServiceSource.includes('Mã reset mật khẩu cho') &&
      !emailServiceSource.includes('khôi phục mật khẩu: " + resetCode') &&
      safeSmtpFailure.error.includes('App Password') &&
      !safeSmtpFailure.error.includes('secret detail'),
    'TC-EMAIL-09: Luồng quên mật khẩu không làm lộ OTP hoặc chi tiết SMTP'
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

  const hostileHtml = emailService.buildCustomHtmlEmail({
    title: '<img src=x onerror=alert(1)>',
    body: '<script>alert(1)</script> [button: Bấm vào | javascript:alert(1)] [link: Tài liệu | https://example.com/docs]',
    actionText: '<b>Mở hệ thống</b>',
    actionUrl: 'javascript:alert(1)',
    documentUrl: 'https://example.com/guide',
    footerText: '<svg onload=alert(1)>',
  });
  assert(
    !hostileHtml.includes('<script>') &&
      !hostileHtml.includes('javascript:') &&
      hostileHtml.includes('&lt;script&gt;') &&
      hostileHtml.includes('https://example.com/docs') &&
      hostileHtml.includes('https://example.com/guide'),
    'TC-EMAIL-12: Nội dung mail escape HTML và loại bỏ link javascript nguy hiểm'
  );

  const inlineImage = 'data:image/png;base64,' + Buffer.from('safe-image').toString('base64');
  const extracted = emailService.__test.extractInlineDataImages(`<img src="${inlineImage}">`);
  assert(
    extracted.html.includes('cid:inline_image_0@etoffice') &&
      extracted.attachments.length === 1 &&
      extracted.attachments[0].content.toString() === 'safe-image',
    'TC-EMAIL-13: Ảnh chọn từ thiết bị được chuyển thành CID attachment khi gửi Gmail'
  );

  assert(
    emailService.__test.sanitizeEmailSubject('Thông báo\r\nBcc: attacker@example.com') === 'Thông báo Bcc: attacker@example.com',
    'TC-EMAIL-14: Tiêu đề email loại bỏ CRLF chống chèn header'
  );

  const customModalSource = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/components/CustomEmailModal.jsx'),
    'utf8'
  );
  assert(
    emailsPageSource.includes('DOMPurify.sanitize') &&
      emailsPageSource.includes('__html: safePreviewHtml') &&
      customModalSource.includes('DOMPurify.sanitize') &&
      customModalSource.includes('__html: safePreviewHtml'),
    'TC-EMAIL-15: Cả hai màn hình xem trước email đều sanitize HTML trước khi render'
  );

  const envExampleSource = fs.readFileSync(
    path.resolve(__dirname, '../../.env.example'),
    'utf8'
  );
  assert(
    envExampleSource.includes('BREVO_API_KEY=') &&
      envExampleSource.includes('BREVO_SENDER_EMAIL=') &&
      envExampleSource.includes('EMAIL_LOGO_URL=') &&
      !emailsPageSource.includes('Gmail SMTP') &&
      !customModalSource.includes('Gmail SMTP'),
    'TC-EMAIL-15.1: Cấu hình và giao diện phản ánh đúng provider Brevo HTTPS'
  );

  const brandedHtml = emailService.buildCustomHtmlEmail({
    title: 'Thông báo',
    body: '[button: Mở hệ thống | https://example.com]',
  });
  assert(
    brandedHtml.includes('Kiến trúc ET') &&
      brandedHtml.includes('7 P. Nguyễn Thị Định, Trung Hoà, Cầu Giấy, Hà Nội') &&
      brandedHtml.includes('#596168') &&
      !brandedHtml.includes('#6366f1') &&
      !brandedHtml.includes('#4f46e5'),
    'TC-EMAIL-16: Mẫu email đồng bộ graphite và có địa chỉ trụ sở mới 7 P. Nguyễn Thị Định'
  );

  const customFooterHtml = emailService.buildCustomHtmlEmail({
    title: 'Thông báo mới',
    body: 'Nội dung thông báo',
    companyAddress: 'Tòa nhà Landmark 81, TP.HCM',
    footerNote: 'Ghi chú chân trang riêng của phòng ban.',
    companyName: 'ET Architecture Studio',
  });
  assert(
    customFooterHtml.includes('Tòa nhà Landmark 81, TP.HCM') &&
      customFooterHtml.includes('Ghi chú chân trang riêng của phòng ban.') &&
      customFooterHtml.includes('ET Architecture Studio'),
    'TC-EMAIL-17: Cho phép tùy biến toàn diện địa chỉ công ty và ghi chú chân trang email'
  );

  const settingsPageSource = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/SettingsPage.jsx'),
    'utf8'
  );
  assert(
    settingsPageSource.includes('company_address') &&
      settingsPageSource.includes('email_footer_note') &&
      emailsPageSource.includes('companyAddress') &&
      emailsPageSource.includes('footerNote') &&
      customModalSource.includes('companyAddress') &&
      customModalSource.includes('footerNote'),
    'TC-EMAIL-18: Giao diện Cài đặt và Soạn thảo email đều hỗ trợ cấu hình & chỉnh sửa footer linh hoạt'
  );
}

module.exports = runEmailSecurityTests;
