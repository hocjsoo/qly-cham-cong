// server/src/services/emailService.js
// Dịch Vụ Gửi Email Chuẩn Giao Diện Tối (Dark Cyber Slate) & Logo ET Architects — Zero-Impact Test Isolated

const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

let transporter = null;

function normalizeSmtpPassword(pass, host) {
  const value = String(pass || '');
  return String(host || '').toLowerCase().includes('gmail.com')
    ? value.replace(/\s+/g, '')
    : value;
}

function buildEmailErrorResult(error) {
  transporter = null;
  return {
    sent: false,
    error: error?.message || 'SMTP error',
    code: error?.code || null,
    responseCode: error?.responseCode || null,
  };
}

function buildTransportOptions(user, pass, env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  const secure = env.SMTP_SECURE === undefined
    ? port === 465
    : env.SMTP_SECURE === "true";

  return {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    requireTLS: !secure && port === 587,
    family: Number(env.SMTP_FAMILY || 4),
    connectionTimeout: Number(env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(env.SMTP_SOCKET_TIMEOUT_MS || 30000),
    auth: { user, pass },
    tls: { rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false" },
  };
}

function getTransporter() {
  if (process.env.NODE_ENV === "test") return null;

  if (!transporter) {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    const pass = normalizeSmtpPassword(rawPass, host);

    if (!user || !pass) {
      return null;
    }

    transporter = nodemailer.createTransport(buildTransportOptions(user, pass, {
      ...process.env,
      SMTP_HOST: host,
    }));
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
 * Xây dựng khung giao diện Email HTML Chuẩn Chủ Đề Tối (Dark Cyber Slate Theme)
 */
function buildCustomHtmlEmail({ title, body, actionText, actionUrl, documentUrl, footerText }) {
  let cleanBody = (body || "")
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong style=\"color: #ffffff; font-weight: 800;\">$1</strong>");

  // Parse [img: URL]
  cleanBody = cleanBody.replace(/\[img:\s*([^\]]+)\]/gi, (match, url) => {
    return '<div style="text-align: center; margin: 20px 0;"><img src="' + url.trim() + '" alt="Hình ảnh" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: inline-block; border: 1px solid #30353a;" /></div>';
  });

  // Parse [button: Label | URL]
  cleanBody = cleanBody.replace(/\[button:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, label, url) => {
    return '<div style="text-align: center; margin: 24px 0 16px;"><a href="' + url.trim() + '" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(99,102,241,0.4); letter-spacing: -0.01em;">' + label.trim() + '</a></div>';
  });

  // Parse [link: Text | URL]
  cleanBody = cleanBody.replace(/\[link:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, text, url) => {
    return '<a href="' + url.trim() + '" target="_blank" style="color: #818cf8; text-decoration: underline; font-weight: 700;">' + text.trim() + '</a>';
  });

  let ctaSection = "";
  if (actionText && actionUrl) {
    ctaSection += '<div style="text-align: center; margin: 28px 0 16px;">' +
      '<a href="' + actionUrl + '" target="_blank" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(99,102,241,0.4); letter-spacing: -0.01em;">' +
        actionText +
      '</a>' +
    '</div>';
  }

  if (documentUrl) {
    ctaSection += '<div style="text-align: center; margin-top: 14px; margin-bottom: 20px;">' +
      '<a href="' + documentUrl + '" target="_blank" style="display: inline-block; color: #818cf8; text-decoration: none; font-size: 13px; font-weight: 700; background: rgba(99,102,241,0.12); padding: 9px 18px; border-radius: 10px; border: 1px solid rgba(99,102,241,0.28);">' +
        '📖 Xem Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết →' +
      '</a>' +
    '</div>';
  }

  const logoPath = getLogoPath();

  return '<div style="background-color: #0b0d0e; padding: 36px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%; color: #f2f3f3;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background: #16191c; border-radius: 20px; overflow: hidden; border: 1px solid #2d3238; box-shadow: 0 20px 60px rgba(0,0,0,0.65);">' +
      '<!-- Dark Header with Logo -->' +
      '<tr>' +
        '<td style="background: linear-gradient(180deg, #181b1e 0%, #131618 100%); padding: 30px 28px 24px; text-align: center; border-bottom: 1px solid #282d33;">' +
          (logoPath ? '<img src="cid:company_logo" alt="Kiến trúc ET" style="height: 56px; max-width: 180px; object-fit: contain; display: inline-block; margin-bottom: 10px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.8)); border-radius: 8px;" />' : "") +
          '<div style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1;">Kiến trúc ET</div>' +
          '<div style="color: #81888e; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px;">HỆ THỐNG QUẢN LÝ CHẤM CÔNG & NỘI BỘ</div>' +
        '</td>' +
      '</tr>' +

      '<!-- Dark Card Body -->' +
      '<tr>' +
        '<td style="padding: 32px 30px 26px;">' +
          (title ? ('<h2 style="font-size: 18.5px; font-weight: 800; color: #f8fafc; margin: 0 0 20px; border-bottom: 1px solid #282d33; padding-bottom: 14px; line-height: 1.35; letter-spacing: -0.01em;">' + title + '</h2>') : "") +
          '<div style="font-size: 14.5px; line-height: 1.85; color: #cbd5e1;">' +
            cleanBody +
          '</div>' +
          ctaSection +
        '</td>' +
      '</tr>' +

      '<!-- Dark Footer Signature -->' +
      '<tr>' +
        '<td style="background: #111315; padding: 20px 28px; border-top: 1px solid #24282c; text-align: center; font-size: 11.5px; color: #81888e; line-height: 1.6;">' +
          (footerText ? ('<div style="font-weight: 800; color: #e2e8f0; margin-bottom: 5px; font-size: 12.5px;">' + footerText + '</div>') : "") +
          '<div><strong style="color: #cbd5e1;">Kiến trúc ET</strong> · Tòa nhà 17T10 Nguyễn Thị Định, Cầu Giấy, Hà Nội</div>' +
          '<div style="margin-top: 4px; color: #64748b; font-size: 10.5px;">Thư được gửi tự động từ hệ thống ET Office Portal. Vui lòng không trả lời trực tiếp email này.</div>' +
        '</td>' +
      '</tr>' +
    '</table>' +
  '</div>';
}

/**
 * Gửi email đặt lại mật khẩu kèm mã 6 số (Reset OTP) — DUY NHẤT ĐƯỢC GỬI TỰ ĐỘNG (Dark Theme)
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

  const html = '<div style="background-color: #0b0d0e; padding: 36px 12px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #f2f3f3;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #16191c; border-radius: 20px; overflow: hidden; border: 1px solid #2d3238; box-shadow: 0 20px 60px rgba(0,0,0,0.65);">' +
      '<!-- Header -->' +
      '<tr>' +
        '<td style="background: linear-gradient(180deg, #181b1e 0%, #131618 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid #282d33;">' +
          (logoPath ? '<img src="cid:company_logo" alt="Kiến trúc ET" style="height: 54px; max-width: 170px; object-fit: contain; display: inline-block; margin-bottom: 8px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.8)); border-radius: 6px;" />' : "") +
          '<div style="color: #ffffff; font-size: 19px; font-weight: 800; letter-spacing: -0.02em;">Kiến trúc ET</div>' +
          '<div style="color: #81888e; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 3px;">XÁC THỰC KHÔI PHỤC MẬT KHẨU</div>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="padding: 32px 28px;">' +
          '<p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin-top: 0;">' +
            'Xin chào <strong>' + (recipientName || "bạn") + '</strong>,' +
          '</p>' +
          '<p style="color: #cbd5e1; font-size: 14px; line-height: 1.65;">' +
            'Bạn vừa gửi yêu cầu khôi phục mật khẩu tài khoản ET Office Portal. Dưới đây là <strong>Mã xác thực OTP (6 chữ số)</strong> của bạn:' +
          '</p>' +

          '<div style="text-align: center; margin: 28px 0;">' +
            '<div style="display: inline-block; padding: 16px 38px; background: #0f1216; color: #38bdf8; font-size: 32px; font-weight: 900; letter-spacing: 8px; border-radius: 14px; font-family: monospace; border: 2px solid #6366f1; box-shadow: 0 8px 26px rgba(99,102,241,0.35);">' +
              resetCode +
            '</div>' +
          '</div>' +

          '<div style="background: #111417; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; font-size: 12.5px; color: #94a3b8; line-height: 1.5; border: 1px solid #23272b; border-left-width: 4px;">' +
            '⏳ Mã xác thực có hiệu lực trong vòng <strong>30 phút</strong>. Vì lý do an toàn, tuyệt đối không chia sẻ mã này cho bất kỳ ai.' +
          '</div>' +
        '</td>' +
      '</tr>' +

      '<tr>' +
        '<td style="background: #111315; padding: 18px 24px; border-top: 1px solid #24282c; text-align: center; font-size: 11px; color: #81888e;">' +
          '© 2026 Kiến trúc ET · Hệ thống Chấm công & Phân quyền Bảo mật' +
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
    return buildEmailErrorResult(error);
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
    return buildEmailErrorResult(error);
  }
}

module.exports = {
  getTransporter,
  renderTemplateVariables,
  buildCustomHtmlEmail,
  sendCustomEmail,
  sendPasswordResetEmail,
  __test: { buildTransportOptions, normalizeSmtpPassword, buildEmailErrorResult },
};
