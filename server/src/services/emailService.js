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
 * Xây dựng khung giao diện Email HTML phong cách Kiến trúc Cao cấp chuẩn Logo & Branding ET Architects
 */
function buildCustomHtmlEmail({ title, body, actionText, actionUrl, documentUrl, footerText }) {
  const cleanBody = (body || "")
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong style=\"color: #0f172a; font-weight: 800;\">$1</strong>");

  let ctaSection = "";
  if (actionText && actionUrl) {
    ctaSection += '<div style="text-align: center; margin: 30px 0 18px;">' +
      '<a href="' + actionUrl + '" target="_blank" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(99,102,241,0.38); letter-spacing: -0.01em;">' +
        actionText +
      '</a>' +
    '</div>';
  }

  if (documentUrl) {
    ctaSection += '<div style="text-align: center; margin-top: 14px; margin-bottom: 22px;">' +
      '<a href="' + documentUrl + '" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; color: #4f46e5; text-decoration: none; font-size: 13.5px; font-weight: 700; background: rgba(99,102,241,0.08); padding: 9px 18px; border-radius: 999px; border: 1px solid rgba(99,102,241,0.22);">' +
        '📖 Xem Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết →' +
      '</a>' +
    '</div>';
  }

  return '<div style="background-color: #f5f4f0; padding: 36px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #dcd8cf; box-shadow: 0 18px 50px rgba(15,23,42,0.08);">' +
      '<!-- ET Architects Brand Header -->' +
      '<tr>' +
        '<td style="background: linear-gradient(135deg, #0b0f17 0%, #1e1b4b 50%, #0f172a 100%); padding: 32px 28px; text-align: center; border-bottom: 3px solid #6366f1;">' +
          '<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">' +
            '<tr>' +
              '<td style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%); width: 50px; height: 50px; border-radius: 14px; text-align: center; vertical-align: middle; box-shadow: 0 6px 20px rgba(99,102,241,0.45); border: 1px solid rgba(255,255,255,0.25);">' +
                '<span style="color: #ffffff; font-size: 21px; font-weight: 900; letter-spacing: -0.5px;">ET</span>' +
                '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; vertical-align: super; margin-left: -2px;"></span>' +
              '</td>' +
              '<td style="padding-left: 16px; text-align: left;">' +
                '<div style="color: #ffffff; font-size: 21px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1;">ET ARCHITECTS</div>' +
                '<div style="color: #a5b4fc; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px;">HỆ THỐNG QUẢN LÝ CHẤM CÔNG & NỘI BỘ</div>' +
              '</td>' +
            '</tr>' +
          '</table>' +
        '</td>' +
      '</tr>' +

      '<!-- Main Content Body -->' +
      '<tr>' +
        '<td style="padding: 34px 30px;">' +
          (title ? ('<h2 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 22px; line-height: 1.35; letter-spacing: -0.01em; border-bottom: 2px solid #f1f5f9; padding-bottom: 14px;">' + title + '</h2>') : "") +
          '<div style="font-size: 14.5px; line-height: 1.85; color: #334155;">' +
            cleanBody +
          '</div>' +
          ctaSection +
        '</td>' +
      '</tr>' +

      '<!-- Corporate Footer Signature -->' +
      '<tr>' +
        '<td style="background: #f8fafc; padding: 22px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">' +
          (footerText ? ('<div style="font-weight: 800; color: #1e293b; margin-bottom: 6px; font-size: 13px;">' + footerText + '</div>') : "") +
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

  const html = '<div style="background-color: #f5f4f0; padding: 36px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #dcd8cf; box-shadow: 0 18px 50px rgba(15,23,42,0.08);">' +
      '<!-- Header -->' +
      '<tr>' +
        '<td style="background: linear-gradient(135deg, #0b0f17 0%, #1e1b4b 50%, #0f172a 100%); padding: 28px 24px; text-align: center; border-bottom: 3px solid #6366f1;">' +
          '<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">' +
            '<tr>' +
              '<td style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%); width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle; box-shadow: 0 4px 16px rgba(99,102,241,0.4);">' +
                '<span style="color: #ffffff; font-size: 19px; font-weight: 900;">ET</span>' +
                '<span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; vertical-align: super;"></span>' +
              '</td>' +
              '<td style="padding-left: 14px; text-align: left;">' +
                '<div style="color: #ffffff; font-size: 19px; font-weight: 900; letter-spacing: -0.02em;">ET ARCHITECTS</div>' +
                '<div style="color: #a5b4fc; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 3px;">XÁC THỰC KHÔI PHỤC MẬT KHẨU</div>' +
              '</td>' +
            '</tr>' +
          '</table>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="padding: 32px 28px;">' +
          '<p style="color: #334155; font-size: 15px; line-height: 1.6; margin-top: 0;">' +
            'Xin chào <strong>' + (recipientName || "bạn") + '</strong>,' +
          '</p>' +
          '<p style="color: #475569; font-size: 14px; line-height: 1.65;">' +
            'Bạn vừa gửi yêu cầu khôi phục mật khẩu tài khoản ET Office Portal. Dưới đây là <strong>Mã xác thực OTP (6 chữ số)</strong> của bạn:' +
          '</p>' +

          '<div style="text-align: center; margin: 28px 0;">' +
            '<div style="display: inline-block; padding: 16px 36px; background: #0f172a; color: #38bdf8; font-size: 32px; font-weight: 900; letter-spacing: 8px; border-radius: 14px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; border: 2px solid #6366f1; box-shadow: 0 8px 24px rgba(99,102,241,0.28);">' +
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
