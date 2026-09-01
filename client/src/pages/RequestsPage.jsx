import ImageLightbox from "../components/ImageLightbox";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Edit2, X, Check, FileText, Clock, CheckCircle2, XCircle,
  Calendar, Sparkles, Search, Camera, AlertTriangle, Bike, RotateCcw,
  Trash2, RefreshCw, ZoomIn, Info, ShieldAlert, ChevronRight, MapPin, Building
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';
import HeaderActions from '../components/HeaderActions';

function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = true, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 600 }} onClick={onCancel}>
      <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', margin: '0 auto' }}>
        <div className="modal-sheet__handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: danger ? 'var(--red-soft)' : 'var(--yellow-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AlertTriangle size={20} color={danger ? 'var(--red)' : 'var(--yellow)'} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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
    timing: "Nộp ngay khi phát sinh hoặc bổ sung khi có thể",
    requirement: "Thông báo quản lý xác nhận tình trạng nghỉ",
    impact: "Trừ vào quỹ ngày nghỉ ốm & hưởng chế độ trợ cấp nghỉ ốm",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  unpaid_leave: {
    label: "⚪ Nghỉ không lương (KL)",
    desc: "Sử dụng khi nghỉ việc cá nhân nhưng không hưởng lương, không thuộc phép",
    timing: "Trước ít nhất 03 ngày làm việc / Lý do phù hợp",
    requirement: "Bàn giao công việc cho người trực thay",
    impact: "Tính 0.0 công và không tính lương cho ngày nghỉ (KL)",
    color: "var(--text-muted)",
    bg: "var(--bg-raised)",
  },
  business_trip: {
    label: "💼 CT trong nước (CT1)",
    desc: "Đi công tác trong nước ngoại thành theo yêu cầu của công việc/dự án",
    timing: "Trước ít nhất 01 ngày làm việc",
    requirement: "Ghi rõ dự án và bàn giao công việc tại văn phòng",
    impact: "Xác nhận công tác ngoại thành & tính đủ 1.0 công / ngày",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  foreign_trip: {
    label: "✈️ CT nước ngoài (CT2)",
    desc: "Đi công tác nước ngoài theo yêu cầu dự án",
    timing: "Trước ít nhất 01 ngày làm việc",
    requirement: "Báo cáo lịch trình chi tiết và liên lạc với PM",
    impact: "Xác nhận công tác quốc tế & tính công tác đặc biệt",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
  wfh: {
    label: "🏠 Work from home (WFH)",
    desc: "Làm việc tại nhà theo kế hoạch hoặc lý do đặc biệt",
    timing: "Trước ngày làm việc phát sinh",
    requirement: "Báo cáo công việc và tiến độ hàng ngày cho Quản lý",
    impact: "Xác nhận làm việc tại nhà & tính đủ 1.0 công",
    color: "var(--blue)",
    bg: "var(--blue-soft)",
  },
  late: {
    label: "⏰ Giải trình đi muộn",
    desc: "Nhân sự đến sau giờ làm việc quy định (sau 09:00)",
    timing: "Nộp trong ngày phát sinh",
    requirement: "Ghi rõ lý do đi muộn và thời gian đến văn phòng",
    impact: "Gỡ phạt muộn & khôi phục đủ công sau khi quản lý duyệt",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  early_leave: {
    label: "🏃 Giải trình về sớm",
    desc: "Nhân sự rời công ty trước giờ kết thúc ca (trước 18:30)",
    timing: "Nộp trước thời điểm về sớm / Trường hợp đột xuất báo cáo sau",
    requirement: "Ghi rõ lý do và bàn giao công việc còn dở",
    impact: "Ghi nhận về sớm hợp lệ sau khi được phê duyệt",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  forgot_checkout: {
    label: "🚪 Bổ sung giờ checkout",
    desc: "Sử dụng khi đã check-in nhưng quên bấm checkout lúc ra về",
    timing: "Nộp trong vòng 24h - 48h sau ca làm việc",
    requirement: "Nhập chính xác giờ ra thực tế đề xuất & lý do",
    impact: "Cập nhật giờ ra, tính lại tổng giờ làm việc và OT/Về sớm",
    color: "var(--yellow)",
    bg: "var(--yellow-soft)",
  },
  overtime: {
    label: "⏱️ Tăng ca (OT)",
    desc: "Làm việc ngoài giờ theo yêu cầu dự án hoặc được phê duyệt",
    timing: "Nộp trước khi thực hiện hoặc trong ca làm thêm",
    requirement: "Ghi rõ dự án, nội dung công việc và số giờ làm thêm",
    impact: "Ghi nhận số giờ OT vào Báo cáo & Bảng lương",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  vehicle_update: {
    label: "🛵 Đổi thông tin gửi xe",
    desc: "Thay đổi biển số xe, loại xe đăng ký vé xe tòa nhà",
    timing: "02 Đợt: Ngày 10 hoặc 25 hàng tháng",
    requirement: "Cung cấp chính xác Loại xe, Biển số và Màu xe",
    impact: "Tự động cập nhật biển số & vị trí gửi xe vào hồ sơ cá nhân",
    color: "var(--primary)",
    bg: "var(--primary-soft)",
  },
  other: {
    label: "📌 Khác (K)",
    desc: "Các trường hợp phát sinh đặc biệt khác",
    timing: "Nộp trước hoặc ngay khi phát sinh",
    requirement: "Ghi rõ chi tiết lý do và đề xuất",
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
  forgot_checkout:{ label: '🚪 Bổ sung giờ checkout',   color: 'var(--yellow)', bg: 'var(--yellow-soft)' },
  overtime:       { label: '⏱️ Tăng ca (OT)',           color: 'var(--primary)', bg: 'var(--primary-soft)' },
  vehicle_update: { label: '🛵 Đổi thông tin gửi xe',  color: 'var(--primary)', bg: 'var(--primary-soft)' },
  other:          { label: '📌 Khác (K)',               color: 'var(--text-secondary)', bg: 'var(--bg-raised)' },
};

const STATUS_CONFIG = {
  pending:   { label: 'Chờ duyệt',  cls: 'badge--warning', icon: <Clock size={12} />, border: 'var(--yellow)' },
  approved:  { label: 'Đã duyệt',   cls: 'badge--success', icon: <CheckCircle2 size={12} />, border: 'var(--green)' },
  rejected:  { label: 'Từ chối',    cls: 'badge--danger',  icon: <XCircle size={12} />, border: 'var(--red)' },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'mine';

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'leader';

  // 3 Primary Tabs: 'mine' | 'pending' | 'history' (plus 'flagged' for managers)
  const [tab, setTab] = useState(
    isManager && initialTab === 'flagged' ? 'flagged' :
    isManager && initialTab === 'pending' ? 'pending' :
    initialTab === 'history' ? 'history' : 'mine'
  );

  const [mineList, setMineList] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [showEditGuidelinesModal, setShowEditGuidelinesModal] = useState(false);
  const [guidelines, setGuidelines] = useState(DEFAULT_REQUEST_GUIDELINES);
  const [editingTypeKey, setEditingTypeKey] = useState("annual_leave");
  const [draftGuidelines, setDraftGuidelines] = useState(DEFAULT_REQUEST_GUIDELINES);
  const [savingGuidelines, setSavingGuidelines] = useState(false);

  // Confirm dialog
  const [confirm, setConfirm] = useState(null);

  // Flagged Attendance State
  const [flaggedList, setFlaggedList] = useState([]);
  const [flaggedCounts, setFlaggedCounts] = useState({ pending: 0, approved: 0, rejected: 0, with_photo: 0, with_device: 0, total: 0 });
  const [flaggedTab, setFlaggedTab] = useState('pending');
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [flaggedSearch, setFlaggedSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [rejectFlaggedTarget, setRejectFlaggedTarget] = useState(null);
  const [rejectFlaggedReason, setRejectFlaggedReason] = useState('');
  const [allowRecheckin, setAllowRecheckin] = useState(false);

  // Single Toolbar Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(''); // 'YYYY-MM'
  const [search, setSearch] = useState('');

  // Reject Request Modal State
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [fullAvatarImage, setFullAvatarImage] = useState(null);

  // Create Request Form State
  const [type, setType] = useState('annual_leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dedicated Vehicle Update Fields [P1 Bug Fix]
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleParkingLocation, setVehicleParkingLocation] = useState('Tòa 17T10 Nguyễn Thị Định');

  // Load Guidelines from settings
  const loadSystemGuidelines = async () => {
    try {
      const { data } = await api.get("/settings");
      if (data && data.request_guidelines && typeof data.request_guidelines === "object") {
        const merged = { ...DEFAULT_REQUEST_GUIDELINES, ...data.request_guidelines };
        setGuidelines(merged);
        setDraftGuidelines(merged);
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

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (tab === 'mine') {
        const { data } = await api.get('/requests/my-requests');
        setMineList(Array.isArray(data) ? data : []);
      } else if (tab === 'pending' || tab === 'history') {
        const { data } = await api.get('/requests/pending');
        setPendingList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi tải danh sách đơn');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  // Flagged Attendance loader
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
    if (isManager && tab === 'flagged') fetchFlagged();
  }, [fetchFlagged, isManager, tab]);

  useEffect(() => {
    const queryType = searchParams.get('type');
    const queryCreate = searchParams.get('create');
    if (queryType && TYPE_CONFIG[queryType]) {
      setType(queryType);
      setShowForm(true);
    } else if (queryCreate === 'true') {
      setShowForm(true);
    }
  }, [searchParams]);

  // Image picker helper
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

  // Create Request Handler
  const handleCreateRequest = async () => {
    if (!startDate) {
      toast.error('Vui lòng chọn ngày áp dụng');
      return;
    }

    let finalProposedVehicleInfo = null;
    let finalReason = reason.trim();

    if (type === 'vehicle_update') {
      if (!vehiclePlate.trim() && !vehicleModel.trim()) {
        toast.error('Vui lòng nhập Biển số xe hoặc Loại xe đăng ký mới');
        return;
      }
      const parts = [];
      if (vehicleModel.trim()) parts.push(vehicleModel.trim());
      if (vehicleColor.trim()) parts.push(`Màu ${vehicleColor.trim()}`);
      if (vehiclePlate.trim()) parts.push(`(${vehiclePlate.trim().toUpperCase()})`);
      finalProposedVehicleInfo = parts.join(' - ');

      if (!finalReason) {
        finalReason = `Đổi thông tin phương tiện gửi xe: ${finalProposedVehicleInfo}`;
      }
    }

    if (!finalReason) {
      toast.error('Vui lòng nhập lý do cụ thể');
      return;
    }

    const selectedProj = projects.find(p => p._id === selectedProjectId);

    setSubmitting(true);
    try {
      await api.post('/requests', {
        type,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: startTime || null,
        end_time: endTime || null,
        project_id: selectedProjectId || null,
        project_name: selectedProj ? selectedProj.name : null,
        proposed_parking_location: type === 'vehicle_update' ? vehicleParkingLocation : null,
        proposed_vehicle_info: finalProposedVehicleInfo,
        reason: finalReason,
        attachment_url: attachmentUrl || null,
      });

      toast.success('Gửi đơn thành công! 📝');
      setShowForm(false);
      // Reset form
      setStartDate(''); setEndDate(''); setStartTime(''); setEndTime('');
      setReason(''); setSelectedProjectId(''); setAttachmentUrl('');
      setVehiclePlate(''); setVehicleModel(''); setVehicleColor('');
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Lỗi gửi đơn');
    } finally {
      setSubmitting(false);
    }
  };

  // Approval actions
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
      message: `Bạn có chắc muốn hoàn tác đơn "${TYPE_CONFIG[reqItem.type]?.label || reqItem.type}" ngày ${formatDate(reqItem.start_date)}? (Hệ thống sẽ phục hồi nguyên vẹn 100% dữ liệu trước khi duyệt).`,
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
      message: `Bạn có chắc chắn muốn xóa hẳn đơn "${TYPE_CONFIG[reqItem.type]?.label || reqItem.type}" ngày ${formatDate(reqItem.start_date)}?`,
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

  // Flagged verification handlers
  const handleVerifyFlagged = async (recordId, action, reviewerNote = '') => {
    try {
      setVerifyingId(recordId);
      const res = await api.put(`/attendance/flagged/verify/${recordId}`, {
        action,
        reviewer_note: reviewerNote || (action === 'approve' ? 'Đã phê duyệt ca chấm công hợp lệ' : 'Đã từ chối ca')
      });
      toast.success(res.data?.message || (action === 'approve' ? 'Đã duyệt ca & tin cậy thiết bị! ✅' : 'Đã xử lý ca!'));
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

  // Filtered requests list
  const currentBaseList = useMemo(() => {
    if (tab === 'mine') return mineList;
    if (tab === 'pending') return pendingList.filter(r => r.status === 'pending');
    if (tab === 'history') return pendingList.filter(r => r.status !== 'pending');
    return [];
  }, [tab, mineList, pendingList]);

  const filteredRequests = useMemo(() => {
    return currentBaseList.filter(r => {
      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      // Month filter
      if (monthFilter && r.start_date && !r.start_date.startsWith(monthFilter)) return false;
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          r.user_name?.toLowerCase().includes(q) ||
          r.user_code?.toLowerCase().includes(q) ||
          r.reason?.toLowerCase().includes(q) ||
          r.project_name?.toLowerCase().includes(q) ||
          r.proposed_vehicle_info?.toLowerCase().includes(q) ||
          TYPE_CONFIG[r.type]?.label?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [currentBaseList, statusFilter, typeFilter, monthFilter, search]);

  // Counts
  const pendingCountTotal = useMemo(() => pendingList.filter(r => r.status === 'pending').length, [pendingList]);
  const myPendingCount = useMemo(() => mineList.filter(r => r.status === 'pending').length, [mineList]);

  return (
    <div className="page">
      {/* 1. Header & Main Action Controls */}
      <div className="header">
        <div className="header__inner">
          <div className="header__title">Quản Lý Đơn Từ & Giải Trình</div>
          <div className="page-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowGuidelineModal(true)}
              className="btn btn--ghost"
              style={{ padding: '7px 12px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Xem bảng quy định 11 loại đơn từ và thời hạn nộp"
            >
              <Info size={16} /> Xem quy định
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn--primary"
              style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Tạo đơn mới
            </button>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '14px' }}>
        {/* 2. Structured Tab Bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', background: 'var(--bg-input)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => { setTab('mine'); setStatusFilter('all'); }}
            style={{
              flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              background: tab === 'mine' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'mine' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: tab === 'mine' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <span>📝 Đơn của tôi</span>
            {myPendingCount > 0 && <span className="badge badge--warning" style={{ fontSize: '10px', padding: '1px 6px' }}>{myPendingCount}</span>}
          </button>

          {isManager && (
            <button
              onClick={() => { setTab('pending'); setStatusFilter('all'); }}
              style={{
                flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'pending' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'pending' ? 'var(--yellow)' : 'var(--text-secondary)',
                boxShadow: tab === 'pending' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span>⏳ Cần duyệt</span>
              {pendingCountTotal > 0 && <span className="badge badge--warning" style={{ fontSize: '10px', padding: '1px 6px' }}>{pendingCountTotal}</span>}
            </button>
          )}

          {isManager && (
            <button
              onClick={() => { setTab('history'); setStatusFilter('all'); }}
              style={{
                flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'history' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: tab === 'history' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              📜 Lịch sử xử lý
            </button>
          )}

          {isManager && (
            <button
              onClick={() => { setTab('flagged'); fetchFlagged(); }}
              style={{
                flex: 1, padding: '9px 10px', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                background: tab === 'flagged' ? 'var(--bg-card)' : 'transparent',
                color: tab === 'flagged' ? 'var(--yellow)' : 'var(--text-secondary)',
                boxShadow: tab === 'flagged' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span>🛡️ Cảnh báo & Selfie</span>
              {flaggedCounts.pending > 0 && <span className="badge badge--warning" style={{ fontSize: '10px', padding: '1px 6px' }}>{flaggedCounts.pending}</span>}
            </button>
          )}
        </div>

        {/* 3. Tab Content */}
        {tab === 'flagged' ? (
          /* =========================================================================
             FLAGGED ATTENDANCE VERIFICATION MODULE
             ========================================================================= */
          <div>
            {/* Toolbar for Flagged Attendance */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
                  placeholder="Tìm theo tên nhân sự, mã NV, lý do cảnh báo..."
                  value={flaggedSearch}
                  onChange={e => setFlaggedSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => fetchFlagged()}
                className="btn btn--ghost"
                style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={flaggedLoading ? 'spinner' : ''} /> Làm mới
              </button>
            </div>

            {/* Filter Pills for Flagged */}
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
                  onClick={() => { setFlaggedTab(ft.key); fetchFlagged(ft.key); }}
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
            ) : flaggedList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🛡️</div>
                <div className="empty-state__title">Không có ca cảnh báo nào</div>
                <div className="empty-state__desc">Tất cả các ca chấm công đã được xác thực an toàn</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {flaggedList.filter(item => {
                  const q = flaggedSearch.trim().toLowerCase();
                  if (!q) return true;
                  return item.user_id?.full_name?.toLowerCase().includes(q) ||
                         item.user_id?.employee_code?.toLowerCase().includes(q) ||
                         item.flag_reason?.toLowerCase().includes(q) ||
                         item.date?.includes(q);
                }).map(item => {
                  const isApproved = item.verification_status === 'approved';
                  const isRejected = item.verification_status === 'rejected';
                  const isPending = !isApproved && !isRejected;
                  const empName = item.user_id?.full_name || 'Nhân sự';
                  const empCode = item.user_id?.employee_code || item.user_id?.code || 'NS';
                  const deptName = item.user_id?.department_id?.name || 'Văn Phòng';

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                            {empName} <span style={{ color: 'var(--primary)', fontSize: '12px' }}>(#{empCode})</span>
                          </span>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>🏢 {deptName}</div>
                        </div>
                        <span className={`badge badge--${isApproved ? 'success' : isRejected ? 'danger' : 'warning'}`} style={{ fontSize: '11.5px', padding: '4px 9px' }}>
                          {isApproved ? '✅ Đã xác minh' : isRejected ? '❌ Bị từ chối' : '⏳ Chờ xem xét'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {item.selfie_url ? (
                          <button
                            type="button"
                            aria-label={`Xem ảnh selfie của ${empName}`}
                            onClick={() => setFullAvatarImage({ url: item.selfie_url, title: `Ảnh Selfie: ${empName} (${formatDate(item.date)})` })}
                            style={{ position: 'relative', cursor: 'pointer', flexShrink: 0, padding: 0, border: 0, background: 'transparent', borderRadius: '12px' }}
                          >
                            <img
                              src={item.selfie_url}
                              alt="Selfie"
                              loading="lazy"
                              decoding="async"
                              style={{ width: 78, height: 78, borderRadius: '12px', objectFit: 'cover', border: `2px solid ${isApproved ? 'var(--green)' : isRejected ? 'var(--red)' : 'var(--yellow)'}` }}
                            />
                            <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', borderRadius: '4px', padding: '1px 4px', fontWeight: 800 }}>
                              <ZoomIn size={10} /> Xem
                            </div>
                          </button>
                        ) : (
                          <div style={{ width: 78, height: 78, borderRadius: '12px', background: 'var(--bg-raised)', color: 'var(--text-muted)', fontSize: '10.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px', flexShrink: 0, border: '1px dashed var(--border)' }}>
                            <Camera size={18} style={{ marginBottom: '2px' }} />
                            Không có ảnh
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text)', marginBottom: '4px' }}>
                            📅 Ngày <strong>{formatDate(item.date)}</strong> · ⏰ Vào: <strong>{item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</strong>
                          </div>
                          {item.hardware_uuid && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              📱 ID Thiết bị: <code>{item.hardware_uuid.slice(0, 14)}...</code>
                            </div>
                          )}
                          {item.flag_reason && (
                            <div style={{ fontSize: '12px', color: 'var(--yellow)', background: 'var(--yellow-soft)', padding: '6px 10px', borderRadius: '8px', marginBottom: '6px', fontWeight: 600 }}>
                              ⚠️ {item.flag_reason}
                            </div>
                          )}
                          {item.reviewer_note && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px' }}>
                              💬 Ghi chú: {item.reviewer_note}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Flagged Actions */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleVerifyFlagged(item._id, 'approve')}
                              disabled={verifyingId === item._id}
                              className="btn btn--primary"
                              style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 700 }}
                            >
                              <Check size={14} /> Duyệt ca & Tin cậy máy
                            </button>
                            <button
                              onClick={() => {
                                setRejectFlaggedTarget(item);
                                setRejectFlaggedReason('');
                                setAllowRecheckin(false);
                              }}
                              disabled={verifyingId === item._id}
                              className="btn btn--ghost"
                              style={{ fontSize: '12px', padding: '6px 14px', color: 'var(--red)', fontWeight: 600 }}
                            >
                              <X size={14} /> Từ chối ca
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleVerifyFlagged(item._id, 'revert', 'Hoàn tác về chờ duyệt')}
                            disabled={verifyingId === item._id}
                            className="btn btn--ghost"
                            style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--primary)', fontWeight: 700 }}
                          >
                            <RotateCcw size={14} /> Hoàn tác về chờ duyệt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             STANDARD REQUESTS TAB (MINE / PENDING / HISTORY)
             ========================================================================= */
          <div>
            {/* Unified Filter Toolbar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '8px',
              marginBottom: '14px',
              background: 'var(--bg-card)',
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid var(--border)'
            }}>
              {/* Search */}
              <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '30px', padding: '8px 10px 8px 30px', fontSize: '13px' }}
                  placeholder="Tìm theo tên, mã NV, lý do, dự án, xe..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Type Filter [P2 Bug Fix: Full 11 types] */}
              <div>
                <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '8px 10px', fontSize: '12.5px' }}>
                  <option value="all">📂 Tất cả loại đơn</option>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter (Only in Mine or History) */}
              {tab !== 'pending' && (
                <div>
                  <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 10px', fontSize: '12.5px' }}>
                    <option value="all">📌 Tất cả trạng thái</option>
                    <option value="pending">⏳ Chờ duyệt</option>
                    <option value="approved">✅ Đã duyệt</option>
                    <option value="rejected">❌ Từ chối</option>
                  </select>
                </div>
              )}

              {/* Month Filter */}
              <div>
                <input
                  type="month"
                  className="form-input"
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  style={{ padding: '7px 10px', fontSize: '12.5px' }}
                  title="Lọc theo tháng áp dụng"
                />
              </div>

              {/* Reset filter button if any active */}
              {(typeFilter !== 'all' || statusFilter !== 'all' || monthFilter || search) && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setMonthFilter(''); setSearch(''); }}
                    className="btn btn--ghost btn--full"
                    style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--text-muted)' }}
                  >
                    Xóa bộ lọc ✕
                  </button>
                </div>
              )}
            </div>

            {/* List Rendering */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '110px', borderRadius: '14px' }} />)}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                  <FileText size={28} />
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>
                  Không tìm thấy đơn từ nào phù hợp
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                  Thử thay đổi bộ lọc tìm kiếm hoặc tạo một đơn mới.
                </div>
                <button type="button" onClick={() => setShowForm(true)} className="btn btn--primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                  <Plus size={15} /> Tạo đơn mới ngay
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredRequests.map(r => {
                  const typeCfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.other;
                  const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const displayName = r.user_name || user?.full_name || 'Nhân viên';
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
                        boxShadow: 'var(--shadow-xs)'
                      }}
                    >
                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '12px', fontWeight: 800, color: typeCfg.color, background: typeCfg.bg,
                            padding: '3px 8px', borderRadius: '6px', border: `1px solid ${typeCfg.color}22`
                          }}>
                            {typeCfg.label}
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>
                            {displayName} {r.user_code ? `(#${r.user_code})` : ''}
                          </span>
                        </div>

                        <span className={`badge ${statusCfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11.5px' }}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </div>

                      {/* Vehicle Info Box if vehicle_update */}
                      {r.type === 'vehicle_update' && (
                        <div style={{
                          background: 'var(--primary-soft)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '8px', padding: '10px 12px', margin: '6px 0 8px 0'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', marginBottom: '3px' }}>
                            🛵 THÔNG TIN XE ĐỀ XUẤT ĐĂNG KÝ:
                          </div>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>
                            {r.proposed_vehicle_info || 'Không sử dụng xe'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            🏢 Nơi gửi: <strong>{r.proposed_parking_location || 'Tòa 17T10 Nguyễn Thị Định'}</strong>
                          </div>
                        </div>
                      )}

                      {/* Reason Description */}
                      <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, margin: '6px 0 8px 0', lineHeight: 1.5, background: 'var(--bg-raised)', padding: '8px 12px', borderRadius: '8px' }}>
                        💬 "{r.reason}"
                      </div>

                      {/* Attachment Photo Thumbnail */}
                      {r.attachment_url && (
                        <div style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            aria-label={`Xem ảnh minh chứng đính kèm của ${displayName}`}
                            onClick={() => setFullAvatarImage({ url: r.attachment_url, title: `Minh chứng đính kèm: ${displayName}` })}
                            style={{ width: '64px', height: '64px', padding: 0, borderRadius: '10px', border: '2px solid var(--primary)', background: 'transparent', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}
                            title="Click để phóng to ảnh"
                          >
                            <img
                              src={r.attachment_url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </button>
                          <div style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: 600 }}>
                            📸 Ảnh minh chứng đính kèm (Click để xem)
                          </div>
                        </div>
                      )}

                      {/* Date & Project Information */}
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 600 }}>
                            🏗️ Dự án: {r.project_name}
                          </span>
                        )}
                      </div>

                      {/* Reviewer Note */}
                      {r.reviewer_note && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '8px' }}>
                          💬 <strong>Phản hồi quản lý:</strong> {r.reviewer_note}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}>
                          {/* Pending approvals */}
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

                          {/* Revert in History */}
                          {tab === 'history' && canManage && (
                            <button
                              onClick={() => handleRevert(r)}
                              className="btn btn--ghost"
                              style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--primary)', fontWeight: 700 }}
                            >
                              <RotateCcw size={14} /> Hoàn tác về chờ duyệt
                            </button>
                          )}
                        </div>

                        {/* Delete Action */}
                        <div>
                          {(isManager || (isOwner && r.status === 'pending')) && (
                            <button
                              onClick={() => handleDelete(r)}
                              className="btn btn--ghost"
                              style={{ padding: '6px 10px', fontSize: '11.5px', color: 'var(--red)' }}
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

      {/* 4. MODAL: XEM QUY ĐỊNH 11 LOẠI ĐƠN TỪ */}
      {showGuidelineModal && (
        <div className="modal-overlay" onClick={() => setShowGuidelineModal(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '820px', width: '95vw', maxHeight: '90vh',
              overflowY: 'auto', margin: 'auto', borderRadius: '16px', padding: '22px 26px'
            }}
          >
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Quy Định & Thời Hạn 11 Loại Đơn Từ</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quy chế nghỉ phép, công tác, WFH, giải trình đi muộn/về sớm và đổi xe</div>
                </div>
              </div>
              <button onClick={() => setShowGuidelineModal(false)} className="btn btn--ghost" style={{ padding: '6px 10px', borderRadius: '8px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px', marginBottom: '18px' }}>
              {Object.entries(guidelines).map(([key, g]) => (
                <div key={key} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: g.color, background: g.bg, padding: '3px 8px', borderRadius: '6px', border: `1px solid ${g.color}33` }}>
                      {g.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setType(key);
                        setShowGuidelineModal(false);
                        setShowForm(true);
                      }}
                      className="btn btn--ghost"
                      style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--primary)' }}
                    >
                      + Tạo đơn này
                    </button>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 600 }}>{g.desc}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    ⏰ <strong>Thời điểm:</strong> {g.timing}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    📌 <strong>Yêu cầu:</strong> {g.requirement}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '4px 8px', borderRadius: '6px' }}>
                    ⚡ {g.impact}
                  </div>
                </div>
              ))}
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-muted)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowGuidelineModal(false);
                    setDraftGuidelines(guidelines);
                    setShowEditGuidelinesModal(true);
                  }}
                  className="btn btn--ghost"
                  style={{ fontSize: '12.5px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit2 size={14} /> Chỉnh sửa nội dung quy định
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL TẠO ĐƠN MỚI ĐỘNG (DYNAMIC CREATE REQUEST) */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '620px', width: '95vw', maxHeight: '90vh',
              overflowY: 'auto', margin: 'auto', borderRadius: '16px', padding: '22px 26px'
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

            {/* Request Type Selector */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Loại đơn cần gửi *</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Mini guideline banner */}
            {(() => {
              const g = guidelines[type] || DEFAULT_REQUEST_GUIDELINES.other;
              return (
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, color: g.color }}>{g.label}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>— {g.desc}</span>
                  </div>
                  <div style={{ color: 'var(--primary)', fontWeight: 600 }}>⚡ {g.impact}</div>
                </div>
              );
            })()}

            {/* DYNAMIC FORM PER TYPE */}
            {type === 'forgot_checkout' ? (
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--yellow)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🚪 Bổ sung giờ ra (Checkout)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>📅 Ngày quên checkout *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>⏱️ Giờ ra thực tế đề xuất *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={endTime || startTime}
                      onChange={e => { setEndTime(e.target.value); setStartTime(e.target.value); }}
                      onClick={e => e.target.showPicker && e.target.showPicker()}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  💡 <strong>Lưu ý:</strong> Đơn chỉ gửi thành công khi ngày làm việc đó bạn <strong>đã check-in</strong> nhưng <strong>chưa checkout</strong>. Khi Admin/Leader duyệt, hệ thống sẽ tự động cập nhật giờ ra và tính toán lại tổng giờ làm, OT hoặc Về sớm.
                </div>
              </div>
            ) : type === 'vehicle_update' ? (
              /* DEDICATED VEHICLE UPDATE FORM [P1 Bug Fix] */
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bike size={16} /> Thông tin phương tiện gửi xe mới
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Biển số xe *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: 29B1-123.45"
                      value={vehiclePlate}
                      onChange={e => setVehiclePlate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Hãng & Dòng xe *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: Honda Vision / Air Blade"
                      value={vehicleModel}
                      onChange={e => setVehicleModel(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Màu sắc xe</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: Đen nhám / Trắng"
                      value={vehicleColor}
                      onChange={e => setVehicleColor(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Nơi gửi xe đề xuất *</label>
                    <select
                      className="form-select"
                      value={vehicleParkingLocation}
                      onChange={e => setVehicleParkingLocation(e.target.value)}
                    >
                      <option value="Tòa 17T10 Nguyễn Thị Định">Tòa 17T10 Nguyễn Thị Định</option>
                      <option value="Tòa 24T3 Hoàng Đạo Thúy">Tòa 24T3 Hoàng Đạo Thúy</option>
                      <option value="Bãi gửi xe ngoài">Bãi gửi xe ngoài</option>
                      <option value="Không gửi xe">Không gửi xe</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Ngày bắt đầu áp dụng *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
              </div>
            ) : (
              /* STANDARD DATE / TIME / PROJECT FIELDS */
              <>
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

                {/* Project selector for OT & Business trips [P2 Bug Fix] */}
                {['business_trip', 'foreign_trip', 'overtime'].includes(type) && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>🏗️ Dự án / Công trình liên quan</label>
                    <select
                      className="form-select"
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                    >
                      <option value="">-- Không gắn dự án --</option>
                      {projects.map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.code || 'DA'})</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Reason */}
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

            {/* Attachment image */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                <span>📸 Ảnh minh chứng đính kèm (Tùy chọn)</span>
                {attachmentUrl && (
                  <button type="button" onClick={() => setAttachmentUrl('')} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '11.5px', cursor: 'pointer', fontWeight: 700 }}>
                    Xóa ảnh
                  </button>
                )}
              </label>

              {attachmentUrl ? (
                <button
                  type="button"
                  aria-label="Xem lớn ảnh minh chứng đang chọn"
                  onClick={() => setFullAvatarImage({ url: attachmentUrl, title: 'Ảnh minh chứng đang chọn' })}
                  style={{ position: 'relative', display: 'inline-block', marginTop: '4px', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', borderRadius: '10px' }}
                >
                  <img
                    src={attachmentUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ width: '84px', height: '84px', borderRadius: '10px', objectFit: 'cover', border: '2px solid var(--primary)' }}
                  />
                </button>
              ) : (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', borderRadius: '10px', border: '1.5px dashed var(--border)',
                  background: 'var(--bg-raised)', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)'
                }}>
                  <Camera size={20} color="var(--primary)" />
                  <span>Chọn ảnh từ thiết bị / Chụp từ camera</span>
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

      {/* 6. MODAL TỪ CHỐI ĐƠN TỪ */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--red)', margin: 0 }}>Từ chối đơn từ</h3>
              <button onClick={() => setRejectTarget(null)} className="btn btn--ghost" style={{ padding: '4px 8px' }}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Lý do từ chối *</label>
              <textarea
                className="form-input"
                rows={3}
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Nhập ghi chú lý do không duyệt đơn..."
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

      {/* 7. MODAL TỪ CHỐI CA CHẤM CÔNG CẢNH BÁO */}
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
                placeholder="Nhập lý do từ chối ca..."
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={allowRecheckin}
                onChange={e => setAllowRecheckin(e.target.checked)}
              />
              <span>Xóa dữ liệu ca cũ để nhân viên có thể chấm công lại</span>
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setRejectFlaggedTarget(null)} className="btn btn--ghost btn--full">Hủy</button>
              <button
                onClick={handleConfirmRejectFlagged}
                disabled={verifyingId === rejectFlaggedTarget._id}
                className="btn btn--full"
                style={{ background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 700 }}
              >
                {verifyingId === rejectFlaggedTarget._id ? <span className="spinner" /> : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL CHỈNH SỬA QUY ĐỊNH (ADMIN ONLY) */}
      {showEditGuidelinesModal && (
        <div className="modal-overlay" onClick={() => setShowEditGuidelinesModal(false)}>
          <div
            className="modal-sheet animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '680px', width: '95vw', maxHeight: '90vh',
              overflowY: 'auto', margin: 'auto', borderRadius: '16px', padding: '22px 26px'
            }}
          >
            <div className="modal-sheet__handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Cấu Hình Bảng Quy Định Đơn Từ</h3>
              <button onClick={() => setShowEditGuidelinesModal(false)} className="btn btn--ghost" style={{ padding: '6px 10px' }}><X size={20} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Chọn loại đơn cần chỉnh sửa</label>
              <select className="form-select" value={editingTypeKey} onChange={e => setEditingTypeKey(e.target.value)}>
                {Object.entries(draftGuidelines).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {draftGuidelines[editingTypeKey] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Mô tả loại đơn</label>
                  <input
                    type="text"
                    className="form-input"
                    value={draftGuidelines[editingTypeKey].desc || ''}
                    onChange={e => setDraftGuidelines({
                      ...draftGuidelines,
                      [editingTypeKey]: { ...draftGuidelines[editingTypeKey], desc: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Thời điểm báo cáo quy định</label>
                  <input
                    type="text"
                    className="form-input"
                    value={draftGuidelines[editingTypeKey].timing || ''}
                    onChange={e => setDraftGuidelines({
                      ...draftGuidelines,
                      [editingTypeKey]: { ...draftGuidelines[editingTypeKey], timing: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Yêu cầu kèm theo</label>
                  <input
                    type="text"
                    className="form-input"
                    value={draftGuidelines[editingTypeKey].requirement || ''}
                    onChange={e => setDraftGuidelines({
                      ...draftGuidelines,
                      [editingTypeKey]: { ...draftGuidelines[editingTypeKey], requirement: e.target.value }
                    })}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDraftGuidelines(DEFAULT_REQUEST_GUIDELINES)}
                className="btn btn--ghost"
                style={{ fontSize: '12.5px' }}
              >
                Đặt lại mặc định
              </button>
              <button
                type="button"
                onClick={handleSaveGuidelines}
                disabled={savingGuidelines}
                className="btn btn--primary"
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 800 }}
              >
                {savingGuidelines ? <span className="spinner" /> : 'Lưu cấu hình 💾'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Lightbox Photo View */}
      {fullAvatarImage && (
        <ImageLightbox
          image={fullAvatarImage}
          onClose={() => setFullAvatarImage(null)}
        />
      )}

      {/* 10. Confirmation Modal Dialog */}
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
    </div>
  );
}
