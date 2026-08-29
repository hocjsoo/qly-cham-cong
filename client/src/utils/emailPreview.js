const EMAIL_THEME = {
  background: '#0b0d0e',
  card: '#16191c',
  cardBorder: '#2d3238',
  headerStart: '#181b1e',
  headerEnd: '#131618',
  divider: '#282d33',
  text: '#f2f3f3',
  textSecondary: '#cbd5e1',
  textMuted: '#81888e',
  accentStart: '#596168',
  accentEnd: '#80878d',
  accentText: '#d7dadd',
};

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getSafeHttpUrl = value => {
  const input = String(value || '').trim();
  if (!input) return null;
  try {
    const parsed = new URL(input);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const getSafeImageUrl = value => {
  const input = String(value || '').trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(input) && input.length <= 4_000_000) {
    return input.replace(/\s+/g, '');
  }
  return getSafeHttpUrl(input);
};

const renderVariables = (template, variables) => {
  let output = String(template || '');
  for (const [key, value] of Object.entries(variables || {})) {
    const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\{${safeKey}\\}`, 'gi'), String(value ?? ''));
  }
  return output;
};

const renderBodyMarkup = body => {
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
  source = source.replace(/\[button:\s*([^|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, label, url) => {
    const safeUrl = getSafeHttpUrl(url);
    if (!safeUrl) return reserveToken(escapeHtml(label.trim()));
    return reserveToken(
      '<div style="text-align: center; margin: 24px 0 16px;">' +
        '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ' + EMAIL_THEME.accentStart + ' 0%, ' + EMAIL_THEME.accentEnd + ' 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(76,84,91,0.32); letter-spacing: -0.01em;">' +
          escapeHtml(label.trim()) +
        '</a>' +
      '</div>'
    );
  });
  source = source.replace(/\[link:\s*([^|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, text, url) => {
    const safeUrl = getSafeHttpUrl(url);
    if (!safeUrl) return reserveToken(escapeHtml(text.trim()));
    return reserveToken(
      '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" style="color: ' + EMAIL_THEME.accentText + '; text-decoration: underline; font-weight: 700;">' +
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
};

export const renderEmailPreviewHtml = ({
  subject,
  body,
  actionText,
  actionUrl,
  documentUrl,
  footerText,
  companyAddress = '7 P. Nguyễn Thị Định, Trung Hoà, Cầu Giấy, Hà Nội',
  footerNote = 'Thư được gửi tự động từ hệ thống ET Office Portal.',
  companyName = 'Kiến trúc ET',
  variables,
  logoUrl = '/logo.png',
}) => {
  const renderedSubject = renderVariables(subject, variables);
  const renderedBody = renderVariables(body, variables);
  const renderedActionText = renderVariables(actionText, variables);
  const renderedActionUrl = renderVariables(actionUrl, variables);
  const renderedDocumentUrl = renderVariables(documentUrl, variables);
  const renderedFooterText = renderVariables(footerText, variables);
  const renderedCompanyAddress = renderVariables(companyAddress || '7 P. Nguyễn Thị Định, Trung Hoà, Cầu Giấy, Hà Nội', variables);
  const renderedFooterNote = renderVariables(footerNote || 'Thư được gửi tự động từ hệ thống ET Office Portal.', variables);
  const renderedCompanyName = renderVariables(companyName || 'Kiến trúc ET', variables);

  const safeSubject = escapeHtml(renderedSubject);
  const safeBody = renderBodyMarkup(renderedBody);
  const safeActionText = escapeHtml(renderedActionText);
  const safeActionUrl = getSafeHttpUrl(renderedActionUrl);
  const safeDocumentUrl = getSafeHttpUrl(renderedDocumentUrl);
  const safeFooterText = escapeHtml(renderedFooterText);
  const safeCompanyAddress = escapeHtml(renderedCompanyAddress);
  const safeFooterNote = escapeHtml(renderedFooterNote);
  const safeCompanyName = escapeHtml(renderedCompanyName);
  const safeLogoUrl = getSafeImageUrl(logoUrl) || '/logo.png';

  let actions = '';
  if (safeActionText && safeActionUrl) {
    actions += '<div style="text-align: center; margin: 28px 0 16px;">' +
      '<a href="' + escapeHtml(safeActionUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, ' + EMAIL_THEME.accentStart + ' 0%, ' + EMAIL_THEME.accentEnd + ' 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(76,84,91,0.32); letter-spacing: -0.01em;">' +
        safeActionText +
      '</a>' +
    '</div>';
  }

  if (safeDocumentUrl) {
    actions += '<div style="text-align: center; margin: 14px 0 20px;">' +
      '<a href="' + escapeHtml(safeDocumentUrl) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; color: ' + EMAIL_THEME.accentText + '; text-decoration: none; font-size: 13px; font-weight: 700; background: rgba(194,199,203,0.08); padding: 9px 18px; border-radius: 10px; border: 1px solid rgba(194,199,203,0.22);">' +
        '📖 Xem Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết →' +
      '</a>' +
    '</div>';
  }

  return '<div style="background-color: ' + EMAIL_THEME.background + '; padding: 24px 8px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; border-radius: 14px; color: ' + EMAIL_THEME.text + ';">' +
    '<div style="max-width: 560px; margin: 0 auto; background: ' + EMAIL_THEME.card + '; border-radius: 18px; overflow: hidden; border: 1px solid ' + EMAIL_THEME.cardBorder + '; box-shadow: 0 20px 60px rgba(0,0,0,0.65);">' +
      '<div style="background: linear-gradient(180deg, ' + EMAIL_THEME.headerStart + ' 0%, ' + EMAIL_THEME.headerEnd + ' 100%); padding: 28px 22px 22px; text-align: center; border-bottom: 1px solid ' + EMAIL_THEME.divider + ';">' +
        '<img src="' + escapeHtml(safeLogoUrl) + '" alt="' + safeCompanyName + '" style="height: 54px; max-width: 180px; object-fit: contain; display: inline-block; margin-bottom: 8px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.8)); border-radius: 8px;" />' +
        '<div style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1;">' + safeCompanyName + '</div>' +
        '<div style="color: ' + EMAIL_THEME.textMuted + '; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px;">HỆ THỐNG QUẢN LÝ CHẤM CÔNG & NỘI BỘ</div>' +
      '</div>' +
      '<div style="padding: 28px 24px;">' +
        (safeSubject ? '<h2 style="font-size: 18px; font-weight: 800; color: #f8fafc; margin: 0 0 18px; border-bottom: 1px solid ' + EMAIL_THEME.divider + '; padding-bottom: 12px; line-height: 1.35;">' + safeSubject + '</h2>' : '') +
        '<div style="font-size: 14.5px; line-height: 1.85; color: ' + EMAIL_THEME.textSecondary + ';">' + safeBody + '</div>' +
        actions +
      '</div>' +
      '<div style="background: #111315; padding: 18px 24px; border-top: 1px solid #24282c; text-align: center; font-size: 11.5px; color: ' + EMAIL_THEME.textMuted + '; line-height: 1.6;">' +
        (safeFooterText ? '<div style="font-weight: 800; color: #e2e8f0; margin-bottom: 4px; font-size: 12.5px;">' + safeFooterText + '</div>' : '') +
        '<div><strong style="color: #cbd5e1;">' + safeCompanyName + '</strong> · ' + safeCompanyAddress + '</div>' +
        '<div style="margin-top: 4px; color: #64748b; font-size: 10.5px;">' + safeFooterNote + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
};
