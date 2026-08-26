import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Edit3,
  Lock, LockOpen, Save, Users, X, Check, BriefcaseBusiness,
  SprayCan, Bath, Info, UserRoundCheck, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';
import './TtsSchedulePage.css';

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const DAY_MS = 86400000;

const toDateString = date => date.toISOString().slice(0, 10);
const parseLocalDate = value => new Date(`${value}T12:00:00.000Z`);
const addDays = (value, amount) => new Date(value.getTime() + amount * DAY_MS);
const currentMonday = () => {
  const nowVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const date = parseLocalDate(nowVN);
  const day = date.getUTCDay() || 7;
  return toDateString(addDays(date, 1 - day));
};
const shiftWeek = (weekStart, amount) => toDateString(addDays(parseLocalDate(weekStart), amount * 7));
const formatShortDate = value => parseLocalDate(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const personId = person => String(person?._id || person?.id || person || '');

function Avatar({ person, size = 34 }) {
  const initials = person?.full_name?.split(' ').map(word => word[0]).slice(-2).join('').toUpperCase() || '?';
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [person?.avatar_url]);
  const hasPersonalAvatar = person?.avatar_url && person.avatar_url !== '/logo.png';
  return hasPersonalAvatar && !imageFailed ? (
    <img className="tts-avatar" src={person.avatar_url} alt={`Ảnh của ${person.full_name || 'nhân sự'}`} style={{ width: size, height: size }} onError={() => setImageFailed(true)} />
  ) : <span className="tts-avatar tts-avatar--fallback" title={person?.full_name || ''} style={{ width: size, height: size }}>{initials}</span>;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section className={`tts-modal ${wide ? 'tts-modal--wide' : ''}`} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="tts-modal__handle" aria-hidden="true" />
        <header className="tts-modal__header">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="tts-icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function TtsSchedulePage() {
  const { user } = useAuthStore();
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registrationEditor, setRegistrationEditor] = useState(null);
  const [dutyEditorOpen, setDutyEditorOpen] = useState(false);
  const [permissionEditorOpen, setPermissionEditorOpen] = useState(false);
  const [instructionEditorOpen, setInstructionEditorOpen] = useState(false);
  const [savingCell, setSavingCell] = useState('');
  const [savingPermission, setSavingPermission] = useState('');
  const [draftDuties, setDraftDuties] = useState([]);
  const [activeDutyDate, setActiveDutyDate] = useState('');
  const [activeDutyField, setActiveDutyField] = useState('office_cleaning_user_ids');
  const [draftInstructions, setDraftInstructions] = useState({ before_work: '', during_day: '', weekly: '' });

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tts-schedules?week_start=${weekStart}`);
      setPayload(data);
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không tải được lịch TTS');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const schedule = payload?.schedule;
  const days = payload?.allowed_dates || [];
  const ttsUsers = payload?.tts_users || [];
  const people = payload?.people || [];
  const canManage = Boolean(payload?.can_manage);
  const canManageDuties = Boolean(payload?.can_manage_duties);
  const isAdmin = user?.role === 'admin';
  const isTts = user?.employee_type === 'TTS';
  const locked = Boolean(payload?.is_registration_locked);

  const registrations = useMemo(() => {
    const map = new Map();
    (schedule?.registrations || []).forEach(reg => map.set(personId(reg.user_id), reg));
    return map;
  }, [schedule]);

  const duties = useMemo(() => {
    const map = new Map();
    (schedule?.duties || []).forEach(duty => map.set(duty.date, duty));
    return map;
  }, [schedule]);

  const slotFor = (userId, date) => registrations.get(String(userId))?.slots?.find(slot => slot.date === date);
  const sessionCount = (date, key) => ttsUsers.filter(person => Boolean(slotFor(personId(person), date)?.[key])).length;
  const totalSessions = userId => days.reduce((sum, date) => {
    const slot = slotFor(userId, date);
    return sum + Number(Boolean(slot?.morning)) + Number(Boolean(slot?.afternoon));
  }, 0);

  const openRegistration = (person) => {
    const existing = registrations.get(personId(person));
    setRegistrationEditor({
      person,
      slots: days.map(date => {
        const slot = existing?.slots?.find(item => item.date === date);
        return { date, morning: Boolean(slot?.morning), afternoon: Boolean(slot?.afternoon) };
      }),
      note: existing?.note || '',
      adjusted: Boolean(existing?.adjusted_by),
    });
  };

  const saveRegistration = async () => {
    if (!registrationEditor) return;
    setSaving(true);
    try {
      const targetId = personId(registrationEditor.person);
      const isSelf = targetId === personId(user);
      const url = isSelf && isTts
        ? '/tts-schedules/my-registration'
        : `/tts-schedules/${weekStart}/registration/${targetId}`;
      await api.put(url, { week_start: weekStart, slots: registrationEditor.slots, note: registrationEditor.note });
      toast.success('Đã lưu lịch tuần');
      setRegistrationEditor(null);
      loadSchedule();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không lưu được lịch');
    } finally { setSaving(false); }
  };

  const toggleAvailabilityCell = async (person, date, session) => {
    const targetId = personId(person);
    const isSelf = targetId === personId(user);
    if (!canManage && (!isTts || !isSelf || locked)) return;
    const cellKey = `${targetId}-${date}-${session}`;
    if (savingCell) return;
    const existing = registrations.get(targetId);
    const nextSlots = days.map(day => {
      const current = existing?.slots?.find(item => item.date === day);
      const slot = { date: day, morning: Boolean(current?.morning), afternoon: Boolean(current?.afternoon) };
      return day === date ? { ...slot, [session]: !slot[session] } : slot;
    });
    setSavingCell(cellKey);
    try {
      const url = isSelf && isTts
        ? '/tts-schedules/my-registration'
        : `/tts-schedules/${weekStart}/registration/${targetId}`;
      await api.put(url, { week_start: weekStart, slots: nextSlots, note: existing?.note || '' });
      await loadSchedule();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không cập nhật được buổi đăng ký');
    } finally {
      setSavingCell('');
    }
  };

  const openDuties = () => {
    setDraftDuties(days.map(date => {
      const duty = duties.get(date);
      return {
        date,
        office_cleaning_user_ids: (duty?.office_cleaning_user_ids || []).map(personId),
        restroom_cleaning_user_ids: (duty?.restroom_cleaning_user_ids || []).map(personId),
        note: duty?.note || '',
      };
    }));
    setActiveDutyDate(days[0] || '');
    setActiveDutyField('office_cleaning_user_ids');
    setDutyEditorOpen(true);
  };

  const toggleDutyPerson = (date, field, id) => {
    setDraftDuties(current => current.map(duty => {
      if (duty.date !== date) return duty;
      const ids = duty[field];
      return { ...duty, [field]: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] };
    }));
  };

  const saveDuties = async () => {
    setSaving(true);
    try {
      await api.put(`/tts-schedules/${weekStart}/duties`, { duties: draftDuties });
      toast.success('Đã lưu phân công trực nhật');
      setDutyEditorOpen(false);
      loadSchedule();
    } catch (error) { toast.error(error?.response?.data?.error || 'Không lưu được phân công'); }
    finally { setSaving(false); }
  };

  const openInstructions = () => {
    setDraftInstructions({
      before_work: schedule?.instructions?.before_work || '',
      during_day: schedule?.instructions?.during_day || '',
      weekly: schedule?.instructions?.weekly || '',
    });
    setInstructionEditorOpen(true);
  };

  const saveInstructions = async () => {
    setSaving(true);
    try {
      await api.put(`/tts-schedules/${weekStart}/instructions`, draftInstructions);
      toast.success('Đã cập nhật nội dung trực nhật');
      setInstructionEditorOpen(false);
      loadSchedule();
    } catch (error) { toast.error(error?.response?.data?.error || 'Không lưu được nội dung'); }
    finally { setSaving(false); }
  };

  const toggleScheduleLock = async () => {
    try {
      await api.post(`/tts-schedules/${weekStart}/lock`, { locked: schedule?.status !== 'locked' });
      toast.success(schedule?.status === 'locked' ? 'Đã mở lại lịch' : 'Đã khóa lịch');
      loadSchedule();
    } catch (error) { toast.error(error?.response?.data?.error || 'Không đổi được trạng thái'); }
  };

  const toggleManagementPermission = async (person) => {
    if (!isAdmin || person.role === 'admin' || savingPermission) return;
    const id = personId(person);
    setSavingPermission(id);
    try {
      await api.put(`/users/${id}`, { can_manage_tts_schedule: !person.can_manage_tts_schedule });
      toast.success(person.can_manage_tts_schedule ? `Đã thu quyền của ${person.full_name}` : `Đã cấp quyền cho ${person.full_name}`);
      await loadSchedule();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không cập nhật được quyền');
    } finally {
      setSavingPermission('');
    }
  };

  const activeDuty = draftDuties.find(duty => duty.date === activeDutyDate);

  const myTtsPerson = ttsUsers.find(person => personId(person) === personId(user));
  return (
    <main className="page tts-page">
      <header className="header">
        <div className="header__inner">
          <div><div className="header__title">Lịch tuần TTS</div><div className="header__subtitle">Lịch khả dụng để chủ động sắp xếp công việc</div></div>
          <HeaderActions />
        </div>
      </header>

      <div className="container tts-container">
        <section className="tts-toolbar" aria-label="Điều khiển tuần">
          <button className="tts-icon-button" onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Tuần trước"><ChevronLeft /></button>
          <div className="tts-week-title"><CalendarDays size={18} /><div><strong>{formatShortDate(weekStart)} — {formatShortDate(schedule?.week_end || toDateString(addDays(parseLocalDate(weekStart), 5)))}</strong><span>Thứ 2 đến Thứ 7</span></div></div>
          <button className="tts-icon-button" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Tuần sau"><ChevronRight /></button>
          <button className="btn btn--ghost" onClick={() => setWeekStart(currentMonday())}>Tuần này</button>
          <button className="btn btn--ghost" onClick={() => setWeekStart(shiftWeek(currentMonday(), 1))}>Tuần tới</button>
          <span className={`tts-lock-state ${locked ? 'is-locked' : 'is-open'}`}>{locked ? <Lock size={13} /> : <LockOpen size={13} />}{locked ? 'Đã khóa' : 'Đang mở'}</span>
          <div className="tts-toolbar__spacer" />
          {isTts && myTtsPerson && (!locked || canManage) && <button className="btn btn--primary" onClick={() => openRegistration(myTtsPerson)}><ClipboardCheck size={16} /> Đăng ký lịch của tôi</button>}
          {canManageDuties && <button className="btn btn--ghost" onClick={openDuties}><SprayCan size={16} /> Phân công</button>}
          {isAdmin && <button className="btn btn--ghost" onClick={() => setPermissionEditorOpen(true)}><ShieldCheck size={16} /> Phân quyền</button>}
          {canManage && <button className="btn btn--ghost" onClick={toggleScheduleLock}>{schedule?.status === 'locked' ? <LockOpen size={16} /> : <Lock size={16} />}{schedule?.status === 'locked' ? 'Mở lịch' : 'Khóa lịch'}</button>}
        </section>

        {loading ? <div className="tts-loading"><span className="spinner" /> Đang sắp lịch tuần...</div> : (
          <>
            <section className="tts-board-card">
              <div className="tts-section-heading"><div><span className="tts-section-icon"><Users size={18} /></span><div><h2>Bảng khả dụng tuần</h2><p>Chạm vào tên để xem hoặc điều chỉnh lịch</p></div></div><span className="tts-live-dot">Cập nhật trực tiếp</span></div>
              {ttsUsers.length === 0 ? <div className="tts-empty"><UserRoundCheck size={28} /><strong>Chưa có tài khoản TTS đang hoạt động</strong><span>Admin có thể tạo tài khoản Employee và chọn loại nhân sự TTS.</span></div> : (
                <div className="tts-table-scroll">
                  <table className="tts-grid-table">
                    <thead><tr><th className="tts-sticky-cell">Ngày</th><th>Buổi</th>{ttsUsers.map(person => { const editable = canManage || (personId(person) === personId(user) && !locked); return <th key={personId(person)}><button className="tts-person-head" onClick={() => editable && openRegistration(person)} aria-label={`${editable ? 'Mở lịch' : 'Xem lịch'} của ${person.full_name}`}><Avatar person={person} /><span>{person.full_name}</span><small>{person.employee_code}</small></button></th>; })}<th className="tts-count-col">SL</th></tr></thead>
                    <tbody>{days.flatMap((date, dayIndex) => ['morning', 'afternoon'].map((session, sessionIndex) => (
                      <tr key={`${date}-${session}`}>
                        {sessionIndex === 0 && <th rowSpan="2" className="tts-day-cell tts-sticky-cell"><strong>{DAY_NAMES[dayIndex]}</strong><small>{formatShortDate(date)}</small></th>}
                        <th className="tts-session-cell"><span className={session === 'morning' ? 'is-morning' : 'is-afternoon'}>{session === 'morning' ? 'Sáng' : 'Chiều'}</span></th>
                        {ttsUsers.map(person => {
                          const active = Boolean(slotFor(personId(person), date)?.[session]);
                          const editable = canManage || (isTts && personId(person) === personId(user) && !locked);
                          const cellKey = `${personId(person)}-${date}-${session}`;
                          return <td key={personId(person)} className={active ? 'is-available' : ''}>
                            <button
                              type="button"
                              className={`tts-slot-button ${editable ? 'is-editable' : ''}`}
                              onClick={() => toggleAvailabilityCell(person, date, session)}
                              disabled={!editable || Boolean(savingCell)}
                              title={editable ? `${active ? 'Bỏ' : 'Đăng ký'} ${session === 'morning' ? 'buổi sáng' : 'buổi chiều'} cho ${person.full_name}` : `${person.full_name}: ${active ? 'Có mặt' : 'Không đăng ký'}`}
                              aria-label={`${person.full_name}, ${DAY_NAMES[dayIndex]} ${session === 'morning' ? 'buổi sáng' : 'buổi chiều'}: ${active ? 'đã đăng ký' : 'chưa đăng ký'}`}
                            >
                              {savingCell === cellKey ? <span className="spinner" /> : active ? <span className="tts-check"><Check size={15} /></span> : <span className="tts-dash">—</span>}
                            </button>
                          </td>;
                        })}
                        <td className="tts-count-col"><strong>{sessionCount(date, session)}</strong></td>
                      </tr>
                    )))}</tbody>
                    <tfoot><tr><th className="tts-sticky-cell" colSpan="2">Tổng buổi</th>{ttsUsers.map(person => <td key={personId(person)}><strong>{totalSessions(personId(person))}</strong></td>)}<td className="tts-count-col">—</td></tr></tfoot>
                  </table>
                </div>
              )}
            </section>

            <section className="tts-lower-grid">
              <div className="tts-duty-card">
                <div className="tts-section-heading"><div><span className="tts-section-icon tts-section-icon--amber"><BriefcaseBusiness size={18} /></span><div><h2>Lịch trực nhật</h2><p>Phân công rõ người, rõ ngày</p></div></div>{canManageDuties && <button className="tts-icon-button" onClick={openDuties} aria-label="Sửa phân công"><Edit3 size={16} /></button>}</div>
                <div className="tts-duty-list">{days.map((date, index) => {
                  const duty = duties.get(date);
                  const office = duty?.office_cleaning_user_ids || [];
                  const restroom = duty?.restroom_cleaning_user_ids || [];
                  return <article className="tts-duty-row" key={date}><div className="tts-duty-date"><strong>{DAY_NAMES[index]}</strong><span>{formatShortDate(date)}</span></div><div className="tts-duty-assignment"><span><SprayCan size={14} /> Dọn văn phòng</span><div>{office.length ? office.map(person => <span className="tts-person-pill" key={personId(person)}><Avatar person={person} size={22} />{person.full_name}</span>) : <em>Chưa phân công</em>}</div></div><div className="tts-duty-assignment"><span><Bath size={14} /> Nhà vệ sinh</span><div>{restroom.length ? restroom.map(person => <span className="tts-person-pill" key={personId(person)}><Avatar person={person} size={22} />{person.full_name}</span>) : <em>—</em>}</div></div></article>;
                })}</div>
              </div>

              <aside className="tts-guide-card">
                <div className="tts-section-heading"><div><span className="tts-section-icon tts-section-icon--blue"><Info size={18} /></span><div><h2>Nội dung thực hiện</h2><p>Nhịp vận hành văn phòng</p></div></div>{canManage && <button className="tts-icon-button" onClick={openInstructions} aria-label="Sửa nội dung"><Edit3 size={16} /></button>}</div>
                {[['Trước giờ làm', schedule?.instructions?.before_work], ['Giữa & cuối ngày', schedule?.instructions?.during_day], ['Định kỳ hằng tuần', schedule?.instructions?.weekly]].map(([title, content], index) => <div className="tts-guide-block" key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{content || 'Chưa có nội dung'}</p></div></div>)}
                <div className="tts-time-card"><Clock3 size={18} /><div><span>Sáng</span><strong>09:00 — 12:30</strong></div><div><span>Chiều</span><strong>14:00 — 18:30</strong></div></div>
              </aside>
            </section>
          </>
        )}
      </div>

      {registrationEditor && <Modal title={`Lịch của ${registrationEditor.person.full_name}`} subtitle={`Tuần ${formatShortDate(weekStart)} — ${formatShortDate(schedule?.week_end || weekStart)}`} onClose={() => setRegistrationEditor(null)}>
        <div className="tts-register-grid">{registrationEditor.slots.map((slot, index) => <div className="tts-register-day" key={slot.date}><div><strong>{DAY_NAMES[index]}</strong><span>{formatShortDate(slot.date)}</span></div>{['morning', 'afternoon'].map(session => <button key={session} className={slot[session] ? 'is-selected' : ''} onClick={() => setRegistrationEditor(current => ({ ...current, slots: current.slots.map(item => item.date === slot.date ? { ...item, [session]: !item[session] } : item) }))}><span>{slot[session] && <Check size={13} />}</span>{session === 'morning' ? 'Sáng' : 'Chiều'}</button>)}</div>)}</div>
        <label className="tts-field"><span>Ghi chú lịch học</span><textarea value={registrationEditor.note} onChange={event => setRegistrationEditor(current => ({ ...current, note: event.target.value }))} rows="3" placeholder="Ví dụ: Chiều Thứ 4 đến muộn 30 phút..." /></label>
        <div className="tts-modal__actions"><button className="btn btn--ghost" onClick={() => setRegistrationEditor(null)}>Hủy</button><button className="btn btn--primary" onClick={saveRegistration} disabled={saving}>{saving ? <span className="spinner" /> : <Save size={16} />} Lưu lịch tuần</button></div>
      </Modal>}

      {dutyEditorOpen && <Modal wide title="Phân công trực nhật" subtitle="Chọn ngày và hạng mục, sau đó chọn người thực hiện" onClose={() => setDutyEditorOpen(false)}>
        <div className="tts-duty-editor">
          <nav className="tts-duty-days" aria-label="Chọn ngày trực nhật">
            {draftDuties.map((duty, index) => <button type="button" className={activeDutyDate === duty.date ? 'is-active' : ''} onClick={() => setActiveDutyDate(duty.date)} key={duty.date}><strong>{DAY_NAMES[index]}</strong><span>{formatShortDate(duty.date)}</span></button>)}
          </nav>
          <div className="tts-duty-workspace">
            <div className="tts-duty-types">
              {[['office_cleaning_user_ids', 'Dọn văn phòng', SprayCan], ['restroom_cleaning_user_ids', 'Dọn nhà vệ sinh', Bath]].map(([field, label, Icon]) => {
                const selectedCount = activeDuty?.[field]?.length || 0;
                return <button type="button" className={activeDutyField === field ? 'is-active' : ''} onClick={() => setActiveDutyField(field)} key={field}><Icon size={17} /><span><strong>{label}</strong><small>{selectedCount ? `${selectedCount} người đã chọn` : 'Chưa phân công'}</small></span></button>;
              })}
            </div>
            <div className="tts-assignee-panel">
              <div className="tts-assignee-panel__heading"><strong>Chọn nhân sự</strong><span>Có thể chọn nhiều người</span></div>
              <div className="tts-assignee-grid">{people.map(person => {
                const id = personId(person);
                const selected = Boolean(activeDuty?.[activeDutyField]?.includes(id));
                return <button type="button" className={selected ? 'is-selected' : ''} onClick={() => toggleDutyPerson(activeDutyDate, activeDutyField, id)} key={id}><Avatar person={person} size={28} /><span>{person.full_name}</span>{selected && <Check size={13} />}</button>;
              })}</div>
            </div>
          </div>
        </div>
        <div className="tts-modal__actions"><button className="btn btn--ghost" onClick={() => setDutyEditorOpen(false)}>Hủy</button><button className="btn btn--primary" onClick={saveDuties} disabled={saving}><Save size={16} /> Lưu phân công</button></div>
      </Modal>}

      {permissionEditorOpen && <Modal title="Phân quyền trực nhật" subtitle="Admin chọn người được phép xếp người dọn văn phòng và nhà vệ sinh" onClose={() => setPermissionEditorOpen(false)}>
        <div className="tts-permission-note"><ShieldCheck size={18} /><span>Admin luôn có quyền. Người được cấp quyền chỉ sửa phân công trực nhật; không được sửa lịch đăng ký TTS, nội dung hướng dẫn hoặc khóa tuần.</span></div>
        <div className="tts-permission-list">{people.map(person => {
          const adminAccount = person.role === 'admin';
          const enabled = adminAccount || Boolean(person.can_manage_tts_schedule);
          return <div className="tts-permission-row" key={personId(person)}><Avatar person={person} size={34} /><div><strong>{person.full_name}</strong><span>{person.employee_code || 'Chưa có mã'} · {adminAccount ? 'Admin' : person.role === 'leader' || person.role === 'manager' ? 'Leader' : 'Nhân viên'}</span></div>{adminAccount ? <span className="tts-permission-default">Mặc định</span> : <button type="button" role="switch" aria-checked={enabled} className={`tts-permission-switch ${enabled ? 'is-on' : ''}`} onClick={() => toggleManagementPermission(person)} disabled={Boolean(savingPermission)} aria-label={`${enabled ? 'Thu' : 'Cấp'} quyền quản lý Lịch TTS cho ${person.full_name}`}><span />{savingPermission === personId(person) ? 'Đang lưu' : enabled ? 'Được sửa' : 'Chỉ xem'}</button>}</div>;
        })}</div>
      </Modal>}

      {instructionEditorOpen && <Modal title="Nội dung trực nhật" subtitle="Hướng dẫn chung hiển thị cho toàn công ty" onClose={() => setInstructionEditorOpen(false)}>
        {[['before_work', 'Trước giờ làm'], ['during_day', 'Giữa và cuối ngày'], ['weekly', 'Định kỳ hằng tuần']].map(([key, label]) => <label className="tts-field" key={key}><span>{label}</span><textarea rows="4" value={draftInstructions[key]} onChange={event => setDraftInstructions(current => ({ ...current, [key]: event.target.value }))} /></label>)}
        <div className="tts-modal__actions"><button className="btn btn--ghost" onClick={() => setInstructionEditorOpen(false)}>Hủy</button><button className="btn btn--primary" onClick={saveInstructions} disabled={saving}><Save size={16} /> Lưu nội dung</button></div>
      </Modal>}
    </main>
  );
}
