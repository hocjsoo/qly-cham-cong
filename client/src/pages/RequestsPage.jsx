import ImageLightbox from "../components/ImageLightbox";
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Edit2, X, Check, FileText, Clock, CheckCircle2, XCircle,
  Calendar, Sparkles,
  Search, Camera, AlertTriangle, Phone, Mail, MapPin, Bike, RotateCcw,
  Trash2, RefreshCw, ZoomIn
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = true, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 500 }} onClick={onCancel}>
      <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', margin: '0 auto' }}>
        <div className="modal-sheet__handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <AlertTriangle size={24} color={danger ? 'var(--red)' : 'var(--yellow)'} />
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} className="btn btn--ghost btn--full" style={{ padding: '10px', fontWeight: 700 }}>
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            className="btn btn--full"
            style={{
              background: danger ? 'var(--red)' : 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              padding: '10px'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_REQUEST_GUIDELINES = {
  annual_leave: {
    label: "🏖️ Nghỉ phép năm (P)",
    desc: "01 Ngày/tháng; nghỉ phép có hưởng lương",
    timing: "Trước ít nhất 03 ngày làm việc / Lý do phù hợp",
    requirement: "Admin trực tiếp/Zalo sau khi gửi đơn để xác nhận và bàn giao công việc",
    impact: "Trừ vào quỹ phép năm & tính đủ 1.0 công hưởng lương",
    color: "var(--green)",
    bg: "var(--green-soft)",
  },
  sick_leave: {
    label: "🏥 Nghỉ ốm (O)",
    desc: "Sử dụng khi ốm, sức khỏe không đảm bảo để làm việc",
    timing: "Nộp ngay khi phát sinh. Trường hợp đột xuất không thể báo trước thì nộp/bổ sung khi có thể",
    requirement: "Admin trực tiếp/Zalo để xác nhận tình trạng nghỉ",
    impact: "Trừ vào quỹ ngày nghỉ ốm & hưởng chế độ trợ cấp nghỉ ốm",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  unpaid_leave: {
    label: "⚪ Nghỉ không lương (KL)",
    desc: "Sử dụng khi nghỉ vì lý do cá nhân nhưng không hưởng lương, không thuộc phép",
    timing: "Trước ít nhất 03 ngày làm việc / Lý do phù hợp",
    requirement: "Admin trực tiếp/Zalo sau khi gửi đơn để xác nhận và bàn giao công việc",
    impact: "Tính 0 công và không tính lương cho các ngày nghỉ",
    color: "var(--text-muted)",
    bg: "var(--bg-raised)",
  },
  business_trip: {
    label: "💼 CT trong nước (CT1)",
    desc: "Sử dụng khi đi công tác trong nước ngoại thành HN theo yêu cầu của công việc/dự án",
    timing: "Trước ít nhất 01 ngày làm việc, hoặc sớm hơn tùy lịch công tác",
    requirement: "Admin trực tiếp/Zalo sau khi gửi đơn để xác nhận và bàn giao công việc",
    impact: "Xác nhận công tác ngoại thành & tính đủ 1.0 công / ngày",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  foreign_trip: {
    label: "✈️ CT nước ngoài (CT2)",
    desc: "Sử dụng khi đi công tác nước ngoài theo yêu cầu dự án",
    timing: "Trước ít nhất 01 ngày làm việc, hoặc sớm hơn tùy lịch công tác",
    requirement: "Admin trực tiếp/Zalo sau khi gửi đơn để xác nhận và bàn giao công việc",
    impact: "Xác nhận công tác quốc tế & tính công tác đặc biệt",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
  wfh: {
    label: "🏠 Work from home (WFH)",
    desc: "Sử dụng khi được phép làm việc tại nhà",
    timing: "Trước ngày làm việc phát sinh",
    requirement: "Báo cáo công việc và tiến độ hàng ngày cho Quản lý",
    impact: "Xác nhận làm việc tại nhà & tính đủ 1.0 công",
    color: "var(--blue)",
    bg: "var(--blue-soft)",
  },
  late: {
    label: "⏰ Giải trình đi muộn",
    desc: "Sử dụng khi nhân sự đến sau giờ làm việc quy định (08:30)",
    timing: "Nộp trong ngày phát sinh",
    requirement: "Ghi rõ lý do đi muộn và thời gian dự kiến đến văn phòng",
    impact: "Gỡ bỏ phạt muộn & khôi phục đủ công sau khi quản lý duyệt",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  early_leave: {
    label: "🏃 Giải trình về sớm",
    desc: "Sử dụng khi nhân sự rời công ty trước giờ kết thúc làm việc (17:30)",
    timing: "Nộp trước thời điểm về sớm / Trường hợp đột xuất báo cáo sau",
    requirement: "Ghi rõ lý do và bàn giao công việc còn dở",
    impact: "Ghi nhận về sớm hợp lệ sau khi được phê duyệt",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  overtime: {
    label: "⏱️ Tăng ca (OT)",
    desc: "Sử dụng khi làm việc ngoài thời gian làm việc quy định, theo yêu cầu hoặc được công ty/Quản lý phê duyệt",
    timing: "Nộp trước khi thực hiện OT",
    requirement: "Admin trực tiếp/Zalo sau khi gửi đơn để xác nhận",
    impact: "Ghi nhận số giờ OT vào Bảng tính lương & Báo cáo tổng hợp",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  vehicle_update: {
    label: "🛵 Đổi thông tin gửi xe",
    desc: "Sử dụng khi thay đổi biển số xe, phương tiện, thông tin đăng ký gửi xe",
    timing: "02 Đợt: Ngày 10 hoặc 25 hàng tháng",
    requirement: "Ghi rõ loại xe, màu sắc và biển số xe chính xác để nộp BQL Tòa 17T10",
    impact: "Tự động cập nhật biển số & vị trí gửi xe vào hồ sơ sau khi Admin duyệt",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  other: {
    label: "📌 Khác (K)",
    desc: "Sử dụng cho các trường hợp phát sinh không thuộc các loại đơn trên",
    timing: "Nộp trước hoặc ngay khi phát sinh",
    requirement: "Ghi rõ chi tiết lý do và đề xuất giải quyết",
    impact: "Lưu nhật ký giải trình & gửi thông báo đến quản lý",
    color: "var(--text-secondary)",
    bg: "var(--bg-raised)",
  },
};

const TYPE_CONFIG = {
  annual_leave:   { label: '🏖️ Nghỉ phép năm (P)',     color: 'var(--green)', bg: 'var(--green-soft)' },
  sick_leave:     { label: '🏥 Nghỉ ốm (O)',            color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  unpaid_leave:   { label: '⚪ Nghỉ không lương (KL)',   color: 'var(--text-muted)', bg: 'var(--bg-raised)' },
  business_trip:  { label: '💼 CT Trong nước (CT1)',    color: 'var(--primary)', bg: 'var(--primary-soft)' },
  foreign_trip:   { label: '✈️ CT Nước ngoài (CT2)',   color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  wfh:            { label: '🏠 Work from home (WFH)',   color: 'var(--blue)', bg: 'var(--blue-soft)' },
  late:           { label: '⏰ Giải trình đi muộn',     color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  early_leave:    { label: '🏃 Giải trình về sớm',     color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  overtime:       { label: '⏱️ Tăng ca (OT)',           color: 'var(--primary)', bg: 'var(--primary-soft)' },
  vehicle_update: { label: '🛵 Đổi thông tin gửi xe',  color: 'var(--primary)', bg: 'var(--primary-soft)' },
  other:          { label: '📌 Khác (K)',               color: 'var(--text-secondary)', bg: 'var(--bg-raised)' },
};

const STATUS_CONFIG = {
  pending:   { label: 'Chờ duyệt',  cls: 'badge--warning', icon: <Clock size={11} />, border: 'var(--yellow)' },
  approved:  { label: 'Đã duyệt',   cls: 'badge--success', icon: <CheckCircle2 size={11} />, border: 'var(--green)' },
  rejected:  { label: 'Từ chối',    cls: 'badge--danger',  icon: <XCircle size={11} />, border: 'var(--red)' },
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const REJECT_REASONS_SUGGESTIONS = [
  'Ảnh Selfie không rõ mặt / Không hợp lệ',
  'Vị trí ngoài văn phòng không báo trước',
  'Nghi vấn chấm công hộ / Gian lận',
  'Thiết bị lạ chưa đăng ký phê duyệt',
  'Không có mặt tại nơi làm việc',
];

export default function RequestsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'mine';

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'leader';

  const [tab, setTab] = useState(isManager && initialTab === 'flagged' ? 'flagged' : isManager && initialTab === 'pending' ? 'pending' : 'mine'); // 'mine' | 'pending' | 'flagged'
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [showGuidelinesCard, setShowGuidelinesCard] = useState(false);
  const [showEditGuidelinesModal, setShowEditGuidelinesModal] = useState(false);
  const [guidelines, setGuidelines] = useState(DEFAULT_REQUEST_GUIDELINES);
  const [editingTypeKey, setEditingTypeKey] = useState("annual_leave");
  const [draftGuidelines, setDraftGuidelines] = useState(DEFAULT_REQUEST_GUIDELINES);
  const [savingGuidelines, setSavingGuidelines] = useState(false);

  const loadSystemGuidelines = async () => {
    try {
      const { data } = await api.get("/settings");
      if (data && data.request_guidelines && typeof data.request_guidelines === "object") {
        setGuidelines({ ...DEFAULT_REQUEST_GUIDELINES, ...data.request_guidelines });
        setDraftGuidelines({ ...DEFAULT_REQUEST_GUIDELINES, ...data.request_guidelines });
      }
    } catch {}
  };

  useEffect(() => {
    loadSystemGuidelines();
  }, []);

  const handleSaveGuidelines = async () => {
    setSavingGuidelines(true);
    try {
      await api.put("/settings", { request_guidelines: draftGuidelines });
      setGuidelines(draftGuidelines);
      toast.success("Đã cập nhật quy định đơn từ thành công! 💾");
      setShowEditGuidelinesModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Lỗi lưu quy định đơn từ");
    } finally {
      setSavingGuidelines(false);
    }
  };

  const handleResetDefaultGuidelines = () => {
    if (!window.confirm("Bạn có chắc muốn đặt lại toàn bộ quy định 11 loại đơn từ về mặc định ban đầu?")) return;
    setDraftGuidelines(DEFAULT_REQUEST_GUIDELINES);
    toast.success("Đã nạp lại bảng quy định mặc định");
  };


  // Safe Confirmation State
  const [confirm, setConfirm] = useState(null);

  // Flagged Attendance & Photo Verification State
  const [flaggedList, setFlaggedList] = useState([]);
  const [flaggedCounts, setFlaggedCounts] = useState({ pending: 0, approved: 0, rejected: 0, with_photo: 0, with_device: 0, total: 0 });
  const [flaggedTab, setFlaggedTab] = useState('pending');
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [flaggedSearch, setFlaggedSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [rejectFlaggedTarget, setRejectFlaggedTarget] = useState(null);
  const [rejectFlaggedReason, setRejectFlaggedReason] = useState('');
  const [allowRecheckin, setAllowRecheckin] = useState(false);

  // Status & Search Filters for Requests
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Reject Request Modal State
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);
  const [viewingStaffDetail, setViewingStaffDetail] = useState(null);

  // Form State
  const [type, setType] = useState('annual_leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const queryType = searchParams.get('type');
    const queryCreate = searchParams.get('create');
    if (queryType) {
      if (TYPE_CONFIG[queryType]) {
        setType(queryType);
      }
      setShowForm(true);
    } else if (queryCreate === 'true') {
      setShowForm(true);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (tab === 'mine') {
        const { data } = await api.get('/requests/my-requests');
        setMine(Array.isArray(data) ? data : []);
      } else {
        const { data } = await api.get('/requests/pending');
        setPending(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tải danh sách đơn');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachmentUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateRequest = async () => {
    if (!startDate) {
      toast.error('Vui lòng chọn ngày áp dụng');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do cụ thể');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/requests', {
        type,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: startTime || null,
        end_time: endTime || null,
        project_id: selectedProject || null,
        reason: reason.trim(),
        attachment_url: attachmentUrl || null,
      });

      toast.success('Gửi đơn thành công! 📝');
      setShowForm(false);
      setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setReason(''); setSelectedProject(''); setAttachmentUrl('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi gửi đơn');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await api.put(`/requests/${id}/approve`);
      toast.success(res.data?.message || 'Đã duyệt đơn thành công! ✅');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi duyệt đơn');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setRejecting(true);
    try {
      const res = await api.put(`/requests/${rejectTarget._id}/reject`, { reviewer_note: rejectNote.trim() });
      toast.success(res.data?.message || 'Đã từ chối đơn! ❌');
      setRejectTarget(null);
      setRejectNote('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi từ chối đơn');
    } finally {
      setRejecting(false);
    }
  };

  const handleRevert = (reqItem) => {
    setConfirm({
      title: 'Hoàn Tác Đơn Về Chờ Duyệt',
      message: `Bạn có chắc muốn hoàn tác đơn "${TYPE_CONFIG[reqItem.type]?.label || reqItem.type}" về trạng thái "Chờ duyệt"? (Hệ thống sẽ tự động hoàn lại quỹ phép và khôi phục bảng công ban đầu).`,
      confirmLabel: 'Hoàn tác ngay',
      danger: false,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const res = await api.put(`/requests/${reqItem._id}/revert`);
          toast.success(res.data?.message || 'Đã hoàn tác đơn về trạng thái Chờ duyệt! 🔄');
          loadData();
        } catch (err) {
          toast.error(err?.response?.data?.error || 'Lỗi hoàn tác đơn');
        }
      }
    });
  };

  const handleDelete = (reqItem) => {
    setConfirm({
      title: 'Xóa Đơn Này?',
      message: `Bạn có chắc chắn muốn xóa hẳn đơn "${TYPE_CONFIG[reqItem.type]?.label || reqItem.type}" ngày ${formatDate(reqItem.start_date)}? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa hẳn đơn',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const res = await api.delete(`/requests/${reqItem._id}`);
          toast.success(res.data?.message || 'Đã xóa đơn thành công! 🗑️');
          loadData();
        } catch (err) {
          toast.error(err?.response?.data?.error || 'Lỗi xóa đơn');
        }
      }
    });
  };

  // ==========================================
  // FLAGGED ATTENDANCE & PHOTO VERIFICATION
  // ==========================================
  const fetchFlagged = useCallback(async (targetStatus) => {
    try {
      setFlaggedLoading(true);
      const st = targetStatus || flaggedTab;
      const res = await api.get(`/attendance/flagged?status=${st}`);
      if (res.data) {
        setFlaggedList(res.data.flagged || []);
        if (res.data.counts) {
          setFlaggedCounts(res.data.counts);
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tải danh sách cảnh báo chấm công');
    } finally {
      setFlaggedLoading(false);
    }
  }, [flaggedTab]);

  useEffect(() => {
    loadData();
    api.get('/projects?active_only=true').then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [loadData]);

  useEffect(() => {
    if (isManager) fetchFlagged();
  }, [fetchFlagged, isManager]);

  const handleVerifyFlagged = async (recordId, action, reviewerNote = '') => {
    try {
      setVerifyingId(recordId);
      const res = await api.put(`/attendance/flagged/verify/${recordId}`, {
        action,
        reviewer_note: reviewerNote || (action === 'approve' ? 'Đã phê duyệt ca chấm công hợp lệ' : 'Đã từ chối ca')
      });
      toast.success(res.data?.message || (action === 'approve' ? 'Đã duyệt ca chấm công thành công! ✅' : 'Đã xử lý ca!'));
      fetchFlagged();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý ca chấm công');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmRejectFlagged = async () => {
    if (!rejectFlaggedTarget) return;
    try {
      setVerifyingId(rejectFlaggedTarget._id);
      const res = await api.put(`/attendance/flagged/verify/${rejectFlaggedTarget._id}`, {
        action: 'reject',
        reviewer_note: rejectFlaggedReason.trim() || 'Nghi vấn ca chấm công không hợp lệ',
        allow_recheckin: allowRecheckin
      });
      toast.success(res.data?.message || 'Đã từ chối ca chấm công! ❌');
      setRejectFlaggedTarget(null);
      setRejectFlaggedReason('');
      setAllowRecheckin(false);
      fetchFlagged();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi xử lý từ chối ca');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRevertFlagged = (item) => {
    setConfirm({
      title: 'Hoàn Tác Ca Chấm Công',
      message: `Bạn có chắc muốn hoàn tác ca ngày ${formatDate(item.date)} của ${item.user_id?.full_name || 'nhân viên'} về trạng thái "Chờ duyệt"?`,
      confirmLabel: 'Hoàn tác ngay',
      danger: false,
      onConfirm: async () => {
        setConfirm(null);
        await handleVerifyFlagged(item._id, 'revert', 'Hoàn tác về chờ duyệt');
      }
    });
  };

  const handleDeleteFlagged = (item) => {
    setConfirm({
      title: 'Xóa Ca Chấm Công?',
      message: `Bạn có chắc chắn muốn xóa hẳn bản ghi chấm công ngày ${formatDate(item.date)} của ${item.user_id?.full_name || 'nhân viên'}?`,
      confirmLabel: 'Xóa ca này',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await handleVerifyFlagged(item._id, 'delete');
      }
    });
  };

  const rawList = tab === 'mine' ? mine : pending;
  const list = rawList.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
                        r.user_name?.toLowerCase().includes(q) ||
                        r.user_code?.toLowerCase().includes(q) ||
                        r.reason?.toLowerCase().includes(q) ||
                        r.project_name?.toLowerCase().includes(q) ||
                        TYPE_CONFIG[r.type]?.label?.toLowerCase().includes(q);

    return matchStatus && matchType && matchSearch;
  });

  const filteredFlaggedList = flaggedList.filter(item => {
    const q = flaggedSearch.trim().toLowerCase();
    if (!q) return true;
    return item.user_id?.full_name?.toLowerCase().includes(q) ||
           item.user_id?.employee_code?.toLowerCase().includes(q) ||
           item.flag_reason?.toLowerCase().includes(q) ||
           item.date?.includes(q);
  });

  // Summary counts for Requests
  const pendingCount = rawList.filter(r => r.status === 'pending').length;
  const approvedCount = rawList.filter(r => r.status === 'approved').length;
  const rejectedCount = rawList.filter(r => r.status === 'rejected').length;

  return (
    <div className="page">
      {/* Top Header */}
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Portal Phê Duyệt & Đơn Từ</div>
          <div className="page-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowForm(true)} className="btn btn--primary" style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 800 }}>
              <Plus size={16} /> Tạo đơn mới
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* Modern Top KPI Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: isManager ? "repeat(auto-fit, minmax(140px, 1fr))" : "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div className="stat-card-modern card--interactive" onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")} style={{ cursor: "pointer", border: statusFilter === "pending" ? "2px solid var(--yellow)" : "1px solid var(--border)", background: statusFilter === "pending" ? "var(--yellow-soft)" : "var(--bg-card)" }}>
            <div className="stat-card-modern__value" style={{ color: "var(--yellow)" }}>{pendingCount}</div>
            <div className="stat-card-modern__label">⏳ Chờ Duyệt</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Đơn cần xem xét</div>
          </div>

          <div className="stat-card-modern card--interactive" onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")} style={{ cursor: "pointer", border: statusFilter === "approved" ? "2px solid var(--green)" : "1px solid var(--border)", background: statusFilter === "approved" ? "var(--green-soft)" : "var(--bg-card)" }}>
            <div className="stat-card-modern__value" style={{ color: "var(--green)" }}>{approvedCount}</div>
            <div className="stat-card-modern__label">✅ Đã Phê Duyệt</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Đã tính vào công</div>
          </div>

          <div className="stat-card-modern card--interactive" onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")} style={{ cursor: "pointer", border: statusFilter === "rejected" ? "2px solid var(--red)" : "1px solid var(--border)", background: statusFilter === "rejected" ? "var(--red-soft)" : "var(--bg-card)" }}>
            <div className="stat-card-modern__value" style={{ color: "var(--red)" }}>{rejectedCount}</div>
            <div className="stat-card-modern__label">❌ Bị Từ Chối</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Không được duyệt</div>
          </div>

          {isManager && (
            <div
              className="stat-card-modern card--interactive"
              onClick={() => { setTab("flagged"); fetchFlagged(); }}
              style={{
                cursor: "pointer",
                border: tab === "flagged" ? "2px solid var(--primary)" : (flaggedCounts.pending > 0 ? "1.5px solid var(--yellow)" : "1px solid var(--border)"),
                background: tab === "flagged" ? "var(--primary-soft)" : (flaggedCounts.pending > 0 ? "var(--yellow-soft)" : "var(--bg-card)")
              }}
            >
              <div className="stat-card-modern__value" style={{ color: flaggedCounts.pending > 0 ? "var(--yellow)" : "var(--primary)" }}>
                {flaggedCounts.pending}
              </div>
              <div className="stat-card-modern__label">🛡️ Cảnh Báo & Ảnh</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Ca nghi vấn / Selfie</div>
            </div>
          )}
        </div>

        
        {/* Full In-Page Reference Table for 11 Request Types */}
        <div className="card animate-fade-in" style={{ marginBottom: "16px", padding: 0, overflow: "hidden", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>
          <div
            className="request-guidelines-toggle"
            onClick={() => setShowGuidelinesCard(!showGuidelinesCard)}
            style={{
              padding: "14px 18px", background: "var(--bg-raised)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", borderBottom: showGuidelinesCard ? "1px solid var(--border)" : "none",
              userSelect: "none"
            }}
          >
            <div className="request-guidelines-summary" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                <FileText size={18} />
              </div>
              <div>
                <strong style={{ fontSize: "14.5px", color: "var(--text)" }}>Bảng Quy Định & Thời Hạn Nộp 11 Loại Đơn Từ</strong>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>Quy chế nghỉ phép, công tác, WFH, giải trình đi muộn/về sớm và đổi xe</div>
              </div>
            </div>

            <div className="request-guidelines-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftGuidelines(guidelines);
                    setShowEditGuidelinesModal(true);
                  }}
                  className="btn btn--ghost"
                  style={{ padding: "4px 9px", fontSize: "11.5px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}
                  title="Chỉnh sửa nội dung mô tả, thời hạn nộp và yêu cầu của 11 loại đơn từ"
                >
                  <Edit2 size={13} /> Sửa quy định
                </button>
              )}
              <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700 }}>
                {showGuidelinesCard ? "Thu gọn ▲" : "Mở rộng ▼"}
              </span>
            </div>
          </div>

          {showGuidelinesCard && (
            <div style={{ overflowX: "auto", background: "var(--bg-card)" }}>
              <table style={{ width: "100%", minWidth: "780px", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--bg-raised)", borderBottom: "2px solid var(--primary)", color: "var(--text)", fontWeight: 800 }}>
                    <th style={{ padding: "10px 14px", width: "170px" }}>LOẠI ĐƠN</th>
                    <th style={{ padding: "10px 14px", minWidth: "190px" }}>MÔ TẢ</th>
                    <th style={{ padding: "10px 14px", minWidth: "180px" }}>THỜI ĐIỂM BÁO CÁO</th>
                    <th style={{ padding: "10px 14px", minWidth: "190px" }}>YÊU CẦU BÁO CÁO</th>
                    <th style={{ padding: "10px 14px", width: "100px", textAlign: "center" }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(guidelines).map(([key, g], idx) => (
                    <tr key={key} style={{ borderBottom: "1px solid var(--border-muted)", background: idx % 2 === 0 ? "transparent" : "var(--bg-raised)" }}>
                      <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: g.color, background: g.bg, padding: "3px 8px", borderRadius: "6px", display: "inline-block", border: "1px solid " + g.color + "33" }}>
                          {g.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "middle", color: "var(--text)", lineHeight: 1.5 }}>
                        {g.desc}
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "middle", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--text)" }}>{g.timing}</strong>
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "middle", color: "var(--text-muted)", lineHeight: 1.5, fontSize: "12px" }}>
                        {g.requirement}
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "middle", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setType(key);
                            setShowForm(true);
                          }}
                          className="btn btn--ghost"
                          style={{ padding: "4px 8px", fontSize: "11.5px", color: "var(--primary)", whiteSpace: "nowrap" }}
                        >
                          + Tạo đơn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Primary Role Tabs */}
        {isManager && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', background: 'var(--bg-input)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => { setTab('mine'); setStatusFilter('all'); }}
              style={{
                flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'mine' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'mine' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: tab === 'mine' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              📝 Đơn của tôi ({mine.length})
            </button>
            <button
              onClick={() => { setTab('pending'); setStatusFilter('all'); }}
              style={{
                flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'pending' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'pending' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: tab === 'pending' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              📋 Quản lý đơn nhân viên ({pending.length})
            </button>
            <button
              onClick={() => { setTab('flagged'); fetchFlagged(); }}
              style={{
                flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'flagged' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'flagged' ? 'var(--yellow)' : 'var(--text-secondary)',
                boxShadow: tab === 'flagged' ? 'var(--shadow-xs)' : 'none',
                position: 'relative',
                transition: 'all 0.15s'
              }}
            >
              🛡️ Cảnh báo & Ảnh {flaggedCounts.pending > 0 && <span className="badge badge--warning" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '4px' }}>{flaggedCounts.pending}</span>}
            </button>
          </div>
        )}

        {tab === 'flagged' ? (
          /* =========================================================================
             FLAGGED ATTENDANCE & SELFIE PHOTO VERIFICATION TAB
             ========================================================================= */
          <div>
            {/* Search and Quick Filters for Flagged Attendance */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
                  placeholder="Tìm theo tên, mã NV, lý do cảnh báo..."
                  value={flaggedSearch}
                  onChange={e => setFlaggedSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => fetchFlagged()}
                className="btn btn--ghost"
                style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Làm mới danh sách"
              >
                <RefreshCw size={14} className={flaggedLoading ? 'spinner' : ''} /> Làm mới
              </button>
            </div>

            {/* Filter Tabs for Flagged Attendance */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
              {[
                { key: 'pending', label: `⏳ Chờ duyệt (${flaggedCounts.pending})` },
                { key: 'device', label: `📱 Thiết bị lạ (${flaggedCounts.with_device || 0})` },
                { key: 'photo', label: `📸 Kèm ảnh Selfie (${flaggedCounts.with_photo})` },
                { key: 'approved', label: `✅ Đã duyệt (${flaggedCounts.approved})` },
                { key: 'rejected', label: `❌ Đã từ chối (${flaggedCounts.rejected})` },
                { key: 'all', label: `Tất cả (${flaggedCounts.total})` },
              ].map(ft => (
                <button
                  key={ft.key}
                  onClick={() => {
                    setFlaggedTab(ft.key);
                    fetchFlagged(ft.key);
                  }}
                  className={`chip${flaggedTab === ft.key ? ' active' : ''}`}
                  style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap' }}
                >
                  {ft.label}
                </button>
              ))}
            </div>

            {flaggedLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '120px', borderRadius: '14px' }} />)}
              </div>
            ) : filteredFlaggedList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🛡️</div>
                <div className="empty-state__title">Không có ca cảnh báo nào</div>
                <div className="empty-state__desc">Tất cả các ca chấm công đã được xác thực an toàn</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredFlaggedList.map(item => {
                  const isApproved = item.verification_status === 'approved';
                  const isRejected = item.verification_status === 'rejected';
                  const isPending = !isApproved && !isRejected;

                  const empName = item.user_id?.full_name || 'Nhân sự';
                  const empCode = item.user_id?.employee_code || item.user_id?.code || 'NS';
                  const deptName = item.user_id?.department_id?.name || item.user_id?.department_name || 'Văn Phòng';

                  return (
                    <div
                      key={item._id}
                      className="card animate-fade-in"
                      style={{
                        padding: '16px', borderRadius: '14px',
                        borderLeft: `4px solid ${isApproved ? 'var(--green)' : isRejected ? 'var(--red)' : 'var(--yellow)'}`,
                        background: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-xs)'
                      }}
                    >
                      {/* Top Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            className="avatar"
                            style={{
                              width: '38px', height: '38px', fontSize: '13px', borderRadius: '50%',
                              overflow: 'hidden', cursor: 'pointer', border: '1.5px solid var(--border)',
                              background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800
                            }}
                            onClick={() => {
                              if (item.user_id) setViewingStaffDetail(item.user_id);
                            }}
                            title="Xem hồ sơ nhân sự"
                          >
                            <img
                              src={item.user_id?.avatar_url || '/logo.png'}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.src = '/logo.png'; }}
                            />
                          </div>
                          <div>
                            <div
                              onClick={() => { if (item.user_id) setViewingStaffDetail(item.user_id); }}
                              style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', cursor: 'pointer' }}
                            >
                              {empName} <span style={{ color: 'var(--primary)', fontSize: '12px' }}>(#{empCode})</span>
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              🏢 {deptName}
                            </div>
                          </div>
                        </div>

                        <span className={`badge badge--${isApproved ? 'success' : isRejected ? 'danger' : 'warning'}`} style={{ fontSize: '11.5px', padding: '4px 9px' }}>
                          {isApproved ? '✅ Đã xác minh' : isRejected ? '❌ Bị từ chối' : '⏳ Chờ xem xét'}
                        </span>
                      </div>

                      {/* Main Details Body */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Selfie Image Preview */}
                        {item.selfie_url ? (
                          <div
                            onClick={() => setFullAvatarImage({ url: item.selfie_url, title: `Ảnh Selfie Chấm Công: ${empName} (${formatDate(item.date)})` })}
                            style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                            title="Click để phóng to ảnh Selfie"
                          >
                            <img
                              src={item.selfie_url}
                              alt="Selfie"
                              style={{
                                width: 78, height: 78, borderRadius: '12px', objectFit: 'cover',
                                border: `2px solid ${isApproved ? 'var(--green)' : isRejected ? 'var(--red)' : 'var(--yellow)'}`,
                                display: 'block', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                              }}
                            />
                            <div style={{
                              position: 'absolute', bottom: '4px', right: '4px',
                              background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px',
                              borderRadius: '4px', padding: '1px 4px', fontWeight: 800,
                              display: 'flex', alignItems: 'center', gap: '2px'
                            }}>
                              <ZoomIn size={10} /> Phóng to
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            width: 78, height: 78, borderRadius: '12px', background: 'var(--bg-raised)',
                            color: 'var(--text-muted)', fontSize: '10.5px', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px',
                            flexShrink: 0, border: '1px dashed var(--border)'
                          }}>
                            <Camera size={18} style={{ marginBottom: '2px' }} />
                            Không có ảnh
                          </div>
                        )}

                        {/* Attendance Metadata Info */}
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text)', marginBottom: '4px' }}>
                            📅 Ngày <strong>{formatDate(item.date)}</strong> · ⏰ Vào: <strong>{item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</strong> {item.check_out_time ? `→ Ra: ${new Date(item.check_out_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}
                          </div>

                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <span>📍 Phương thức: <strong>{item.check_in_mode === 'photo' ? 'Selfie + GPS' : item.check_in_type || 'Văn phòng'}</strong></span>
                            {item.total_hours ? <span>⏱️ {item.total_hours}h</span> : null}
                            {item.hardware_uuid && (
                              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                📱 ID Thiết bị: <code>{item.hardware_uuid.slice(0, 14)}...</code>
                              </span>
                            )}
                          </div>

                          {/* Flag Reason Banner */}
                          {item.flag_reason && (
                            <div style={{
                              fontSize: '12px', color: 'var(--yellow)', background: 'var(--yellow-soft)',
                              padding: '6px 10px', borderRadius: '8px', marginBottom: '6px', fontWeight: 600,
                              border: '1px solid rgba(234, 179, 8, 0.2)'
                            }}>
                              ⚠️ Lý do cảnh báo: {item.flag_reason}
                            </div>
                          )}

                          {/* Reviewer Note */}
                          {item.reviewer_note && (
                            <div style={{
                              fontSize: '11.5px', color: 'var(--text-secondary)', background: 'var(--bg-raised)',
                              padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)'
                            }}>
                              💬 <strong>Quản lý phản hồi:</strong> {item.reviewer_note}
                              {item.reviewed_by?.full_name && ` (bởi ${item.reviewed_by.full_name})`}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Bar for Flagged Attendance */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Left Action: Approve / Reject or Undo */}
                        <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}>
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleVerifyFlagged(item._id, 'approve')}
                                disabled={verifyingId === item._id}
                                className="btn btn--primary"
                                style={{ flex: 1, fontSize: '12px', padding: '7px 12px', fontWeight: 700 }}
                              >
                                {verifyingId === item._id ? <span className="spinner" /> : <><Check size={14} /> Duyệt ca & Tin cậy thiết bị</>}
                              </button>
                              <button
                                onClick={() => {
                                  setRejectFlaggedTarget(item);
                                  setRejectFlaggedReason('');
                                  setAllowRecheckin(false);
                                }}
                                disabled={verifyingId === item._id}
                                className="btn btn--ghost"
                                style={{ flex: 1, fontSize: '12px', padding: '7px 12px', color: 'var(--red)', fontWeight: 600 }}
                              >
                                <X size={14} /> Từ chối ca
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleRevertFlagged(item)}
                              disabled={verifyingId === item._id}
                              className="btn btn--ghost"
                              style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--primary)', fontWeight: 700 }}
                            >
                              <RotateCcw size={14} /> Hoàn tác về chờ duyệt
                            </button>
                          )}
                        </div>

                        {/* Right Action: Delete Button */}
                        <div>
                          <button
                            onClick={() => handleDeleteFlagged(item)}
                            disabled={verifyingId === item._id}
                            className="btn btn--ghost"
                            style={{
                              padding: '6px 10px', fontSize: '11.5px', color: 'var(--red)',
                              borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)',
                              borderRadius: '6px'
                            }}
                            title="Xóa bản ghi ca này"
                          >
                            <Trash2 size={13} /> Xóa ca
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             STANDARD REQUESTS TAB (MINE / PENDING / ALL STAFF)
             ========================================================================= */
          <div>
            {/* Search Bar + Type Select */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
                  placeholder="Tìm theo Tên, Mã NS, Lý do, Dự án..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: '12px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">📂 Loại đơn: Tất cả</option>
                <option value="annual_leave">🌴 Nghỉ phép năm</option>
                <option value="business_trip">🏗️ Đi công tác</option>
                <option value="wfh">🏠 Làm WFH</option>
                <option value="late">⏰ Giải trình muộn/về sớm</option>
                <option value="overtime">💪 Đơn tăng ca (OT)</option>
                <option value="vehicle_update">🛵 Đổi thông tin gửi xe</option>
                <option value="unpaid_leave">📄 Nghỉ không lương</option>
                <option value="sick_leave">🤒 Nghỉ ốm</option>
              </select>
            </div>

            {/* Status Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
              {[
                { key: 'all', label: `Tất cả (${rawList.length})` },
                { key: 'pending', label: `⏳ Chờ duyệt (${pendingCount})` },
                { key: 'approved', label: `✅ Đã duyệt (${approvedCount})` },
                { key: 'rejected', label: `❌ Từ chối (${rejectedCount})` },
              ].map(sf => (
                <button
                  key={sf.key}
                  onClick={() => setStatusFilter(sf.key)}
                  className={`chip${statusFilter === sf.key ? ' active' : ''}`}
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            {/* Request List */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '96px', borderRadius: '12px' }} />)}
              </div>
            ) : list.length === 0 ? (
              <div className="empty-state" style={{ padding: "36px 20px", borderRadius: "16px", background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center", boxShadow: "var(--shadow-xs)" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                  <FileText size={28} />
                </div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "6px" }}>Chưa có đơn từ nào phù hợp</div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px", lineHeight: 1.5 }}>
                  Bấm "Tạo đơn mới" để gửi yêu cầu xin nghỉ phép, giải trình đi muộn, làm việc tại nhà (WFH) hoặc tăng ca (OT).
                </div>
                <button type="button" onClick={() => setShowForm(true)} className="btn btn--primary" style={{ padding: "8px 18px", fontSize: "13px" }}>
                  <Plus size={15} /> Tạo đơn mới ngay
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {list.map(r => {
                  const typeCfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.other;
                  const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const displayName = r.user_name || (tab === 'mine' ? user?.full_name : 'Nhân viên');
                  const avatarUrl = r.user_avatar || r.user_id?.avatar_url || (tab === 'mine' ? user?.avatar_url : null);
                  const isOwner = r.user_id === user?._id || r.user_id?._id === user?._id || tab === 'mine';
                  const canManage = isManager && (isAdmin || r.user_id?.role !== 'admin');

                  return (
                    <div
                      key={r._id}
                      className="card animate-fade-in"
                      style={{
                        padding: '16px',
                        borderLeft: `4px solid ${statusCfg.border}`,
                        background: 'var(--bg-card)',
                        borderRadius: '14px',
                        boxShadow: 'var(--shadow-xs)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Top Row: Type Tag + Avatar + Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            className="avatar"
                            style={{
                              width: '36px', height: '36px', fontSize: '12px', flexShrink: 0,
                              borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                              border: '1.5px solid var(--border)', background: 'var(--bg-raised)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', fontWeight: 800
                            }}
                            onClick={() => {
                              if (r.user_id) setViewingStaffDetail(r.user_id);
                              else if (avatarUrl) setFullAvatarImage({ url: avatarUrl, title: displayName });
                            }}
                            title="Click để xem hồ sơ nhân sự"
                          >
                            <img
                              src={avatarUrl || '/logo.png'}
                              alt={displayName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => { e.target.src = '/logo.png'; }}
                            />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '12px', fontWeight: 700, color: typeCfg.color, background: typeCfg.bg,
                                padding: '3px 8px', borderRadius: '6px', border: `1px solid ${typeCfg.color}22`
                              }}>
                                {typeCfg.label}
                              </span>
                              <span
                                onClick={() => {
                                  if (r.user_id) setViewingStaffDetail(r.user_id);
                                }}
                                style={{
                                  fontSize: '13px', fontWeight: 800,
                                  color: r.user_id ? 'var(--primary)' : 'var(--text)',
                                  cursor: r.user_id ? 'pointer' : 'default'
                                }}
                                title={r.user_id ? 'Click để xem hồ sơ nhân sự' : ''}
                              >
                                {displayName} {r.user_code ? `(#${r.user_code})` : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`badge ${statusCfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11.5px' }}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </div>

                      {/* Proposed Vehicle Info Box for vehicle_update */}
                      {r.type === 'vehicle_update' && (
                        <div style={{
                          background: 'var(--primary-subtle, rgba(59, 130, 246, 0.12))',
                          border: '1px solid var(--primary)',
                          borderRadius: '8px', padding: '8px 12px', margin: '6px 0 8px 0'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginBottom: '3px' }}>
                            🛵 THÔNG TIN XE ĐỀ XUẤT CẬP NHẬT:
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                            {r.proposed_vehicle_info || 'Không sử dụng xe'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            🏢 Địa điểm gửi: <strong>{r.proposed_parking_location || 'Tòa 17T10 Nguyễn Thị Định'}</strong>
                          </div>
                        </div>
                      )}

                      {/* Reason Details */}
                      <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, margin: '6px 0 8px 0', lineHeight: 1.5, background: 'var(--bg-raised)', padding: '8px 12px', borderRadius: '8px' }}>
                        💬 "{r.reason}"
                      </div>

                      {/* Attachment Photo Thumbnail if present */}
                      {r.attachment_url && (
                        <div style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={r.attachment_url}
                            alt="Minh chứng"
                            onClick={() => setFullAvatarImage({ url: r.attachment_url, title: `Minh chứng đính kèm: ${displayName}` })}
                            style={{
                              width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover',
                              border: '2px solid var(--primary)', cursor: 'pointer'
                            }}
                            title="Click để phóng to ảnh minh chứng"
                          />
                          <div style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: 600 }}>
                            📸 Ảnh minh chứng đính kèm (Click để xem)
                          </div>
                        </div>
                      )}

                      {/* Time & Location Details */}
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', color: 'var(--text-muted)', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📅 {formatDate(r.start_date)} {r.end_date && r.end_date !== r.start_date ? `→ ${formatDate(r.end_date)}` : ''}
                        </span>
                        {r.start_time && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ⏰ {r.start_time} {r.end_time && `- ${r.end_time}`}
                          </span>
                        )}
                        {r.project_name && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🏗️ {r.project_name}
                          </span>
                        )}
                      </div>

                      {/* Reviewer Note if processed */}
                      {r.reviewer_note && (
                        <div style={{
                          fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-raised)',
                          padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '8px'
                        }}>
                          💬 <strong>Phản hồi của quản lý:</strong> {r.reviewer_note}
                        </div>
                      )}

                      {/* ACTION CONTROLS PANEL (Approve, Reject, Revert, Delete) */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Left Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}>
                          {/* Case 1: Pending Request under Management Tab */}
                          {tab === 'pending' && r.status === 'pending' && canManage && (
                            <>
                              <button
                                onClick={() => handleApprove(r._id)}
                                className="btn btn--primary"
                                style={{ flex: 1, fontSize: '12px', padding: '7px 12px', fontWeight: 700 }}
                              >
                                <Check size={14} /> Phê duyệt
                              </button>
                              <button
                                onClick={() => { setRejectTarget(r); setRejectNote(''); }}
                                className="btn btn--ghost"
                                style={{ flex: 1, fontSize: '12px', padding: '7px 12px', color: 'var(--red)', fontWeight: 600 }}
                              >
                                <X size={14} /> Từ chối
                              </button>
                            </>
                          )}

                          {/* Case 2: Processed Request under Management Tab -> Undo / Revert Option */}
                          {tab === 'pending' && r.status !== 'pending' && canManage && (
                            <button
                              onClick={() => handleRevert(r)}
                              className="btn btn--ghost"
                              style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--primary)', fontWeight: 700 }}
                              title="Hoàn tác đơn về trạng thái Chờ duyệt"
                            >
                              <RotateCcw size={14} /> Hoàn tác về chờ duyệt
                            </button>
                          )}

                          {/* Case 3: Admin review boundary note */}
                          {tab === 'pending' && !isAdmin && r.user_id?.role === 'admin' && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              🔒 Đơn của Ban Giám Đốc (Chỉ Admin duyệt)
                            </div>
                          )}
                        </div>

                        {/* Right Action: Delete Button */}
                        <div>
                          {(isManager || (isOwner && r.status === 'pending')) && (
                            <button
                              onClick={() => handleDelete(r)}
                              className="btn btn--ghost"
                              style={{
                                padding: '6px 10px', fontSize: '11.5px', color: 'var(--red)',
                                borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)',
                                borderRadius: '6px'
                              }}
                              title="Xóa đơn này"
                            >
                              <Trash2 size={13} /> {tab === 'mine' ? 'Hủy đơn' : 'Xóa'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal Sheet */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Modern Create Request Sheet Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '640px',
              width: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto',
              borderRadius: '16px',
              padding: '22px 26px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
            }}
          >
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Tạo Đơn Từ Mới</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gửi đơn xin nghỉ phép, giải trình đi muộn, làm ngoài giờ (OT)...</div>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Loại đơn xin phép *</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Detailed Guideline Information Card matching company standard */}
            {(() => {
              const g = guidelines[type] || REQUEST_GUIDELINES.other;
              return (
                <div style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  marginBottom: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: g.color, background: g.bg, padding: "3px 8px", borderRadius: "6px", border: "1px solid " + g.color + "33" }}>
                      {g.label}
                    </span>
                    <span style={{ fontSize: "12.5px", color: "var(--text)", fontWeight: 600 }}>
                      {g.desc}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", fontSize: "11.5px", paddingTop: "6px", borderTop: "1px solid var(--border-muted)" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>⏰ Thời điểm báo cáo: </span>
                      <strong style={{ color: "var(--text)" }}>{g.timing}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>📌 Yêu cầu: </span>
                      <strong style={{ color: "var(--text)" }}>{g.requirement}</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: "11.5px", color: "var(--primary)", fontWeight: 600, background: "var(--primary-soft)", padding: "6px 10px", borderRadius: "6px" }}>
                    ⚡ Tác động hệ thống: {g.impact}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>📅 Từ ngày *</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>📅 Đến ngày</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                />
              </div>
            </div>

            {['late', 'early_leave', 'overtime'].includes(type) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>⏱️ Từ giờ</label>
                  <input
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>⏱️ Đến giờ</label>
                  <input
                    type="time"
                    className="form-input"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
              </div>
            )}

            {['business_trip', 'overtime'].includes(type) && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>🏗️ Dự án / Công trình liên quan (Nếu có)</label>
                <select className="form-select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">-- Không gắn dự án --</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name} ({p.code || 'DA'})</option>)}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>📝 Lý do cụ thể *</label>
              <textarea
                className="form-input"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Nhập lý do xin nghỉ, giải trình đi muộn, nội dung công việc..."
              />
            </div>

            {/* Ảnh minh chứng đính kèm */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                <span>📸 Ảnh minh chứng đính kèm (Không bắt buộc)</span>
                {attachmentUrl && (
                  <button type="button" onClick={() => setAttachmentUrl('')} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '11.5px', cursor: 'pointer', fontWeight: 700 }}>
                    Xóa ảnh
                  </button>
                )}
              </label>

              {attachmentUrl ? (
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '4px' }}>
                  <img
                    src={attachmentUrl}
                    alt="Preview"
                    style={{ width: '84px', height: '84px', borderRadius: '10px', objectFit: 'cover', border: '2px solid var(--primary)' }}
                  />
                </div>
              ) : (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', borderRadius: '10px', border: '1.5px dashed var(--border)',
                  background: 'var(--bg-raised)', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)',
                  transition: 'all 0.15s'
                }}>
                  <Camera size={20} color="var(--primary)" />
                  <span>Chạm để chọn ảnh / chụp từ camera điện thoại</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn--ghost"
                style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCreateRequest}
                disabled={submitting}
                className="btn btn--primary"
                style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 800 }}
              >
                {submitting ? <span className="spinner" /> : '🚀 Gửi đơn xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal for Requests */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--red)' }}>Từ chối đơn từ</h3>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Lý do từ chối *</label>
              <textarea
                className="form-input"
                rows={3}
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Nhập ghi chú phản hồi lý do không duyệt đơn..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button onClick={handleConfirmReject} disabled={rejecting} className="btn btn--full" style={{ background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 700 }}>
                {rejecting ? <span className="spinner" /> : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Flagged Attendance Modal */}
      {rejectFlaggedTarget && (
        <div className="modal-overlay" onClick={() => setRejectFlaggedTarget(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="var(--red)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--red)', margin: 0 }}>Từ chối ca chấm công</h3>
              </div>
              <button onClick={() => setRejectFlaggedTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
              Xác nhận từ chối ca chấm công của nhân sự <strong>{rejectFlaggedTarget.user_id?.full_name || 'Nhân viên'}</strong> vào ngày <strong>{formatDate(rejectFlaggedTarget.date)}</strong>.
            </div>

            {/* Quick Reason Suggestions */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Gợi ý lý do nhanh:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {REJECT_REASONS_SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectFlaggedReason(sug)}
                    className="chip"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Lý do từ chối cụ thể *</label>
              <textarea
                className="form-input"
                rows={3}
                value={rejectFlaggedReason}
                onChange={e => setRejectFlaggedReason(e.target.value)}
                placeholder="Nhập lý do hoặc chọn từ gợi ý phía trên..."
              />
            </div>

            <div className="form-group" style={{ background: 'var(--bg-raised)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={allowRecheckin}
                  onChange={e => setAllowRecheckin(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>Xóa ca hôm nay để nhân viên được phép chấm công lại</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setRejectFlaggedTarget(null)} className="btn btn--ghost btn--full" style={{ padding: '10px', fontWeight: 700 }}>
                Hủy
              </button>
              <button
                onClick={handleConfirmRejectFlagged}
                disabled={verifyingId === rejectFlaggedTarget._id}
                className="btn btn--full"
                style={{ background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 800, padding: '10px' }}
              >
                {verifyingId === rejectFlaggedTarget._id ? <span className="spinner" /> : 'Xác nhận từ chối ❌'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullsize Avatar Lightbox Modal */}
      <ImageLightbox image={fullAvatarImage} onClose={() => setFullAvatarImage(null)} />

      {/* Staff Profile Detail Modal */}
      {viewingStaffDetail && (
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px' }} onClick={() => setViewingStaffDetail(null)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px', width: '100%', margin: '0 auto',
              padding: '24px', borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              border: '1px solid var(--border)'
            }}
          >
            <div className="modal-sheet__handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>👤</span>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  Hồ Sơ Nhân Sự
                </h3>
              </div>
              <button
                onClick={() => setViewingStaffDetail(null)}
                className="btn btn--ghost"
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Highlight Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%)',
              padding: '18px', borderRadius: '16px',
              border: '1px solid var(--primary-soft)', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div
                onClick={() => {
                  const av = viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar;
                  if (av) {
                    setFullAvatarImage({ url: av, title: viewingStaffDetail.full_name || viewingStaffDetail.user_name });
                  }
                }}
                style={{ cursor: (viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar) ? 'zoom-in' : 'default', position: 'relative' }}
                title={(viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar) ? 'Click để xem ảnh lớn' : ''}
              >
                <img
                  src={viewingStaffDetail.avatar_url || viewingStaffDetail.user_avatar || '/logo.png'}
                  alt=""
                  style={{ width: 62, height: 62, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)' }}
                  onError={e => { e.target.src = '/logo.png'; }}
                />
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>
                  {viewingStaffDetail.full_name || viewingStaffDetail.user_name || 'Nhân viên'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>
                  #{viewingStaffDetail.employee_code || viewingStaffDetail.user_code || 'NS'} · {viewingStaffDetail.position || 'Nhân sự'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  🏢 {viewingStaffDetail.department_name || viewingStaffDetail.department_id?.name || 'Văn Phòng'}
                </div>
              </div>
            </div>

            {/* Detailed Info List */}
            <div style={{
              background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '12px',
              border: '1px solid var(--border)', fontSize: '13px',
              display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} /> Email:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.email || 'Chưa cập nhật'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} /> Điện thoại:
                </span>
                {viewingStaffDetail.phone ? (
                  <a href={`tel:${viewingStaffDetail.phone}`} style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>
                    {viewingStaffDetail.phone}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Chưa cập nhật</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Ngày gia nhập:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.join_date || (viewingStaffDetail.start_year ? `Năm ${viewingStaffDetail.start_year}` : 'Chưa cập nhật')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> Điểm gửi xe:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {viewingStaffDetail.parking_location || 'Tòa 17T10 Nguyễn Thị Định'}
                </span>
              </div>

              {viewingStaffDetail.vehicle_info && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bike size={14} /> Phương tiện:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {viewingStaffDetail.vehicle_info}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setViewingStaffDetail(null)}
              className="btn btn--primary btn--full btn--lg"
              style={{ padding: '12px', fontSize: '14px', fontWeight: 800, borderRadius: '12px' }}
            >
              Đóng hồ sơ ✓
            </button>
          </div>
        </div>
      )}
    
      {/* Full Guideline Table Modal Sheet */}
      {showGuidelineModal && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: "16px" }} onClick={() => setShowGuidelineModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: "860px", width: "100%", margin: "auto", padding: "22px 24px", maxHeight: "calc(100dvh - 40px)", display: "flex", flexDirection: "column" }}>
            <div className="modal-sheet__handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "var(--text)" }}>Bảng Quy Định Các Loại Đơn Từ</h3>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Quy chế nghỉ phép, công tác, WFH, giải trình và đổi thông tin xe</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowGuidelineModal(false)} className="btn btn--ghost" style={{ padding: "4px 8px" }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--bg-raised)", borderBottom: "2px solid var(--primary)", color: "var(--text)", fontWeight: 800 }}>
                    <th style={{ padding: "10px 12px", width: "160px" }}>LOẠI ĐƠN</th>
                    <th style={{ padding: "10px 12px", minWidth: "180px" }}>MÔ TẢ</th>
                    <th style={{ padding: "10px 12px", minWidth: "170px" }}>THỜI ĐIỂM BÁO CÁO</th>
                    <th style={{ padding: "10px 12px", minWidth: "180px" }}>YÊU CẦU BÁO CÁO</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(guidelines).map(([key, g], idx) => (
                    <tr key={key} style={{ borderBottom: "1px solid var(--border-muted)", background: idx % 2 === 0 ? "transparent" : "var(--bg-raised)" }}>
                      <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: g.color, background: g.bg, padding: "3px 8px", borderRadius: "6px", display: "inline-block" }}>
                          {g.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "top", color: "var(--text)", lineHeight: 1.5 }}>
                        {g.desc}
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "top", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        <strong>{g.timing}</strong>
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "top", color: "var(--text-muted)", lineHeight: 1.5, fontSize: "12px" }}>
                        {g.requirement}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                💡 Vui lòng tuân thủ đúng thời hạn và yêu cầu để được phê duyệt kịp thời
              </span>
              <button type="button" onClick={() => setShowGuidelineModal(false)} className="btn btn--primary" style={{ padding: "8px 24px" }}>
                Đã hiểu ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit Guidelines Modal Sheet */}
      {showEditGuidelinesModal && (
        <div className="modal-overlay" style={{ zIndex: 999999, padding: "16px" }} onClick={() => setShowEditGuidelinesModal(false)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: "640px", width: "100%", margin: "auto", padding: "22px 24px", maxHeight: "calc(100dvh - 40px)", display: "flex", flexDirection: "column" }}>
            <div className="modal-sheet__handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "var(--text)" }}>Chỉnh Sửa Quy Định Đơn Từ</h3>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Thay đổi mô tả, thời hạn nộp và yêu cầu báo cáo cho từng loại đơn</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowEditGuidelinesModal(false)} className="btn btn--ghost" style={{ padding: "4px 8px" }}><X size={18} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Chọn loại đơn cần chỉnh sửa:</label>
              <select
                className="form-select"
                value={editingTypeKey}
                onChange={e => setEditingTypeKey(e.target.value)}
                style={{ fontWeight: 700, color: "var(--primary)" }}
              >
                {Object.entries(draftGuidelines).map(([k, g]) => (
                  <option key={k} value={k}>{g.label}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mô tả loại đơn</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={draftGuidelines[editingTypeKey]?.desc || ""}
                  onChange={e => setDraftGuidelines({
                    ...draftGuidelines,
                    [editingTypeKey]: { ...draftGuidelines[editingTypeKey], desc: e.target.value }
                  })}
                  placeholder="Mô tả mục đích sử dụng loại đơn..."
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">⏰ Thời điểm báo cáo (Quy định hạn nộp)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={draftGuidelines[editingTypeKey]?.timing || ""}
                  onChange={e => setDraftGuidelines({
                    ...draftGuidelines,
                    [editingTypeKey]: { ...draftGuidelines[editingTypeKey], timing: e.target.value }
                  })}
                  placeholder="VD: Trước ít nhất 03 ngày làm việc / Lý do phù hợp..."
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">📌 Yêu cầu báo cáo & Xác nhận</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={draftGuidelines[editingTypeKey]?.requirement || ""}
                  onChange={e => setDraftGuidelines({
                    ...draftGuidelines,
                    [editingTypeKey]: { ...draftGuidelines[editingTypeKey], requirement: e.target.value }
                  })}
                  placeholder="VD: Admin trực tiếp/Zalo sau khi gửi đơn để xác nhận..."
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">⚡ Tác động hệ thống (Tính công / Trừ phép)</label>
                <input
                  type="text"
                  className="form-input"
                  value={draftGuidelines[editingTypeKey]?.impact || ""}
                  onChange={e => setDraftGuidelines({
                    ...draftGuidelines,
                    [editingTypeKey]: { ...draftGuidelines[editingTypeKey], impact: e.target.value }
                  })}
                  placeholder="VD: Trừ vào quỹ phép năm & tính đủ 1.0 công..."
                />
              </div>
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={handleResetDefaultGuidelines}
                className="btn btn--ghost"
                style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}
                title="Khôi phục toàn bộ bảng quy định 11 loại đơn về mặc định ban đầu"
              >
                <RefreshCw size={13} /> Đặt lại mặc định
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => setShowEditGuidelinesModal(false)} className="btn btn--ghost">Hủy</button>
                <button
                  type="button"
                  onClick={handleSaveGuidelines}
                  disabled={savingGuidelines}
                  className="btn btn--primary"
                  style={{ fontWeight: 800, padding: "0 22px" }}
                >
                  {savingGuidelines ? <span className="spinner" /> : "Lưu quy định 💾"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
