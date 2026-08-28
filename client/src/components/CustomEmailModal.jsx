// client/src/components/CustomEmailModal.jsx
// Bộ Soạn & Gửi Email Tùy Chỉnh (Live Preview, Gửi Thử Nghiệm, Mẫu Thư & Chọn Người Nhận) — Admin Tool

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import { Mail, Send, Eye, Edit3, X, Users, ShieldAlert, CheckSquare, Square } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { renderEmailPreviewHtml } from "../utils/emailPreview";

const normalizeEmploymentStatus = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase()
  .replace(/đ/g, "d");

const isEligibleRecipient = staff => {
  if (!staff || staff.is_active === false) return false;
  const status = normalizeEmploymentStatus(staff.employment_status);
  const isResigned = ["da nghi viec", "nghi viec", "resigned", "inactive", "quit", "terminated", "thoi viec"].includes(status);
  return !isResigned && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(staff.email || "").trim());
};

const containsPasswordVariable = (...values) => values.some(value => /\{mat_khau\}/i.test(String(value || "")));

const PRESET_TEMPLATES = [
  {
    id: "onboarding",
    name: "🚀 Bàn giao tài khoản & Hướng dẫn sử dụng",
    subject: "Thông tin tài khoản & Hướng dẫn sử dụng hệ thống ET Office Portal",
    body: "Xin chào **{ho_ten}**,\n\nKiến trúc ET chính thức đưa vào vận hành hệ thống **ET Office Portal** nhằm tối ưu hóa quy trình chấm công GPS, nộp đơn từ, quản lý dự án và đăng ký lịch làm việc.\n\n🔐 **THÔNG TIN TÀI KHOẢN CỦA BẠN:**\n• **Tài khoản (Email):** {email}\n• **Thiết lập mật khẩu:** Dùng chức năng **Quên mật khẩu** để nhận mã OTP qua email và tự đặt mật khẩu riêng.\n• **Chức vụ:** {chuc_vu} · **Phòng ban:** {phong_ban}\n\n📌 **QUY TRÌNH BẮT ĐẦU:**\n1. Bấm nút bên dưới để mở trang thiết lập mật khẩu.\n2. Nhập email và mã OTP nhận qua email.\n3. Đăng nhập hệ thống rồi xem tài liệu hướng dẫn sử dụng.\n\nChúc bạn có trải nghiệm làm việc thuận tiện và hiệu quả!",
    actionText: "🔐 Thiết Lập Mật Khẩu Bằng OTP",
    actionUrl: "https://qly-cham-cong.vercel.app/forgot-password",
    documentUrl: "https://docs.google.com/presentation/d/1wniEsYDzZ5yWMO0kpJDVNucalvfOPMzxpJfweixT2Ek/edit?usp=sharing",
    footerText: "Ban Giám Đốc & Phòng Hành Chính Nhân Sự Kiến trúc ET",
  },
  {
    id: "announcement",
    name: "📢 Thông báo chính thức từ Ban Giám Đốc",
    subject: "Thông báo chính thức từ Ban Giám Đốc Kiến trúc ET",
    body: "Kính gửi toàn thể cán bộ nhân viên **Kiến trúc ET**,\n\nBan Giám Đốc xin gửi tới anh/chị/em thông báo quan trọng về kế hoạch công việc và các lưu ý trong thời gian tới:\n\n[ Nhập nội dung thông báo chi tiết tại đây... ]\n\nĐề nghị các phòng ban và từng cá nhân nghiêm túc phối hợp thực hiện.",
    actionText: "Mở Hệ Thống ET Portal",
    actionUrl: "https://qly-cham-cong.vercel.app",
    documentUrl: "",
    footerText: "Ban Giám Đốc Kiến trúc ET",
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

export default function CustomEmailModal({ staffList = [], currentUser, onClose }) {
  const [selectedTemplate, setSelectedTemplate] = useState("onboarding");
  const [activeTab, setActiveTab] = useState("editor");
  const [subject, setSubject] = useState(PRESET_TEMPLATES[0].subject);
  const [body, setBody] = useState(PRESET_TEMPLATES[0].body);
  const [actionText, setActionText] = useState(PRESET_TEMPLATES[0].actionText);
  const [actionUrl, setActionUrl] = useState(PRESET_TEMPLATES[0].actionUrl);
  const [documentUrl, setDocumentUrl] = useState(PRESET_TEMPLATES[0].documentUrl);
  const [footerText, setFooterText] = useState(PRESET_TEMPLATES[0].footerText);

  const [selectedRecipientIds, setSelectedRecipientIds] = useState(() => 
    staffList.filter(isEligibleRecipient).map(s => String(s._id || s.id))
  );

  const [testEmail, setTestEmail] = useState(currentUser?.email || "");
  const [sendingTest, setSendingTest] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const imageInputRef = useRef(null);

  const handleSelectImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const eligibleStaff = useMemo(() => {
    return staffList.filter(isEligibleRecipient);
  }, [staffList]);

  const displayedRecipients = eligibleStaff;

  const toggleRecipient = (id) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllDisplayed = () => {
    const ids = displayedRecipients.map(s => String(s._id || s.id));
    setSelectedRecipientIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const deselectAllDisplayed = () => {
    const ids = new Set(displayedRecipients.map(s => String(s._id || s.id)));
    setSelectedRecipientIds(prev => prev.filter(x => !ids.has(x)));
  };

  const livePreviewHtml = useMemo(() => renderEmailPreviewHtml({
    subject,
    body,
    actionText,
    actionUrl,
    documentUrl,
    footerText,
    variables: {
      ho_ten: "Nguyễn Văn A",
      email: "nguyenvana@et-arc.com",
      chuc_vu: "Kiến trúc sư",
      phong_ban: "Phòng Thiết Kế Kiến Trúc",
      link_he_thong: actionUrl || "https://qly-cham-cong.vercel.app",
      link_tai_lieu: documentUrl || "https://docs.google.com/presentation/d/1wniEsYDzZ5yWMO0kpJDVNucalvfOPMzxpJfweixT2Ek/edit?usp=sharing",
    },
  }), [subject, body, actionText, actionUrl, documentUrl, footerText]);

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
    if (containsPasswordVariable(subject, body, actionText, footerText)) {
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
      });
      toast.success(data.message || "Đã gửi email thử nghiệm!");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Lỗi gửi email thử nghiệm");
    } finally {
      setSendingTest(false);
    }
  };

  const handleConfirmBroadcast = async () => {
    if (selectedRecipientIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất một nhân sự nhận email");
      return;
    }
    if (containsPasswordVariable(subject, body, actionText, footerText)) {
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
      });
      toast.success(data.message || ("Đã gửi thành công " + data.sent + " email!"), { duration: 5000 });
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Lỗi gửi email hàng loạt");
    } finally {
      setBroadcasting(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      style={{ zIndex: 999999, padding: "16px" }}
      onClick={onClose}
    >
      <input type="file" ref={imageInputRef} onChange={handleSelectImageFile} accept="image/*" style={{ display: "none" }} />
      <div
        className="modal-sheet animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "860px", width: "100%", margin: "auto",
          padding: "24px", borderRadius: "20px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)", maxHeight: "calc(100dvh - 40px)",
          display: "flex", flexDirection: "column"
        }}
      >
        <div className="modal-sheet__handle" />

        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <Mail size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text)" }}>Bộ Soạn & Gửi Email Tùy Chỉnh</h2>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Gửi thư chào mừng, cấp tài khoản hoặc thông báo chính thức qua dịch vụ email bảo mật</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn--ghost" style={{ padding: "4px 8px" }}><X size={18} /></button>
        </div>

        {/* Template Selector & Mode Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {PRESET_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl.id)}
                className={"chip " + (selectedTemplate === tpl.id ? "active" : "")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                {tpl.name}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: "10px", padding: "3px", border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setActiveTab("editor")}
              style={{
                padding: "6px 14px", border: "none", borderRadius: "8px", cursor: "pointer",
                fontSize: "12.5px", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px",
                background: activeTab === "editor" ? "var(--bg-card)" : "transparent",
                color: activeTab === "editor" ? "var(--primary)" : "var(--text-secondary)",
                boxShadow: activeTab === "editor" ? "var(--shadow-xs)" : "none",
              }}
            >
              <Edit3 size={14} /> Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              style={{
                padding: "6px 14px", border: "none", borderRadius: "8px", cursor: "pointer",
                fontSize: "12.5px", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px",
                background: activeTab === "preview" ? "var(--bg-card)" : "transparent",
                color: activeTab === "preview" ? "var(--primary)" : "var(--text-secondary)",
                boxShadow: activeTab === "preview" ? "var(--shadow-xs)" : "none",
              }}
            >
              <Eye size={14} /> Xem trước (Live Preview)
            </button>
          </div>
        </div>

        {/* Tab 1: Editor */}
        {activeTab === "editor" ? (
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tiêu đề Email *</label>
              <input
                type="text"
                className="form-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="VD: Thông tin tài khoản & Hướng dẫn sử dụng hệ thống ET Office Portal"
                style={{ fontWeight: 700 }}
              />
            </div>

            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>
                💡 Bấm để chèn biến thông minh (Tự động thay thế theo từng nhân sự):
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[
                  { tag: "ho_ten", label: "+ {ho_ten}" },
                  { tag: "email", label: "+ {email}" },
                  { tag: "chuc_vu", label: "+ {chuc_vu}" },
                  { tag: "phong_ban", label: "+ {phong_ban}" },
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariable(v.tag)}
                    className="btn btn--ghost"
                    style={{ padding: "4px 8px", fontSize: "11.5px", borderRadius: "6px", fontFamily: "monospace" }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nội dung Email (Hỗ trợ **in đậm** và xuống dòng) *</label>
              <textarea
                className="form-input"
                rows={9}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Nhập nội dung thư..."
                style={{ fontSize: "13.5px", lineHeight: 1.6, fontFamily: "inherit" }}
              />
            </div>

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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-raised)", padding: "12px", borderRadius: "14px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", textAlign: "center" }}>
              📱 Xem trước giao diện hiển thị trên ứng dụng email (Đã thay thế biến mẫu ví dụ: <em>Nguyễn Văn A</em>)
            </div>
            <div dangerouslySetInnerHTML={{ __html: safePreviewHtml }} />
          </div>
        )}

        {/* Recipient Filter & Selection Section */}
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)", background: "var(--bg-input)", padding: "12px 14px", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={16} color="var(--primary)" />
              <strong style={{ fontSize: "13px", color: "var(--text)" }}>
                Danh sách người nhận: <span style={{ color: "var(--primary)" }}>{selectedRecipientIds.length}/{eligibleStaff.length} nhân sự</span>
              </strong>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>

              <button type="button" onClick={selectAllDisplayed} className="btn btn--ghost" style={{ padding: "4px 8px", fontSize: "11.5px" }}>Chọn tất cả</button>
              <button type="button" onClick={deselectAllDisplayed} className="btn btn--ghost" style={{ padding: "4px 8px", fontSize: "11.5px" }}>Bỏ chọn</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxHeight: "80px", overflowY: "auto", padding: "4px 0" }}>
            {displayedRecipients.map(s => {
              const sid = String(s._id || s.id);
              const isSelected = selectedRecipientIds.includes(sid);
              return (
                <div
                  key={sid}
                  onClick={() => toggleRecipient(sid)}
                  className="card card--interactive"
                  style={{
                    padding: "4px 8px", fontSize: "11.5px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "5px", borderRadius: "8px",
                    border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--primary-soft)" : "var(--bg-card)",
                    color: isSelected ? "var(--primary)" : "var(--text-secondary)",
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {isSelected ? <CheckSquare size={13} color="var(--primary)" /> : <Square size={13} />}
                  <span>{s.full_name}</span>
                  <small style={{ opacity: 0.65 }}>({s.email})</small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "1 1 320px" }}>
            <input
              type="email"
              className="form-input"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="Nhập email bất kỳ để gửi thử nghiệm..."
              style={{ fontSize: "12.5px", minHeight: "38px" }}
            />
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={sendingTest || !testEmail}
              className="btn btn--ghost"
              style={{ fontSize: "12px", whiteSpace: "nowrap", flexShrink: 0, minHeight: "38px" }}
              title="Gửi 1 email mẫu tới hòm thư này để kiểm tra câu chữ và giao diện trước"
            >
              {sendingTest ? <span className="spinner" /> : <><Send size={13} /> Gửi thử</>}
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={onClose} className="btn btn--ghost" style={{ minHeight: "38px" }}>Hủy</button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={broadcasting || selectedRecipientIds.length === 0 || !subject || !body}
              className="btn btn--primary"
              style={{ minHeight: "38px", fontWeight: 800, padding: "0 20px" }}
            >
              {broadcasting ? <span className="spinner" /> : <><Send size={15} /> Gửi chính thức ({selectedRecipientIds.length} người)</>}
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="modal-overlay" style={{ zIndex: 1000003 }} onClick={() => setShowConfirmModal(false)}>
            <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", margin: "auto", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <ShieldAlert size={26} color="var(--primary)" />
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Xác nhận gửi Email hàng loạt</h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
                Hệ thống sẽ gửi email <strong>"{subject}"</strong> tới <strong>{selectedRecipientIds.length} nhân sự</strong> đã chọn qua dịch vụ email bảo mật (giãn cách 1s/email an toàn).
                <span style={{ display: "block", color: "var(--green)", marginTop: "6px", fontWeight: 600 }}>
                  🔐 Email không thay đổi mật khẩu; người nhận chỉ tự đặt lại bằng OTP gửi qua email.
                </span>
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => setShowConfirmModal(false)} className="btn btn--ghost btn--full">Hủy</button>
                <button type="button" onClick={handleConfirmBroadcast} className="btn btn--primary btn--full" style={{ fontWeight: 800 }}>Xác nhận gửi ngay 🚀</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
