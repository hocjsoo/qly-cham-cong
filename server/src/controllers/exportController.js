// controllers/exportController.js — Excel export engine (Chuẩn mẫu ET_Staff 2026)
const XLSX = require('xlsx');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

function getTimesheetSymbol(rec) {
  if (!rec) return '';
  const notes = (rec.notes || '').toUpperCase();
  if (notes.includes('CT2') || notes.includes('NƯỚC NGOÀI')) return 'CT2';
  if (notes.includes('CT1') || notes.includes('TRONG NƯỚC') || rec.check_in_type === 'site') return 'CT1';
  if (rec.check_in_type === 'wfh' || notes.includes('WFH')) return 'WFH';
  if (rec.status === 'leave' || notes.includes('NGHỈ PHÉP') || notes.includes('(P)')) return 'P';
  if (notes.includes('NGHỈ ỐM') || notes.includes('(O)')) return 'O';
  if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)')) return 'KL';
  if (notes.includes('(K)') || notes.includes('KHÁC')) return 'K';
  if (rec.total_hours >= 7.5) return 'x';
  if (rec.total_hours >= 5.5) return '0,75x';
  if (rec.total_hours >= 3.5) return '0,5x';
  if (rec.total_hours > 0) return '0,5x';
  return '';
}

// GET /api/export/excel?month=7&year=2026&department_id=...&user_id=...
const exportAttendanceExcel = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const department_id = req.query.department_id;
    const user_id = req.query.user_id;

    let userFilter = { is_active: true };
    if (req.user.role === 'manager') {
      userFilter.manager_id = req.user._id;
    }
    if (department_id) {
      userFilter.department_id = department_id;
    }
    if (user_id) {
      userFilter._id = user_id;
    }

    const users = await User.find(userFilter)
      .select('employee_code full_name position email phone department_id employment_status bhxh_code emergency_phone dob hometown cccd bank_name bank_account license_plate')
      .populate('department_id', 'name')
      .sort({ employee_code: 1, full_name: 1 });

    const userIds = users.map(u => u._id);

    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      date: { $regex: `^${monthStr}` }
    }).sort({ date: 1 });

    const daysInMonth = new Date(y, m, 0).getDate();

    // Sheet 1: Bảng Chấm Công ET_Staff chuẩn mẫu
    const summaryData = users.map((u, index) => {
      const recs = attendances.filter(a => a.user_id.toString() === u._id.toString());

      const vpDays = recs.filter(r => r.check_in_type === 'office' && !r.is_late).length;
      const ct1Days = recs.filter(r => r.check_in_type === 'site').length;
      const ct2Days = recs.filter(r => r.check_in_type === 'client').length;
      const wfhDays = recs.filter(r => r.check_in_type === 'wfh').length;
      const leaveDays = recs.filter(r => r.status === 'leave').length;

      const row = {
        'ID': u.employee_code || `NS ${String(index + 1).padStart(2, '0')}`,
        'NHÂN SỰ': u.full_name,
        'NV': u.position || 'KTS',
        'NLV tại VP': vpDays,
        'CT Trong nước': ct1Days,
        'CT Nước ngoài': ct2Days,
        'Work form home': wfhDays,
        'Nghỉ phép': leaveDays,
        'Nghỉ ốm': 0,
        'Nghỉ không lương': 0,
        'Khác': 0,
      };

      // ĐIỀN CỘT TỪNG NGÀY TRONG THÁNG (01 -> 31)
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${monthStr}-${String(d).padStart(2, '0')}`;
        const att = recs.find(a => a.date === dateKey);
        const colHeader = String(d).padStart(2, '0');
        row[colHeader] = getTimesheetSymbol(att);
      }

      return row;
    });

    // Sheet 2: Danh sách thông tin nhân sự (Cho Admin / Ban Giám Đốc)
    const staffInfoData = users.map((u, index) => ({
      'STT': index + 1,
      'ID': u.employee_code || `NS ${String(index + 1).padStart(2, '0')}`,
      'HỌ TÊN': u.full_name,
      'CHỨC VỤ': u.position || 'KTS',
      'PHÒNG BAN': u.department_id?.name || '—',
      'TRẠNG THÁI': u.employment_status || 'Đang làm việc',
      'SĐT': u.phone || '—',
      'EMAIL': u.email,
      'NGÀY SINH': u.dob || '—',
      'QUÊ QUÁN': u.hometown || '—',
      'CCCD': u.cccd || '—',
      'MÃ BHXH': u.bhxh_code || '—',
      'NGÂN HÀNG': u.bank_name || '—',
      'STK': u.bank_account || '—',
      'BIỂN SỐ XE': u.license_plate || '—',
    }));

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsStaff = XLSX.utils.json_to_sheet(staffInfoData);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Chấm Công ET_Staff');
    XLSX.utils.book_append_sheet(wb, wsStaff, 'Thông Tin Nhân Sự');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `ET_Staff_ChamCong_${monthStr}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('ExportExcel error:', error);
    res.status(500).json({ error: 'Lỗi xuất file Excel.' });
  }
};

module.exports = { exportAttendanceExcel };
