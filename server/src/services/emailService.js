// server/src/services/emailService.js
// Dịch Vụ Gửi Email Chuẩn Giao Diện ET Architects Portal qua Gmail SMTP — Zero-Impact Test Isolated

const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

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

function getLogoPath() {
  const p1 = path.resolve(__dirname, "../../../client/public/logo.png");
  const p2 = path.resolve(__dirname, "../../../293413875_460767742721671_8147407730308205969_n.png");
  if (fs.existsSync(p1)) return p1;
  if (fs.existsSync(p2)) return p2;
  return null;
}

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
 * Xây dựng khung Email HTML chuẩn giao diện Web Portal ET Architects (Thanh lịch, đồng bộ 100%)
 */
function buildCustomHtmlEmail({ title, body, actionText, actionUrl, documentUrl, footerText }) {
  let cleanBody = (body || "")
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong style=\"color: #0f172a; font-weight: 750;\">$1</strong>");

  // Parse [img: URL]
  cleanBody = cleanBody.replace(/\[img:\s*([^\]]+)\]/gi, (match, url) => {
    return '<div style="text-align: center; margin: 18px 0;"><img src="' + url.trim() + '" alt="Hình ảnh" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); display: inline-block; border: 1px solid #e2e8f0;" /></div>';
  });

  // Parse [button: Label | URL]
  cleanBody = cleanBody.replace(/\[button:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, label, url) => {
    return '<div style="text-align: center; margin: 22px 0 14px;"><a href="' + url.trim() + '" target="_blank" style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.25);">' + label.trim() + '</a></div>';
  });

  // Parse [link: Text | URL]
  cleanBody = cleanBody.replace(/\[link:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, text, url) => {
    return '<a href="' + url.trim() + '" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">' + text.trim() + '</a>';
  });

  let ctaSection = "";
  if (actionText && actionUrl) {
    ctaSection += '<div style="text-align: center; margin: 26px 0 14px;">' +
      '<a href="' + actionUrl + '" target="_blank" style="display: inline-block; padding: 13px 30px; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14.5px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.25);">' +
        actionText +
      '</a>' +
    '</div>';
  }

  if (documentUrl) {
    ctaSection += '<div style="text-align: center; margin-top: 10px; margin-bottom: 18px;">' +
      '<a href="' + documentUrl + '" target="_blank" style="display: inline-block; color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600; background: rgba(37,99,235,0.06); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(37,99,235,0.18);">' +
        '📖 Xem Tài Liệu Hướng Dẫn Chi Tiết →' +
      '</a>' +
    '</div>';
  }

  const logoPath = getLogoPath();

  return '<div style="background-color: #f4f3ef; padding: 28px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #d5d8dc; box-shadow: 0 10px 32px rgba(35,39,41,0.06);">' +
      '<!-- Header Matching Web Portal -->' +
      '<tr>' +
        '<td style="background: #ffffff; padding: 26px 28px 20px; text-align: center; border-bottom: 1px solid #e7eaee;">' +
          (logoPath ? '<img src="cid:company_logo" alt="ET Architects" style="height: 52px; max-width: 170px; object-fit: contain; display: inline-block; margin-bottom: 10px;" />' : "") +
          '<div style="color: #171a1d; font-size: 19px; font-weight: 800; letter-spacing: -0.02em;">Kiến trúc ET</div>' +
          '<div style="color: #5e676f; font-size: 12px; font-weight: 600; margin-top: 3px;">Hệ Thống Quản Lý Chấm Công & Nội Bộ</div>' +
        '</td>' +
      '</tr>' +

      '<!-- Body Content -->' +
      '<tr>' +
        '<td style="padding: 28px 28px 24px;">' +
          (title ? ('<h2 style="font-size: 18px; font-weight: 800; color: #171a1d; margin: 0 0 18px; border-bottom: 1px solid #e7eaee; padding-bottom: 12px; line-height: 1.35;">' + title + '</h2>') : "") +
          '<div style="font-size: 14px; line-height: 1.8; color: #3e464c;">' +
            cleanBody +
          '</div>' +
          ctaSection +
        '</td>' +
      '</tr>' +

      '<!-- Clean Corporate Footer -->' +
      '<tr>' +
        '<td style="background: #f8f7f2; padding: 18px 24px; border-top: 1px solid #e7eaee; text-align: center; font-size: 11.5px; color: #5e676f; line-height: 1.6;">' +
          (footerText ? ('<div style="font-weight: 700; color: #171a1d; margin-bottom: 4px; font-size: 12px;">' + footerText + '</div>') : "") +
          '<div><strong>Kiến trúc ET</strong> · Tòa nhà 17T10 Nguyễn Thị Định, Cầu Giấy, Hà Nội</div>' +
          '<div style="margin-top: 3px; color: #8c959d; font-size: 10.5px;">Thư được gửi tự động từ hệ thống ET Office Portal. Vui lòng không trả lời trực tiếp email này.</div>' +
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
  const logoPath = getLogoPath();
  const attachments = logoPath ? [{ filename: "logo.png", path: logoPath, cid: "company_logo" }] : [];

  const html = '<div style="background-color: #f4f3ef; padding: 28px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #d5d8dc; box-shadow: 0 10px 32px rgba(35,39,41,0.06);">' +
      '<!-- Header -->' +
      '<tr>' +
        '<td style="background: #ffffff; padding: 24px 24px 18px; text-align: center; border-bottom: 1px solid #e7eaee;">' +
          (logoPath ? '<img src="cid:company_logo" alt="ET Architects" style="height: 48px; max-width: 160px; object-fit: contain; display: inline-block; margin-bottom: 8px;" />' : "") +
          '<div style="color: #171a1d; font-size: 18px; font-weight: 800;">Kiến trúc ET</div>' +
          '<div style="color: #5e676f; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 2px;">XÁC THỰC KHÔI PHỤC MẬT KHẨU</div>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="padding: 26px 26px 22px;">' +
          '<p style="color: #171a1d; font-size: 14.5px; line-height: 1.6; margin-top: 0;">' +
            'Xin chào <strong>' + (recipientName || "bạn") + '</strong>,' +
          '</p>' +
          '<p style="color: #3e464c; font-size: 13.5px; line-height: 1.65;">' +
            'Bạn vừa gửi yêu cầu khôi phục mật khẩu tài khoản ET Office Portal. Dưới đây là <strong>Mã xác thực OTP (6 chữ số)</strong> của bạn:' +
          '</p>' +

          '<div style="text-align: center; margin: 24px 0;">' +
            '<div style="display: inline-block; padding: 14px 32px; background: rgba(37,99,235,0.08); color: #2563eb; font-size: 30px; font-weight: 800; letter-spacing: 6px; border-radius: 12px; font-family: monospace; border: 1.5px solid rgba(37,99,235,0.3);">' +
              resetCode +
            '</div>' +
          '</div>' +

          '<div style="background: #f8f7f2; border-left: 3px solid #d97706; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #5e676f; line-height: 1.5;">' +
            '⏳ Mã xác thực có hiệu lực trong vòng <strong>30 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.' +
          '</div>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="background: #f8f7f2; padding: 16px 20px; border-top: 1px solid #e7eaee; text-align: center; font-size: 11px; color: #8c959d;">' +
          '© 2026 Kiến trúc ET · Hệ thống Chấm công Thông minh' +
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
      attachments,
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
  const logoPath = getLogoPath();
  const attachments = logoPath ? [{ filename: "logo.png", path: logoPath, cid: "company_logo" }] : [];

  try {
    await mailer.sendMail({
      from,
      to: toEmail,
      subject,
      html: htmlContent,
      attachments,
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
