// server/src/services/emailService.js
// Dịch Vụ Gửi Email Chuẩn Giao Diện Tối Graphite & Logo Kiến trúc ET — Zero-Impact Test Isolated

const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

let transporter = null;

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_SENDER_NAME = "Kiến trúc ET";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeEmailSubject(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

function getSafeHttpUrl(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  try {
    const parsed = new URL(input);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function getSafeImageUrl(value) {
  const input = String(value || '').trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(input) && input.length <= 4_000_000) {
    return input.replace(/\s+/g, '');
  }
  return getSafeHttpUrl(input);
}

function renderBodyMarkup(body) {
  const tokens = [];
  const reserveToken = html => {
    const token = `__ET_EMAIL_TOKEN_${tokens.length}__`;
    tokens.push({ token, html });
    return token;
  };

  let source = String(body || '');
  source = source.replace(/\[img:\s*([^\]]+)\]/gi, (match, url) => {
    const safeUrl = getSafeImageUrl(url);
    if (!safeUrl) return reserveToken('');
    return reserveToken(
      '<div style="text-align: center; margin: 20px 0;">' +
        '<img src="' + escapeHtml(safeUrl) + '" alt="Hình ảnh" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: inline-block; border: 1px solid #30353a;" />' +
      '</div>'
    );
  });
  source = source.replace(/\[button:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, label, url) => {
    const safeUrl = getSafeHttpUrl(url);
    if (!safeUrl) return reserveToken(escapeHtml(label.trim()));
    return reserveToken(
      '<div style="text-align: center; margin: 24px 0 16px;">' +
        '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #596168 0%, #80878d 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(76,84,91,0.32); letter-spacing: -0.01em;">' +
          escapeHtml(label.trim()) +
        '</a>' +
      '</div>'
    );
  });
  source = source.replace(/\[link:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, text, url) => {
    const safeUrl = getSafeHttpUrl(url);
    if (!safeUrl) return reserveToken(escapeHtml(text.trim()));
    return reserveToken(
      '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" style="color: #d7dadd; text-decoration: underline; font-weight: 700;">' +
        escapeHtml(text.trim()) +
      '</a>'
    );
  });

  let html = escapeHtml(source)
    .replace(/\\n/g, '<br>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 800;">$1</strong>');
  tokens.forEach(({ token, html: tokenHtml }) => {
    html = html.replace(token, tokenHtml);
  });
  return html;
}

function extractInlineDataImages(htmlContent) {
  const attachments = [];
  const html = String(htmlContent || '').replace(
    /src="data:image\/(png|jpe?g|gif|webp);base64,([a-z0-9+/=]+)"/gi,
    (match, extension, base64Data) => {
      const normalizedExtension = extension.toLowerCase() === 'jpg' ? 'jpeg' : extension.toLowerCase();
      const content = Buffer.from(base64Data, 'base64');
      if (!content.length || content.length > 3_000_000) return 'src=""';

      const cid = `inline_image_${attachments.length}@etoffice`;
      attachments.push({
        filename: `inline-image-${attachments.length + 1}.${normalizedExtension === 'jpeg' ? 'jpg' : normalizedExtension}`,
        content,
        cid,
        contentType: `image/${normalizedExtension}`,
      });
      return `src="cid:${cid}"`;
    }
  );

  return { html, attachments };
}

function normalizeSmtpPassword(pass, host) {
  const value = String(pass || '');
  return String(host || '').toLowerCase().includes('gmail.com')
    ? value.replace(/\s+/g, '')
    : value;
}

function getSafeEmailErrorMessage(error) {
  const code = String(error?.code || '').toUpperCase();
  const responseCode = Number(error?.responseCode || 0);

  if (code === 'EAUTH' || responseCode === 535) {
    return 'Gmail từ chối xác thực SMTP. Hãy kiểm tra tài khoản gửi và App Password.';
  }
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED'].includes(code)) {
    return 'Không thể kết nối máy chủ SMTP. Vui lòng thử lại sau.';
  }
  if (code === 'EENVELOPE') {
    return 'Địa chỉ email nhận không hợp lệ hoặc bị máy chủ từ chối.';
  }
  if (code === 'EMESSAGE') {
    return 'Nội dung email không hợp lệ.';
  }
  return 'Dịch vụ SMTP không khả dụng. Vui lòng thử lại sau.';
}

function buildEmailErrorResult(error) {
  transporter = null;
  return {
    sent: false,
    error: getSafeEmailErrorMessage(error),
    code: error?.code || null,
    responseCode: error?.responseCode || null,
    provider: 'smtp',
  };
}

function getSafeBrevoErrorMessage(status) {
  if (status === 400) {
    return 'Brevo từ chối yêu cầu. Hãy kiểm tra email người gửi đã xác minh và nội dung thư.';
  }
  if (status === 401 || status === 403) {
    return 'Khóa API Brevo không hợp lệ hoặc không có quyền gửi email.';
  }
  if (status === 402 || status === 429) {
    return 'Đã đạt giới hạn gửi email miễn phí của Brevo. Vui lòng thử lại sau.';
  }
  if (status >= 500) {
    return 'Dịch vụ Brevo đang tạm thời không khả dụng. Vui lòng thử lại sau.';
  }
  return 'Brevo không thể gửi email. Vui lòng kiểm tra cấu hình và thử lại.';
}

function getBrevoFailureCode(status) {
  if (status === 400) return 'BREVO_REQUEST';
  if (status === 401 || status === 403) return 'BREVO_AUTH';
  if (status === 402) return 'BREVO_QUOTA';
  if (status === 429) return 'BREVO_RATE_LIMIT';
  if (status >= 500) return 'BREVO_UNAVAILABLE';
  return 'BREVO_ERROR';
}

function buildBrevoErrorResult(status) {
  return {
    sent: false,
    error: getSafeBrevoErrorMessage(status),
    code: getBrevoFailureCode(status),
    responseCode: Number(status) || null,
    provider: 'brevo',
  };
}

function buildBrevoNetworkErrorResult(error) {
  const timedOut = error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
  return {
    sent: false,
    error: timedOut
      ? 'Kết nối Brevo quá thời gian chờ. Vui lòng thử lại sau.'
      : 'Không thể kết nối dịch vụ Brevo. Vui lòng thử lại sau.',
    code: timedOut ? 'BREVO_TIMEOUT' : 'BREVO_CONNECTION',
    responseCode: null,
    provider: 'brevo',
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

function getBrevoConfig(env = process.env) {
  const apiKey = String(env.BREVO_API_KEY || '').trim();
  const senderEmail = String(env.BREVO_SENDER_EMAIL || '').trim().toLowerCase();
  if (!apiKey || !EMAIL_PATTERN.test(senderEmail)) return null;

  const senderName = sanitizeEmailSubject(env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME).slice(0, 100) || DEFAULT_SENDER_NAME;
  const replyToEmail = String(env.BREVO_REPLY_TO_EMAIL || '').trim().toLowerCase();
  const replyToName = sanitizeEmailSubject(env.BREVO_REPLY_TO_NAME || senderName).slice(0, 100) || senderName;

  return {
    apiKey,
    sender: { email: senderEmail, name: senderName },
    replyTo: EMAIL_PATTERN.test(replyToEmail) ? { email: replyToEmail, name: replyToName } : null,
  };
}

function hasSmtpConfiguration(env = process.env) {
  const user = String(env.SMTP_USER || env.GMAIL_USER || '').trim();
  const pass = normalizeSmtpPassword(env.SMTP_PASS || env.GMAIL_APP_PASSWORD, env.SMTP_HOST || 'smtp.gmail.com');
  return Boolean(user && pass);
}

function getConfiguredEmailProvider(env = process.env) {
  if (getBrevoConfig(env)) return 'brevo';
  if (hasSmtpConfiguration(env)) return 'smtp';
  return null;
}

function getEmailLogoUrl(env = process.env) {
  const explicitUrl = getSafeHttpUrl(env.EMAIL_LOGO_URL || env.BREVO_LOGO_URL);
  if (explicitUrl && explicitUrl.startsWith('https://')) return explicitUrl;

  const frontendUrl = getSafeHttpUrl(env.FRONTEND_URL);
  if (!frontendUrl || !frontendUrl.startsWith('https://')) return null;

  try {
    return new URL('/logo.png', frontendUrl).toString();
  } catch {
    return null;
  }
}

function getAttachmentContent(attachment) {
  if (Buffer.isBuffer(attachment?.content)) return attachment.content;
  if (typeof attachment?.content === 'string') return Buffer.from(attachment.content);
  if (attachment?.path && fs.existsSync(attachment.path)) return fs.readFileSync(attachment.path);
  return null;
}

function inferAttachmentContentType(attachment) {
  if (attachment?.contentType) return String(attachment.contentType).toLowerCase();
  const extension = path.extname(String(attachment?.filename || attachment?.path || '')).toLowerCase();
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }[extension] || 'application/octet-stream';
}

function prepareBrevoContent(htmlContent, attachments = [], env = process.env) {
  let html = String(htmlContent || '');
  const apiAttachments = [];
  const logoUrl = getEmailLogoUrl(env);

  for (const attachment of attachments) {
    const content = getAttachmentContent(attachment);
    if (!content?.length) continue;

    if (attachment.cid) {
      let replacement = null;
      if (attachment.cid === 'company_logo' && logoUrl) {
        replacement = logoUrl;
      } else {
        const contentType = inferAttachmentContentType(attachment);
        if (contentType.startsWith('image/') && content.length <= 3_000_000) {
          replacement = `data:${contentType};base64,${content.toString('base64')}`;
        }
      }

      if (replacement) {
        const safeCid = String(attachment.cid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`cid:${safeCid}`, 'gi'), replacement);
      }
      if (attachment.cid !== 'company_logo') {
        apiAttachments.push({
          name: String(attachment.filename || 'inline-image.png').slice(0, 255),
          content: content.toString('base64'),
        });
      }
      continue;
    }

    apiAttachments.push({
      name: String(attachment.filename || 'attachment.bin').slice(0, 255),
      content: content.toString('base64'),
    });
  }

  return { html, attachments: apiAttachments };
}

function buildBrevoPayload({ toEmail, toName, subject, htmlContent, attachments = [] }, env = process.env) {
  const config = getBrevoConfig(env);
  const normalizedToEmail = String(toEmail || '').trim().toLowerCase();
  if (!config || !EMAIL_PATTERN.test(normalizedToEmail)) return null;

  const prepared = prepareBrevoContent(htmlContent, attachments, env);
  const safeToName = sanitizeEmailSubject(toName).slice(0, 100);
  const payload = {
    sender: config.sender,
    to: [{ email: normalizedToEmail, ...(safeToName ? { name: safeToName } : {}) }],
    subject: sanitizeEmailSubject(subject) || 'Thông báo từ Kiến trúc ET',
    htmlContent: prepared.html,
  };

  if (config.replyTo) payload.replyTo = config.replyTo;
  if (prepared.attachments.length > 0) payload.attachment = prepared.attachments;
  return payload;
}

async function sendViaBrevo(message, env = process.env, fetchImpl = globalThis.fetch) {
  const config = getBrevoConfig(env);
  const payload = buildBrevoPayload(message, env);
  if (!config || !payload) {
    return {
      sent: false,
      error: 'Brevo chưa được cấu hình đầy đủ hoặc địa chỉ email không hợp lệ.',
      code: 'BREVO_CONFIG',
      responseCode: null,
      provider: 'brevo',
    };
  }
  if (typeof fetchImpl !== 'function') {
    return {
      sent: false,
      error: 'Máy chủ hiện tại chưa hỗ trợ kết nối Brevo qua HTTPS.',
      code: 'BREVO_RUNTIME',
      responseCode: null,
      provider: 'brevo',
    };
  }

  const controller = new AbortController();
  const configuredTimeout = Number(env.BREVO_TIMEOUT_MS || 20000);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.max(5000, configuredTimeout)
    : 20000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': config.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) return buildBrevoErrorResult(response.status);

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
    console.log('✅ [EMAIL/BREVO] Đã gửi email thành công.');
    return {
      sent: true,
      provider: 'brevo',
      messageId: typeof responseBody?.messageId === 'string' ? responseBody.messageId : null,
    };
  } catch (error) {
    console.error('❌ [EMAIL/BREVO] Gửi email thất bại:', error?.name || error?.code || 'UNKNOWN');
    return buildBrevoNetworkErrorResult(error);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaSmtp({ toEmail, subject, htmlContent, attachments = [] }) {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      sent: false,
      reason: 'SMTP chưa được cấu hình.',
      code: 'SMTP_CONFIG',
      provider: 'smtp',
    };
  }

  const from = process.env.EMAIL_FROM || ('"ET Office Portal" <' + (process.env.SMTP_USER || process.env.GMAIL_USER) + '>');
  try {
    await mailer.sendMail({
      from,
      to: toEmail,
      subject: sanitizeEmailSubject(subject),
      html: htmlContent,
      attachments,
    });
    console.log('✅ [EMAIL/SMTP] Đã gửi email thành công.');
    return { sent: true, provider: 'smtp' };
  } catch (error) {
    console.error('❌ [EMAIL/SMTP] Gửi email thất bại:', error.code || error.responseCode || 'UNKNOWN');
    return buildEmailErrorResult(error);
  }
}

async function sendEmailMessage(message) {
  const provider = getConfiguredEmailProvider();
  if (provider === 'brevo') return sendViaBrevo(message);
  if (provider === 'smtp') return sendViaSmtp(message);

  const brevoKeyPresent = Boolean(String(process.env.BREVO_API_KEY || '').trim());
  return {
    sent: false,
    error: brevoKeyPresent
      ? 'Brevo chưa được cấu hình đầy đủ. Hãy bổ sung email người gửi đã xác minh.'
      : 'Dịch vụ email chưa được cấu hình.',
    code: brevoKeyPresent ? 'BREVO_CONFIG' : 'EMAIL_CONFIG',
    responseCode: null,
    provider: brevoKeyPresent ? 'brevo' : null,
  };
}

function renderTemplateVariables(templateStr, vars = {}) {
  if (!templateStr || typeof templateStr !== "string") return "";
  let result = templateStr;
  for (const [key, value] of Object.entries(vars)) {
    const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp("\\{" + safeKey + "\\}", "gi");
    result = result.replace(regex, () => (value != null ? String(value) : ""));
  }
  return result;
}

/**
 * Xây dựng khung giao diện Email HTML Chuẩn Chủ Đề Tối (Dark Cyber Slate Theme)
 */
function buildCustomHtmlEmail({ title, body, actionText, actionUrl, documentUrl, footerText }) {
  const cleanBody = renderBodyMarkup(body);
  const safeActionUrl = getSafeHttpUrl(actionUrl);
  const safeDocumentUrl = getSafeHttpUrl(documentUrl);
  const safeActionText = escapeHtml(actionText);
  const safeTitle = escapeHtml(title);
  const safeFooterText = escapeHtml(footerText);

  let ctaSection = "";
  if (safeActionText && safeActionUrl) {
    ctaSection += '<div style="text-align: center; margin: 28px 0 16px;">' +
      '<a href="' + escapeHtml(safeActionUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #596168 0%, #80878d 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(76,84,91,0.32); letter-spacing: -0.01em;">' +
        safeActionText +
      '</a>' +
    '</div>';
  }

  if (safeDocumentUrl) {
    ctaSection += '<div style="text-align: center; margin-top: 14px; margin-bottom: 20px;">' +
      '<a href="' + escapeHtml(safeDocumentUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; color: #d7dadd; text-decoration: none; font-size: 13px; font-weight: 700; background: rgba(194,199,203,0.08); padding: 9px 18px; border-radius: 10px; border: 1px solid rgba(194,199,203,0.22);">' +
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
          (safeTitle ? ('<h2 style="font-size: 18.5px; font-weight: 800; color: #f8fafc; margin: 0 0 20px; border-bottom: 1px solid #282d33; padding-bottom: 14px; line-height: 1.35; letter-spacing: -0.01em;">' + safeTitle + '</h2>') : "") +
          '<div style="font-size: 14.5px; line-height: 1.85; color: #cbd5e1;">' +
            cleanBody +
          '</div>' +
          ctaSection +
        '</td>' +
      '</tr>' +

      '<!-- Dark Footer Signature -->' +
      '<tr>' +
        '<td style="background: #111315; padding: 20px 28px; border-top: 1px solid #24282c; text-align: center; font-size: 11.5px; color: #81888e; line-height: 1.6;">' +
          (safeFooterText ? ('<div style="font-weight: 800; color: #e2e8f0; margin-bottom: 5px; font-size: 12.5px;">' + safeFooterText + '</div>') : "") +
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
  const logoPath = getLogoPath();
  const attachments = logoPath ? [{ filename: "logo.png", path: logoPath, cid: "company_logo" }] : [];
  const safeRecipientName = escapeHtml(recipientName || 'bạn');
  const safeResetCode = escapeHtml(resetCode);

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
            'Xin chào <strong>' + safeRecipientName + '</strong>,' +
          '</p>' +
          '<p style="color: #cbd5e1; font-size: 14px; line-height: 1.65;">' +
            'Bạn vừa gửi yêu cầu khôi phục mật khẩu tài khoản ET Office Portal. Dưới đây là <strong>Mã xác thực OTP (6 chữ số)</strong> của bạn:' +
          '</p>' +

          '<div style="text-align: center; margin: 28px 0;">' +
            '<div style="display: inline-block; padding: 16px 38px; background: #0f1216; color: #f8fafc; font-size: 32px; font-weight: 900; letter-spacing: 8px; border-radius: 14px; font-family: monospace; border: 2px solid #596168; box-shadow: 0 8px 26px rgba(76,84,91,0.35);">' +
              safeResetCode +
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

  return sendEmailMessage({
    toEmail,
    toName: recipientName,
    subject: '[ET Office Portal] Mã xác thực khôi phục mật khẩu',
    htmlContent: html,
    attachments,
  });
}

/**
 * Gửi email tùy chỉnh đơn lẻ (Do Admin bấm gửi thủ công)
 */
async function sendCustomEmail({ toEmail, subject, htmlContent }) {
  const logoPath = getLogoPath();
  const inlineContent = extractInlineDataImages(htmlContent);
  const attachments = [
    ...(logoPath ? [{ filename: "logo.png", path: logoPath, cid: "company_logo" }] : []),
    ...inlineContent.attachments,
  ];

  return sendEmailMessage({
    toEmail,
    subject,
    htmlContent: inlineContent.html,
    attachments,
  });
}

module.exports = {
  getTransporter,
  renderTemplateVariables,
  buildCustomHtmlEmail,
  sendCustomEmail,
  sendPasswordResetEmail,
  __test: {
    getConfiguredEmailProvider,
    getBrevoConfig,
    getEmailLogoUrl,
    prepareBrevoContent,
    buildBrevoPayload,
    buildBrevoErrorResult,
    buildBrevoNetworkErrorResult,
    sendViaBrevo,
    buildTransportOptions,
    normalizeSmtpPassword,
    getSafeEmailErrorMessage,
    buildEmailErrorResult,
    escapeHtml,
    sanitizeEmailSubject,
    getSafeHttpUrl,
    getSafeImageUrl,
    renderBodyMarkup,
    extractInlineDataImages,
  },
};
