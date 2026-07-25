# ET Office Portal — Agent Rules

## Code Style
- Giữ nguyên tất cả comment và docstring hiện có khi sửa code.
- Dùng tiếng Việt cho user-facing strings (toast, error messages, labels).
- Dùng tiếng Anh cho code (variable names, function names, comments giải thích logic).
- Không dùng TypeScript — project dùng JavaScript thuần.
- Không dùng TailwindCSS — project dùng vanilla CSS với CSS variables.

## Architecture Rules
- Backend: 1 controller/route file cho mỗi domain (auth, attendance, request...).
- Frontend: 1 page component/file, đặt trong `client/src/pages/`.
- State management: Zustand stores trong `client/src/stores/`.
- API calls: Luôn qua `client/src/services/api.js` (Axios instance có interceptor JWT + offline fallback).

## Security Rules
- Mọi route cần auth phải dùng `authMiddleware`.
- Route admin-only phải thêm `roleMiddleware(['admin'])`.
- Không bao giờ trả `password_hash` trong API response.
- GPS coordinates phải validate là số hợp lệ trước khi lưu.

## Database Rules
- Mỗi user chỉ có 1 attendance record/ngày (unique index `user_id + date`).
- `date` field luôn format `YYYY-MM-DD` (string, không phải Date object).
- Timezone luôn là `Asia/Ho_Chi_Minh` khi tính toán ngày/giờ.

## UI/UX Rules
- Mobile-first design (min-width 320px).
- Hỗ trợ dark/light theme qua `[data-theme="dark"]` CSS selector.
- Dùng `lucide-react` cho icons (line-art, không filled).
- Toast notifications qua `react-hot-toast`.
- Loading states: dùng skeleton cards hoặc spinner.
- Empty states: dùng icon lớn + text mô tả + CTA button.
