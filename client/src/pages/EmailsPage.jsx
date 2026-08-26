// client/src/pages/EmailsPage.jsx
// Trang Soạn & Gửi Email Tùy Chỉnh Toàn Màn Hình (2 Cột Soạn Thảo & Live Preview Song Song) — Admin Only

import { useState, useEffect, useMemo } from "react";
import { Mail, Send, Eye, Edit3, Check, Users, ShieldAlert, Sparkles, FileText, CheckSquare, Square, RefreshCw, Link as LinkIcon, ExternalLink, ArrowRight, Info, ShieldCheck, Search, Lock } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import useAuthStore from "../stores/authStore";
import HeaderActions from "../components/HeaderActions";

const PRESET_TEMPLATES = [
  {
    id: "onboarding",
    name: "🚀 Bàn giao tài khoản & HDSD",
    subject: "Thông tin tài khoản & Hướng dẫn sử dụng hệ thống ET Office Portal",
    body: "Xin chào **{ho_ten}**,\n\n**Kiến trúc ET** chính thức đưa vào vận hành hệ thống **ET Office Portal** nhằm tối ưu hóa quy trình chấm công GPS, nộp đơn từ, quản lý dự án và đăng ký lịch làm việc.\n\n🔐 **THÔNG TIN ĐĂNG NHẬP CỦA BẠN:**\n• **Tài khoản (Email):** {email}\n• **Mật khẩu tạm thời:** {mat_khau}\n• **Chức vụ:** {chuc_vu} · **Phòng ban:** {phong_ban}\n\n[button: 🚀 Đăng Nhập Hệ Thống Ngay | https://qly-cham-cong.vercel.app]\n\n[link: 📖 Bấm vào đây để xem Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết | https://drive.google.com]\n\n📌 **QUY TRÌNH BẮT ĐẦU:**\n1. Bấm nút đăng nhập phía trên để truy cập.\n2. Đổi mật khẩu cá nhân mới ngay trong lần đầu đăng nhập.\n3. Tham khảo tài liệu hướng dẫn để nắm rõ các quy định.\n\nChúc bạn có trải nghiệm làm việc thuận tiện và hiệu quả!",
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

  // Multi-Dimensional Recipient Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterEmpType, setFilterEmpType] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);

  // Test & Broadcast State
  const [testEmail, setTestEmail] = useState(currentUser?.email || "ndhoc2816@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const imageInputRef = useRef(null);

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
      const activeIds = list.filter(s => s.is_active !== false && s.employment_status !== "Da nghi viec" && s.email && s.email.includes("@")).map(s => String(s._id || s.id));
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

  const activeCount = useMemo(() => {
    return staffList.filter(s => s.is_active !== false && s.employment_status !== "Da nghi viec" && s.email && s.email.includes("@")).length;
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
      const isResigned = s.is_active === false || s.employment_status === "Da nghi viec";
      if (filterStatus === "active" && isResigned) return false;
      if (filterStatus === "resigned" && !isResigned) return false;

      if (filterDept !== "all") {
        const deptIds = Array.isArray(s.department_ids) ? s.department_ids.map(String) : (s.department_id ? [String(s.department_id)] : []);
        if (!deptIds.includes(String(filterDept))) return false;
      }
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
  }, [staffList, searchQuery, filterStatus, filterDept, filterEmpType, filterRole]);

  const toggleRecipient = (staff) => {
    const sid = String(staff._id || staff.id);
    const isResigned = staff.is_active === false || staff.employment_status === "Da nghi viec";
    if (isResigned) {
      toast.error("Nhân sự này đã nghỉ việc — Tự động khóa không gửi email!", { icon: "🔒" });
      return;
    }
    setSelectedRecipientIds(prev => 
      prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]
    );
  };

  const selectAllEligibleDisplayed = () => {
    const validIds = displayedStaff
      .filter(s => s.is_active !== false && s.employment_status !== "Da nghi viec" && s.email && s.email.includes("@"))
      .map(s => String(s._id || s.id));
    setSelectedRecipientIds(prev => Array.from(new Set([...prev, ...validIds])));
  };

  const deselectAllDisplayed = () => {
    const ids = new Set(displayedStaff.map(s => String(s._id || s.id)));
    setSelectedRecipientIds(prev => prev.filter(x => !ids.has(x)));
  };

  const selectOnlyType = (type) => {
    setFilterEmpType(type);
    const validIds = staffList
      .filter(s => s.is_active !== false && s.employment_status !== "Da nghi viec" && s.email && s.email.includes("@"))
      .filter(s => (s.employee_type || "NS") === type)
      .map(s => String(s._id || s.id));
    setSelectedRecipientIds(validIds);
    toast.success("Đã chọn " + validIds.length + " nhân sự loại " + type);
  };

  const selectOnlyLeaders = () => {
    setFilterRole("leader");
    const validIds = staffList
      .filter(s => s.is_active !== false && s.employment_status !== "Da nghi viec" && s.email && s.email.includes("@"))
      .filter(s => ["admin", "leader", "manager"].includes(s.role))
      .map(s => String(s._id || s.id));
    setSelectedRecipientIds(validIds);
    toast.success("Đã chọn " + validIds.length + " Cấp Quản Lý (Admin & Leader)");
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
    let cleanBody = renderedBody
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong style=\"color: #0f172a; font-weight: 800;\">$1</strong>");

    // Parse [img: URL]
    cleanBody = cleanBody.replace(/\[img:\s*([^\]]+)\]/gi, (match, url) => {
      return "<div style=\"text-align: center; margin: 16px 0;\"><img src=\"" + url.trim() + "\" alt=\"Hình ảnh\" style=\"max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); display: inline-block; border: 1px solid #e2e8f0;\" /></div>";
    });

    // Parse [button: Label | URL]
    cleanBody = cleanBody.replace(/\[button:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, label, url) => {
      return "<div style=\"text-align: center; margin: 20px 0;\"><a href=\"" + url.trim() + "\" target=\"_blank\" style=\"display: inline-block; padding: 13px 28px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 14.5px; font-weight: 800; border-radius: 10px; box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35); letter-spacing: -0.01em;\">" + label.trim() + "</a></div>";
    });

    // Parse [link: Text | URL]
    cleanBody = cleanBody.replace(/\[link:\s*([^\|\]]+)(?:\||,)\s*([^\]]+)\]/gi, (match, text, url) => {
      return "<a href=\"" + url.trim() + "\" target=\"_blank\" style=\"color: #2563eb; text-decoration: underline; font-weight: 700;\">" + text.trim() + "</a>";
    });

    let ctaButtons = "";
    if (actionText && actionUrl) {
      ctaButtons += "<div style=\"text-align: center; margin: 28px 0 16px;\"><a href=\"" + actionUrl + "\" target=\"_blank\" style=\"display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35); letter-spacing: -0.01em;\">" + actionText + "</a></div>";
    }

    if (documentUrl) {
      ctaButtons += "<div style=\"text-align: center; margin-top: 14px; margin-bottom: 22px;\"><a href=\"" + documentUrl + "\" target=\"_blank\" style=\"display: inline-flex; align-items: center; gap: 6px; color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 700; background: rgba(37, 99, 235, 0.08); padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(37, 99, 235, 0.2);\">📖 Xem Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết →</a></div>";
    }

    return "<div style=\"background-color: #f5f4f0; padding: 24px 8px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; border-radius: 14px;\"><div style=\"max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #dcd8cf; box-shadow: 0 16px 48px rgba(15,23,42,0.08);\"><div style=\"background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 22px; text-align: center; border-bottom: 3px solid #2563eb;\"><div style=\"text-align: center;\"><img src=\"/logo.png\" alt=\"ET Architects\" style=\"height: 54px; max-width: 180px; object-fit: contain; display: inline-block; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5)); border-radius: 8px;\" /><div style=\"color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; margin-top: 8px;\">ET ARCHITECTS</div><div style=\"color: #94a3b8; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px;\">HỆ THỐNG QUẢN LÝ CHẤM CÔNG & NỘI BỘ</div></div></div><div style=\"padding: 28px 24px;\">" + (subject ? "<h2 style=\"font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; line-height: 1.35;\">" + subject + "</h2>" : "") + "<div style=\"font-size: 14.5px; line-height: 1.85; color: #334155;\">" + cleanBody + "</div>" + ctaButtons + "</div><div style=\"background: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;\">" + (footerText ? "<div style=\"font-weight: 800; color: #1e293b; margin-bottom: 4px; font-size: 12.5px;\">" + footerText + "</div>" : "") + "<div><strong>Kiến trúc ET</strong> · Tòa nhà 17T10 Nguyễn Thị Định, Cầu Giấy, Hà Nội</div><div style=\"margin-top: 4px; color: #94a3b8; font-size: 10.5px;\">Thư được gửi tự động từ hệ thống ET Office Portal.</div></div></div></div>";
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
      <input type="file" ref={imageInputRef} onChange={handleSelectImageFile} accept="image/*" style={{ display: "none" }} />
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
                  { tag: "mat_khau", label: "🔑 {mat_khau}" },
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
                  onClick={() => setBody(prev => prev + " [link: Xem chi tiết tại đây | https://drive.google.com] ")}
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

            {/* Department */}
            <select
              className="form-select"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              style={{ fontSize: "12.5px", minHeight: "36px" }}
            >
              <option value="all">🏢 Tất cả phòng ban</option>
              {departments.map(d => (
                <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
              ))}
            </select>

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
                const isResigned = s.is_active === false || s.employment_status === "Da nghi viec";
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
              Sẵn sàng gửi tới <strong style={{ color: "var(--primary)" }}>{selectedRecipientIds.length} nhân sự</strong> hợp lệ qua Gmail SMTP
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
