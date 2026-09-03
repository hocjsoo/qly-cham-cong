// src/pages/HistoryPage.jsx
// Lịch sử chấm công — Xem theo Tuần / Tháng / Năm, Chế độ Lịch Ô (Calendar Grid View), Xem Chi Tiết Ngày, Admin Override

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, Clock, AlertTriangle, List, Table2, Download, Edit2, X, LayoutGrid, Info, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import useSettingsStore from '../stores/settingsStore';
import HeaderActions from '../components/HeaderActions';
import { downloadBlob } from '../utils/downloadBlob';

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
};

const addMinsToTime = (timeStr, mins) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const newH = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const newM = String(total % 60).padStart(2, '0');
  return `${newH}:${newM}`;
};

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const TYPE_MAP = {
  office: '🏢 Văn phòng', site: '🏗️ Công trình', client: '👔 Khách hàng', wfh: '🏠 WFH',
};
const TYPE_SHORT = { office: 'VP', site: 'CT', client: 'KH', wfh: 'WFH' };
const HOLIDAY_WORK_MULTIPLIERS = [1.5, 2, 3];
const normalizeHolidayMultiplier = value => (
  HOLIDAY_WORK_MULTIPLIERS.includes(Number(value)) ? Number(value) : 1.5
);
const formatHolidayWorkSymbol = value => {
  const multiplier = normalizeHolidayMultiplier(value);
  return multiplier === 1.5 ? '1,5x' : `${multiplier}x`;
};

// Ký hiệu bảng chấm công chuẩn theo mẫu ET_Staff 2026
const TIMESHEET_SYMBOLS = [
  { code: 'x', label: 'Đủ công (1.0)', color: 'var(--green)' },
  { code: '0.75x', label: '3/4 công', color: 'var(--green)' },
  { code: '0.5x', label: '1/2 công', color: 'var(--yellow)' },
  { code: '1,5x', label: 'Ngày lễ (1.5)', color: 'var(--holiday-work)' },
  { code: '2x', label: 'Ngày lễ (2.0)', color: 'var(--holiday-work)' },
  { code: '3x', label: 'Ngày lễ (3.0)', color: 'var(--holiday-work)' },
  { code: 'CT1', label: 'CT Trong nước', color: 'var(--blue)' },
  { code: 'CT2', label: 'CT Nước ngoài', color: 'var(--blue)' },
  { code: 'WFH', label: 'Work form home', color: 'var(--primary)' },
  { code: 'P', label: 'Nghỉ phép', color: 'var(--purple, #8b5cf6)' },
  { code: 'O', label: 'Nghỉ ốm', color: 'var(--red)' },
  { code: 'KL', label: 'Nghỉ không lương', color: 'var(--text-muted)' },
  { code: 'K', label: 'Khác', color: 'var(--text-muted)' },
];

function getTimesheetSymbol(rec) {
  if (!rec) return '—';
  if (HOLIDAY_WORK_MULTIPLIERS.includes(Number(rec.work_units))) return formatHolidayWorkSymbol(rec.work_units);
  if (rec.check_in_type === 'wfh') return 'WFH';
  if (rec.check_in_type === 'site') return 'CT1';
  if (rec.check_in_type === 'client') return 'CT2';
  if (rec.status === 'leave' || rec.notes?.includes('Nghỉ phép')) return 'P';
  if (rec.work_units === 0.75) return '0.75x';
  if (rec.work_units === 0.5 || rec.status === 'half_day') return '0.5x';
  if (rec.total_hours <= 4) return '0.5x';
  if (rec.total_hours >= 6 && rec.total_hours < 7.5) return '0.75x';
  return 'x';
}

export default function HistoryPage() {
  const { user } = useAuthStore();
  const storedSettings = useSettingsStore(state => state.settings);
  const isAdmin = user?.role === 'admin';
  const isAdminOrManager = ['admin', 'leader', 'manager'].includes(user?.role);

  const now = new Date();
  const [timeMode, setTimeMode] = useState('month'); // 'week' | 'month' | 'year'
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (Lịch ô) | 'list' | 'table'

  // Selected Day Detail Modal
  const [selectedDayDate, setSelectedDayDate] = useState('');

  // Admin Override Modal
  const [overrideRecord, setOverrideRecord] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ check_in_time: '', check_out_time: '', is_late: false, is_overnight_checkout: false, notes: '' });
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Holidays list & modal management
  const [holidays, setHolidays] = useState([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ id: null, name: '', date: '', end_date: '', work_multiplier: 1.5, note: '' });
  const [submittingHoliday, setSubmittingHoliday] = useState(false);

  // Policy Info Card Toggle
  const [showPolicy, setShowPolicy] = useState(false);

  // Admin Staff Selector
  const [staffList, setStaffList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Settings for dynamic working hours & late rules (Default 09:00 - 18:30)
  const settings = storedSettings || {
    work_start_time: '09:00',
    work_end_time: '18:30',
    ot_start_time: '18:30',
    minor_late_mins: 30,
    medium_late_mins: 60,
  };

  const startTime = settings?.work_start_time || '09:00';
  const endTime = settings?.work_end_time || '18:30';
  const minorLateTime = addMinsToTime(startTime, settings?.minor_late_mins ?? 30);
  const fetchHolidays = useCallback(() => {
    api.get(`/holidays?year=${year}`).then(r => setHolidays(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [year]);

  const holidayByDate = useMemo(() => {
    const lookup = new Map();
    holidays.forEach(holiday => {
      const start = new Date(`${holiday.date}T00:00:00Z`);
      const end = new Date(`${holiday.end_date || holiday.date}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;
      let daysMapped = 0;
      for (let cursor = start; cursor <= end && daysMapped < 370; cursor = new Date(cursor.getTime() + 86400000)) {
        lookup.set(cursor.toISOString().slice(0, 10), holiday);
        daysMapped += 1;
      }
    });
    return lookup;
  }, [holidays]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleOpenCreateHoliday = (dateStr) => {
    setHolidayForm({ id: null, name: '', date: dateStr, end_date: dateStr, work_multiplier: 1.5, note: '' });
    setShowHolidayModal(true);
  };

  const handleOpenEditHoliday = (hObj) => {
    setHolidayForm({ id: hObj._id, name: hObj.name, date: hObj.date, end_date: hObj.end_date || hObj.date, work_multiplier: normalizeHolidayMultiplier(hObj.work_multiplier), note: hObj.note || '' });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.name || !holidayForm.date) {
      toast.error('Vui lòng nhập tên ngày lễ và ngày bắt đầu');
      return;
    }
    const workMultiplier = Number(holidayForm.work_multiplier);
    if (!HOLIDAY_WORK_MULTIPLIERS.includes(workMultiplier)) {
      toast.error('Hệ số công ngày lễ không hợp lệ');
      return;
    }
    setSubmittingHoliday(true);
    try {
      const payload = {
        name: holidayForm.name,
        date: holidayForm.date,
        end_date: holidayForm.end_date || holidayForm.date,
        work_multiplier: workMultiplier,
        note: holidayForm.note,
      };
      if (holidayForm.id) {
        await api.put(`/holidays/${holidayForm.id}`, payload);
      } else {
        await api.post('/holidays', payload);
      }
      toast.success('Đã cập nhật ngày nghỉ lễ & phát thông báo toàn công ty! 🎉');
      setShowHolidayModal(false);
      fetchHolidays();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi lưu ngày nghỉ lễ');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa ngày nghỉ lễ này?')) return;
    try {
      await api.delete(`/holidays/${id}`);
      toast.success('Đã xóa ngày nghỉ lễ');
      setSelectedDayDate('');
      fetchHolidays();
    } catch {
      toast.error('Lỗi xóa ngày nghỉ lễ');
    }
  };

  useEffect(() => {
    if (isAdminOrManager) {
      api.get('/users').then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.users || []);
        setStaffList(list);
      }).catch(() => {});
    }
  }, [isAdminOrManager]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const userParam = selectedUserId ? `&user_id=${selectedUserId}` : '';
      const { data: d } = await api.get(`/attendance/history?month=${month}&year=${year}&mode=${timeMode}${userParam}`);
      setData(d);
    } catch { toast.error('Lỗi tải lịch sử'); }
    finally { setLoading(false); }
  }, [month, selectedUserId, timeMode, year]);

  useEffect(() => { load(); }, [load]);

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const exportCSV = () => {
    if (!records.length) { toast.error('Không có dữ liệu để xuất'); return; }
    const rows = [
      ['Ngày', 'Vào', 'Ra', 'Loại', 'Giờ làm', 'Tăng ca', 'Trạng thái', 'Ghi chú'],
      ...records.map(r => [
        r.date || '—',
        fmt(r.check_in_time),
        fmt(r.check_out_time),
        TYPE_SHORT[r.check_in_type] || '—',
        r.total_hours || 0,
        r.ot_hours || 0,
        r.is_late ? 'Muộn' : 'Đúng giờ',
        r.notes || '—',
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `cham-cong-${year}-${String(month).padStart(2,'0')}.csv`);
    toast.success('Đã xuất CSV!');
  };

  const extractVNTime = (isoOrDate) => {
    if (!isoOrDate) return '';
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false
    });
  };

  const adjustTimeString = (timeStr, deltaMinutes) => {
    if (!timeStr) timeStr = '09:00';
    const parts = timeStr.split(':').map(Number);
    let totalMins = (parts[0] || 0) * 60 + (parts[1] || 0) + deltaMinutes;
    if (totalMins < 0) totalMins = 0;
    if (totalMins > 23 * 60 + 59) totalMins = 23 * 60 + 59;
    const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const computeLiveSummary = (inTime, outTime, workEndTime = '18:30', otStartTime = '18:30', isOvernightCheckout = false) => {
    if (!inTime || !outTime) return null;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + inM;
    let outMins = outH * 60 + outM;
    if (isOvernightCheckout) {
      outMins += 24 * 60; // Ca làm việc xuyên đêm sang ngày hôm sau (+1 ngày)
    }
    if (outMins <= inMins) return { totalHours: 0, otHours: 0 };
    const diffMins = outMins - inMins;
    const totalHours = parseFloat((diffMins / 60).toFixed(1));

    const [otH, otM] = (otStartTime || '18:30').split(':').map(Number);
    const otStartMins = otH * 60 + otM;
    let otHours = 0;
    if (outMins > otStartMins) {
      otHours = parseFloat(((outMins - otStartMins) / 60).toFixed(2));
    }
    return { totalHours, otHours };
  };

  const handleOpenOverride = (rec) => {
    setOverrideRecord(rec);
    const inTime = extractVNTime(rec.check_in_time) || '09:00';
    const outTime = extractVNTime(rec.check_out_time) || '18:30';
    const isOvernight = Boolean(rec.is_overnight || rec.is_overnight_checkout);
    setOverrideForm({
      date: rec.date || (rec.check_in_time ? new Date(rec.check_in_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''),
      check_in_time: inTime,
      check_out_time: outTime,
      check_in_type: rec.check_in_type || 'office',
      is_late: Boolean(rec.is_late),
      is_overnight_checkout: isOvernight,
      notes: rec.notes || 'Đã sửa bởi Admin',
    });
  };

  const handleSaveOverride = async () => {
    if (!overrideRecord) return;
    setSubmittingOverride(true);
    try {
      await api.put(`/attendance/override/${overrideRecord._id}`, overrideForm);
      toast.success('Đã điều chỉnh bản ghi chấm công thành công! ✅');
      setOverrideRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi điều chỉnh bản ghi');
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleDeleteAttendance = async (recordId, dateStr) => {
    const confirmMsg = dateStr
      ? `XÓA BẢN GHI CHẤM CÔNG NGÀY ${dateStr}?\n\nSau khi xóa, nhân viên sẽ có thể thực hiện chấm công lại từ đầu!`
      : `XÓA BẢN GHI CHẤM CÔNG NÀY?\n\nNhân viên sẽ có thể thực hiện chấm công lại!`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const { data: resData } = await api.delete(`/attendance/${recordId}`);
      toast.success(resData.message || 'Đã xóa bản ghi chấm công thành công!');
      setSelectedDayDate('');
      setOverrideRecord(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi khi xóa bản ghi chấm công');
    }
  };

  const s = data?.summary || {};
  const records = data?.records || [];
  const workDays = s.total_days || 22;
  const presentRate = workDays > 0 ? Math.round((s.present_days || 0) / workDays * 100) : 0;

  // Build Calendar Grid Days Matrix
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const startOffset = (firstDayOfWeek + 6) % 7; // Convert 0=Sun to Monday-first (0=Mon, 6=Sun)

  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push({ blank: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayRecs = records.filter(r => (r.date === dateStr || r.check_in_time?.startsWith(dateStr)));
    calendarDays.push({ day: d, dateStr, records: dayRecs, record: dayRecs[0] || null });
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Lịch sử chấm công</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {records.length > 0 && (
              <button onClick={exportCSV} className="btn btn--ghost" style={{ padding: '6px 10px', fontSize: '12px' }}>
                <Download size={14} /> CSV
              </button>
            )}
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setViewMode('grid')}
                title="Giao diện Lịch Ô"
                style={{
                  background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                  border: 'none', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Danh sách thẻ"
                style={{
                  background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                  border: 'none', color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Bảng chi tiết"
                style={{
                  background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                  border: 'none', color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <Table2 size={14} />
              </button>
            </div>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Admin Employee Selector Dropdown */}
        {isAdminOrManager && (
          <div className="card" style={{ marginBottom: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              👤 XEM LỊCH SỬ CHẤM CÔNG CỦA NHÂN VIÊN (DÀNH CHO ADMIN / QUẢN LÝ)
            </div>
            <select
              className="form-input"
              style={{ fontSize: '13px', padding: '8px 12px' }}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">-- Cá nhân tôi ({user?.full_name}) --</option>
              {staffList.filter(s => (s._id || s.id) !== (user?._id || user?.id)).map(s => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.full_name} ({s.employee_code || 'NV'}) - {s.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Time Mode Chips */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {[
            { key: 'month', label: '📊 Xem theo Tháng (Lịch Ô)' },
            { key: 'year', label: '🗓️ Xem theo Năm (12 Tháng)' },
          ].map(t => (
            <button key={t.key} onClick={() => setTimeMode(t.key)} className={`chip${timeMode === t.key ? ' active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Month Navigation */}
        <div className="card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '12px', padding: '10px 14px',
        }}>
          <button onClick={prev} className="theme-toggle-btn" style={{ width: '32px', height: '32px' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{MONTHS[month - 1]}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Năm {year}</div>
          </div>
          <button onClick={next} className="theme-toggle-btn" style={{ width: '32px', height: '32px' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Attendance Calculation & Late Policy Banner */}
        <div className="card" style={{ marginBottom: '14px', padding: '12px 14px', background: 'var(--bg-card)', borderLeft: '4px solid var(--primary)' }}>
          <div
            onClick={() => setShowPolicy(!showPolicy)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                📌 Quy định tính công & Đi muộn (Kiến trúc ET)
              </span>
            </div>
            <button className="btn btn--ghost" style={{ padding: '2px 6px', fontSize: '11px', gap: '4px', color: 'var(--primary)' }}>
              {showPolicy ? <>Thu gọn <ChevronUp size={14} /></> : <>Xem quy định <ChevronDown size={14} /></>}
            </button>
          </div>

          {showPolicy && (
            <div className="animate-fade-in" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', fontSize: '12px', lineHeight: 1.5 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {/* Rule 1: Working hours */}
                <div style={{ background: 'var(--bg-raised)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>
                    ⏰ Giờ Làm Việc Quy Định
                  </div>
                  <div>• Ca ngày: <strong>{startTime} – {endTime}</strong> (Tính <strong>x 1.0 công</strong>)</div>
                  <div>• Tăng ca (OT): <strong>Tính từ {endTime} trở đi</strong> (ghi nhận giờ làm thêm để công ty xem xét khen thưởng).</div>
                </div>

                {/* Rule 2: Late rules */}
                <div style={{ background: 'var(--bg-raised)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--yellow)', marginBottom: '4px' }}>
                    ⚠️ Quy Định Các Mức Đi Muộn
                  </div>
                  <div>• <strong>≤ {startTime}</strong>: Đúng giờ (Tính đủ 1.0 công <code>x</code>)</div>
                  <div>• <strong>{addMinsToTime(startTime, 1)} – {minorLateTime}</strong>: Muộn nhẹ (Tính đủ công)</div>
                  <div>• <strong>&gt; {minorLateTime}</strong>: Muộn quá 30p (Tính <strong>0.75 công</strong>, trừ 0.25c nếu không có giải trình)</div>
                </div>

                {/* Rule 3: Leave & Explanation */}
                <div style={{ background: 'var(--bg-raised)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--green)', marginBottom: '4px' }}>
                    🏖️ Nghỉ Lễ & Đơn Từ Giải Trình
                  </div>
                  <div>• Ngày nghỉ lễ: Nghỉ theo quy định lịch nhà nước / công ty.</div>
                  <div>• Đơn đi muộn / WFH / công tác được duyệt ➔ <strong>Tính đủ 1.0 công (<code>x</code>) & phục hồi 100% công lao động</strong>!</div>
                </div>
              </div>

              {/* Official 10 Attendance Symbols Legend Grid */}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)' }}>
                <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '8px', fontSize: '13px' }}>
                  📋 Bảng Ký Hiệu Chấm Công Quy Định (ET Staff):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--green)' }}>x</strong> : Đủ công (1.0)
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--green)' }}>0,75x</strong> : 3/4 công
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--yellow)' }}>0,5x</strong> : 1/2 công
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--primary)' }}>CT1</strong> : CT Trong nước
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: '#8b5cf6' }}>CT2</strong> : CT Nước ngoài
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--blue)' }}>WFH</strong> : Làm tại nhà
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--green)' }}>P</strong> : Nghỉ phép
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--yellow)' }}>O</strong> : Nghỉ ốm
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text-muted)' }}>KL</strong> : Nghỉ không lương
                  </div>
                  <div style={{ background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>K</strong> : Khác
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '68px', borderRadius: '12px' }} />)}
          </div>
        ) : timeMode === 'year' ? (
          /* YEAR DRILLDOWN VIEW: 12 Month Cards */
          <div className="animate-fade-in">
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              TỔNG QUAN 12 THÁNG NĂM {year} (Bấm vào tháng bất kỳ để xem chi tiết Lịch Ô)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {(data?.months || []).map((mObj) => (
                <button
                  key={mObj.month}
                  onClick={() => {
                    setMonth(mObj.month);
                    setTimeMode('month');
                  }}
                  className="card"
                  style={{
                    padding: '14px 10px', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.15s', border: '1px solid var(--border)',
                    background: mObj.total_days > 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                    {mObj.label}
                  </div>
                  {mObj.total_days > 0 ? (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)' }}>
                        ✓ {mObj.present_days} ngày đi làm
                      </div>
                      {mObj.late_days > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--yellow)', marginTop: '2px' }}>
                          ⚠️ {mObj.late_days} lượt muộn
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {mObj.total_hours}h làm {mObj.ot_hours > 0 && `(+${mObj.ot_hours}h OT)`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chưa có ca làm</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Quick Summary Card */}
            <div className="card" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Thống kê nhanh {MONTHS[month - 1]}</span>
                <span style={{
                  fontSize: '20px', fontWeight: 700,
                  color: presentRate >= 90 ? 'var(--green)' : presentRate >= 70 ? 'var(--yellow)' : 'var(--red)'
                }}>{presentRate}%</span>
              </div>

              <div className="progress-bar" style={{ marginBottom: '12px' }}>
                <div className="progress-bar__fill" style={{
                  width: `${presentRate}%`,
                  background: presentRate >= 90 ? 'var(--green)' : presentRate >= 70 ? 'var(--yellow)' : 'var(--red)',
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { icon: <CalendarIcon size={14} />, label: 'Có mặt', value: `${s.present_days || 0}d`, color: 'var(--green)' },
                  { icon: <Clock size={14} />, label: 'Đi muộn', value: `${s.late_days || 0}d`, color: 'var(--yellow)' },
                  { icon: <TrendingUp size={14} />, label: 'Giờ làm', value: `${s.total_hours || 0}h`, color: 'var(--primary)' },
                  { icon: <AlertTriangle size={14} />, label: 'Tăng ca', value: `${s.total_ot_hours || 0}h`, color: 'var(--blue)' },
                ].map((item, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ color: item.color, display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>{item.icon}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* VIEW MODE 1: APP LỊCH GRID VIEW (Calendar Grid) */}
            {viewMode === 'grid' ? (
              <div className="card" style={{ padding: '12px' }}>
                {/* Calendar Day Header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px', marginBottom: '8px' }}>
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (
                    <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: i >= 5 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid Cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {calendarDays.map((item, idx) => {
                    if (item.blank) {
                      return <div key={idx} style={{ height: '48px', borderRadius: '8px', background: 'transparent' }} />;
                    }

                    const dayRecs = item.records || [];
                    const rec = dayRecs[0];
                    const hasAtt = dayRecs.length > 0;
                    const workedRec = dayRecs.find(record => Boolean(record.check_in_time)) || rec;
                    const hasWorked = Boolean(workedRec?.check_in_time);
                    const isLate = dayRecs.some(r => r.is_late);
                    const isOt = dayRecs.some(r => r.ot_hours > 0);
                    const holidayObj = holidayByDate.get(item.dateStr);
                    const isHoliday = Boolean(holidayObj);

                    let bg = 'var(--bg-raised)';
                    let border = '1px solid var(--border)';
                    let textColor = 'var(--text)';

                    if (isHoliday) {
                      bg = 'rgba(139, 92, 246, 0.15)';
                      border = '1px solid #8b5cf6';
                      textColor = '#8b5cf6';
                    } else if (hasAtt) {
                      if (isLate) {
                        bg = 'var(--yellow-soft)';
                        border = '1px solid var(--yellow)';
                        textColor = 'var(--yellow)';
                      } else {
                        bg = 'var(--green-soft)';
                        border = '1px solid var(--green)';
                        textColor = 'var(--green)';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDayDate(item.dateStr);
                        }}
                        style={{
                          height: '52px', borderRadius: '8px', background: bg, border,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', padding: '2px', position: 'relative', transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700, color: textColor }}>{item.day}</span>

                        {isHoliday && hasWorked ? (
                          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--holiday-work)', marginTop: '2px' }} title={`${holidayObj?.name}: ${formatHolidayWorkSymbol(workedRec?.work_units || holidayObj?.work_multiplier)}`}>
                            {getTimesheetSymbol(workedRec)} {isOt && '🔥'}
                          </div>
                        ) : isHoliday ? (
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#8b5cf6', marginTop: '2px' }} title={holidayObj?.name}>
                            🏖️ {holidayObj?.name?.slice(0, 8)}..
                          </div>
                        ) : hasAtt ? (
                          <div style={{ fontSize: '10px', fontWeight: 700, color: textColor, marginTop: '2px' }}>
                            {dayRecs.length > 1 ? `👥 ${dayRecs.length}` : getTimesheetSymbol(rec)} {isOt && '🔥'}
                          </div>
                        ) : (
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>—</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend chuẩn theo mẫu ET_Staff */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  {TIMESHEET_SYMBOLS.map(s => (
                    <span key={s.code} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <strong style={{ color: s.color }}>{s.code}</strong>: {s.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : viewMode === 'list' ? (
              /* VIEW MODE 2: LIST VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {records.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">📅</div>
                    <div className="empty-state__title">Không có dữ liệu</div>
                    <div className="empty-state__desc">Chưa có bản ghi chấm công trong khoảng thời gian này</div>
                  </div>
                ) : records.map((r, i) => {
                  const date = new Date(r.date || r.check_in_time);
                  const dayStr = date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
                  return (
                    <div key={i} className="card animate-fade-in" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: r.is_late ? 'var(--yellow-soft)' : 'var(--green-soft)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: r.is_late ? 'var(--yellow)' : 'var(--green)',
                        fontSize: '13px', fontWeight: 700, flexShrink: 0,
                      }}>
                        {date.getDate()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>
                          {r.user_id?.full_name ? <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '6px' }}>{r.user_id.full_name}:</span> : null}
                          {fmt(r.check_in_time)} → {fmt(r.check_out_time)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {dayStr} · {TYPE_MAP[r.check_in_type] || r.check_in_type || '—'} · {r.total_hours || 0}h
                          {r.ot_hours > 0 && <span style={{ color: 'var(--blue)' }}> +{r.ot_hours}h OT</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {r.is_late ? (
                          <span className="badge badge--warning" style={{ fontSize: '10px' }}>Muộn</span>
                        ) : (
                          <span className="badge badge--success" style={{ fontSize: '10px' }}>✓</span>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleOpenOverride(r)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}>
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VIEW MODE 3: TABLE VIEW */
              <div className="card" style={{ padding: '8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 8px' }}>Ngày</th>
                      <th style={{ padding: '6px 8px' }}>Vào</th>
                      <th style={{ padding: '6px 8px' }}>Ra</th>
                      <th style={{ padding: '6px 8px' }}>Loại</th>
                      <th style={{ padding: '6px 8px' }}>Giờ</th>
                      <th style={{ padding: '6px 8px' }}>OT</th>
                      <th style={{ padding: '6px 8px' }}>Trạng thái</th>
                      {isAdmin && <th style={{ padding: '6px 8px' }}>Sửa</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-muted)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.date}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--green)' }}>{fmt(r.check_in_time)}</td>
                        <td style={{ padding: '6px 8px' }}>{fmt(r.check_out_time)}</td>
                        <td style={{ padding: '6px 8px' }}>{TYPE_SHORT[r.check_in_type] || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{r.total_hours || 0}h</td>
                        <td style={{ padding: '6px 8px', color: 'var(--blue)' }}>{r.ot_hours > 0 ? `${r.ot_hours}h` : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {r.is_late ? (
                            <span className="badge badge--warning" style={{ fontSize: '10px' }}>Muộn</span>
                          ) : (
                            <span className="badge badge--success" style={{ fontSize: '10px' }}>✓</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '6px 8px' }}>
                            <button onClick={() => handleOpenOverride(r)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                              <Edit2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Selected Day Detail Modal */}
      {selectedDayDate && (
        <div className="modal-overlay" onClick={() => setSelectedDayDate('')}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', margin: '0 auto', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text)' }}>
                Chi tiết ngày {selectedDayDate}
              </div>
              <button onClick={() => setSelectedDayDate('')} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {(() => {
              const currentHoliday = holidayByDate.get(selectedDayDate);
              const dayRecs = records.filter(r => (r.date === selectedDayDate || r.check_in_time?.startsWith(selectedDayDate)));

              return (
                <div>
                  {currentHoliday && (
                    <div className="card" style={{
                      padding: '16px', marginBottom: '16px', background: 'rgba(139, 92, 246, 0.08)',
                      border: '1.5px solid #8b5cf6', borderRadius: '14px', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.1)'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#8b5cf6', marginBottom: '6px', lineHeight: 1.3 }}>
                        🏖️ NGHỈ LỄ: {currentHoliday.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Áp dụng: <strong style={{ color: 'var(--text)' }}>{currentHoliday.date}</strong> {currentHoliday.end_date && currentHoliday.end_date !== currentHoliday.date ? `→ ${currentHoliday.end_date}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--holiday-work)', fontWeight: 800 }}>
                        Đi làm ngày lễ: {formatHolidayWorkSymbol(currentHoliday.work_multiplier)} công
                      </div>

                      {/* Full Pre-formatted Announcement Content */}
                      {currentHoliday.note && (
                        <div style={{
                          fontSize: '13px',
                          color: 'var(--text)',
                          lineHeight: 1.7,
                          marginTop: '10px',
                          padding: '14px 16px',
                          background: 'var(--bg-card)',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          whiteSpace: 'pre-line',
                          wordBreak: 'break-word',
                          maxHeight: '350px',
                          overflowY: 'auto'
                        }}>
                          <div style={{ fontWeight: 800, color: '#8b5cf6', marginBottom: '8px', fontSize: '12px', letterSpacing: '0.5px' }}>
                            📢 NỘI DUNG THÔNG BÁO:
                          </div>
                          {currentHoliday.note}
                        </div>
                      )}

                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            onClick={() => { handleOpenEditHoliday(currentHoliday); setSelectedDayDate(''); }}
                            className="btn btn--ghost"
                            style={{ flex: 1, fontSize: '12px', padding: '7px', color: '#8b5cf6', borderColor: '#8b5cf6', fontWeight: 700 }}
                          >
                            ✏️ Sửa ngày lễ
                          </button>
                          <button
                            onClick={() => handleDeleteHoliday(currentHoliday._id)}
                            className="btn btn--ghost"
                            style={{ fontSize: '12px', padding: '7px 14px', color: 'var(--red)', borderColor: 'var(--red)', fontWeight: 700 }}
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {dayRecs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
                      {dayRecs.map((selectedDayRecord, recIdx) => (
                        <div key={selectedDayRecord._id || recIdx} className="card" style={{ padding: '12px', border: '1px solid var(--border)' }}>
                          {selectedDayRecord.user_id?.full_name && (
                            <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>👤 {selectedDayRecord.user_id.full_name}</span>
                              {selectedDayRecord.user_id.employee_code && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>#{selectedDayRecord.user_id.employee_code}</span>
                              )}
                            </div>
                          )}

                          <div className="card" style={{ padding: '10px', marginBottom: '8px', background: selectedDayRecord.is_late ? 'var(--yellow-soft)' : 'var(--green-soft)', border: 'none' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: selectedDayRecord.is_late ? 'var(--yellow)' : 'var(--green)', marginBottom: '2px' }}>
                              {selectedDayRecord.is_late ? `⚠️ Đi muộn ${selectedDayRecord.late_minutes || 0} phút` : '✅ Chấm công đúng giờ'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {TYPE_MAP[selectedDayRecord.check_in_type] || 'Văn phòng'} {selectedDayRecord.project_name ? `· ${selectedDayRecord.project_name}` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                            <div style={{ background: 'var(--bg-raised)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GIỜ VÀO</div>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--green)' }}>{fmt(selectedDayRecord.check_in_time)}</div>
                            </div>
                            <div style={{ background: 'var(--bg-raised)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GIỜ RA</div>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{fmt(selectedDayRecord.check_out_time)}</div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                            <div style={{ background: 'var(--bg-raised)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TỔNG GIỜ LÀM</div>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}>{selectedDayRecord.total_hours || 0} giờ</div>
                            </div>
                            <div style={{ background: 'var(--bg-raised)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GIỜ TĂNG CA (OT)</div>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--blue)' }}>{selectedDayRecord.ot_hours || 0} giờ</div>
                            </div>
                          </div>

                          {selectedDayRecord.notes && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                              <strong>Ghi chú:</strong> {selectedDayRecord.notes}
                            </div>
                          )}

                          {isAdmin && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button onClick={() => { handleOpenOverride(selectedDayRecord); setSelectedDayDate(''); }} className="btn btn--primary" style={{ flex: 1, padding: '7px', fontSize: '12px' }}>
                                <Edit2 size={13} /> Điều chỉnh ca làm
                              </button>
                              <button onClick={() => handleDeleteAttendance(selectedDayRecord._id, selectedDayRecord.date || selectedDayDate)} className="btn btn--ghost" style={{ padding: '7px 12px', fontSize: '12px', color: 'var(--red)', borderColor: 'var(--red)' }}>
                                <Trash2 size={13} /> Xóa (Cho chấm lại)
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '24px 12px' }}>
                      <div className="empty-state__icon">⚪</div>
                      <div className="empty-state__title">Không có ca làm</div>
                      <div className="empty-state__desc">Không có dữ liệu chấm công trong ngày {selectedDayDate}</div>
                    </div>
                  )}

                  {/* Admin Fast Add Holiday Trigger */}
                  {isAdmin && !currentHoliday && (
                    <button
                      onClick={() => { handleOpenCreateHoliday(selectedDayDate); setSelectedDayDate(''); }}
                      className="btn btn--ghost btn--full"
                      style={{ marginTop: '12px', borderColor: '#8b5cf6', color: '#8b5cf6', fontSize: '12px' }}
                    >
                      🏖️ Đặt ngày {selectedDayDate} làm Ngày Nghỉ Lễ
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Admin Override Sheet */}
      {overrideRecord && (() => {
        const liveStats = computeLiveSummary(
          overrideForm.check_in_time,
          overrideForm.check_out_time,
          settings?.work_end_time || '18:30',
          settings?.ot_start_time || '18:30',
          overrideForm.is_overnight_checkout
        );

        const shiftFormDate = (offsetDays) => {
          const base = overrideForm.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          const [y, m, d] = base.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          dt.setDate(dt.getDate() + offsetDays);
          const newDateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          setOverrideForm({ ...overrideForm, date: newDateStr });
        };

        const applyPreset = (inT, outT, isLateVal = false) => {
          setOverrideForm({
            ...overrideForm,
            check_in_time: inT,
            check_out_time: outT,
            is_late: isLateVal
          });
        };

        return (
          <div className="modal-overlay" onClick={() => setOverrideRecord(null)}>
            <div
              className="modal-sheet animate-slide-up"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '600px',
                width: '95vw',
                maxHeight: '92vh',
                overflowY: 'auto',
                margin: '0 auto',
                borderRadius: '16px',
                padding: '22px 26px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
              }}
            >
              <div className="modal-sheet__handle" />
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={22} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                      Sửa Giờ Chấm Công
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '2px', fontWeight: 700 }}>
                      {overrideRecord.user_id?.full_name ? `${overrideRecord.user_id.full_name} (${overrideRecord.user_id.employee_code || 'NS'})` : 'Nhân sự'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setOverrideRecord(null)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                  <X size={20} />
                </button>
              </div>

              {/* 📅 Date Selector with Quick Switchers */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📅 Chọn Ngày Chấm Công</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Bấm để đổi ngày cần sửa</span>
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => shiftFormDate(-1)}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '12px', height: '36px' }}
                    title="Ngày hôm trước"
                  >
                    ◀ Hôm trước
                  </button>
                  <input
                    type="date"
                    className="form-input"
                    style={{ flex: 1, fontSize: '13px', fontWeight: 800, padding: '7px 10px', height: '36px' }}
                    value={overrideForm.date}
                    onChange={e => setOverrideForm({ ...overrideForm, date: e.target.value })}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                  <button
                    type="button"
                    onClick={() => shiftFormDate(1)}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '12px', height: '36px' }}
                    title="Ngày hôm sau"
                  >
                    Hôm sau ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideForm({ ...overrideForm, date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) })}
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px', fontSize: '11.5px', height: '36px', color: 'var(--primary)', fontWeight: 700 }}
                  >
                    Hôm nay
                  </button>
                </div>
              </div>

              {/* ⚡ Quick Shift Presets (1-Click Fill) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  ⚡ Chọn nhanh mẫu ca làm việc phổ biến:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: '🏢 Chuẩn 09:00 - 18:30', in: '09:00', out: '18:30', late: false },
                    { label: '🏢 Chuẩn 09:00 - 18:30 (ET)', in: '09:00', out: '18:30', late: false },
                    { label: '🔥 Tăng ca 09:00 - 20:00', in: '09:00', out: '20:00', late: false },
                    { label: '🌓 Sáng 09:00 - 12:00', in: '09:00', out: '12:00', late: false },
                    { label: '🌔 Chiều 13:30 - 18:30', in: '13:30', out: '18:30', late: false },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyPreset(p.in, p.out, p.late)}
                      className="btn btn--ghost"
                      style={{
                        fontSize: '11.5px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: (overrideForm.check_in_time === p.in && overrideForm.check_out_time === p.out) ? 'var(--primary-soft)' : 'var(--bg-input)',
                        color: (overrideForm.check_in_time === p.in && overrideForm.check_out_time === p.out) ? 'var(--primary)' : 'var(--text-secondary)',
                        borderColor: (overrideForm.check_in_time === p.in && overrideForm.check_out_time === p.out) ? 'var(--primary)' : 'var(--border)',
                        fontWeight: 600
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Pickers (In & Out) with Steppers & Quick Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* 🟢 Giờ vào (Check-in) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>🟢 Giờ vào (Check-in)</span>
                    <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700 }}>{overrideForm.check_in_time || '—'}</span>
                  </label>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_in_time: adjustTimeString(overrideForm.check_in_time, -15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Giảm 15 phút"
                    >
                      -15p
                    </button>
                    <input
                      type="time"
                      className="form-input"
                      style={{ fontSize: '15px', fontWeight: 800, padding: '6px 8px', height: '38px', textAlign: 'center', flex: 1 }}
                      value={overrideForm.check_in_time}
                      onChange={e => setOverrideForm({ ...overrideForm, check_in_time: e.target.value })}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                    />
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_in_time: adjustTimeString(overrideForm.check_in_time, 15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Tăng 15 phút"
                    >
                      +15p
                    </button>
                  </div>

                  {/* Check-in Quick Chips */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['08:00', '08:30', '08:45', '09:00', '09:15'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOverrideForm({ ...overrideForm, check_in_time: t })}
                        className="btn btn--ghost"
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: overrideForm.check_in_time === t ? 'var(--primary-soft)' : 'transparent',
                          color: overrideForm.check_in_time === t ? 'var(--primary)' : 'var(--text-muted)',
                          borderColor: overrideForm.check_in_time === t ? 'var(--primary)' : 'var(--border)',
                          fontWeight: overrideForm.check_in_time === t ? 700 : 500
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 🔴 Giờ ra (Check-out) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>🔴 Giờ ra (Check-out)</span>
                    <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 700 }}>{overrideForm.check_out_time || '—'}</span>
                  </label>

                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_out_time: adjustTimeString(overrideForm.check_out_time, -15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Giảm 15 phút"
                    >
                      -15p
                    </button>
                    <input
                      type="time"
                      className="form-input"
                      style={{ fontSize: '15px', fontWeight: 800, padding: '6px 8px', height: '38px', textAlign: 'center', flex: 1 }}
                      value={overrideForm.check_out_time}
                      onChange={e => {
                        const newOut = e.target.value;
                        const autoOvernight = newOut && overrideForm.check_in_time && newOut < overrideForm.check_in_time;
                        setOverrideForm({
                          ...overrideForm,
                          check_out_time: newOut,
                          is_overnight_checkout: autoOvernight ? true : overrideForm.is_overnight_checkout
                        });
                      }}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                    />
                    <button
                      type="button"
                      onClick={() => setOverrideForm({ ...overrideForm, check_out_time: adjustTimeString(overrideForm.check_out_time, 15) })}
                      className="btn btn--ghost"
                      style={{ padding: '6px 8px', fontSize: '11.5px', height: '38px' }}
                      title="Tăng 15 phút"
                    >
                      +15p
                    </button>
                  </div>

                  {/* Check-out Quick Chips */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['12:00', '17:30', '18:00', '18:30', '19:00', '20:00'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOverrideForm({ ...overrideForm, check_out_time: t })}
                        className="btn btn--ghost"
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: overrideForm.check_out_time === t ? 'var(--primary-soft)' : 'transparent',
                          color: overrideForm.check_out_time === t ? 'var(--primary)' : 'var(--text-muted)',
                          borderColor: overrideForm.check_out_time === t ? 'var(--primary)' : 'var(--border)',
                          fontWeight: overrideForm.check_out_time === t ? 700 : 500
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 📊 Live Calculated Summary Badge */}
              {liveStats && (
                <div style={{
                  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '14px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>⏱️ Tổng Giờ Làm</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                      {liveStats.totalHours} giờ
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🔥 Giờ Tăng Ca OT</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: liveStats.otHours > 0 ? '#ef4444' : 'var(--text-secondary)', marginTop: '2px' }}>
                      {liveStats.otHours}h OT
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🌟 Kỷ Luật</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: overrideForm.is_late ? 'var(--red)' : 'var(--green)', marginTop: '2px' }}>
                      {overrideForm.is_late ? '🔴 Đi muộn' : '🟢 Đúng giờ'}
                    </div>
                  </div>
                </div>
              )}

              {/* Hình thức & Toggle Đi muộn */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Hình thức chấm công */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>🏢 Hình thức làm việc</label>
                  <select
                    className="form-select"
                    value={overrideForm.check_in_type}
                    onChange={e => setOverrideForm({ ...overrideForm, check_in_type: e.target.value })}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  >
                    <option value="office">🏢 Văn phòng</option>
                    <option value="site">🏗️ Công trình (CT1)</option>
                    <option value="client">👔 Khách hàng (CT2)</option>
                    <option value="wfh">🏠 Làm từ xa (WFH)</option>
                  </select>
                </div>

                {/* Toggle Đi muộn */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>⚠️ Ghi nhận đi muộn</label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: overrideForm.is_late ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input)',
                      border: overrideForm.is_late ? '1px solid var(--red)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      height: '38px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={overrideForm.is_late}
                      onChange={e => setOverrideForm({ ...overrideForm, is_late: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--red)' }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: overrideForm.is_late ? 700 : 500, color: overrideForm.is_late ? 'var(--red)' : 'var(--text)' }}>
                      {overrideForm.is_late ? '🔴 Đánh dấu Đi muộn' : '🟢 Đi đúng giờ'}
                    </span>
                  </label>
                </div>
              </div>

                            {/* 🌙 Toggle Ca làm việc xuyên đêm */}
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: overrideForm.is_overnight_checkout ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-input)',
                    border: overrideForm.is_overnight_checkout ? '1px solid #8b5cf6' : '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={overrideForm.is_overnight_checkout}
                      onChange={e => setOverrideForm({ ...overrideForm, is_overnight_checkout: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: overrideForm.is_overnight_checkout ? 700 : 500, color: overrideForm.is_overnight_checkout ? '#8b5cf6' : 'var(--text)' }}>
                      🌙 Ra ca rạng sáng hôm sau (OT qua 0h)
                    </span>
                  </div>
                  {overrideForm.is_overnight_checkout && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.18)', padding: '2px 8px', borderRadius: '12px' }}>
                      Qua đêm
                    </span>
                  )}
                </label>
              </div>

              {/* Lý do điều chỉnh */}
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>📝 Lý do điều chỉnh (Audit Note)</label>
                <input
                  type="text"
                  className="form-input"
                  value={overrideForm.notes}
                  onChange={e => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                  placeholder="VD: Sửa theo giải trình duyệt đơn, lỗi mạng, công tác..."
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setOverrideRecord(null)}
                    className="btn btn--ghost"
                    style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOverride}
                    disabled={submittingOverride}
                    className="btn btn--primary"
                    style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
                  >
                    {submittingOverride ? <span className="spinner" /> : '💾 Lưu điều chỉnh'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAttendance(overrideRecord._id, overrideRecord.date)}
                  className="btn btn--ghost btn--full"
                  style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.4)', fontSize: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.05)' }}
                >
                  <Trash2 size={15} /> Xóa hẳn ca làm này (Cho phép nhân viên chấm lại)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin Holiday Edit/Create Modal Sheet */}
      {showHolidayModal && (
        <div className="modal-overlay" onClick={() => setShowHolidayModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={20} color="#8b5cf6" />
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>
                  {holidayForm.id ? 'Sửa Lịch Nghỉ Lễ' : 'Đặt Ngày Nghỉ Lễ Mới'}
                </h3>
              </div>
              <button onClick={() => setShowHolidayModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="history-holiday-work-multiplier">Hệ số công khi đi làm ngày lễ</label>
              <select
                id="history-holiday-work-multiplier"
                className="form-select"
                value={normalizeHolidayMultiplier(holidayForm.work_multiplier)}
                onChange={e => setHolidayForm({ ...holidayForm, work_multiplier: Number(e.target.value) })}
              >
                {HOLIDAY_WORK_MULTIPLIERS.map(multiplier => (
                  <option key={multiplier} value={multiplier}>{formatHolidayWorkSymbol(multiplier)} công</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tên ngày nghỉ lễ *</label>
              <input
                type="text"
                className="form-input"
                value={holidayForm.name}
                onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                placeholder="VD: Nghỉ lễ Quốc Khánh 2/9"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Từ ngày *</label>
                <input
                  type="date"
                  className="form-input"
                  value={holidayForm.date}
                  onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Đến ngày</label>
                <input
                  type="date"
                  className="form-input"
                  value={holidayForm.end_date}
                  onChange={e => setHolidayForm({ ...holidayForm, end_date: e.target.value })}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>
                💬 Ghi chú / Nội dung thông báo toàn thể nhân viên
              </label>
              <textarea
                className="form-input"
                rows={5}
                value={holidayForm.note}
                onChange={e => setHolidayForm({ ...holidayForm, note: e.target.value })}
                placeholder="Nhập chi tiết về đợt nghỉ lễ, văn bản thông báo, lời chúc, hướng dẫn bàn giao công việc..."
                style={{ lineHeight: 1.6, fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowHolidayModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveHoliday} disabled={submittingHoliday} className="btn btn--primary btn--full" style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}>
                {submittingHoliday ? <span className="spinner" /> : 'Lưu & Phát Thông Báo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
