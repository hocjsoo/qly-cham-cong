// models/User.js - MongoDB Schema Nhân viên (Theo mẫu thực tế ET Architects)
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    employee_code: {
      type: String, // ID tự động: NS-001, TV-001, TTS-001
      trim: true,
      unique: true,
      sparse: true,
      default: null,
    },
    employee_type: {
      type: String,
      enum: ['NS', 'TV', 'TTS'], // Nhân sự chính thức, Thử việc, Thực tập sinh
      default: 'NS',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    position: {
      type: String, // Giám đốc, PGĐ - Thi công, PGĐ - Điều hành, KTS, KTS NT - QL, KTS NT, TTS, KTS Thử Việc...
      trim: true,
      default: 'KTS',
    },
    employment_status: {
      type: String, // Đang làm việc, Đã nghỉ việc, Đang nghỉ ốm, Nghỉ thai sản, Chuyển chức vụ, Khác
      default: 'Đang làm việc',
    },
    start_year: {
      type: String, // Năm bắt đầu làm việc
      default: null,
    },
    join_date: {
      type: String, // Ngày vào công ty chính xác (YYYY-MM-DD)
      default: null,
    },
    education: {
      type: String, // Trình độ
      default: null,
    },
    role: {
      type: String,
      enum: ['admin', 'leader', 'manager', 'employee', 'staff'],
      default: 'employee',
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    department_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    manager_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    avatar_url: {
      type: String,
      default: '/logo.png',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_attendance_exempt: {
      type: Boolean, // Miễn chấm công (Ban giám đốc, Cố vấn, QTV không bắt buộc điểm danh)
      default: false,
    },
    is_duty_exempt: {
      type: Boolean, // Không tham gia lịch dọn văn phòng / nhà vệ sinh
      default: false,
    },
    can_manage_tts_schedule: {
      type: Boolean,
      default: false,
    },

    // --- Confidential HR Fields (Chỉ Admin / Giám đốc / PGĐ xem được) ---
    bhxh_code: { type: String, default: null },       // Mã số BHXH
    emergency_phone: { type: String, default: null }, // ĐT Khẩn
    dob: { type: String, default: null },             // Ngày sinh
    address_current: { type: String, default: null }, // Địa chỉ HT
    hometown: { type: String, default: null },        // Quê quán
    cccd: { type: String, default: null },            // CCCD
    bank_account: { type: String, default: null },    // Số tài khoản ngân hàng
    bank_name: { type: String, default: null },       // Ngân hàng
    license_plate: { type: String, default: null },   // Biển số xe (Legacy)
    parking_location: { type: String, default: 'Tòa 17T10 Nguyễn Thị Định' }, // Địa điểm gửi xe
    vehicle_info: { type: String, default: null },     // Mô tả xe - Biển số xe (VD: Honda Lead Đỏ - 29E1-456.78)
    driver_code: { type: String, default: null },     // Mã tài xế
    branch: { type: String, default: null },          // Chi nhánh

    // Auth & Security
    must_change_password: { type: Boolean, default: true },
    reset_token: { type: String, default: null },
    reset_token_expires: { type: Date, default: null },
    last_login_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('User', userSchema);
