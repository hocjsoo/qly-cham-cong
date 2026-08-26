// routes/ttsSchedule.routes.js - Routes Lịch Hàng Tuần TTS & Phân Công Trực Nhật
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
  getWeeklySchedule,
  registerSchedule,
  updateDutyRoster,
  addInternToSchedule,
  removeInternFromSchedule,
} = require('../controllers/ttsScheduleController');

router.use(authMiddleware);

// GET /api/tts-schedules — Xem lịch tuần & phân công trực nhật (Tất cả nhân sự đều xem được)
router.get('/', getWeeklySchedule);

// POST /api/tts-schedules/register — Đăng ký ca làm việc (TTS hoặc Admin/Leader)
router.post('/register', registerSchedule);

// PUT /api/tts-schedules/duty-roster — Phân công trực nhật (Leader & Admin)
router.put('/duty-roster', requireRole('admin', 'manager'), updateDutyRoster);

// POST /api/tts-schedules/add-intern — Thêm TTS vào bảng (Admin & Leader)
router.post('/add-intern', requireRole('admin', 'manager'), addInternToSchedule);

// DELETE /api/tts-schedules/registration/:regId — Xóa TTS khỏi bảng tuần (Admin & Leader)
router.delete('/registration/:regId', requireRole('admin', 'manager'), removeInternFromSchedule);

module.exports = router;
