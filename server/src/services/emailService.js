// server/src/services/emailService.js
// Dịch Vụ Gửi Email Thật qua Gmail SMTP (Nodemailer) — Production Ready & Zero-Impact Test Isolated

const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (process.env.NODE_ENV === "test") return null;

  if (!transporter) {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      return null;
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

/**
 * Hàm thay thế các biến mẫu thông minh
 */
function renderTemplateVariables(templateStr, vars = {}) {
  if (!templateStr || typeof templateStr !== "string") return "";
  let result = templateStr;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp("\\{" + key + "\\}", "gi");
    result = result.replace(regex, value != null ? String(value) : "");
  }
  return result;
}

/**
 * Xây dựng khung giao diện Email HTML hoàn chỉnh chuẩn ET Architects
 */
function buildCustomHtmlEmail({ title, body, actionText, actionUrl, documentUrl, footerText }) {
  const cleanBody = (body || "")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  let ctaButtons = "";
  if (actionText && actionUrl) {
    ctaButtons += '<div style="text-align: center; margin: 24px 0 16px;">' +
      '<a href="' + actionUrl + '" target="_blank" style="display: inline-block; padding: 14px 28px; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.3);">' +
        actionText +
      '</a>' +
    '</div>';
  }

  if (documentUrl) {
    ctaButtons += '<div style="text-align: center; margin-bottom: 20px;">' +
      '<a href="' + documentUrl + '" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 13.5px; font-weight: 600;">' +
        '📖 Bấm vào đây để xem Tài Liệu Hướng Dẫn Chi Tiết →' +
      '</a>' +
    '</div>';
  }

  return '<div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px 16px; background: #f4f3ef; color: #171a1d;">' +
    '<div style="background: #ffffff; border-radius: 16px; border: 1px solid #d5d8dc; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">' +
      '<div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 26px 24px; text-align: center; color: #ffffff;">' +
        '<div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: #2563eb; color: #ffffff; font-weight: 900; font-size: 18px; margin-bottom: 8px;">ET</div>' +
        '<h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">ET ARCHITECTS</h1>' +
        '<div style="color: #94a3b8; font-size: 12px; margin-top: 4px; font-weight: 500;">HỆ THỐNG QUẢN LÝ CHẤM CÔNG & NỘI BỘ DOANH NGHIỆP</div>' +
      '</div>' +

      '<div style="padding: 28px 24px;">' +
        (title ? ('<h2 style="font-size: 18px; font-weight: 800; color: #171a1d; margin-top: 0; margin-bottom: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">' + title + '</h2>') : "") +
        '<div style="font-size: 14.5px; line-height: 1.75; color: #334155;">' +
          cleanBody +
        '</div>' +
        ctaButtons +
      '</div>' +

      '<div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11.5px; color: #64748b; line-height: 1.6; text-align: center;">' +
        (footerText ? ('<p style="margin: 0 0 6px;">' + footerText + '</p>') : "") +
        '<p style="margin: 0;"><strong>ET Architects JSC</strong> · Tòa nhà 17T10 Nguyễn Thị Định, Cầu Giấy, Hà Nội</p>' +
        '<p style="margin: 4px 0 0; color: #94a3b8;">Email được gửi tự động từ hệ thống ET Office Portal. Vui lòng không trả lời trực tiếp email này.</p>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * Gửi một email tùy chỉnh đơn lẻ
 */
async function sendCustomEmail({ toEmail, subject, htmlContent }) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log("📨 [LOCAL LOG] Gửi email tùy chỉnh tới: " + toEmail + " | Tiêu đề: " + subject);
    return { sent: false, reason: "SMTP not configured" };
  }

  const from = process.env.EMAIL_FROM || ('"ET Office Portal" <' + (process.env.SMTP_USER || process.env.GMAIL_USER) + '>');

  try {
    await mailer.sendMail({
      from,
      to: toEmail,
      subject,
      html: htmlContent,
    });
    console.log("✅ [SMTP GMAIL] Đã gửi email thành công tới: " + toEmail);
    return { sent: true };
  } catch (error) {
    console.error("❌ [SMTP ERROR] Gửi mail thất bại tới " + toEmail + ":", error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Gửi email đặt lại mật khẩu kèm mã 6 số (Reset OTP)
 */
async function sendPasswordResetEmail(toEmail, recipientName, resetCode) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log("📨 [LOCAL LOG] Mã reset mật khẩu cho " + recipientName + " (" + toEmail + "): " + resetCode);
    return { sent: false, reason: "SMTP not configured" };
  }

  const from = process.env.EMAIL_FROM || ('"ET Office Portal" <' + (process.env.SMTP_USER || process.env.GMAIL_USER) + '>');

  const html = '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0;">' +
    '<div style="text-align: center; margin-bottom: 20px;">' +
      '<h2 style="color: #0f172a; margin: 0; font-size: 20px;">ET Office Portal</h2>' +
      '<div style="color: #64748b; font-size: 13px; margin-top: 4px;">Hệ Thống Quản Lý Chấm Công Thông Minh</div>' +
    '</div>' +
    '<div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">' +
      '<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-top: 0;">' +
        'Xin chào <strong>' + (recipientName || "bạn") + '</strong>,' +
      '</p>' +
      '<p style="color: #475569; font-size: 14px; line-height: 1.6;">' +
        'Bạn vừa yêu cầu đặt lại mật khẩu đăng nhập trên hệ thống ET Office Portal. Dưới đây là mã xác thực của bạn:' +
      '</p>' +
      '<div style="text-align: center; margin: 24px 0;">' +
        '<span style="display: inline-block; padding: 14px 28px; background: #2563eb; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 6px; border-radius: 10px; font-family: monospace;">' +
          resetCode +
        '</span>' +
      '</div>' +
      '<p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-bottom: 0;">' +
        '⏳ <em>Mã xác thực có hiệu lực trong vòng <strong>30 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</em>' +
      '</p>' +
    '</div>' +
    '<div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 11px;">' +
      '© 2026 ET Architects. All rights reserved.' +
    '</div>' +
  '</div>';

  try {
    await mailer.sendMail({
      from,
      to: toEmail,
      subject: "[ET Office Portal] Mã xác thực đặt lại mật khẩu: " + resetCode,
      html,
    });
    console.log("✅ [SMTP GMAIL] Đã gửi mã reset tới: " + toEmail);
    return { sent: true };
  } catch (error) {
    console.error("❌ [SMTP ERROR] Gửi mail thất bại tới " + toEmail + ":", error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Gửi email thông báo trạng thái đơn từ (Duyệt / Từ chối)
 */
async function sendRequestStatusEmail(toEmail, recipientName, requestTitle, status, reason) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false };

  const from = process.env.EMAIL_FROM || ('"ET Office Portal" <' + (process.env.SMTP_USER || process.env.GMAIL_USER) + '>');
  const isApproved = status === "approved";
  const statusColor = isApproved ? "#16a34a" : "#dc2626";
  const statusLabel = isApproved ? "ĐÃ ĐƯỢC DUYỆT ✓" : "BỊ TỪ CHỐI ✕";

  const html = '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0;">' +
    '<div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">' +
      '<h3 style="color: #0f172a; margin-top: 0;">Thông Báo Trạng Thái Đơn Từ</h3>' +
      '<p style="color: #334155; font-size: 14px;">Xin chào <strong>' + recipientName + '</strong>,</p>' +
      '<p style="color: #475569; font-size: 14px;">' +
        'Đơn <strong>' + requestTitle + '</strong> của bạn đã được quản lý xử lý:' +
      '</p>' +
      '<div style="padding: 12px; border-radius: 8px; background: ' + (isApproved ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)") + '; color: ' + statusColor + '; font-weight: bold; text-align: center; margin: 16px 0;">' +
        statusLabel +
      '</div>' +
      (reason ? ('<p style="color: #64748b; font-size: 13px;"><em>Ghi chú: ' + reason + '</em></p>') : "") +
    '</div>' +
  '</div>';

  try {
    await mailer.sendMail({
      from,
      to: toEmail,
      subject: "[ET Office Portal] Kết quả đơn: " + requestTitle + " (" + statusLabel + ")",
      html,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

module.exports = {
  getTransporter,
  renderTemplateVariables,
  buildCustomHtmlEmail,
  sendCustomEmail,
  sendPasswordResetEmail,
  sendRequestStatusEmail,
};
