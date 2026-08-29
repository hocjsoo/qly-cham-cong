// client/src/pages/EmailsPage.jsx
// Trang Soạn & Gửi Email Tùy Chỉnh Toàn Màn Hình (2 Cột Soạn Thảo & Live Preview Song Song) — Admin Only

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import { Send, Eye, Edit3, Users, ShieldAlert, Sparkles, CheckSquare, Square, ShieldCheck, Search, Lock } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import useAuthStore from "../stores/authStore";
import useSettingsStore from "../stores/settingsStore";
import HeaderActions from "../components/HeaderActions";
import { renderEmailPreviewHtml } from "../utils/emailPreview";
import {
  DEFAULT_COMPANY_ADDRESS,
  DEFAULT_EMAIL_FOOTER_NOTE,
} from "../utils/dynamicBranding";

const normalizeEmploymentStatus = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase()
  .replace(/đ/g, "d");

const isResignedStaff = staff => {
  if (!staff || staff.is_active === false) return true;
  const status = normalizeEmploymentStatus(staff.employment_status);
  return ["da nghi viec", "nghi viec", "resigned", "inactive", "quit", "terminated", "thoi viec"].includes(status);
};

const hasValidEmail = staff => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(staff?.email || "").trim());
const isEligibleRecipient = staff => !isResignedStaff(staff) && hasValidEmail(staff);
const containsPasswordVariable = (...values) => values.some(value => /\{mat_khau\}/i.test(String(value || "")));

const PRESET_TEMPLATES = [
  {
    id: "onboarding",
    name: "🚀 Bàn giao tài khoản & HDSD",
    subject: "Thông tin tài khoản & Hướng dẫn sử dụng hệ thống ET Office Portal",
    body: "Xin chào **{ho_ten}**,\n\n**Kiến trúc ET** chính thức đưa vào vận hành hệ thống **ET Office Portal** nhằm tối ưu hóa quy trình chấm công GPS, nộp đơn từ, quản lý dự án và đăng ký lịch làm việc.\n\n🔐 **THÔNG TIN TÀI KHOẢN CỦA BẠN:**\n• **Tài khoản (Email):** {email}\n• **Thiết lập mật khẩu:** Dùng chức năng **Quên mật khẩu** để nhận mã OTP qua email và tự đặt mật khẩu riêng.\n• **Chức vụ:** {chuc_vu} · **Phòng ban:** {phong_ban}\n\n[button: 🔐 Thiết Lập Mật Khẩu Bằng OTP | https://qly-cham-cong.vercel.app/forgot-password]\n\n[button: 🚀 Đăng Nhập Hệ Thống | https://qly-cham-cong.vercel.app]\n\n[link: 📖 Bấm vào đây để xem Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết | https://docs.google.com/presentation/d/1wniEsYDzZ5yWMO0kpJDVNucalvfOPMzxpJfweixT2Ek/edit?usp=sharing]\n\n📌 **QUY TRÌNH BẮT ĐẦU:**\n1. Bấm nút thiết lập mật khẩu và nhập đúng email tài khoản.\n2. Nhập mã OTP nhận qua email để tự đặt mật khẩu mới.\n3. Đăng nhập hệ thống và tham khảo tài liệu hướng dẫn.\n\nChúc bạn có trải nghiệm làm việc thuận tiện và hiệu quả!",
    actionText: "",
    actionUrl: "",
    documentUrl: "",
    footerText: "Ban Giám Đốc & Phòng Hành Chính Nhân Sự Kiến trúc ET",
  },
  {
    id: "holiday",
    name: "🏖️ Thông báo Lịch Nghỉ Lễ",
    subject: "Thông báo Lịch Nghỉ Lễ chính thức từ Ban Giám Đốc",
    body: "Kính gửi toàn thể cán bộ nhân viên **Kiến trúc ET**,\n\nBan Giám Đốc xin trân trọng thông báo về **Lịch Nghỉ Lễ** sắp tới của công ty như sau:\n\n📅 **THỜI GIAN NGHỈ:**\n• Bắt đầu nghỉ từ: **[ Ngày bắt đầu ]**\n• Đi làm lại vào ngày: **[ Ngày đi làm lại ]**\n\n📌 **LƯU Ý:**\n1. Các bộ phận hoàn thành bàn giao hồ sơ thiết kế trước kỳ nghỉ.\n2. Nhân sự trực nhật kiểm tra tắt toàn bộ thiết bị điện, khóa cửa văn phòng trước khi về.\n\nChúc toàn thể anh/chị/em có một kỳ nghỉ lễ vui vẻ và ý nghĩa bên gia đình!",
    actionText: "Xem Lịch Trên Hệ Thống",
    actionUrl: "https://qly-cham-cong.vercel.app/checkin",
    documentUrl: "",
    footerText: "Ban Giám Đốc Kiến trúc ET",
  },
  {
    id: "announcement",
    name: "📢 Thông báo Họp & Quyết định",
    subject: "Thông báo chính thức từ Ban Giám Đốc Kiến trúc ET",
    body: "Kính gửi toàn thể cán bộ nhân viên **Kiến trúc ET**,\n\nBan Giám Đốc xin gửi tới anh/chị/em thông báo quan trọng về kế hoạch công việc và các lưu ý trong thời gian tới:\n\n[ Nhập nội dung thông báo chi tiết tại đây... ]\n\n[button: Mở Bảng Điều Khiển ET Portal | https://qly-cham-cong.vercel.app/dashboard]\n\nĐề nghị các phòng ban và từng cá nhân nghiêm túc phối hợp thực hiện.",
    actionText: "",
    actionUrl: "",
    documentUrl: "",
    footerText: "Ban Giám Đốc Kiến trúc ET",
  },
  {
    id: "duty_reminder",
    name: "📋 Nhắc Lịch Tuần & Trực Nhật",
    subject: "Nhắc nhở đăng ký Lịch Làm Việc & Lịch Trực Nhật tuần mới",
    body: "Xin chào **{ho_ten}**,\n\nNhằm đảm bảo tiến độ công việc và vệ sinh văn phòng, đề nghị các bạn nhân sự và thực tập sinh (TTS) hoàn thành đăng ký lịch làm việc trước **23:59 Chủ Nhật tuần này**.\n\n[button: 📅 Đăng Ký Lịch Làm Việc Ngay | https://qly-cham-cong.vercel.app/tts-schedule]\n\nLịch trực nhật tuần mới sẽ được tự động phân công công bằng theo hệ số 12 tuần trên hệ thống.\n\nTrân trọng cảm ơn sự phối hợp của các bạn!",
    actionText: "",
    actionUrl: "",
    documentUrl: "",
    footerText: "Phòng Hành Chính Nhân Sự Kiến trúc ET",
  },
  {
    id: "birthday",
    name: "🎉 Chúc Mừng Sinh Nhật / Tri Ân",
    subject: "Chúc Mừng Sinh Nhật — Kiến trúc ET thân gửi lời chúc tốt đẹp nhất!",
    body: "Thân gửi **{ho_ten}**,\n\nNhân ngày sinh nhật của bạn, thay mặt toàn thể đại gia đình **Kiến trúc ET**, Ban Giám Đốc xin gửi tới bạn lời chúc mừng nồng nhiệt và chân thành nhất! 🎂🎉\n\nChúc bạn luôn dồi dào sức khỏe, ngập tràn niềm vui, hạnh phúc và gặt hái được nhiều thành công mới trên con đường sáng tạo kiến trúc cùng công ty! 🌟",
    actionText: "Gửi Lời Chúc Trên Portal",
    actionUrl: "https://qly-cham-cong.vercel.app/dashboard",
    documentUrl: "",
    footerText: "Ban Giám Đốc & Đại Gia Đình Kiến trúc ET",
  },
  {
    id: "custom",
    name: "✏️ Soạn thư tự do",
    subject: "",
    body: "",
    actionText: "",
    actionUrl: "",
    documentUrl: "",
    footerText: "Kiến trúc ET",
  },
];

export default function EmailsPage() {
  const { user: currentUser } = useAuthStore();
  const [staffList, setStaffList] = useState([]);

  const { company_name, company_address, email_footer_note, company_logo_url } = useSettingsStore();

  // Template & Composer State
  const [selectedTemplate, setSelectedTemplate] = useState("onboarding");
  const [subject, setSubject] = useState(PRESET_TEMPLATES[0].subject);
  const [body, setBody] = useState(PRESET_TEMPLATES[0].body);
  const [actionText, setActionText] = useState(PRESET_TEMPLATES[0].actionText);
  const [actionUrl, setActionUrl] = useState(PRESET_TEMPLATES[0].actionUrl);
  const [documentUrl, setDocumentUrl] = useState(PRESET_TEMPLATES[0].documentUrl);
  const [footerText, setFooterText] = useState(PRESET_TEMPLATES[0].footerText);
  const [companyAddress, setCompanyAddress] = useState(company_address || DEFAULT_COMPANY_ADDRESS);
  const [footerNote, setFooterNote] = useState(email_footer_note || DEFAULT_EMAIL_FOOTER_NOTE);

  // Multi-Dimensional Recipient Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmpType, setFilterEmpType] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);

  // Test & Broadcast State
  const [testEmail, setTestEmail] = useState(currentUser?.email || "");
  const [sendingTest, setSendingTest] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const imageInputRef = useRef(null);
  const confirmDialogRef = useRef(null);

  const handleSelectImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Vui lòng chọn ảnh nhỏ hơn 5MB để email gửi nhanh mượt");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.85);

        setBody(prev => prev + "\n\n[img: " + optimizedBase64 + "]\n");
        toast.success("Đã chọn ảnh từ thiết bị và chèn vào bài viết! 🖼️");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };


  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!showConfirmModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setShowConfirmModal(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      confirmDialogRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      confirmDialogRef.current?.focus({ preventScroll: true });
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showConfirmModal]);

  const fetchInitialData = async () => {
    try {
      const { data } = await api.get("/users");
      const list = data || [];
      setStaffList(list);
      const activeIds = list.filter(isEligibleRecipient).map(s => String(s._id || s.id));
      setSelectedRecipientIds(activeIds);
    } catch {
      toast.error("Lỗi tải danh sách nhân sự");
    }
  };

  const handleApplyTemplate = (tplId) => {
    const tpl = PRESET_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    setSelectedTemplate(tplId);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setActionText(tpl.actionText);
    setActionUrl(tpl.actionUrl);
    setDocumentUrl(tpl.documentUrl);
    setFooterText(tpl.footerText);
    toast.success("Đã nạp mẫu: " + tpl.name);
  };

  const insertVariable = (varName) => {
    setBody(prev => prev + " {" + varName + "}");
  };

  const activeCount = useMemo(() => {
    return staffList.filter(isEligibleRecipient).length;
  }, [staffList]);

  const displayedStaff = useMemo(() => {
    return staffList.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.full_name || "").toLowerCase().includes(q);
        const matchEmail = (s.email || "").toLowerCase().includes(q);
        const matchCode = (s.employee_code || "").toLowerCase().includes(q);
        const matchPhone = (s.phone || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCode && !matchPhone) return false;
      }
      const isResigned = isResignedStaff(s);
      if (filterStatus === "active" && isResigned) return false;
      if (filterStatus === "resigned" && !isResigned) return false;

      if (filterEmpType !== "all") {
        const empType = s.employee_type || "NS";
        if (empType !== filterEmpType) return false;
      }
      if (filterRole !== "all") {
        if (filterRole === "leader" && !["admin", "leader", "manager"].includes(s.role)) return false;
        if (filterRole === "employee" && ["admin", "leader", "manager"].includes(s.role)) return false;
      }
      return true;
    });
  }, [staffList, searchQuery, filterStatus, filterEmpType, filterRole]);

  const toggleRecipient = (staff) => {
    const sid = String(staff._id || staff.id);
    const isResigned = isResignedStaff(staff);
    if (isResigned) {
      toast.error("Nhân sự này đã nghỉ việc — Tự động khóa không gửi email!", { icon: "🔒" });
      return;
    }
    if (!hasValidEmail(staff)) {
      toast.error("Nhân sự này chưa có địa chỉ email hợp lệ.");
      return;
    }
    setSelectedRecipientIds(prev => 
      prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]
    );
  };

  const selectAllEligibleDisplayed = () => {
    const validIds = displayedStaff
      .filter(isEligibleRecipient)
      .map(s => String(s._id || s.id));
    setSelectedRecipientIds(prev => Array.from(new Set([...prev, ...validIds])));
  };

  const deselectAllDisplayed = () => {
    const ids = new Set(displayedStaff.map(s => String(s._id || s.id)));
    setSelectedRecipientIds(prev => prev.filter(x => !ids.has(x)));
  };

  const livePreviewHtml = useMemo(() => renderEmailPreviewHtml({
    subject,
    body,
    actionText,
    actionUrl,
    documentUrl,
    footerText,
    companyAddress,
    footerNote,
    companyName: company_name,
    logoUrl: company_logo_url,
    variables: {
      ho_ten: "Nguyễn Văn A",
      email: "nguyenvana@et-arc.com",
      chuc_vu: "Kiến trúc sư",
      phong_ban: "Phòng Thiết Kế Kiến Trúc",
      link_he_thong: actionUrl || "https://qly-cham-cong.vercel.app",
      link_tai_lieu: documentUrl || "https://docs.google.com/presentation/d/1wniEsYDzZ5yWMO0kpJDVNucalvfOPMzxpJfweixT2Ek/edit?usp=sharing",
    },
  }), [subject, body, actionText, actionUrl, documentUrl, footerText, companyAddress, footerNote, company_name, company_logo_url]);

  const safePreviewHtml = useMemo(() => DOMPurify.sanitize(livePreviewHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
    ADD_DATA_URI_TAGS: ["img"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  }), [livePreviewHtml]);

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email nhận thử nghiệm hợp lệ");
      return;
    }
    if (containsPasswordVariable(subject, body, actionText, footerText, footerNote, companyAddress)) {
      toast.error("Biến {mat_khau} đã bị vô hiệu hóa. Hãy dùng hướng dẫn nhận OTP qua email.");
      return;
    }
    setSendingTest(true);
    try {
      const { data } = await api.post("/users/email/send-test", {
        toEmail: testEmail.trim(),
        title: subject,
        body,
        actionText,
        actionUrl,
        documentUrl,
        footerText,
        companyAddress,
        footerNote,
        companyName: company_name,
      }, { timeout: 60000 });
      if (!data?.sent) {
        toast.error(data?.error || data?.message || "Máy chủ chưa xác nhận email đã được gửi");
        return;
      }
      toast.success(data.message || "Đã gửi email thử nghiệm!", { duration: 4000 });
    } catch (err) {
      const message = err?.code === "ECONNABORTED"
        ? "Máy chủ gửi email phản hồi quá chậm. Vui lòng thử lại sau ít phút."
        : (err?.response?.data?.error || "Lỗi gửi email thử nghiệm");
      toast.error(message, { duration: 6000 });
    } finally {
      setSendingTest(false);
    }
  };

  const handleConfirmBroadcast = async () => {
    if (selectedRecipientIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất một nhân sự nhận email");
      return;
    }
    if (containsPasswordVariable(subject, body, actionText, footerText, footerNote, companyAddress)) {
      toast.error("Email hàng loạt không được phép tạo, đổi hoặc gửi mật khẩu nhân sự.");
      setShowConfirmModal(false);
      return;
    }
    setBroadcasting(true);
    setShowConfirmModal(false);
    try {
      const { data } = await api.post("/users/email/broadcast-custom", {
        recipientIds: selectedRecipientIds,
        title: subject,
        body,
        actionText,
        actionUrl,
        documentUrl,
        footerText,
        companyAddress,
        footerNote,
        companyName: company_name,
      }, { timeout: Math.min(600000, Math.max(120000, selectedRecipientIds.length * 5000)) });
      if (data.failed > 0) {
        toast.error(data.message || ("Đã gửi " + data.sent + " email, có " + data.failed + " email lỗi."), { duration: 8000 });
      } else {
        toast.success(data.message || ("Đã gửi thành công " + data.sent + " email!"), { duration: 6000 });
      }
    } catch (err) {
      const message = err?.code === "ECONNABORTED"
        ? "Quá trình gửi nhiều email mất nhiều thời gian hơn dự kiến. Vui lòng kiểm tra kết quả trước khi gửi lại."
        : (err?.response?.data?.error || "Lỗi gửi email hàng loạt");
      toast.error(message, { duration: 8000 });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="page">
      <input type="file" ref={imageInputRef} onChange={handleSelectImageFile} accept="image/*" style={{ display: "none" }} />
      {/* Header */}
      <div className="header">
        <div className="header__inner header__inner--wide">
          <div>
            <div className="header__title">Bộ Soạn & Gửi Email Doanh Nghiệp</div>
            <div className="header__subtitle">
              Quản lý truyền thông nội bộ · Bàn giao tài khoản & Thông báo chính thức qua dịch vụ email bảo mật
            </div>
          </div>
          <div className="page-header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <HeaderActions />
          </div>
        </div>
      </div>

      <div className="container container--wide" style={{ paddingTop: "18px", paddingBottom: "80px" }}>
        {/* Top Preset Template Switcher Bar */}
        <div className="card" style={{ marginBottom: "18px", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={16} color="var(--primary)" /> Mẫu thư có sẵn:
            </span>
            {PRESET_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl.id)}
                className={"chip " + (selectedTemplate === tpl.id ? "active" : "")}
                style={{ fontSize: "12.5px", padding: "7px 14px" }}
              >
                {tpl.name}
              </button>
            ))}
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldCheck size={14} color="var(--green)" /> Tự động cá nhân hóa tên, email, chức vụ và phòng ban theo từng nhân sự
          </div>
        </div>

        {/* 2-Column Split Workspace (Desktop: Side-by-Side | Mobile: Stacked) */}
        <div className="email-workspace-grid">
          {/* Column 1: Editor */}
          <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
              <Edit3 size={18} color="var(--primary)" />
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text)" }}>Khung Soạn Thảo Nội Dung</h3>
            </div>

            {/* Subject Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tiêu đề Email *</label>
              <input
                type="text"
                className="form-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="VD: Thông tin tài khoản & Hướng dẫn sử dụng hệ thống ET Office Portal"
                style={{ fontWeight: 700, fontSize: "14px" }}
              />
            </div>

            {/* Variable Inserter */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)" }}>
                  💡 Bấm để chèn biến thông minh & phần tử vào vị trí con trỏ:
                </span>
                <span style={{ fontSize: "11px", color: "var(--primary)" }}>
                  Tự động căn chỉnh & đổi nội dung theo từng người
                </span>
              </div>
              
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                {[
                  { tag: "ho_ten", label: "👤 {ho_ten}" },
                  { tag: "email", label: "📧 {email}" },
                  { tag: "chuc_vu", label: "💼 {chuc_vu}" },
                  { tag: "phong_ban", label: "🏢 {phong_ban}" },
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariable(v.tag)}
                    className="btn btn--ghost"
                    style={{ padding: "4px 9px", fontSize: "11.5px", borderRadius: "8px", fontFamily: "monospace", color: "var(--primary)", fontWeight: 700 }}
                  >
                    + {v.label}
                  </button>
                ))}
              </div>

              {/* Rich Elements Insert Buttons */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setBody(prev => prev + "\n\n[button: 🚀 Đăng Nhập Hệ Thống Ngay | https://qly-cham-cong.vercel.app]\n")}
                  className="btn btn--ghost"
                  style={{ padding: "4px 9px", fontSize: "11.5px", borderRadius: "8px", color: "var(--green)", fontWeight: 700 }}
                  title="Chèn nút bấm hành động nổi bật vào vị trí này"
                >
                  + 🔘 Thêm Nút Bấm
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="btn btn--ghost"
                  style={{ padding: "4px 9px", fontSize: "11.5px", borderRadius: "8px", color: "#2563eb", fontWeight: 700 }}
                  title="Chèn ảnh minh họa / bản vẽ / poster"
                >
                  + 🖼️ Thêm Ảnh
                </button>
                <button
                  type="button"
                  onClick={() => setBody(prev => prev + " [link: Xem chi tiết tại đây | https://docs.google.com/presentation/d/1wniEsYDzZ5yWMO0kpJDVNucalvfOPMzxpJfweixT2Ek/edit?usp=sharing] ")}
                  className="btn btn--ghost"
                  style={{ padding: "4px 9px", fontSize: "11.5px", borderRadius: "8px", color: "var(--primary)", fontWeight: 700 }}
                  title="Chèn đường link liên kết văn bản"
                >
                  + 🔗 Thêm Link
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nội dung Thư (Hỗ trợ **in đậm** và xuống dòng) *</label>
              <textarea
                className="form-input"
                rows={12}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Nhập nội dung thư..."
                style={{ fontSize: "13.5px", lineHeight: 1.65, fontFamily: "inherit" }}
              />
            </div>

            {/* Action Buttons & Links */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Chữ trên nút hành động (CTA)</label>
                <input
                  type="text"
                  className="form-input"
                  value={actionText}
                  onChange={e => setActionText(e.target.value)}
                  placeholder="VD: 🚀 Đăng Nhập Hệ Thống Ngay"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Đường link nút hành động (URL)</label>
                <input
                  type="url"
                  className="form-input"
                  value={actionUrl}
                  onChange={e => setActionUrl(e.target.value)}
                  placeholder="https://qly-cham-cong.vercel.app"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Link Tài Liệu Hướng Dẫn (Drive / Notion / PDF)</label>
              <input
                type="url"
                className="form-input"
                value={documentUrl}
                onChange={e => setDocumentUrl(e.target.value)}
                placeholder="https://docs.google.com/presentation/d/1wniEsYDzZ5yWMO0kpJDVNucalvfOPMzxpJfweixT2Ek/edit?usp=sharing"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Chữ ký chân trang (Footer Signature)</label>
                <input
                  type="text"
                  className="form-input"
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  placeholder="VD: Ban Giám Đốc Kiến trúc ET"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ghi chú chân trang email</label>
                <input
                  type="text"
                  className="form-input"
                  value={footerNote}
                  onChange={e => setFooterNote(e.target.value)}
                  placeholder={DEFAULT_EMAIL_FOOTER_NOTE}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Địa chỉ trụ sở công ty ở chân trang (Company Address)</label>
              <input
                type="text"
                className="form-input"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                placeholder={DEFAULT_COMPANY_ADDRESS}
              />
            </div>
          </div>

          {/* Column 2: Live Preview & Test Dispatch */}
          <div className="email-preview-column">
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Eye size={18} color="var(--primary)" />
                  <strong style={{ fontSize: "15px", color: "var(--text)" }}>Xem Trước Trực Tiếp (Live Preview)</strong>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Tự động đồng bộ theo thời gian thực</span>
              </div>

              {/* Rendered HTML Container */}
              <div className="email-preview-scroll">
                <div dangerouslySetInnerHTML={{ __html: safePreviewHtml }} />
              </div>
            </div>

            {/* Test Send Box */}
            <div className="card" style={{ padding: "16px", background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Send size={15} color="var(--primary)" /> Gửi Thử Nghiệm Trước Khi Gửi Thật (Test First):
              </div>
              <div className="email-test-row">
                <input
                  type="email"
                  className="form-input"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Nhập email bất kỳ để nhận thử..."
                  style={{ fontSize: "13px", minWidth: 0, flex: "1 1 180px" }}
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmail}
                  className="btn btn--ghost"
                  style={{ fontSize: "12.5px", whiteSpace: "nowrap", flex: "1 1 140px", fontWeight: 700, padding: "0 16px" }}
                >
                  {sendingTest ? <span className="spinner" /> : <><Send size={14} /> Gửi Thử Ngay</>}
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                💡 Thư mẫu sẽ được gửi vào hộp thư này trong 2 giây để bạn kiểm tra chữ nghĩa và link.
              </div>
            </div>
          </div>
        </div>

        {/* 4-Dimensional Smart Recipient Filter Section */}
        <div className="card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                <Users size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                  Bộ Lọc Người Nhận Thông Minh (Đang chọn <span style={{ color: "var(--primary)" }}>{selectedRecipientIds.length}/{activeCount}</span> nhân sự đang làm việc)
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  🛡️ Hệ thống tự động khóa, tuyệt đối không gửi nhầm cho nhân sự đã nghỉ việc
                </div>
              </div>
            </div>

            {/* Selection Action Buttons */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={selectAllEligibleDisplayed} className="btn btn--ghost" style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}>
                Chọn tất cả ({displayedStaff.length})
              </button>
              <button type="button" onClick={deselectAllDisplayed} className="btn btn--ghost" style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}>
                Bỏ chọn
              </button>
            </div>
          </div>

          {/* Filter Toolbar Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "14px" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                className="form-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, mã NS, email..."
                style={{ paddingLeft: "32px", fontSize: "12.5px", minHeight: "36px" }}
              />
            </div>



            {/* Employee Type (NS / TV / TTS) */}
            <select
              className="form-select"
              value={filterEmpType}
              onChange={e => setFilterEmpType(e.target.value)}
              style={{ fontSize: "12.5px", minHeight: "36px" }}
            >
              <option value="all">🏷️ Tất cả loại nhân sự</option>
              <option value="NS">Nhân sự chính thức (NS)</option>
              <option value="TV">Thử việc (TV)</option>
              <option value="TTS">Thực tập sinh (TTS)</option>
            </select>

            {/* Role Filter */}
            <select
              className="form-select"
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              style={{ fontSize: "12.5px", minHeight: "36px" }}
            >
              <option value="all">👑 Tất cả vai trò</option>
              <option value="leader">Cấp Quản Lý (Admin / Leader)</option>
              <option value="employee">Nhân viên thông thường</option>
            </select>

            {/* Status Filter */}
            <select
              className="form-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ fontSize: "12.5px", minHeight: "36px", fontWeight: 750, color: filterStatus === "active" ? "var(--green)" : "var(--text)" }}
            >
              <option value="active">🟢 Đang làm việc (Mặc định)</option>
              <option value="resigned">🔴 Đã nghỉ việc (Khóa)</option>
              <option value="all">Tất cả trạng thái</option>
            </select>
          </div>

          {/* Recipient Checkbox Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px", maxHeight: "220px", overflowY: "auto", padding: "6px", background: "var(--bg-input)", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "16px" }}>
            {displayedStaff.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
                Không tìm thấy nhân sự nào khớp với bộ lọc
              </div>
            ) : (
              displayedStaff.map(s => {
                const sid = String(s._id || s.id);
                const isSelected = selectedRecipientIds.includes(sid);
                const isResigned = isResignedStaff(s);
                const empType = s.employee_type || "NS";
                const isLeader = ["admin", "leader", "manager"].includes(s.role);

                return (
                  <div
                    key={sid}
                    onClick={() => toggleRecipient(s)}
                    className={"card " + (!isResigned ? "card--interactive" : "")}
                    style={{
                      padding: "8px 12px", fontSize: "12px", cursor: isResigned ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: "10px", borderRadius: "10px",
                      border: isResigned ? "1px solid var(--border-muted)" : (isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)"),
                      background: isResigned ? "var(--bg-raised)" : (isSelected ? "var(--primary-soft)" : "var(--bg-card)"),
                      color: isResigned ? "var(--text-muted)" : (isSelected ? "var(--primary)" : "var(--text)"),
                      opacity: isResigned ? 0.5 : 1,
                      userSelect: "none"
                    }}
                    title={isResigned ? "Nhân sự đã nghỉ việc — Tự động loại khỏi danh sách gửi" : ""}
                  >
                    {isResigned ? (
                      <Lock size={15} color="var(--red)" style={{ flexShrink: 0 }} />
                    ) : isSelected ? (
                      <CheckSquare size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                    ) : (
                      <Square size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    )}

                    <img
                      src={s.avatar_url || "/logo.png"}
                      alt=""
                      style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }}
                      onError={e => { e.target.src = "/logo.png"; }}
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12.5px" }}>
                          {s.full_name}
                        </strong>
                        {isLeader && <span style={{ fontSize: "10px", color: "var(--yellow)", fontWeight: 800 }}>👑</span>}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <span className={"badge " + (empType === "TTS" ? "badge--info" : empType === "TV" ? "badge--warning" : "badge--neutral")} style={{ fontSize: "9.5px", padding: "1px 5px" }}>
                          {empType}
                        </span>
                        {isResigned && (
                          <span className="badge badge--danger" style={{ fontSize: "9.5px", padding: "1px 5px" }}>
                            Đã nghỉ
                          </span>
                        )}
                        <span style={{ fontSize: "10.5px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.email}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Broadcast Action Bottom Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
              Sẵn sàng gửi tới <strong style={{ color: "var(--primary)" }}>{selectedRecipientIds.length} nhân sự</strong> hợp lệ qua dịch vụ email
            </span>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={broadcasting || selectedRecipientIds.length === 0 || !subject || !body}
              className="btn btn--primary"
              style={{ minHeight: "42px", fontWeight: 800, padding: "0 28px", fontSize: "14px" }}
            >
              {broadcasting ? <span className="spinner" /> : <><Send size={16} /> Gửi Email Chính Thức ({selectedRecipientIds.length} người) 🚀</>}
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && createPortal(
          <div className="email-confirm-overlay" onClick={() => setShowConfirmModal(false)}>
            <div
              ref={confirmDialogRef}
              className="email-confirm-dialog animate-slide-up"
              role="dialog"
              aria-modal="true"
              aria-labelledby="email-confirm-title"
              tabIndex={-1}
              onClick={event => event.stopPropagation()}
            >
              <div className="email-confirm-dialog__header">
                <ShieldAlert size={28} color="var(--primary)" />
                <h3 id="email-confirm-title">Xác nhận gửi Email hàng loạt</h3>
              </div>
              <div className="email-confirm-dialog__message">
                Hệ thống sẽ gửi email <strong>"{subject}"</strong> tới <strong>{selectedRecipientIds.length} nhân sự</strong> đã chọn qua dịch vụ email bảo mật (giãn cách 1s/email an toàn).
                <div className="email-confirm-dialog__warning">
                  🔐 Email này không thay đổi mật khẩu. Nhân sự chỉ tự đặt lại mật khẩu bằng mã OTP gửi qua email.
                </div>
              </div>
              <div className="email-confirm-dialog__actions">
                <button type="button" onClick={() => setShowConfirmModal(false)} className="btn btn--ghost btn--full">Hủy</button>
                <button type="button" onClick={handleConfirmBroadcast} className="btn btn--primary btn--full" style={{ fontWeight: 800 }}>Xác nhận gửi ngay 🚀</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
