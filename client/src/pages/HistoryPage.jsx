// src/pages/HistoryPage.jsx
// Lịch sử chấm công — Xem theo Tuần / Tháng / Năm, Chế độ Lịch Ô (Calendar Grid View), Xem Chi Tiết Ngày, Admin Override

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, Clock, AlertTriangle, List, Table2, Download, Edit2, X, LayoutGrid, MapPin, Building, CheckCircle2, Info, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
};

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const TYPE_MAP = {
  office: '🏢 Văn phòng', site: '🏗️ Công trình', client: '👔 Khách hàng', wfh: '🏠 WFH',
};
const TYPE_SHORT = { office: 'VP', site: 'CT', client: 'KH', wfh: 'WFH' };

// Ký hiệu bảng chấm công chuẩn theo mẫu ET_Staff 2026
const TIMESHEET_SYMBOLS = [
  { code: 'x', label: 'Đủ công (1.0)', color: 'var(--green)' },
  { code: '0.75x', label: '3/4 công', color: 'var(--green)' },
  { code: '0.5x', label: '1/2 công', color: 'var(--yellow)' },
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
  if (rec.check_in_type === 'wfh') return 'WFH';
  if (rec.check_in_type === 'site') return 'CT1';
  if (rec.check_in_type === 'client') return 'CT2';
  if (rec.status === 'leave' || rec.notes?.includes('Nghỉ phép')) return 'P';
  if (rec.status === 'half_day' || rec.total_hours <= 4) return '0.5x';
  if (rec.total_hours >= 7.5) return 'x';
  if (rec.total_hours >= 6) return '0.75x';
  return 'x';
}

export default function HistoryPage() {
  const { user } = useAuthStore();
  const isAdminOrManager = ['admin', 'leader', 'manager'].includes(user?.role);

  const now = new Date();
  const [timeMode, setTimeMode] = useState('month'); // 'week' | 'month' | 'year'
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (Lịch ô) | 'list' | 'table'

  // Selected Day Detail Modal
  const [selectedDayRecord, setSelectedDayRecord] = useState(null);
  const [selectedDayDate, setSelectedDayDate] = useState('');

  // Admin Override Modal
  const [overrideRecord, setOverrideRecord] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ check_in_time: '', check_out_time: '', is_late: false, notes: '' });
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Holidays list & modal management
  const [holidays, setHolidays] = useState([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ id: null, name: '', date: '', end_date: '', note: '' });
  const [submittingHoliday, setSubmittingHoliday] = useState(false);

  // Policy Info Card Toggle
  const [showPolicy, setShowPolicy] = useState(false);

  // Admin Staff Selector
  const [staffList, setStaffList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const fetchHolidays = () => {
    api.get(`/holidays?year=${year}`).then(r => setHolidays(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  };

  useEffect(() => {
    fetchHolidays();
  }, [year]);

  const handleOpenCreateHoliday = (dateStr) => {
    setHolidayForm({ id: null, name: '', date: dateStr, end_date: dateStr, note: '' });
    setShowHolidayModal(true);
  };

  const handleOpenEditHoliday = (hObj) => {
    setHolidayForm({ id: hObj._id, name: hObj.name, date: hObj.date, end_date: hObj.end_date || hObj.date, note: hObj.note || '' });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.name || !holidayForm.date) {
      toast.error('Vui lòng nhập tên ngày lễ và ngày bắt đầu');
      return;
    }
    setSubmittingHoliday(true);
    try {
      if (holidayForm.id) {
        await api.delete(`/holidays/${holidayForm.id}`);
      }
      await api.post('/holidays', {
        name: holidayForm.name,
        date: holidayForm.date,
        end_date: holidayForm.end_date || holidayForm.date,
        note: holidayForm.note,
      });
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

  useEffect(() => { load(); }, [month, year, timeMode, selectedUserId]);

  const load = async () => {
    try {
      setLoading(true);
      const userParam = selectedUserId ? `&user_id=${selectedUserId}` : '';
      const { data: d } = await api.get(`/attendance/history?month=${month}&year=${year}&mode=${timeMode}${userParam}`);
      setData(d);
    } catch { toast.error('Lỗi tải lịch sử'); }
    finally { setLoading(false); }
  };

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cham-cong-${year}-${String(month).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất CSV!');
  };

  const handleOpenOverride = (rec) => {
    setOverrideRecord(rec);
    const inStr = rec.check_in_time ? new Date(rec.check_in_time).toISOString().slice(0, 16) : '';
    const outStr = rec.check_out_time ? new Date(rec.check_out_time).toISOString().slice(0, 16) : '';
    setOverrideForm({
      check_in_time: inStr,
      check_out_time: outStr,
      is_late: Boolean(rec.is_late),
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
      setSelectedDayRecord(null);
      load();
    } catch {
      toast.error('Lỗi điều chỉnh bản ghi');
    } finally {
      setSubmittingOverride(false);
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
    const rec = records.find(r => r.date === dateStr);
    calendarDays.push({ day: d, dateStr, record: rec });
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
              {staffList.map(s => (
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
                📌 Quy định tính công & Đi muộn (ET Architects)
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
                  <div>• Ca ngày: <strong>09:00 - 18:00</strong> (8.0 giờ = <strong>x 1.0 công</strong>)</div>
                  <div>• Tăng ca (OT): <strong>Tính từ 18:00 trở đi</strong> (hệ số 1.5x).</div>
                </div>

                {/* Rule 2: Late rules */}
                <div style={{ background: 'var(--bg-raised)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--yellow)', marginBottom: '4px' }}>
                    ⚠️ Quy Định Các Mức Đi Muộn
                  </div>
                  <div>• <strong>≤ 09:00</strong>: Đúng giờ (Tính đủ công <code>x</code>)</div>
                  <div>• <strong>09:01 – 09:10</strong>: Muộn nhẹ</div>
                  <div>• <strong>09:11 – 09:30</strong>: Muộn</div>
                  <div>• <strong>&gt; 09:30</strong>: Muộn nhiều</div>
                </div>

                {/* Rule 3: Leave & Explanation */}
                <div style={{ background: 'var(--bg-raised)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--green)', marginBottom: '4px' }}>
                    🏖️ Nghỉ Lễ & Đơn Từ Giải Trình
                  </div>
                  <div>• Ngày nghỉ lễ: Hưởng 100% lương công (<code>1.0x</code>)</div>
                  <div>• Đơn đi muộn / WFH / công tác được duyệt ➔ <strong>Tính đủ 1.0 công (<code>x</code>) & tự động xóa cờ muộn</strong>!</div>
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

                    const rec = item.record;
                    const hasAtt = Boolean(rec);
                    const isLate = rec?.is_late;
                    const isOt = rec?.ot_hours > 0;
                    const holidayObj = holidays.find(h => item.dateStr >= h.date && item.dateStr <= (h.end_date || h.date));
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
                          setSelectedDayRecord(rec || null);
                        }}
                        style={{
                          height: '52px', borderRadius: '8px', background: bg, border,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', padding: '2px', position: 'relative', transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700, color: textColor }}>{item.day}</span>

                        {isHoliday ? (
                          <div style={{ fontSize: '9px', fontWeight: 700, color: '#8b5cf6', marginTop: '2px' }} title={holidayObj?.name}>
                            🏖️ {holidayObj?.name?.slice(0, 8)}..
                          </div>
                        ) : hasAtt ? (
                          <div style={{ fontSize: '10px', fontWeight: 700, color: textColor, marginTop: '2px' }}>
                            {getTimesheetSymbol(rec)} {isOt && '🔥'}
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
                        {isAdminOrManager && (
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
                      {isAdminOrManager && <th style={{ padding: '6px 8px' }}>Sửa</th>}
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
                        {isAdminOrManager && (
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
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>Chi tiết ngày {selectedDayDate}</div>
              <button onClick={() => setSelectedDayDate('')} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            {(() => {
              const currentHoliday = holidays.find(h => selectedDayDate >= h.date && selectedDayDate <= (h.end_date || h.date));

              return (
                <div>
                  {currentHoliday && (
                    <div className="card" style={{
                      padding: '12px', marginBottom: '12px', background: 'rgba(139, 92, 246, 0.12)',
                      border: '1px solid #8b5cf6', borderRadius: '12px'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#8b5cf6', marginBottom: '4px' }}>
                        🏖️ NGHỈ LỄ: {currentHoliday.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Áp dụng: <strong>{currentHoliday.date}</strong> {currentHoliday.end_date && currentHoliday.end_date !== currentHoliday.date ? `→ ${currentHoliday.end_date}` : ''}
                      </div>
                      {currentHoliday.note && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          💬 {currentHoliday.note}
                        </div>
                      )}

                      {isAdminOrManager && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button
                            onClick={() => { handleOpenEditHoliday(currentHoliday); setSelectedDayDate(''); }}
                            className="btn btn--ghost"
                            style={{ flex: 1, fontSize: '11px', padding: '6px', color: '#8b5cf6', borderColor: '#8b5cf6' }}
                          >
                            ✏️ Sửa ngày lễ
                          </button>
                          <button
                            onClick={() => handleDeleteHoliday(currentHoliday._id)}
                            className="btn btn--ghost"
                            style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--red)', borderColor: 'var(--red)' }}
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedDayRecord ? (
                    <div>
                      <div className="card" style={{ padding: '12px', marginBottom: '12px', background: selectedDayRecord.is_late ? 'var(--yellow-soft)' : 'var(--green-soft)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: selectedDayRecord.is_late ? 'var(--yellow)' : 'var(--green)', marginBottom: '4px' }}>
                          {selectedDayRecord.is_late ? `⚠️ Đi muộn ${selectedDayRecord.late_minutes || 0} phút` : '✅ Chấm công đúng giờ'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {TYPE_MAP[selectedDayRecord.check_in_type] || 'Văn phòng'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div className="card" style={{ padding: '10px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GIỜ VÀO (CHECK-IN)</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green)' }}>{fmt(selectedDayRecord.check_in_time)}</div>
                        </div>
                        <div className="card" style={{ padding: '10px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GIỜ RA (CHECK-OUT)</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{fmt(selectedDayRecord.check_out_time)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div className="card" style={{ padding: '10px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TỔNG GIỜ LÀM</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>{selectedDayRecord.total_hours || 0} giờ</div>
                        </div>
                        <div className="card" style={{ padding: '10px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GIỜ TĂNG CA (OT)</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--blue)' }}>{selectedDayRecord.ot_hours || 0} giờ</div>
                        </div>
                      </div>

                      {selectedDayRecord.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <strong>Ghi chú:</strong> {selectedDayRecord.notes}
                        </div>
                      )}

                      {isAdminOrManager && (
                        <button onClick={() => { handleOpenOverride(selectedDayRecord); setSelectedDayDate(''); }} className="btn btn--primary btn--full" style={{ marginTop: '12px' }}>
                          <Edit2 size={14} /> Điều chỉnh ca làm này
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state__icon">⚪</div>
                      <div className="empty-state__title">Không có ca làm</div>
                      <div className="empty-state__desc">Nhân viên không chấm công trong ngày {selectedDayDate}</div>
                    </div>
                  )}

                  {/* Admin Fast Add Holiday Trigger */}
                  {isAdminOrManager && !currentHoliday && (
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
      {overrideRecord && (
        <div className="modal-overlay" onClick={() => setOverrideRecord(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>Sửa giờ chấm công</div>
              <button onClick={() => setOverrideRecord(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Ngày: <strong>{overrideRecord.date}</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Thời gian vào (Check-in)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={overrideForm.check_in_time}
                onChange={e => setOverrideForm({ ...overrideForm, check_in_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Thời gian ra (Check-out)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={overrideForm.check_out_time}
                onChange={e => setOverrideForm({ ...overrideForm, check_out_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={overrideForm.is_late}
                  onChange={e => setOverrideForm({ ...overrideForm, is_late: e.target.checked })}
                />
                Đánh dấu là Đi muộn
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Lý do điều chỉnh (Audit Note)</label>
              <input
                type="text"
                className="form-input"
                value={overrideForm.notes}
                onChange={e => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                placeholder="VD: Sửa theo giải trình..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setOverrideRecord(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveOverride} disabled={submittingOverride} className="btn btn--primary btn--full">
                {submittingOverride ? <span className="spinner" /> : 'Lưu điều chỉnh'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <label className="form-label">Ghi chú / Thông báo nhân viên</label>
              <textarea
                className="form-input"
                rows={3}
                value={holidayForm.note}
                onChange={e => setHolidayForm({ ...holidayForm, note: e.target.value })}
                placeholder="Nhập chi tiết về đợt nghỉ lễ..."
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
