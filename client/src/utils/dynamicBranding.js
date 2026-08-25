// src/utils/dynamicBranding.js
// Cập nhật động toàn bộ Favicon, Apple Touch Icon (iOS) và Web App Manifest (Android/PWA)
// khi Admin thay đổi Logo hoặc Tên công ty trong Cài đặt hệ thống.

let currentManifestBlobUrl = null;

export function applyDynamicBranding(companyName, logoUrl) {
  if (typeof document === 'undefined') return;

  const resolvedName = companyName || 'ET Architects';

  // 1. Cập nhật document.title
  if (document.title && !document.title.includes(resolvedName)) {
    document.title = `${resolvedName} — Chấm Công Thông Minh`;
  }

  // 2. Cập nhật Favicon (tất cả các thẻ link rel="icon" và "shortcut icon")
  const iconRels = ['icon', 'shortcut icon'];
  iconRels.forEach(rel => {
    let link = document.querySelector(`link[rel='${rel}']`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = logoUrl || '/favicon.svg';
  });

  // 3. Cập nhật Apple Touch Icon (Dành cho iOS Safari khi Add to Home Screen)
  let appleTouchLink = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleTouchLink) {
    appleTouchLink = document.createElement('link');
    appleTouchLink.rel = 'apple-touch-icon';
    document.head.appendChild(appleTouchLink);
  }
  appleTouchLink.href = logoUrl || '/apple-touch-icon.png';

  // 4. Cập nhật Dynamic Web App Manifest (Dành cho Android Chrome PWA)
  try {
    const manifestObj = {
      short_name: resolvedName,
      name: `${resolvedName} — Chấm Công Thông Minh`,
      description: `Hệ thống quản lý chấm công và nhân sự thông minh ${resolvedName}`,
      icons: logoUrl
        ? [
            { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: logoUrl, sizes: 'any', type: 'image/png', purpose: 'any maskable' },
          ]
        : [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
      start_url: '/checkin',
      background_color: '#0f172a',
      theme_color: '#6366f1',
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
