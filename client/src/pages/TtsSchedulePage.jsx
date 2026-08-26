// client/src/pages/TtsSchedulePage.jsx
// Bảng Lịch Hàng Tuần TTS & Phân Công Trực Nhật — Khớp 100% Bảng Excel Thực Tế 1 Khối Thống Nhất

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Edit2, 
  Trash2, Save, RefreshCw, Printer, X, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

const DAYS = [
  { key: 't2', label: 'Thứ 2', short: 'T2' },
  { key: 't3', label: 'Thứ 3', short: 'T3' },
  { key: 't4', label: 'Thứ 4', short: 'T4' },
  { key: 't5', label: 'Thứ 5', short: 'T5' },
  { key: 't6', label: 'Thứ 6', short: 'T6' },
  { key: 't7', label: 'Thứ 7', short: 'T7' },
];

const SHIFTS = [
  { key: 'morning', label: 'S (Sáng)', time: '9h - 12h30' },
  { key: 'afternoon', label: 'C (Chiều)', time: '14h - 18h30' },
];

export default function TtsSchedulePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isAdminOrLeader = ['admin', 'leader', 'manager'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  
  // State chọn tuần
  const [weekNumber, setWeekNumber] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [currentWeekInfo, setCurrentWeekInfo] = useState({ week: 1, year: 2026 });

  // Modal State Đăng Ký Ca
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    user_id: '',
    full_name: '',
    phone: '',
    bank_account: '',
    bank_name: 'MB',
    shifts: {},
    note: ''
  });
  const [submittingReg, setSubmittingReg] = useState(false);

  // Modal State Phân Công Trực Nhật (Leader Ninh / Admin)
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyRosterForm, setDutyRosterForm] = useState({});
  const [submittingDuty, setSubmittingDuty] = useState(false);

  // Modal Thêm TTS mới vào bảng
  const [showAddInternModal, setShowAddInternModal] = useState(false);
  const [newInternForm, setNewInternForm] = useState({
    user_id: '',
    full_name: '',
    phone: '',
    bank_account: '',
    bank_name: 'MB'
  });
  const [submittingAddIntern, setSubmittingAddIntern] = useState(false);

  // Tải dữ liệu tuần
  const fetchSchedule = async (targetWeek = weekNumber, targetYear = year) => {
    try {
      setLoading(true);
      const query = targetWeek ? `?week_number=${targetWeek}&year=${targetYear}` : '';
      const { data } = await api.get(`/tts-schedules${query}`);

      if (data?.schedule) {
        setScheduleData(data.schedule);
        setWeekNumber(data.schedule.week_number);
        setYear(data.schedule.year);
      }
      if (data?.all_staff) {
        setAllStaff(data.all_staff);
      }
      if (data?.current_week) {
        setCurrentWeekInfo({ week: data.current_week, year: data.current_year });
      }
    } catch {
      toast.error('Lỗi tải lịch đăng ký tuần của TTS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Chuyển tuần
  const handlePrevWeek = () => {
    let nextW = (weekNumber || 1) - 1;
    let nextY = year;
    if (nextW < 1) {
      nextW = 52;
      nextY -= 1;
    }
    setWeekNumber(nextW);
    setYear(nextY);
    fetchSchedule(nextW, nextY);
  };

  const handleNextWeek = () => {
    let nextW = (weekNumber || 1) + 1;
    let nextY = year;
    if (nextW > 52) {
      nextW = 1;
      nextY += 1;
    }
    setWeekNumber(nextW);
    setYear(nextY);
    fetchSchedule(nextW, nextY);
  };

  const handleCurrentWeek = () => {
    setWeekNumber(currentWeekInfo.week);
    setYear(currentWeekInfo.year);
    fetchSchedule(currentWeekInfo.week, currentWeekInfo.year);
  };

  // Đăng ký nhanh cho bản thân (hoặc mở modal)
  const handleOpenMyRegistration = () => {
    if (!user) return;
    const existing = scheduleData?.registrations?.find(r => 
      (r.user_id && String(r.user_id?._id || r.user_id) === String(user._id || user.id)) ||
      (r.full_name && r.full_name.trim().toLowerCase() === user.full_name?.trim().toLowerCase())
    );

    setRegisterForm({
      user_id: user._id || user.id,
      full_name: user.full_name || '',
      phone: user.phone || existing?.phone || '',
      bank_account: user.bank_account || existing?.bank_account || '',
      bank_name: user.bank_name || existing?.bank_name || 'MB',
      shifts: existing?.shifts ? { ...existing.shifts } : {},
      note: existing?.note || ''
    });
    setShowRegisterModal(true);
  };

  // Mở modal sửa ca cho bất kỳ TTS nào (Admin/Leader hoặc chính họ)
  const handleEditInternSchedule = (intern) => {
    setRegisterForm({
      user_id: intern.user_id?._id || intern.user_id || '',
      full_name: intern.full_name || '',
      phone: intern.phone || '',
      bank_account: intern.bank_account || '',
      bank_name: intern.bank_name || 'MB',
      shifts: intern.shifts ? { ...intern.shifts } : {},
      note: intern.note || ''
    });
    setShowRegisterModal(true);
  };

  // Lưu đăng ký ca làm
  const handleSaveRegistration = async () => {
    if (!registerForm.full_name.trim()) {
      toast.error('Vui lòng nhập họ tên');
      return;
    }

    setSubmittingReg(true);
    try {
      await api.post('/tts-schedules/register', {
        week_number: weekNumber,
        year: year,
        ...registerForm
      });
      toast.success('Đã lưu lịch đăng ký thành công! ✅');
      setShowRegisterModal(false);
      fetchSchedule(weekNumber, year);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi lưu lịch đăng ký');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Toggle trực tiếp 1 ô ca làm việc (Quick toggle x)
  const handleToggleShiftDirect = async (intern, shiftKey) => {
    if (!intern) return;
    const isOwner = user && (
      (intern.user_id && String(intern.user_id?._id || intern.user_id) === String(user._id || user.id)) ||
      (intern.full_name && intern.full_name.trim().toLowerCase() === user.full_name?.trim().toLowerCase())
    );

    if (!isAdminOrLeader && !isOwner) {
      toast.error('Bạn chỉ có thể đăng ký ca cho chính mình');
      return;
    }

    const currentVal = Boolean(intern.shifts?.[shiftKey]);
    const updatedShifts = {
      ...(intern.shifts || {}),
      [shiftKey]: !currentVal
    };

    // Optimistic UI Update
    setScheduleData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        registrations: prev.registrations.map(r => {
          if (r._id === intern._id) {
            return { ...r, shifts: updatedShifts };
          }
          return r;
        })
      };
    });

    try {
      await api.post('/tts-schedules/register', {
        week_number: weekNumber,
        year: year,
        user_id: intern.user_id?._id || intern.user_id,
        full_name: intern.full_name,
        phone: intern.phone,
        bank_account: intern.bank_account,
        bank_name: intern.bank_name,
        shifts: updatedShifts
      });
      toast.success(`Đã cập nhật ca ${!currentVal ? '[x]' : '[trống]'} cho ${intern.full_name}`);
    } catch {
      toast.error('Lỗi cập nhật ca làm');
      fetchSchedule(weekNumber, year);
    }
  };

  // Mở modal phân công trực nhật
  const handleOpenDutyModal = () => {
    const currentRoster = scheduleData?.duty_roster || {};
    setDutyRosterForm({
      t2: { office_cleaning: currentRoster.t2?.office_cleaning || 'My, Ly', toilet_cleaning: currentRoster.t2?.toilet_cleaning || '' },
      t3: { office_cleaning: currentRoster.t3?.office_cleaning || 'Ninh', toilet_cleaning: currentRoster.t3?.toilet_cleaning || '' },
      t4: { office_cleaning: currentRoster.t4?.office_cleaning || 'Ngọc, Tiến', toilet_cleaning: currentRoster.t4?.toilet_cleaning || '' },
      t5: { office_cleaning: currentRoster.t5?.office_cleaning || 'A Minh, Sơn', toilet_cleaning: currentRoster.t5?.toilet_cleaning || '' },
      t6: { office_cleaning: currentRoster.t6?.office_cleaning || 'A Trường, Hoàng', toilet_cleaning: currentRoster.t6?.toilet_cleaning || '' },
      t7: { office_cleaning: currentRoster.t7?.office_cleaning || 'A Long, Mến', toilet_cleaning: currentRoster.t7?.toilet_cleaning || 'A Minh' },
    });
    setShowDutyModal(true);
  };

  // Lưu phân công trực nhật
  const handleSaveDutyRoster = async () => {
    setSubmittingDuty(true);
    try {
      await api.put('/tts-schedules/duty-roster', {
        week_number: weekNumber,
        year: year,
        duty_roster: dutyRosterForm
      });
      toast.success('Đã cập nhật phân công trực nhật thành công! 🧹');
      setShowDutyModal(false);
      fetchSchedule(weekNumber, year);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi cập nhật phân công trực nhật');
    } finally {
      setSubmittingDuty(false);
    }
  };

  // Thêm TTS vào bảng
  const handleSaveNewIntern = async () => {
    if (!newInternForm.full_name.trim()) {
      toast.error('Vui lòng nhập tên Thực tập sinh');
      return;
    }

    setSubmittingAddIntern(true);
    try {
      await api.post('/tts-schedules/add-intern', {
        week_number: weekNumber,
        year: year,
        ...newInternForm
      });
      toast.success('Đã thêm TTS vào bảng thành công ✅');
      setShowAddInternModal(false);
      setNewInternForm({ user_id: '', full_name: '', phone: '', bank_account: '', bank_name: 'MB' });
      fetchSchedule(weekNumber, year);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi thêm Thực tập sinh');
    } finally {
      setSubmittingAddIntern(false);
    }
  };

  // Xóa TTS khỏi bảng tuần
  const handleRemoveIntern = async (intern) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${intern.full_name}" khỏi bảng tuần này?`)) return;
    try {
      await api.delete(`/tts-schedules/registration/${intern._id}?week_number=${weekNumber}&year=${year}`);
      toast.success(`Đã xóa ${intern.full_name} khỏi tuần này`);
      fetchSchedule(weekNumber, year);
    } catch {
      toast.error('Lỗi xóa Thực tập sinh');
    }
  };

  // Tính tổng số lượng TTS theo từng buổi (Sáng / Chiều từ T2 - T7)
  const shiftTotals = useMemo(() => {
    const totals = {};
    const regs = scheduleData?.registrations || [];

    DAYS.forEach(d => {
      SHIFTS.forEach(s => {
        const key = `${d.key}_${s.key}`;
        let count = 0;
        regs.forEach(r => {
          if (r.shifts?.[key]) count += 1;
        });
        totals[key] = count;
      });
    });

    return totals;
  }, [scheduleData]);

  // Đảm bảo có tối thiểu 5 cột TTS để layout luôn cân đối đẹp mắt
  const internColumns = useMemo(() => {
    const list = [...(scheduleData?.registrations || [])];
    while (list.length < 5) {
      list.push(null);
    }
    return list;
  }, [scheduleData]);

  // In lịch tuần
  const handlePrintSchedule = () => {
    window.print();
  };

  const dutyRoster = scheduleData?.duty_roster || {};
  const totalCols = 2 + internColumns.length + 1 + 3; // TT/Thứ + S/C + N_Interns + SL + 3 cột trực nhật

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner">
          <div>
            <div className="header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Lịch Hàng Tuần TTS & Trực Nhật</span>
            </div>
            <div className="header__subtitle">
              Đăng ký ca làm việc thực tập sinh & phân công vệ sinh văn phòng ET Architects
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={handleOpenMyRegistration} className="btn btn--primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              ✍️ Đăng ký lịch của tôi
            </button>
            {isAdminOrLeader && (
              <button onClick={handleOpenDutyModal} className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>
                🧹 Phân công trực nhật
              </button>
            )}
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        {/* Week Stepper & Controls Bar */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            
            {/* Week Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={handlePrevWeek} className="theme-toggle-btn" title="Tuần trước">
                <ChevronLeft size={16} />
              </button>
              <div style={{ textAlign: 'center', minWidth: '180px' }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)' }}>
                  Tuần {weekNumber || currentWeekInfo.week} / Năm {year}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                  {scheduleData?.start_date ? `Từ ${scheduleData.start_date.split('-').reverse().join('/')} ➔ ${scheduleData.end_date.split('-').reverse().join('/')}` : '—'}
                </div>
              </div>
              <button onClick={handleNextWeek} className="theme-toggle-btn" title="Tuần tiếp theo">
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={handleCurrentWeek} 
                className="btn btn--ghost" 
                style={{ padding: '4px 10px', fontSize: '12px', marginLeft: '4px' }}
              >
                Tuần hiện tại
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isAdminOrLeader && (
                <button 
                  onClick={() => setShowAddInternModal(true)} 
                  className="btn btn--ghost" 
                  style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
                >
                  <Plus size={14} /> Thêm TTS
                </button>
              )}
              <button 
                onClick={() => fetchSchedule(weekNumber, year)} 
                disabled={loading} 
                className="theme-toggle-btn" 
                title="Làm mới bảng"
              >
                <RefreshCw size={15} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
              </button>
              <button 
                onClick={handlePrintSchedule} 
                className="btn btn--ghost" 
                style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
              >
                <Printer size={14} /> In Bảng Excel
              </button>
            </div>

          </div>
        </div>

        {/* 🌟 MASTER UNIFIED TABLE — KHỚP 100% MẪU BẢNG EXCEL TRONG ẢNH */}
        <div style={{
          overflowX: 'auto',
          background: '#ffffff',
          borderRadius: '8px',
          border: '2px solid #374151',
          boxShadow: 'var(--shadow-md)',
          color: '#111827',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
          marginBottom: '20px'
        }}>
          <table style={{
            width: '100%',
            minWidth: '980px',
            borderCollapse: 'collapse',
            fontSize: '13px',
            textAlign: 'center'
          }}>
            {/* TOP TITLE BAR: Lịch hàng tuần TTS */}
            <thead>
              <tr style={{ background: '#374151', color: '#ffffff', fontWeight: 800, textAlign: 'left' }}>
                <th 
                  colSpan={totalCols} 
                  style={{ 
                    padding: '8px 14px', 
                    fontSize: '14px', 
                    letterSpacing: '0.4px', 
                    border: '1px solid #374151' 
                  }}
                >
                  Lịch hàng tuần TTS
                </th>
              </tr>

              {/* ROW 1: TÊN TTS & LỊCH TRỰC NHẬT HEADER */}
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #9ca3af' }}>
                {/* Cột TT (Span 3 hàng SĐT, STK) */}
                <th rowSpan="3" style={{ width: '42px', border: '1px solid #9ca3af', fontWeight: 800, fontSize: '13px', verticalAlign: 'middle', background: '#f9fafb' }}>
                  TT
                </th>

                {/* Ô header SĐT */}
                <th style={{ width: '55px', border: '1px solid #9ca3af', fontWeight: 800, fontSize: '12px', background: '#f9fafb' }}>
                  SĐT
                </th>

                {/* Các cột TTS */}
                {internColumns.map((intern, i) => (
                  <th 
                    key={intern?._id || `empty-${i}`} 
                    style={{ 
                      minWidth: '95px', 
                      width: '105px', 
                      border: '1px solid #9ca3af', 
                      fontWeight: 800, 
                      color: '#111827', 
                      verticalAlign: 'middle', 
                      padding: '6px 4px',
                      background: '#f9fafb'
                    }}
                  >
                    {intern ? (
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800 }}>{intern.full_name}</div>
                        {isAdminOrLeader && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
                            <button 
                              onClick={() => handleEditInternSchedule(intern)} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '1px' }} 
                              title="Sửa thông tin"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button 
                              onClick={() => handleRemoveIntern(intern)} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '1px' }} 
                              title="Xóa khỏi tuần"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#d1d5db' }}>—</span>
                    )}
                  </th>
                ))}

                {/* Cột SL tổng buổi (Span 3 hàng) */}
                <th rowSpan="3" style={{ width: '45px', border: '1px solid #9ca3af', fontWeight: 800, fontSize: '13px', verticalAlign: 'middle', background: '#f9fafb' }}>
                  SL
                </th>

                {/* Khối LỊCH TRỰC NHẬT Header */}
                <th 
                  colSpan="3" 
                  style={{ 
                    border: '1px solid #9ca3af', 
                    fontWeight: 800, 
                    fontSize: '14px', 
                    padding: '8px', 
                    background: '#ffffff',
                    letterSpacing: '0.5px'
                  }}
                >
                  LỊCH TRỰC NHẬT
                </th>
              </tr>

              {/* ROW 2: SĐT DATA & SUBHEADER TRỰC NHẬT */}
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #9ca3af' }}>
                <th style={{ border: '1px solid #9ca3af', fontWeight: 800, fontSize: '12px', background: '#f9fafb' }}>
                  STK
                </th>

                {internColumns.map((intern, i) => (
                  <th 
                    key={`phone-${i}`} 
                    style={{ 
                      border: '1px solid #9ca3af', 
                      fontWeight: 500, 
                      fontSize: '11px', 
                      color: '#374151', 
                      padding: '4px 2px',
                      background: '#ffffff'
                    }}
                  >
                    {intern?.phone || ''}
                  </th>
                ))}

                {/* 3 Subheader cột trực nhật */}
                <th style={{ border: '1px solid #9ca3af', fontWeight: 800, fontSize: '12px', width: '130px', padding: '6px', background: '#ffffff' }}>
                  DỌN VĂN PHÒNG
                </th>
                <th style={{ border: '1px solid #9ca3af', fontWeight: 800, fontSize: '12px', width: '130px', padding: '6px', background: '#ffffff' }}>
                  DỌN NHÀ VỆ SINH
                </th>
                <th style={{ border: '1px solid #9ca3af', fontWeight: 800, fontSize: '12px', minWidth: '340px', padding: '6px', background: '#ffffff' }}>
                  NỘI DUNG
                </th>
              </tr>

              {/* ROW 3: STK DATA */}
              <tr style={{ background: '#ffffff', borderBottom: '2px solid #374151' }}>
                <th style={{ border: '1px solid #9ca3af', borderBottom: '2px solid #374151', background: '#f9fafb' }}></th>

                {internColumns.map((intern, i) => (
                  <th 
                    key={`bank-${i}`} 
                    style={{ 
                      border: '1px solid #9ca3af', 
                      borderBottom: '2px solid #374151', 
                      fontWeight: 500, 
                      fontSize: '11px', 
                      color: '#374151', 
                      padding: '4px 2px',
                      background: '#ffffff'
                    }}
                  >
                    <div>{intern?.bank_account || ''}</div>
                    {intern?.bank_name && <div style={{ fontSize: '10px', color: '#6b7280' }}>{intern.bank_name}</div>}
                  </th>
                ))}

                {/* 3 cột trực nhật trống ở hàng STK */}
                <th style={{ border: '1px solid #9ca3af', borderBottom: '2px solid #374151', background: '#ffffff' }}></th>
                <th style={{ border: '1px solid #9ca3af', borderBottom: '2px solid #374151', background: '#ffffff' }}></th>
                <th style={{ border: '1px solid #9ca3af', borderBottom: '2px solid #374151', background: '#ffffff' }}></th>
              </tr>
            </thead>

            {/* TBODY: 12 ROWS (T2 S/C ... T7 S/C) */}
            <tbody>
              {DAYS.map((day, dayIdx) => (
                SHIFTS.map((shift, shiftIdx) => {
                  const shiftKey = `${day.key}_${shift.key}`;
                  const isFirstShiftOfDay = shiftIdx === 0;
                  const duty = dutyRoster[day.key] || {};
                  const isSaturday = day.key === 't7';

                  return (
                    <tr 
                      key={shiftKey} 
                      style={{ 
                        height: '34px', 
                        borderBottom: shiftIdx === 1 ? '1px solid #6b7280' : '1px solid #e5e7eb' 
                      }}
                    >
                      {/* Cột Thứ: Gộp 2 hàng (S và C) */}
                      {isFirstShiftOfDay && (
                        <td 
                          rowSpan="2" 
                          style={{ 
                            border: '1px solid #9ca3af', 
                            fontWeight: 800, 
                            fontSize: '13px', 
                            background: '#ffffff' 
                          }}
                        >
                          {day.short}
                        </td>
                      )}

                      {/* Cột Buổi: S hoặc C */}
                      <td 
                        style={{ 
                          border: '1px solid #9ca3af', 
                          fontWeight: 700, 
                          fontSize: '12px', 
                          background: '#ffffff' 
                        }}
                      >
                        {shift.key === 'morning' ? 'S' : 'C'}
                      </td>

                      {/* Các cột TTS */}
                      {internColumns.map((intern, i) => {
                        if (!intern) {
                          return (
                            <td 
                              key={`empty-cell-${i}-${shiftKey}`} 
                              style={{ border: '1px solid #9ca3af', background: '#ffffff' }}
                            />
                          );
                        }

                        const isChecked = Boolean(intern.shifts?.[shiftKey]);
                        const isMyCell = user && (
                          (intern.user_id && String(intern.user_id?._id || intern.user_id) === String(user._id || user.id)) ||
                          (intern.full_name && intern.full_name.trim().toLowerCase() === user.full_name?.trim().toLowerCase())
                        );

                        return (
                          <td
                            key={`${intern._id}-${shiftKey}`}
                            onClick={() => handleToggleShiftDirect(intern, shiftKey)}
                            style={{
                              border: '1px solid #9ca3af',
                              fontWeight: 800,
                              fontSize: '15px',
                              color: '#111827',
                              cursor: (isAdminOrLeader || isMyCell) ? 'pointer' : 'default',
                              background: isChecked ? '#e5e7eb' : '#ffffff',
                              userSelect: 'none',
                              transition: 'background 0.1s'
                            }}
                            title={`${day.label} (${shift.label}) - ${intern.full_name}: ${isChecked ? 'Có đi làm [x]' : 'Nghỉ'}`}
                          >
                            {isChecked ? 'x' : ''}
                          </td>
                        );
                      })}

                      {/* Cột SL tổng số lượng có mặt buổi này */}
                      <td style={{ border: '1px solid #9ca3af', fontWeight: 800, fontSize: '13px', background: '#f9fafb' }}>
                        {shiftTotals[shiftKey] || 0}
                      </td>

                      {/* Cột DỌN VĂN PHÒNG (Gộp 2 hàng mỗi thứ) */}
                      {isFirstShiftOfDay && (
                        <td 
                          rowSpan="2" 
                          onClick={() => isAdminOrLeader && handleOpenDutyModal()}
                          style={{ 
                            border: '1px solid #9ca3af', 
                            fontWeight: 700, 
                            fontSize: '13px', 
                            color: '#111827', 
                            background: '#ffffff', 
                            cursor: isAdminOrLeader ? 'pointer' : 'default' 
                          }}
                          title={isAdminOrLeader ? 'Bấm để sửa phân công trực nhật' : ''}
                        >
                          {duty.office_cleaning || ''}
                        </td>
                      )}

                      {/* Cột DỌN NHÀ VỆ SINH (Gộp 2 hàng mỗi thứ) */}
                      {isFirstShiftOfDay && (
                        <td 
                          rowSpan="2" 
                          onClick={() => isAdminOrLeader && handleOpenDutyModal()}
                          style={{ 
                            border: '1px solid #9ca3af', 
                            fontWeight: 700, 
                            fontSize: '13px',
                            color: isSaturday ? '#9a3412' : '#111827',
                            background: isSaturday ? '#fed7aa' : '#ffffff', // Highlight màu cam Thứ 7
                            cursor: isAdminOrLeader ? 'pointer' : 'default'
                          }}
                          title={isAdminOrLeader ? 'Bấm để sửa phân công' : ''}
                        >
                          {duty.toilet_cleaning || (isSaturday ? 'A Minh' : '')}
                        </td>
                      )}

                      {/* Cột NỘI DUNG: Gộp tất cả 12 hàng (rowSpan="12") */}
                      {dayIdx === 0 && shiftIdx === 0 && (
                        <td 
                          rowSpan="12" 
                          style={{ 
                            border: '1px solid #9ca3af', 
                            textAlign: 'left', 
                            verticalAlign: 'middle', 
                            padding: '16px 22px', 
                            fontSize: '12.5px', 
                            lineHeight: 1.8, 
                            background: '#ffffff', 
                            color: '#111827'
                          }}
                        >
                          <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '13px' }}>
                            * Trước giờ làm
                          </div>
                          <div style={{ paddingLeft: '8px', marginBottom: '8px' }}>
                            1. Quét nhà<br />
                            2. Dọn bàn chung<br />
                            3. Dọn bàn Máy in
                          </div>

                          <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '13px' }}>
                            * Giữa và cuối ngày
                          </div>
                          <div style={{ paddingLeft: '8px', marginBottom: '8px' }}>
                            1. Đồ dùng chung/ đồ dùng cá nhân ➔ dọn, rửa và cất gọn sau khi dùng<br />
                            2. Đổ rác cuối ngày
                          </div>

                          <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '13px', marginTop: '6px' }}>
                            * Lịch dọn nhà vệ sinh 1 tuần/ lần, vào thứ 7 hàng tuần
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ))}
            </tbody>

            {/* TFOOT: BOTTOM SUMMARY & WORK HOURS BAR */}
            <tfoot>
              <tr style={{ background: '#374151', color: '#ffffff', fontWeight: 800, height: '40px' }}>
                <td colSpan="2" style={{ border: '1px solid #374151', fontSize: '14px', letterSpacing: '1px' }}>
                  SL
                </td>

                {internColumns.map((intern, i) => {
                  if (!intern) {
                    return (
                      <td key={`total-empty-${i}`} style={{ border: '1px solid #4b5563', fontSize: '14px' }}>
                        0
                      </td>
                    );
                  }
                  let count = 0;
                  if (intern.shifts) {
                    Object.values(intern.shifts).forEach(v => { if (v) count += 1; });
                  }
                  return (
                    <td key={`total-${intern._id}`} style={{ border: '1px solid #4b5563', fontSize: '14px' }}>
                      {count}
                    </td>
                  );
                })}

                {/* Cột SL tổng */}
                <td style={{ border: '1px solid #4b5563', fontSize: '14px' }}>
                  {Object.values(shiftTotals).reduce((a, b) => a + b, 0)}
                </td>

                {/* Khối khung giờ làm việc bên phải */}
                <td colSpan="3" style={{ border: '1px solid #374151', padding: '6px 14px', textAlign: 'center', lineHeight: 1.4 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px' }}>SÁNG: 9H-12H30</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px' }}>CHIỀU: 14H-18H30</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Hướng Dẫn & Ghi Chú Nhanh Dưới Bảng */}
        <div className="card" style={{ padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
            📌 Hướng Dẫn Đăng Ký & Phân Công:
          </div>
          <div>• <strong>Thực tập sinh (TTS)</strong>: Phụ thuộc vào lịch học trên trường, mỗi Chủ nhật đăng ký lịch làm việc của tuần tiếp theo bằng cách click trực tiếp vào ô tương ứng hoặc bấm <strong>"✍️ Đăng ký lịch của tôi"</strong>. Hàng ngày đến công ty vẫn chấm công GPS + Selfie bình thường.</div>
          <div>• <strong>Leader (Leader Ninh) & Admin</strong>: Phân công người trực nhật (Dọn văn phòng, Dọn nhà vệ sinh) qua nút <strong>"🧹 Phân công trực nhật"</strong> làm căn cứ sắp xếp và giao việc trong tuần.</div>
          <div>• <strong>Minh bạch toàn công ty</strong>: Bảng này mở công khai để tất cả nhân sự đều xem và theo dõi lịch trực nhật.</div>
        </div>

      </div>

      {/* MODAL 1: ĐĂNG KÝ LỊCH TUẦN TTS */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>✍️ Đăng Ký Lịch Làm Việc Tuần {weekNumber}</div>
              <button onClick={() => setShowRegisterModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Họ và tên Thực tập sinh</label>
                <input
                  type="text"
                  className="form-input"
                  value={registerForm.full_name}
                  onChange={e => setRegisterForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nhập họ tên..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="form-input"
                    value={registerForm.phone}
                    onChange={e => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0359..."
                  />
                </div>
                <div>
                  <label className="form-label">STK & Ngân hàng</label>
                  <input
                    type="text"
                    className="form-input"
                    value={registerForm.bank_account}
                    onChange={e => setRegisterForm(prev => ({ ...prev, bank_account: e.target.value }))}
                    placeholder="Số tài khoản MB..."
                  />
                </div>
              </div>

              {/* Grid Chọn Ca Làm Việc */}
              <div style={{ marginTop: '6px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Chọn các ca bạn đi làm được:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {DAYS.map(d => (
                    <div key={d.key} style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 800, fontSize: '12px', marginBottom: '6px', color: d.key === 't7' ? 'var(--red)' : 'var(--text)' }}>
                        {d.label}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', marginBottom: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(registerForm.shifts?.[`${d.key}_morning`])}
                          onChange={e => setRegisterForm(prev => ({
                            ...prev,
                            shifts: { ...prev.shifts, [`${d.key}_morning`]: e.target.checked }
                          }))}
                        />
                        <span>Sáng (9h-12h30)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(registerForm.shifts?.[`${d.key}_afternoon`])}
                          onChange={e => setRegisterForm(prev => ({
                            ...prev,
                            shifts: { ...prev.shifts, [`${d.key}_afternoon`]: e.target.checked }
                          }))}
                        />
                        <span>Chiều (14h-18h30)</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowRegisterModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveRegistration} disabled={submittingReg} className="btn btn--primary btn--full">
                {submittingReg ? <span className="spinner" /> : <><Check size={16} /> Lưu Lịch Đăng Ký</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PHÂN CÔNG TRỰC NHẬT (LEADER NINH / ADMIN) */}
      {showDutyModal && (
        <div className="modal-overlay" onClick={() => setShowDutyModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>🧹 Phân Công Trực Nhật & Vệ Sinh Tuần {weekNumber}</div>
              <button onClick={() => setShowDutyModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              {DAYS.map(d => (
                <div key={d.key} style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '8px', color: d.key === 't7' ? 'var(--red)' : 'var(--primary)' }}>
                    {d.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Dọn văn phòng</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                        value={dutyRosterForm[d.key]?.office_cleaning || ''}
                        onChange={e => setDutyRosterForm(prev => ({
                          ...prev,
                          [d.key]: { ...(prev[d.key] || {}), office_cleaning: e.target.value }
                        }))}
                        placeholder="Nhập tên (VD: My, Ly)..."
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Dọn nhà vệ sinh</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                        value={dutyRosterForm[d.key]?.toilet_cleaning || ''}
                        onChange={e => setDutyRosterForm(prev => ({
                          ...prev,
                          [d.key]: { ...(prev[d.key] || {}), toilet_cleaning: e.target.value }
                        }))}
                        placeholder={d.key === 't7' ? 'VD: A Minh' : 'Để trống nếu không có'}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowDutyModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveDutyRoster} disabled={submittingDuty} className="btn btn--primary btn--full">
                {submittingDuty ? <span className="spinner" /> : <><Save size={16} /> Lưu Phân Công</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: THÊM TTS VÀO BẢNG */}
      {showAddInternModal && (
        <div className="modal-overlay" onClick={() => setShowAddInternModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>➕ Thêm TTS Vào Bảng Tuần</div>
              <button onClick={() => setShowAddInternModal(false)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Chọn nhân sự có sẵn (hoặc nhập tên bên dưới)</label>
                <select
                  className="form-input"
                  onChange={e => {
                    const selected = allStaff.find(s => String(s._id) === String(e.target.value));
                    if (selected) {
                      setNewInternForm({
                        user_id: selected._id,
                        full_name: selected.full_name,
                        phone: selected.phone || '',
                        bank_account: selected.bank_account || '',
                        bank_name: selected.bank_name || 'MB'
                      });
                    }
                  }}
                >
                  <option value="">-- Chọn từ danh sách nhân sự --</option>
                  {allStaff.map(s => (
                    <option key={s._id} value={s._id}>{s.full_name} ({s.position || 'Nhân sự'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Họ và tên TTS *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newInternForm.full_name}
                  onChange={e => setNewInternForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nhập tên..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newInternForm.phone}
                    onChange={e => setNewInternForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="SĐT..."
                  />
                </div>
                <div>
                  <label className="form-label">STK</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newInternForm.bank_account}
                    onChange={e => setNewInternForm(prev => ({ ...prev, bank_account: e.target.value }))}
                    placeholder="STK..."
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowAddInternModal(false)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleSaveNewIntern} disabled={submittingAddIntern} className="btn btn--primary btn--full">
                {submittingAddIntern ? <span className="spinner" /> : <><Plus size={16} /> Thêm Vào Bảng</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
