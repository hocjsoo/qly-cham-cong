# Design System
## ET Office Portal — Blueprint / Architecture Theme

Ngôn ngữ thiết kế: tối giản, kỹ thuật, đáng tin cậy — tham chiếu Notion / Linear / Autodesk Construction Cloud / Arc Browser, phù hợp công ty kiến trúc. Toàn bộ token dưới đây **không hard-code trong component**, load từ `settings/theme` (xem `00-architecture.md` mục 8.3) và ánh xạ vào CSS variables.

---

## 1. Màu sắc (Design Token)

| Token | Vai trò | Light | Dark | Ghi chú |
|---|---|---|---|---|
| `--color-primary` | Hành động chính, active state | Xanh navy đậm (lấy chuẩn từ kientrucet.com) | Xanh navy sáng hơn | Nút CHECK IN, link active |
| `--color-secondary` | Nhấn phụ, badge | Xanh cyan nhạt | Xanh cyan | GPS badge trong bán kính |
| `--color-neutral-50…900` | Nền, border, text | Thang xám trắng→đen | Thang xám đen→trắng | Không dùng đen/trắng tuyệt đối |
| `--color-success` | Đúng giờ, duyệt | Xanh lá | Xanh lá sáng | |
| `--color-warning` | Muộn nhẹ/muộn | Vàng/Cam | Vàng/Cam | 2 sắc độ khác nhau cho "muộn nhẹ" vs "muộn" |
| `--color-danger` | Muộn nhiều, từ chối, lỗi | Đỏ | Đỏ sáng | |
| `--color-holiday` | Nền ô ngày lễ trên Calendar | Tím nhạt | Tím đậm | Mục 6 & 11 trong yêu cầu bổ sung |

**Nguyên tắc**: mọi màu trạng thái chấm công (mục 12 trong prompt gốc) ánh xạ cố định:
```
Đúng giờ      → success
Muộn nhẹ      → warning (nhạt)
Muộn          → warning (đậm)
Muộn nhiều    → danger
```

---

## 2. Typography

| Vai trò | Font | Size scale |
|---|---|---|
| Heading (H1–H4) | Sans hiện đại, gọn nét (kiểu Inter/Söhne) — cân nhắc 1 font có chút nét kỹ thuật nếu đồng bộ được với logo | 32/24/20/16px |
| Body | Cùng họ Inter, weight 400/500 | 14/16px |
| Số liệu lớn (StatCard) | Weight 600–700, tabular-nums (số thẳng hàng khi đổi) | 28–36px |
| Mono (nếu cần hiển thị mã NV, ID) | JetBrains Mono hoặc tương đương | 13px |

Font load từ `settings/theme.fontHeading`/`fontBody` — cho phép đổi mà không deploy lại.

---

## 3. Spacing & Layout

- Grid spacing theo bội số 4px (Tailwind mặc định: `1=4px, 2=8px, 4=16px...`).
- Sidebar width: 240px (desktop), thu gọn 64px (icon only).
- Content max-width: không giới hạn cứng cho bảng (Timesheet cần rộng), nhưng form/detail giới hạn `max-w-2xl` để dễ đọc.
- Border radius nhỏ: `4px` (input, badge), `8px` (card) — **không** dùng bo tròn lớn kiểu app tiêu dùng.
- Border: `1px solid var(--color-neutral-200)` (light) — ưu tiên border mảnh thay vì shadow đậm, đúng tinh thần "bản vẽ kỹ thuật".

---

## 4. Iconography

- Bộ icon dạng line (outline), không filled — dùng `lucide-react` (đã sẵn trong stack Artifacts, đồng nhất được style).
- Kích thước chuẩn: 16px (inline text), 20px (button), 24px (nav/sidebar).
- Icon trạng thái chấm công: gợi ý `Clock` (đúng giờ), `ClockAlert`/`AlertTriangle` (muộn), `Home` (WFH), `HardHat`/`Building2` (đi công trình), `Plane` (nghỉ phép).

---

## 5. Component Guidelines

### StatCard (Dashboard)
- Icon line-art 24px góc trên trái, số lớn (weight 700) chính giữa, label nhỏ dưới, delta (↑↓ so hôm qua) màu success/danger.
- **Clickable variant** (mục 9): toàn bộ card là `<button>`/`<Link>`, hover có border đổi màu `primary` + cursor pointer, không cần thêm nút "Xem chi tiết" riêng — cả card là 1 target bấm.

### Badge trạng thái (StatusPill)
- Pill nhỏ, bo góc 4px, nền nhạt + chữ đậm cùng tông (không nền đặc + chữ trắng, giữ phong cách nhẹ nhàng).
- Mapping: `on_time→success`, `slightly_late→warning-light`, `late→warning`, `very_late→danger`, `wfh→secondary`, `site_visit/business_trip→neutral-dark`.

### Timesheet Grid
- Header sticky, cột tên sticky, ô có nền màu theo trạng thái ở mức **nhạt 10–15% opacity** (để chữ ký hiệu vẫn đọc rõ), không tô đặc.

### Calendar View (mục 10–11)
- Ô ngày: số ngày góc trên trái, ký hiệu công góc dưới, dot màu nhỏ nếu có ghi chú (giải trình/daily report).
- Ngày lễ: nền `--color-holiday`, icon nhỏ (cờ hoặc sao) + tooltip tên ngày lễ, disable click Check In/Out mặc định.

### Activity Feed (mục 7)
- List item dạng: avatar nhỏ (24px) — tên — hành động (badge nhỏ) — thời gian tương đối ("2 phút trước"). Item mới nhất có hiệu ứng fade-in nhẹ (Framer Motion), không dùng âm thanh/rung.

### Command Palette (mục 8, ⌘K)
- Modal trung tâm, input lớn ở trên, kết quả nhóm theo loại (Trang / Nhân sự / Dự án), phím mũi tên điều hướng, `Enter` để chọn — chuẩn UX kiểu Linear/Raycast.

### Birthday / Anniversary Widget (mục 12–13)
- Card nhỏ trong Dashboard, avatar + tên + icon bánh sinh nhật/cúp, không chiếm nhiều diện tích, ẩn hoàn toàn nếu hôm nay không có ai (không hiện card rỗng).

---

## 6. Motion (mục 17 — Framer Motion, dùng tiết chế)

| Vị trí | Hiệu ứng | Duration |
|---|---|---|
| Chuyển trang | fade + slide nhẹ (8px) | 150–200ms |
| StatCard load | stagger fade-in từng card | 50ms delay/card |
| Toast | slide-in từ góc phải | 200ms |
| Modal/Dialog | scale nhẹ (0.98→1) + fade | 150ms |
| Activity Feed item mới | fade-in, không bounce | 200ms |

**Nguyên tắc**: không có hiệu ứng nào >300ms, không dùng easing "bouncy/elastic" — giữ cảm giác công cụ làm việc nghiêm túc, không phải app giải trí.

---

## 7. Dark Mode

- Toàn bộ token có cặp light/dark tương ứng (bảng mục 1), chuyển qua CSS variable + class `.dark` trên `<html>` (chuẩn Tailwind `darkMode: "class"`).
- Mặc định theo hệ điều hành lúc đầu, lưu lựa chọn user vào `localStorage` (chỉ preference UI, không phải data — không vi phạm nguyên tắc "không dùng localStorage làm database").
