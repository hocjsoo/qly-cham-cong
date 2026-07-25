# ET Office Portal — Agent Rules

## Code Style
- Giữ nguyên tất cả comment và docstring hiện có khi sửa code.
- Dùng tiếng Việt cho user-facing strings (toast, error messages, labels).
- Dùng tiếng Anh cho code (variable names, function names, comments giải thích logic).
- Không dùng TypeScript — project dùng JavaScript thuần (JSX cho React components).
- Không dùng TailwindCSS — project dùng vanilla CSS với CSS variables trong `index.css`.

## Architecture Rules
- Backend: 1 controller + 1 route file cho mỗi domain (auth, attendance, request...).
- Frontend: 1 page component/file, đặt trong `client/src/pages/`.
- Shared components đặt trong `client/src/components/`.
- State management: Zustand stores trong `client/src/stores/`.
- API calls: Luôn qua `client/src/services/api.js` (Axios instance có interceptor JWT + offline fallback).
- Custom hooks: đặt trong `client/src/hooks/`.

## Role System
- Hệ thống có 3 vai trò chính: `admin`, `leader`, `employee`.
- Legacy roles `manager` và `staff` vẫn được hỗ trợ (backward compatible).
- `roleMiddleware.js` tự động map: `manager` ↔ `leader`, `staff` ↔ `employee`.
- Khi check role trong frontend, LUÔN include cả legacy values:
  - `isStaff`: check `=== 'staff' || === 'employee'`
  - `isAdminOrManager`: check `['admin', 'leader', 'manager'].includes(role)`
- Role dropdown trong form chỉ hiển thị 3 giá trị mới: `admin`, `leader`, `employee`.

## Multi-Department
- 1 user có thể thuộc nhiều phòng ban cùng lúc.
- `department_ids` (ObjectId[]) — danh sách phòng ban.
- `department_id` (ObjectId) — phòng ban chính (backward compatible, = department_ids[0]).
- Form tạo/sửa nhân viên dùng checkbox grid cho multi-select phòng ban.

## Security Rules
- Mọi route cần auth phải dùng `authMiddleware`.
- Route admin-only phải thêm `requireRole('admin')`.
- Route admin/leader phải thêm `requireRole('admin', 'manager')` — middleware tự map `leader`.
- Không bao giờ trả `password_hash` trong API response.
- GPS coordinates phải validate là số hợp lệ trước khi lưu.

## Database Rules
- Mỗi user chỉ có 1 attendance record/ngày (unique index `user_id + date`).
- `date` field luôn format `YYYY-MM-DD` (string, không phải Date object).
- Timezone luôn là `Asia/Ho_Chi_Minh` khi tính toán ngày/giờ.
- Không dùng `Date` object cho field `date` — dùng string `YYYY-MM-DD`.

## UI/UX Rules
- Mobile-first design (min-width 320px).
- Hỗ trợ dark/light theme qua `[data-theme="dark"]` CSS selector.
- Dùng `lucide-react` cho icons (line-art style, không filled).
- Toast notifications qua `react-hot-toast`.
- Loading states: dùng skeleton cards hoặc spinner.
- Empty states: dùng icon lớn + text mô tả + CTA button.
- Modals dùng class `.modal-overlay` + `.modal-sheet.animate-slide-up`.
- Confirm dialogs: dùng custom `ConfirmDialog` component (không dùng `window.confirm`).

## Performance Rules
- Tránh re-render không cần thiết — dùng `useCallback` và `useMemo` khi cần.
- API calls trong `useEffect` phải có cleanup function hoặc AbortController.
- Pagination cho lists có nhiều hơn 50 items.
- Image export dùng offscreen container với scale 3x cho chất lượng cao.

## Error Handling
- Backend: try/catch trong mọi controller function, trả `{ error: "message" }`.
- Frontend: try/catch cho mọi API call, hiển thị `toast.error()` cho user.
- Network errors: hiển thị toast kèm hướng dẫn retry.

## Git Workflow
- Commit messages viết bằng tiếng Anh, mô tả rõ thay đổi.
- Không commit `.env`, `node_modules/`, `client/dist/`.
- Build test (`npm run build`) trước mỗi commit.
