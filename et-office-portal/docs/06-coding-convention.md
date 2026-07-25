# Coding Convention
## ET Office Portal

---

## 1. Naming Convention

| Đối tượng | Convention | Ví dụ |
|---|---|---|
| Component (React) | PascalCase, file trùng tên component | `CheckInButton.tsx` |
| Hook | camelCase, prefix `use` | `useCheckIn.ts` |
| Service | camelCase, suffix `Service` | `attendanceService.ts` |
| Type/Interface | PascalCase, không prefix `I` | `Employee`, `AttendanceRecord` |
| Enum-like union type | PascalCase cho type, string literal thường | `type WorkflowStatus = "draft" \| "submitted" \| ...` |
| Constant | UPPER_SNAKE_CASE cho hằng số cấu hình tĩnh (không đổi runtime) | `MAX_EXPLANATION_HOURS = 72` |
| Firestore field | camelCase (khớp `02-database-schema.md`) | `employeeId`, `checkInTime` |
| CSS variable / token | kebab-case, prefix `--color-`/`--space-` | `--color-primary` |
| Route path | kebab-case | `/attendance/timesheet` |
| Cloud Function | camelCase, động từ + đối tượng | `closeMonthlyAttendance` |

---

## 2. Cấu trúc thư mục — quy tắc bắt buộc khi thêm module mới

Mỗi module mới trong `modules/` **bắt buộc** có tối thiểu:
```
modules/<tên-module>/
├── pages/        # 1 file = 1 route
├── components/   # component chỉ dùng trong module này
├── hooks/        # data-fetching hooks (TanStack Query) riêng module
├── services/     # gọi Firestore/Cloud Functions, KHÔNG gọi trực tiếp trong component/hook
└── types/        # type riêng module (nếu dùng chung → đưa lên shared/types)
```
- Component dùng ở ≥2 module → chuyển vào `shared/components/`.
- Không import chéo trực tiếp giữa 2 module (vd `attendance` import thẳng component nội bộ của `projects`) — nếu cần chia sẻ, đưa lên `shared/` hoặc tạo public API (`index.ts` export những gì module cho phép dùng ngoài).

---

## 3. Quy tắc viết Service Layer

```ts
// ❌ KHÔNG làm trong component
const snap = await getDocs(collection(db, "attendance"));

// ✅ Luôn qua service
// services/attendanceService.ts
export async function getAttendanceHistory(employeeId: string, limit = 7) {
  const q = query(
    collection(db, "attendance"),
    where("employeeId", "==", employeeId),
    orderBy("date", "desc"),
    limitToLast(limit)
  );
  return getDocs(q);
}

// hooks/useAttendanceHistory.ts
export function useAttendanceHistory(employeeId: string) {
  return useQuery({
    queryKey: ["attendance", "history", employeeId],
    queryFn: () => getAttendanceHistory(employeeId),
  });
}
```
Lý do: tách service giúp đổi nguồn dữ liệu (vd thêm cache layer, đổi cấu trúc query) mà không sửa component; đồng thời dễ viết unit test cho service độc lập.

---

## 4. TypeScript

- `strict: true` bắt buộc trong `tsconfig.json`.
- Không dùng `any` — dùng `unknown` + type guard nếu chưa rõ kiểu (vd dữ liệu từ Google Sheet trước khi validate).
- Mọi Firestore document đọc về phải qua converter (`withConverter`) để có type ngay từ query, không ép kiểu (`as Employee`) tùy tiện.
- Type nghiệp vụ quan trọng (enum trạng thái, role...) đặt tại `shared/types/` để mọi module tham chiếu cùng 1 nguồn, tránh lệch định nghĩa.

---

## 5. React Conventions

- Component functional + hooks, không dùng class component.
- Props luôn có type tường minh, không dùng `React.FC` (gây khó khi có `children` optional) — dùng function declaration + type props riêng.
- Tách logic phức tạp (>1 `useEffect` phối hợp nhiều state) ra custom hook riêng, component chỉ lo render.
- Không gọi Cloud Function callable trực tiếp trong `onClick` — luôn qua hook dùng `useMutation` (TanStack Query) để có loading/error state chuẩn, hiển thị toast nhất quán.

---

## 6. Commit Convention (Conventional Commits)

```
<type>(<scope>): <mô tả ngắn>

[body nếu cần]
[footer: BREAKING CHANGE / closes #issue]
```

| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa lỗi |
| `refactor` | Đổi cấu trúc code, không đổi hành vi |
| `style` | Chỉ đổi format/style code, không đổi logic |
| `docs` | Chỉ sửa tài liệu (`docs/`) |
| `chore` | Cấu hình, dependency, build script |
| `test` | Thêm/sửa test |
| `perf` | Tối ưu hiệu năng |

**Scope** = tên module: `feat(attendance): thêm nút check-in`, `fix(projects): sai số giờ OT khi aggregate`, `docs(architecture): bổ sung schema companies/offices`.

**Breaking change** (vd đổi schema Firestore cần migrate dữ liệu cũ) bắt buộc ghi rõ trong footer + tạo issue riêng theo dõi migration.

---

## 7. Branch & PR

- `main`: luôn deploy được, bảo vệ nhánh (yêu cầu PR review).
- `feature/<module>-<mô-tả-ngắn>`: vd `feature/attendance-checkin-gps`.
- PR bắt buộc: mô tả thay đổi, checklist (đã test rules emulator nếu đổi Security Rules, đã cập nhật `docs/` nếu đổi schema).

---

## 8. Testing tối thiểu bắt buộc trước khi merge module nghiệp vụ chấm công

1. Unit test cho `utils/lateRules.ts`, `utils/otCalculator.ts`, `utils/gpsDistance.ts` (thuần function, dễ test, ảnh hưởng trực tiếp tới lương).
2. Firestore Rules test (emulator) cho mọi thay đổi liên quan `attendance`/`auditLogs`.
3. Cloud Function test cho `onCheckIn`/`onCheckOut`/`closeMonthlyAttendance` với input biên (GPS null, ngày lễ, đã check-in rồi...).
