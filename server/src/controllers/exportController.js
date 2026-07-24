// controllers/exportController.js — Excel export engine using SheetJS (xlsx)
const XLSX = require('xlsx');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Request = require('../models/Request');

// GET /api/export/excel?month=7&year=2026&department_id=...
const exportAttendanceExcel = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const department_id = req.query.department_id;

    let userFilter = { is_active: true };
    if (req.user.role === 'manager') {
      userFilter.manager_id = req.user._id;
    }
    if (department_id) {
      userFilter.department_id = department_id;
    }

    const users = await User.find(userFilter)
      .select('full_name email department_id phone')
      .populate('department_id', 'name')
      .sort({ full_name: 1 });

    const userIds = users.map(u => u._id);

    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      date: { $regex: `^${monthStr}` }
    }).sort({ date: 1 });

    // Sheet 1: Tổng hợp nhân viên
    const summaryData = users.map((u, index) => {
      const recs = attendances.filter(a => a.user_id.toString() === u._id.toString());
      const presentDays = recs.filter(r => !r.is_late).length;
      const lateDays = recs.filter(r => r.is_late).length;
      const totalHours = parseFloat(recs.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
      const otHours = parseFloat(recs.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(1));
      const lateMinutes = recs.reduce((s, r) => s + (r.late_minutes || 0), 0);

      return {
        'STT': index + 1,
        'Họ và Tên': u.full_name,
        'Email': u.email,
        'Số điện thoại': u.phone || '—',
        'Phòng ban': u.department_id?.name || '—',
        'Số ngày có mặt': presentDays,
        'Số lượt muộn': lateDays,
        'Tổng phút muộn': lateMinutes,
        'Tổng giờ làm': totalHours,
        'Giờ tăng ca (OT)': otHours,
      };
    });

    // Sheet 2: Chi tiết nhật ký chấm công
    const detailData = attendances.map((a, index) => {
      const user = users.find(u => u._id.toString() === a.user_id.toString());
      return {
        'STT': index + 1,
        'Họ tên': user?.full_name || '—',
        'Phòng ban': user?.department_id?.name || '—',
        'Ngày': a.date,
        'Giờ vào': a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
        'Giờ ra': a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
        'Loại hình': a.check_in_type?.toUpperCase() || 'OFFICE',
        'Dự án / Công trình': a.project_name || '—',
        'Giờ làm (h)': a.total_hours || 0,
        'OT (h)': a.ot_hours || 0,
        'Trạng thái': a.is_late ? `Muộn ${a.late_minutes || 0}m` : 'Đúng giờ',
        'Ghi chú': a.notes || '—',
      };
    });

    // Tạo Workbook bằng XLSX
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsDetail = XLSX.utils.json_to_sheet(detailData);

    // Set độ rộng cột tự động
    wsSummary['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 16 }];
    wsDetail['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng Hợp Tháng');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi Tiết Chấm Công');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `bao-cao-cham-cong-${monthStr}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('ExportExcel error:', error);
    res.status(500).json({ error: 'Lỗi xuất file Excel.' });
  }
};

module.exports = { exportAttendanceExcel };
