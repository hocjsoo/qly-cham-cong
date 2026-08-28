// src/utils/dynamicBranding.js
// Cập nhật động toàn bộ Favicon, Apple Touch Icon (iOS) và Web App Manifest (Android/PWA)
// khi Admin thay đổi Logo hoặc Tên công ty trong Cài đặt hệ thống.

let currentManifestBlobUrl = null;

export const DEFAULT_COMPANY_NAME = 'Kiến trúc ET';
export const DEFAULT_COMPANY_LOGO_URL = '/logo.png';

const LEGACY_COMPANY_NAMES = new Set([
  'ET Architects',
  'Công ty Cổ phần Kiến trúc ET',
]);

export function normalizeCompanyName(companyName) {
  const resolvedName = typeof companyName === 'string' ? companyName.trim() : '';
  if (!resolvedName || LEGACY_COMPANY_NAMES.has(resolvedName)) return DEFAULT_COMPANY_NAME;
  return resolvedName;
}

export function applyDynamicBranding(companyName, logoUrl) {
  if (typeof document === 'undefined') return;

  const resolvedName = normalizeCompanyName(companyName);
  const resolvedLogoUrl = logoUrl || DEFAULT_COMPANY_LOGO_URL;

  // 1. Cập nhật document.title
  document.title = `${resolvedName} — Chấm Công Thông Minh`;

  let themeColorMeta = document.querySelector("meta[name='theme-color']");
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = '#17191b';

  // 2. Cập nhật Favicon (tất cả các thẻ link rel="icon" và "shortcut icon")
  const iconRels = ['icon', 'shortcut icon'];
  iconRels.forEach(rel => {
    let link = document.querySelector(`link[rel='${rel}']`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = resolvedLogoUrl;
  });

  // 3. Cập nhật Apple Touch Icon (Dành cho iOS Safari khi Add to Home Screen)
  let appleTouchLink = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleTouchLink) {
    appleTouchLink = document.createElement('link');
    appleTouchLink.rel = 'apple-touch-icon';
    document.head.appendChild(appleTouchLink);
  }
  appleTouchLink.href = resolvedLogoUrl;

  // 4. Cập nhật Dynamic Web App Manifest (Dành cho Android Chrome PWA)
  try {
    const manifestObj = {
      short_name: resolvedName,
      name: `${resolvedName} — Chấm Công Thông Minh`,
      description: `Hệ thống quản lý chấm công và nhân sự thông minh ${resolvedName}`,
      icons: resolvedLogoUrl
        ? [
            { src: resolvedLogoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: resolvedLogoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: resolvedLogoUrl, sizes: 'any', type: 'image/png', purpose: 'any maskable' },
          ]
        : [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
      start_url: '/checkin',
      background_color: '#101214',
      theme_color: '#17191b',
      display: 'standalone',
      orientation: 'portrait',
    };

    if (currentManifestBlobUrl) {
      URL.revokeObjectURL(currentManifestBlobUrl);
    }

    const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/json' });
    currentManifestBlobUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector("link[rel='manifest']");
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = currentManifestBlobUrl;
  } catch (e) {
    console.warn('Could not generate dynamic web manifest:', e);
  }
}
