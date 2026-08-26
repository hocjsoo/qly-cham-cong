// server/src/services/emailService.js
// Dịch Vụ Gửi Email Chuẩn Thương Hiệu ET Architects qua Gmail SMTP (Nodemailer) — Zero-Impact Test Isolated

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
 * Xây dựng khung giao diện Email HTML phong cách Kiến trúc Cao cấp (ET Architectural Workspace Template)
 */
function buildCustomHtmlEmail({ title, body, actionText, actionUrl, documentUrl, footerText }) {
  const cleanBody = (body || "")
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong style=\"color: #0f172a; font-weight: 750;\">$1</strong>");

  let ctaSection = "";
  if (actionText && actionUrl) {
    ctaSection += '<div style="text-align: center; margin: 28px 0 16px;">' +
      '<a href="' + actionUrl + '" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 12px; box-shadow: 0 6px 20px rgba(37,99,235,0.35); letter-spacing: -0.01em;">' +
        actionText +
      '</a>' +
    '</div>';
  }

  if (documentUrl) {
    ctaSection += '<div style="text-align: center; margin-top: 14px; margin-bottom: 20px;">' +
      '<a href="' + documentUrl + '" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; color: #2563eb; text-decoration: none; font-size: 13.5px; font-weight: 600; background: rgba(37,99,235,0.08); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(37,99,235,0.2);">' +
        '📖 Xem Tài Liệu Hướng Dẫn Chi Tiết →' +
      '</a>' +
    '</div>';
  }

  return '<div style="background-color: #f1f0eb; padding: 32px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #dcdad1; box-shadow: 0 16px 48px rgba(0,0,0,0.08);">' +
      '<!-- Brand Header Banner -->' +
      '<tr>' +
        '<td style="background: linear-gradient(145deg, #111418 0%, #1a1f26 100%); padding: 32px 28px; text-align: center; border-bottom: 3px solid #2563eb;">' +
          '<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">' +
            '<tr>' +
              '<td style="background: #2563eb; width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: 900; font-size: 19px; box-shadow: 0 4px 14px rgba(37,99,235,0.4);">ET</td>' +
              '<td style="padding-left: 14px; text-align: left;">' +
                '<div style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1;">ET ARCHITECTS</div>' +
                '<div style="color: #94a3b8; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 4px;">Hệ Thống Quản Lý Nội Bộ & Chấm Công</div>' +
              '</td>' +
            '</tr>' +
          '</table>' +
        '</td>' +
      '</tr>' +

      '<!-- Main Content Body -->' +
      '<tr>' +
        '<td style="padding: 32px 30px;">' +
          (title ? ('<h2 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 20px; line-height: 1.35; letter-spacing: -0.01em; border-bottom: 2px solid #f1f5f9; padding-bottom: 14px;">' + title + '</h2>') : "") +
          '<div style="font-size: 14.5px; line-height: 1.8; color: #334155;">' +
            cleanBody +
          '</div>' +
          ctaSection +
        '</td>' +
      '</tr>' +

      '<!-- Corporate Footer Signature -->' +
      '<tr>' +
        '<td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">' +
          (footerText ? ('<div style="font-weight: 700; color: #334155; margin-bottom: 6px; font-size: 12.5px;">' + footerText + '</div>') : "") +
          '<div><strong>Công ty Cổ phần Kiến trúc ET</strong> · Tòa nhà 17T10 Nguyễn Thị Định, Cầu Giấy, Hà Nội</div>' +
          '<div style="margin-top: 4px; color: #94a3b8; font-size: 11px;">Thư được gửi tự động từ hệ thống ET Office Portal. Vui lòng không trả lời trực tiếp email này.</div>' +
        '</td>' +
      '</tr>' +
    '</table>' +
  '</div>';
}

/**
 * Gửi email đặt lại mật khẩu kèm mã 6 số (Reset OTP) — DUY NHẤT ĐƯỢC GỬI TỰ ĐỘNG
 */
async function sendPasswordResetEmail(toEmail, recipientName, resetCode) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log("📨 [LOCAL LOG] Mã reset mật khẩu cho " + recipientName + " (" + toEmail + "): " + resetCode);
    return { sent: false, reason: "SMTP not configured" };
  }

  const from = process.env.EMAIL_FROM || ('"ET Office Portal" <' + (process.env.SMTP_USER || process.env.GMAIL_USER) + '>');

  const html = '<div style="background-color: #f1f0eb; padding: 32px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #dcdad1; box-shadow: 0 16px 48px rgba(0,0,0,0.08);">' +
      '<tr>' +
        '<td style="background: linear-gradient(145deg, #111418 0%, #1a1f26 100%); padding: 26px 24px; text-align: center; border-bottom: 3px solid #2563eb;">' +
          '<div style="display: inline-block; width: 40px; height: 40px; line-height: 40px; border-radius: 10px; background: #2563eb; color: #ffffff; font-weight: 900; font-size: 17px; margin-bottom: 6px;">ET</div>' +
          '<div style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.02em;">ET ARCHITECTS</div>' +
          '<div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">XÁC THỰC KHÔI PHỤC MẬT KHẨU</div>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="padding: 30px 28px;">' +
          '<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-top: 0;">' +
            'Xin chào <strong>' + (recipientName || "bạn") + '</strong>,' +
          '</p>' +
          '<p style="color: #475569; font-size: 14px; line-height: 1.6;">' +
            'Bạn vừa gửi yêu cầu khôi phục mật khẩu tài khoản ET Office Portal. Dưới đây là <strong>Mã xác thực OTP (6 chữ số)</strong> của bạn:' +
          '</p>' +

          '<div style="text-align: center; margin: 28px 0;">' +
            '<div style="display: inline-block; padding: 16px 36px; background: #0f172a; color: #38bdf8; font-size: 32px; font-weight: 900; letter-spacing: 8px; border-radius: 14px; font-family: monospace; border: 2px solid #2563eb; box-shadow: 0 8px 24px rgba(37,99,235,0.25);">' +
              resetCode +
            '</div>' +
          '</div>' +

          '<div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; font-size: 12.5px; color: #64748b; line-height: 1.5;">' +
            '⏳ Mã xác thực có hiệu lực trong vòng <strong>30 phút</strong>. Vì lý do an toàn, tuyệt đối không chia sẻ mã này cho bất kỳ ai.' +
          '</div>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="background: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">' +
          '© 2026 ET Architects JSC · Hệ thống Chấm công & Phân quyền Bảo mật' +
        '</td>' +
      '</tr>' +
    '</table>' +
  '</div>';

  try {
    await mailer.sendMail({
      from,
      to: toEmail,
      subject: "[ET Office Portal] Mã xác thực khôi phục mật khẩu: " + resetCode,
      html,
    });
    console.log("✅ [SMTP GMAIL] Đã gửi mã OTP tới: " + toEmail);
    return { sent: true };
  } catch (error) {
    console.error("❌ [SMTP ERROR] Gửi mã OTP thất bại tới " + toEmail + ":", error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Gửi email tùy chỉnh đơn lẻ (Do Admin bấm gửi thủ công)
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
    console.log("✅ [SMTP GMAIL] Đã gửi email tùy chỉnh thành công tới: " + toEmail);
    return { sent: true };
  } catch (error) {
    console.error("❌ [SMTP ERROR] Gửi mail thất bại tới " + toEmail + ":", error.message);
    return { sent: false, error: error.message };
  }
}

module.exports = {
  getTransporter,
  renderTemplateVariables,
  buildCustomHtmlEmail,
  sendCustomEmail,
  sendPasswordResetEmail,
};
