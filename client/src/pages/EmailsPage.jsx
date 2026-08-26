// client/src/pages/EmailsPage.jsx
// Trang Soạn & Gửi Email Tùy Chỉnh Toàn Màn Hình (2 Cột Soạn Thảo & Live Preview Song Song) — Admin Only

import { useState, useEffect, useMemo } from "react";
import { Mail, Send, Eye, Edit3, Check, Users, ShieldAlert, Sparkles, FileText, CheckSquare, Square, RefreshCw, Link as LinkIcon, ExternalLink, ArrowRight, Info, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import useAuthStore from "../stores/authStore";
import HeaderActions from "../components/HeaderActions";

const PRESET_TEMPLATES = [
  {
    id: "onboarding",
    name: "🚀 Bàn giao tài khoản & Hướng dẫn sử dụng",
    subject: "Thông tin tài khoản & Hướng dẫn sử dụng hệ thống ET Office Portal",
    body: "Xin chào **{ho_ten}**,\n\nCông ty Cổ phần Kiến trúc ET chính thức đưa vào vận hành hệ thống **ET Office Portal** nhằm tối ưu hóa quy trình chấm công GPS, nộp đơn từ, quản lý dự án và đăng ký lịch làm việc.\n\n🔐 **THÔNG TIN ĐĂNG NHẬP CỦA BẠN:**\n• **Tài khoản (Email):** {email}\n• **Mật khẩu tạm thời:** {mat_khau}\n• **Chức vụ:** {chuc_vu} · **Phòng ban:** {phong_ban}\n\n📌 **QUY TRÌNH BẮT ĐẦU:**\n1. Bấm vào nút **Đăng Nhập Hệ Thống** bên dưới để truy cập.\n2. Đổi mật khẩu cá nhân mới ngay trong lần đăng nhập đầu tiên.\n3. Xem tài liệu hướng dẫn sử dụng chi tiết để nắm rõ các quy định chấm công và nộp đơn.\n\nChúc bạn có trải nghiệm làm việc thuận tiện và hiệu quả!",
    actionText: "🚀 Đăng Nhập Hệ Thống Ngay",
    actionUrl: "https://qly-cham-cong.vercel.app",
    documentUrl: "https://drive.google.com",
    footerText: "Ban Giám Đốc & Phòng Hành Chính Nhân Sự ET Architects",
  },
  {
    id: "announcement",
    name: "📢 Thông báo chính thức từ Ban Giám Đốc",
    subject: "Thông báo chính thức từ Ban Giám Đốc ET Architects",
    body: "Kính gửi toàn thể cán bộ nhân viên **ET Architects**,\n\nBan Giám Đốc xin gửi tới anh/chị/em thông báo quan trọng về kế hoạch công việc và các lưu ý trong thời gian tới:\n\n[ Nhập nội dung thông báo chi tiết tại đây... ]\n\nĐề nghị các phòng ban và từng cá nhân nghiêm túc phối hợp thực hiện.",
    actionText: "Mở Hệ Thống ET Portal",
    actionUrl: "https://qly-cham-cong.vercel.app",
    documentUrl: "",
    footerText: "Ban Giám Đốc ET Architects",
  },
  {
    id: "custom",
    name: "✏️ Soạn thư tự do",
    subject: "",
    body: "",
    actionText: "",
    actionUrl: "",
    documentUrl: "",
    footerText: "ET Architects JSC",
  },
];

export default function EmailsPage() {
  const { user: currentUser } = useAuthStore();
  const [staffList, setStaffList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Template & Composer State
  const [selectedTemplate, setSelectedTemplate] = useState("onboarding");
  const [subject, setSubject] = useState(PRESET_TEMPLATES[0].subject);
  const [body, setBody] = useState(PRESET_TEMPLATES[0].body);
  const [actionText, setActionText] = useState(PRESET_TEMPLATES[0].actionText);
  const [actionUrl, setActionUrl] = useState(PRESET_TEMPLATES[0].actionUrl);
  const [documentUrl, setDocumentUrl] = useState(PRESET_TEMPLATES[0].documentUrl);
  const [footerText, setFooterText] = useState(PRESET_TEMPLATES[0].footerText);

  // Recipient Selection
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);

  // Test & Broadcast State
  const [testEmail, setTestEmail] = useState(currentUser?.email || "ndhoc2816@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [uRes, dRes] = await Promise.all([
        api.get("/users"),
        api.get("/departments"),
      ]);
      const list = uRes.data || [];
      setStaffList(list);
      setDepartments(dRes.data || []);
      const activeIds = list.filter(s => s.is_active !== false && s.email && s.email.includes("@")).map(s => String(s._id || s.id));
      setSelectedRecipientIds(activeIds);
    } catch (err) {
      toast.error("Lỗi tải danh sách nhân sự");
    } finally {
      setLoading(false);
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

  const eligibleStaff = useMemo(() => {
    return staffList.filter(s => s.is_active !== false && s.email && s.email.includes("@"));
  }, [staffList]);

  const displayedRecipients = useMemo(() => {
    if (recipientFilter === "all") return eligibleStaff;
    return eligibleStaff.filter(s => {
      const deptIds = Array.isArray(s.department_ids) ? s.department_ids.map(String) : (s.department_id ? [String(s.department_id)] : []);
      return deptIds.includes(String(recipientFilter));
    });
  }, [eligibleStaff, recipientFilter]);

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

  // Live HTML generation for preview (Architectural Frame)
  const livePreviewHtml = useMemo(() => {
    const mockVars = {
      ho_ten: "Nguyễn Văn A",
      email: "nguyenvana@et-arc.com",
      chuc_vu: "Kiến trúc sư",
      phong_ban: "Phòng Thiết Kế Kiến Trúc",
      mat_khau: "ET@2026#8492",
      link_he_thong: actionUrl || "https://qly-cham-cong.vercel.app",
      link_tai_lieu: documentUrl || "https://drive.google.com",
    };

    let renderedBody = body || "";
    for (const [k, v] of Object.entries(mockVars)) {
      renderedBody = renderedBody.replace(new RegExp("\\{" + k + "\\}", "gi"), v);
    }
    const cleanBody = renderedBody
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong style=\"color: #0f172a; font-weight: 750;\">$1</strong>");

    let ctaButtons = "";
    if (actionText && actionUrl) {
      ctaButtons += "<div style=\"text-align: center; margin: 26px 0 16px;\"><a href=\"" + actionUrl + "\" target=\"_blank\" style=\"display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 12px; box-shadow: 0 6px 18px rgba(37,99,235,0.32); letter-spacing: -0.01em;\">" + actionText + "</a></div>";
    }

    if (documentUrl) {
      ctaButtons += "<div style=\"text-align: center; margin-top: 12px; margin-bottom: 20px;\"><a href=\"" + documentUrl + "\" target=\"_blank\" style=\"display: inline-flex; align-items: center; gap: 6px; color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600; background: rgba(37,99,235,0.08); padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(37,99,235,0.2);\">📖 Xem Tài Liệu Hướng Dẫn Chi Tiết →</a></div>";
    }

    return "<div style=\"background-color: #f1f0eb; padding: 24px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 14px;\"><div style=\"max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #dcdad1; box-shadow: 0 14px 40px rgba(0,0,0,0.07);\"><div style=\"background: linear-gradient(145deg, #111418 0%, #1a1f26 100%); padding: 26px 20px; text-align: center; border-bottom: 3px solid #2563eb;\"><div style=\"display: inline-block; width: 42px; height: 42px; line-height: 42px; border-radius: 10px; background: #2563eb; color: #ffffff; font-weight: 900; font-size: 18px; margin-bottom: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.4);\">ET</div><div style=\"color: #ffffff; font-size: 19px; font-weight: 800; letter-spacing: -0.02em;\">ET ARCHITECTS</div><div style=\"color: #94a3b8; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px;\">Hệ Thống Quản Lý Nội Bộ & Chấm Công</div></div><div style=\"padding: 26px 22px;\">" + (subject ? "<h2 style=\"font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; line-height: 1.35;\">" + subject + "</h2>" : "") + "<div style=\"font-size: 14px; line-height: 1.75; color: #334155;\">" + cleanBody + "</div>" + ctaButtons + "</div><div style=\"background: #f8fafc; padding: 18px 22px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;\">" + (footerText ? "<div style=\"font-weight: 700; color: #334155; margin-bottom: 4px;\">" + footerText + "</div>" : "") + "<div><strong>Công ty Cổ phần Kiến trúc ET</strong> · Tòa nhà 17T10 Nguyễn Thị Định, Cầu Giấy, Hà Nội</div><div style=\"margin-top: 4px; color: #94a3b8; font-size: 10.5px;\">Thư được gửi tự động từ hệ thống ET Office Portal.</div></div></div></div>";
  }, [subject, body, actionText, actionUrl, documentUrl, footerText]);

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ Gmail nhận thử nghiệm hợp lệ");
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
      toast.success(data.message || "Đã gửi email thử nghiệm!", { duration: 4000 });
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
      toast.success(data.message || ("Đã gửi thành công " + data.sent + " email!"), { duration: 6000 });
    } catch (err) {
      toast.error(err?.response?.data?.error || "Lỗi gửi email hàng loạt");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header__inner header__inner--wide">
          <div>
            <div className="header__title">Bộ Soạn & Gửi Email Doanh Nghiệp</div>
            <div className="header__subtitle">
              Quản lý truyền thông nội bộ · Bàn giao tài khoản & Thông báo chính thức qua Gmail SMTP
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
            <ShieldCheck size={14} color="var(--green)" /> Tự động thay đổi tên, chức vụ, mật khẩu theo từng nhân sự
          </div>
        </div>

        {/* 2-Column Split Workspace (Desktop: Side-by-Side | Mobile: Stacked) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px", alignItems: "start", marginBottom: "20px" }}>
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
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>
                💡 Bấm để chèn biến thông minh (Tự động điền theo từng người nhận):
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[
                  { tag: "ho_ten", label: "+ {ho_ten}" },
                  { tag: "email", label: "+ {email}" },
                  { tag: "mat_khau", label: "+ {mat_khau}" },
                  { tag: "chuc_vu", label: "+ {chuc_vu}" },
                  { tag: "phong_ban", label: "+ {phong_ban}" },
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariable(v.tag)}
                    className="btn btn--ghost"
                    style={{ padding: "5px 10px", fontSize: "12px", borderRadius: "8px", fontFamily: "monospace", color: "var(--primary)" }}
                  >
                    {v.label}
                  </button>
                ))}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Link Tài Liệu Hướng Dẫn (Drive / Notion / PDF)</label>
                <input
                  type="url"
                  className="form-input"
                  value={documentUrl}
                  onChange={e => setDocumentUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/..."
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Chữ ký chân trang (Footer Signature)</label>
                <input
                  type="text"
                  className="form-input"
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  placeholder="VD: Ban Giám Đốc ET Architects"
                />
              </div>
            </div>
          </div>

          {/* Column 2: Live Preview & Test Dispatch */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "sticky", top: "80px" }}>
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Eye size={18} color="var(--primary)" />
                  <strong style={{ fontSize: "15px", color: "var(--text)" }}>Xem Trước Trực Tiếp (Live Preview)</strong>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Tự động đồng bộ theo thời gian thực</span>
              </div>

              {/* Rendered HTML Container */}
              <div style={{ maxHeight: "500px", overflowY: "auto", borderRadius: "14px", border: "1px solid var(--border)", background: "#f1f0eb", padding: "12px" }}>
                <div dangerouslySetInnerHTML={{ __html: livePreviewHtml }} />
              </div>
            </div>

            {/* Test Send Box */}
            <div className="card" style={{ padding: "16px", background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Send size={15} color="var(--primary)" /> Gửi Thử Nghiệm Trước Khi Gửi Thật (Test First):
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  className="form-input"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Nhập Gmail bất kỳ để nhận thử..."
                  style={{ fontSize: "13px" }}
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmail}
                  className="btn btn--ghost"
                  style={{ fontSize: "12.5px", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700, padding: "0 16px" }}
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

        {/* Recipient Picker & Dispatch Bar */}
        <div className="card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                <Users size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                  Danh Sách Nhân Sự Nhận Email ({selectedRecipientIds.length}/{eligibleStaff.length} người)
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Chọn phòng ban hoặc tích chọn nhân sự nhận thư chính thức</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                className="form-select"
                value={recipientFilter}
                onChange={e => setRecipientFilter(e.target.value)}
                style={{ width: "auto", fontSize: "12.5px", padding: "6px 12px", minHeight: "36px" }}
              >
                <option value="all">🏢 Toàn bộ công ty ({eligibleStaff.length})</option>
                {departments.map(d => (
                  <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                ))}
              </select>
              <button type="button" onClick={selectAllDisplayed} className="btn btn--ghost" style={{ fontSize: "12px", padding: "6px 12px" }}>Chọn tất cả ({displayedRecipients.length})</button>
              <button type="button" onClick={deselectAllDisplayed} className="btn btn--ghost" style={{ fontSize: "12px", padding: "6px 12px" }}>Bỏ chọn</button>
            </div>
          </div>

          {/* Recipient Checkbox Matrix */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px", maxHeight: "180px", overflowY: "auto", padding: "4px 0", marginBottom: "16px" }}>
            {displayedRecipients.map(s => {
              const sid = String(s._id || s.id);
              const isSelected = selectedRecipientIds.includes(sid);
              return (
                <div
                  key={sid}
                  onClick={() => toggleRecipient(sid)}
                  className="card card--interactive"
                  style={{
                    padding: "8px 12px", fontSize: "12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", borderRadius: "10px",
                    border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--primary-soft)" : "var(--bg-card)",
                    color: isSelected ? "var(--primary)" : "var(--text)",
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {isSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-muted)" />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.full_name}</div>
                    <small style={{ opacity: 0.65, fontSize: "10.5px", display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</small>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Broadcast Action Bottom Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Sẵn sàng gửi tới <strong>{selectedRecipientIds.length} nhân sự</strong> qua Gmail SMTP
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
        {showConfirmModal && (
          <div className="modal-overlay" style={{ zIndex: 1000003 }} onClick={() => setShowConfirmModal(false)}>
            <div className="modal-sheet animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px", margin: "auto", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <ShieldAlert size={28} color="var(--primary)" />
                <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0 }}>Xác nhận gửi Email hàng loạt</h3>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "18px" }}>
                Hệ thống sẽ gửi email <strong>"{subject}"</strong> tới <strong>{selectedRecipientIds.length} nhân sự</strong> đã chọn qua Gmail SMTP (giãn cách 1s/email an toàn).
                {body.includes("{mat_khau}") && (
                  <span style={{ display: "block", color: "var(--yellow)", marginTop: "8px", fontWeight: 600, background: "var(--yellow-soft)", padding: "8px 10px", borderRadius: "8px" }}>
                    ⚠️ Thư có chứa biến mật khẩu tạm, hệ thống sẽ tự động cấp mật khẩu mới và yêu cầu nhân viên đổi mật khẩu khi đăng nhập.
                  </span>
                )}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setShowConfirmModal(false)} className="btn btn--ghost btn--full">Hủy</button>
                <button type="button" onClick={handleConfirmBroadcast} className="btn btn--primary btn--full" style={{ fontWeight: 800 }}>Xác nhận gửi ngay 🚀</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
