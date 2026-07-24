-- ==============================================
-- ET OFFICE PORTAL - DATABASE SCHEMA
-- ==============================================
-- Chạy file này trong Supabase SQL Editor
-- Supabase Dashboard → SQL Editor → Paste → Run

-- Bật extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- TABLE 1: DEPARTMENTS - Phòng ban
-- ==============================================
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- TABLE 2: USERS - Nhân viên
-- ==============================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(20),
  
  -- Phân quyền: admin | manager | staff
  role            VARCHAR(20) NOT NULL DEFAULT 'staff'
                  CHECK (role IN ('admin', 'manager', 'staff')),
  
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  
  -- manager_id: nhân viên này thuộc quản lý của ai
  manager_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- TABLE 3: OFFICE_LOCATIONS - Địa điểm văn phòng
-- ==============================================
CREATE TABLE IF NOT EXISTS office_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,       -- "Văn phòng chính", "Chi nhánh HN"
  lat         DECIMAL(10, 8) NOT NULL,     -- Vĩ độ
  lng         DECIMAL(11, 8) NOT NULL,     -- Kinh độ
  radius_m    INTEGER DEFAULT 100,         -- Bán kính cho phép check-in (mét)
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- TABLE 4: ATTENDANCE - Chấm công hàng ngày
-- ==============================================
CREATE TABLE IF NOT EXISTS attendance (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  
  -- Thông tin Check-in
  check_in_time     TIMESTAMPTZ,
  check_in_lat      DECIMAL(10, 8),
  check_in_lng      DECIMAL(11, 8),
  check_in_type     VARCHAR(30)
                    CHECK (check_in_type IN ('office', 'site', 'client', 'wfh')),
                    -- office: tại VP | site: công trình | client: khách hàng | wfh: làm ở nhà
  check_in_address  TEXT,                  -- Địa chỉ (optional, reverse geocode)
  check_in_note     TEXT,                  -- Ghi chú khi check-in
  
  -- Thông tin Check-out
  check_out_time    TIMESTAMPTZ,
  check_out_lat     DECIMAL(10, 8),
  check_out_lng     DECIMAL(11, 8),
  
  -- Tổng kết
  total_hours       DECIMAL(5, 2),         -- Tự tính khi check-out
  is_late           BOOLEAN DEFAULT false, -- Đến muộn không?
  status            VARCHAR(20) DEFAULT 'present'
                    CHECK (status IN ('present', 'late', 'half_day', 'absent', 'leave')),
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ràng buộc: mỗi user chỉ có 1 bản ghi/ngày
  UNIQUE (user_id, date)
);

-- ==============================================
-- TABLE 5: REQUESTS - Đơn từ giải trình
-- ==============================================
CREATE TABLE IF NOT EXISTS requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Loại đơn
  type            VARCHAR(30) NOT NULL
                  CHECK (type IN (
                    'late',           -- Đi muộn
                    'early_leave',    -- Về sớm
                    'overtime',       -- Tăng ca (OT)
                    'business_trip',  -- Công tác
                    'sick_leave',     -- Nghỉ ốm
                    'annual_leave'    -- Nghỉ phép
                  )),
  
  -- Thời gian áp dụng
  start_date      DATE NOT NULL,
  end_date        DATE,                   -- NULL nếu chỉ 1 ngày
  start_time      TIME,                   -- Giờ bắt đầu (với OT, đi muộn...)
  end_time        TIME,                   -- Giờ kết thúc
  
  -- Nội dung đơn
  reason          TEXT NOT NULL,          -- Lý do
  attachment_url  TEXT,                   -- Link file đính kèm (Supabase Storage)
  
  -- Trạng thái duyệt
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by     UUID REFERENCES users(id),  -- Ai duyệt
  approved_at     TIMESTAMPTZ,
  reviewer_note   TEXT,                   -- Ghi chú khi duyệt/từ chối
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- INDEXES - Tối ưu query phổ biến
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_attendance_user_date 
  ON attendance(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_date 
  ON attendance(date DESC);

CREATE INDEX IF NOT EXISTS idx_requests_user_id 
  ON requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_status 
  ON requests(status) WHERE status = 'pending';

-- ==============================================
-- TRIGGER - Tự cập nhật updated_at
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- SEED DATA - Dữ liệu mẫu ban đầu
-- ==============================================

-- Phòng ban mẫu
INSERT INTO departments (name, description) VALUES
  ('Kiến trúc', 'Phòng thiết kế kiến trúc'),
  ('Kết cấu', 'Phòng thiết kế kết cấu'),
  ('Nội thất', 'Phòng thiết kế nội thất'),
  ('Kế toán', 'Phòng kế toán tài chính'),
  ('Hành chính', 'Phòng hành chính nhân sự')
ON CONFLICT DO NOTHING;

-- Vị trí văn phòng mẫu (cần thay toạ độ thật)
INSERT INTO office_locations (name, lat, lng, radius_m) VALUES
  ('Văn phòng chính', 10.7769, 106.7009, 100)
ON CONFLICT DO NOTHING;

-- Tài khoản Admin mẫu
-- Email: admin@etoffice.vn | Password: Admin@123
INSERT INTO users (email, password_hash, full_name, role) VALUES
  (
    'admin@etoffice.vn',
    '$2b$10$rBnxFvqGrLYqfLxqM2OjbO3KoQGWM5HlLvCjUJVz8EtCJVwM.pFCi',
    'Quản trị viên',
    'admin'
  )
ON CONFLICT DO NOTHING;

-- ==============================================
-- VIEWS - View tiện dụng cho dashboard
-- ==============================================

-- View: Trạng thái chấm công hôm nay của tất cả nhân viên
CREATE OR REPLACE VIEW v_today_attendance AS
SELECT 
  u.id AS user_id,
  u.full_name,
  u.email,
  u.role,
  d.name AS department_name,
  a.check_in_time,
  a.check_in_type,
  a.check_out_time,
  a.total_hours,
  a.status,
  CASE 
    WHEN a.id IS NULL THEN 'absent'           -- Chưa check-in
    WHEN a.check_out_time IS NULL THEN 'checked_in'  -- Đang làm
    ELSE 'checked_out'                         -- Đã về
  END AS today_status
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN attendance a ON a.user_id = u.id AND a.date = CURRENT_DATE
WHERE u.is_active = true
ORDER BY u.full_name;
