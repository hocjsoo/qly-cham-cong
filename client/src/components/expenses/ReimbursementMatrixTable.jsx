// client/src/components/expenses/ReimbursementMatrixTable.jsx
// Bảng Quyết Toán Hoàn Ứng & Ma Trận Chi Tiêu — Thiết kế OpenDesign (Modern Minimal — Linear / Vercel style)

import { useState, useMemo, useRef } from 'react';
import {
  Download, Table2, Copy, Check, ChevronDown, ChevronUp,
  Building2, CheckCircle2, RotateCcw, FileText, X, Wallet, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExpensePdfTemplate from './ExpensePdfTemplate';

export default function ReimbursementMatrixTable({
  matrixData,
  matrixScopeFilter,
  setMatrixScopeFilter,
  handleExportMatrixCSV,
  handleExportExcel,
  formatVND,
  formatDate,
  staffList = [],
  handleMarkPaid,
  isAdmin = false,
  user,
  fundStats = null,
}) {
  // Chế độ xem: 'settlement' (Bảng quyết toán theo người) | 'grid' (Lưới ma trận đã lọc sạch 0đ)
  const [subView, setSubView] = useState('settlement');
  const [expandedUserIds, setExpandedUserIds] = useState(new Set());
  const [copiedBankId, setCopiedBankId] = useState(null);
  const [settlingUserId, setSettlingUserId] = useState(null);
  const [payingItemId, setPayingItemId] = useState(null);

  // Xuất file PDF Bảng Kê Giải Trình
  const pdfTemplateRef = useRef(null);
  const [pdfTarget, setPdfTarget] = useState(null);
  const [exportingPdfId, setExportingPdfId] = useState(null);

  // Danh sách quyết toán: Gom tất cả khoản chi theo từng nhân sự chi thực tế
  const settlementList = useMemo(() => {
    const list = (matrixData.displayUsers || []).map(u => {
      const total = matrixData.userTotals.get(u.id) || 0;
      const staff = staffList.find(s => String(s._id || s.id) === String(u.id)) || {};

      const userExpenses = [];
      (matrixData.rows || []).forEach(r => {
        (r.items || []).forEach(item => {
          const itemUserId = String(item.user_id?._id || item.user_id || '');
          if (itemUserId === String(u.id)) {
            userExpenses.push(item);
          }
        });
      });

      // Lấy thông tin STK từ staffList HOẶC từ populated expense user_id HOẶC từ matrix display user
      const resolvedBankName = staff.bank_name || userExpenses[0]?.user_id?.bank_name || u.bank_name || '';
      const resolvedBankAccount = staff.bank_account || userExpenses[0]?.user_id?.bank_account || u.bank_account || '';
      const resolvedBranch = staff.branch || userExpenses[0]?.user_id?.branch || u.branch || '';

      const enrichedStaff = {
        ...staff,
        bank_name: resolvedBankName,
        bank_account: resolvedBankAccount,
        branch: resolvedBranch,
      };

      return {
        ...u,
        staff: enrichedStaff,
        total,
        expenses: userExpenses,
      };
    });

    // Chỉ giữ lại những người có tiền > 0, xếp người có số tiền cao nhất lên đầu
    return list.filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  }, [matrixData, staffList]);

  const toggleExpand = (id) => {
    setExpandedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyBankInfo = (accountNumber, bankName, id) => {
    if (!accountNumber) return;
    navigator.clipboard.writeText(String(accountNumber).trim());
    setCopiedBankId(id);
    toast.success(`Đã sao chép STK ${accountNumber} (${bankName || 'Ngân hàng'})`);
    setTimeout(() => setCopiedBankId(null), 2000);
  };

  const copyFullSettlementSummary = () => {
    if (!settlementList.length) return;
    const lines = settlementList.map((item, idx) => {
      const bank = item.staff.bank_name ? ` · ${item.staff.bank_name} ${item.staff.bank_account || ''}` : '';
      return `${idx + 1}. ${item.full_name}: ${formatVND(item.total)}${bank}`;
    });
    const summaryText = `[DANH SÁCH HOÀN ỨNG CÔNG TY ET]\nTổng cộng: ${formatVND(matrixData.grandTotal)} (${settlementList.length} nhân sự)\n\n` + lines.join('\n');
    navigator.clipboard.writeText(summaryText);
    toast.success('Đã sao chép danh sách chuyển khoản vào clipboard! 📋');
  };

  const handleSettleAllForUser = async (userItem) => {
    if (!handleMarkPaid || !userItem.expenses?.length) return;
    const unpaidItems = userItem.expenses.filter(e => e.payment_status !== 'paid');
    if (!unpaidItems.length) {
      toast.error('Tất cả khoản của nhân sự này đã được đánh dấu thanh toán.');
      return;
    }
    setSettlingUserId(userItem.id);
    const toastId = toast.loading(`Đang thanh toán ${unpaidItems.length} khoản cho ${userItem.full_name}...`);
    try {
      for (const exp of unpaidItems) {
        await handleMarkPaid(exp._id, 'unpaid');
      }
      toast.dismiss(toastId);
      toast.success(`Đã thanh toán toàn bộ cho ${userItem.full_name}! ✅`);
    } catch {
      toast.dismiss(toastId);
      toast.error('Lỗi khi cập nhật thanh toán');
    } finally {
      setSettlingUserId(null);
    }
  };

  // Xuất file PDF A4 chuẩn OpenDesign cho từng nhân sự / người ứng
  const handleExportPDF = async (item) => {
    setExportingPdfId(item.id);
    setPdfTarget({
      beneficiary: {
        ...item.staff,
        full_name: item.full_name,
        employee_code: item.staff.employee_code || item.employee_code,
        id: item.id,
      },
      expenses: item.expenses,
      totalAmount: item.total,
    });

    const toastId = toast.loading('Đang tạo file PDF A4 bảng kê giải trình...');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      await new Promise(r => setTimeout(r, 200));

      if (!pdfTemplateRef.current) {
        throw new Error('Không tìm thấy mẫu in PDF');
      }

      const canvas = await html2canvas(pdfTemplateRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const printableWidth = pdfWidth - (margin * 2);
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * printableWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
      heightLeft -= (pdfHeight - (margin * 2));

      while (heightLeft >= 10) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      const safeName = (item.full_name || 'Hoan_Ung').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const fileName = `Bang_Ke_Hoan_Ung_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      toast.dismiss(toastId);
      toast.success(`Đã xuất PDF bảng kê hoàn ứng thành công! 📄`);
    } catch (err) {
      console.error('PDF error:', err);
      toast.dismiss(toastId);
      toast.error('Lỗi khi xuất file PDF');
    } finally {
      setExportingPdfId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '100%' }}>
      {/* Hidden PDF Template DOM for rendering */}
      {pdfTarget && (
        <ExpensePdfTemplate
          ref={pdfTemplateRef}
          beneficiary={pdfTarget.beneficiary}
          expenses={pdfTarget.expenses}
          totalAmount={pdfTarget.totalAmount}
          fundStats={fundStats}
          formatVND={formatVND}
          formatDate={formatDate}
        />
      )}

      {/* Top Toolbar (OpenDesign Modern Minimal) */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* SubView Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setSubView('settlement')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 13px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer',
                background: subView === 'settlement' ? 'var(--bg-card)' : 'transparent',
                color: subView === 'settlement' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: subView === 'settlement' ? 'var(--shadow-xs)' : 'none',
              }}
            >
              <Wallet size={14} /> Danh Sách Quyết Toán
            </button>
            <button
              type="button"
              onClick={() => setSubView('grid')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 13px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer',
                background: subView === 'grid' ? 'var(--bg-card)' : 'transparent',
                color: subView === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: subView === 'grid' ? 'var(--shadow-xs)' : 'none',
              }}
            >
              <Table2 size={14} /> Ma Trận Lọc Sạch 0đ
            </button>
          </div>

          {/* Scope Filter */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)', padding: '2px' }}>
            {[
              { id: 'unpaid', label: '💸 Cần trả (Chưa trả)' },
              { id: 'all', label: '📊 Toàn bộ' },
              { id: 'paid', label: '✅ Đã trả' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMatrixScopeFilter(tab.id)}
                style={{
                  padding: '5px 11px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600,
                  cursor: 'pointer',
                  background: matrixScopeFilter === tab.id ? 'var(--bg-card)' : 'transparent',
                  color: matrixScopeFilter === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {subView === 'settlement' && settlementList.length > 0 && (
            <button
              onClick={copyFullSettlementSummary}
              className="btn btn--ghost"
              style={{ padding: '6px 12px', fontSize: '12px', gap: '5px' }}
              title="Sao chép toàn bộ danh sách chuyển khoản"
            >
              <Copy size={13} /> Copy Danh Sách
            </button>
          )}
          {handleExportExcel && (
            <button
              onClick={handleExportExcel}
              className="btn btn--primary"
              style={{ padding: '6px 12px', fontSize: '12px', gap: '5px' }}
              title="Xuất file Excel XLSX chuẩn kế toán (2 Sheet, format số và STK chống lỗi)"
            >
              <FileSpreadsheet size={13} /> Xuất Excel
            </button>
          )}
          <button
            onClick={handleExportMatrixCSV}
            className="btn btn--ghost"
            style={{ padding: '6px 12px', fontSize: '12px', gap: '5px' }}
            title="Xuất file CSV"
          >
            <Download size={13} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Top Settlement Summary Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.06) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(99,102,241,0.2)',
        }}
      >
        <div>
          <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
            {matrixScopeFilter === 'unpaid' ? '💸 TỔNG CÔNG TY CẦN HOÀN TRẢ' : '📊 TỔNG CÔNG NỢ CHI TIÊU'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: matrixScopeFilter === 'unpaid' ? 'var(--red)' : 'var(--primary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
            {formatVND(matrixData.grandTotal)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Số người nhận tiền</div>
            <strong style={{ fontSize: '16px', color: 'var(--text)' }}>{settlementList.length} nhân sự</strong>
          </div>
        </div>
      </div>

      {/* CHẾ ĐỘ 1: BẢNG QUYẾT TOÁN THEO NGƯỜI (TRIỆT TIÊU 100% Ô 0Đ) */}
      {subView === 'settlement' ? (
        settlementList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎉</div>
            <div className="empty-state__title">Không có công nợ hoàn ứng nào!</div>
            <div className="empty-state__desc">Tất cả các khoản chi tiêu đã được thanh toán đầy đủ.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {settlementList.map((item, idx) => {
              const isExpanded = expandedUserIds.has(item.id);
              const bankAccount = item.staff.bank_account || '';
              const bankName = item.staff.bank_name || '';
              const hasBank = Boolean(bankAccount);
              const isSettling = settlingUserId === item.id;
              const isExportingThisPdf = exportingPdfId === item.id;

              return (
                <div
                  key={item.id}
                  className="card animate-fade-in"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    {/* Thông tin nhân sự */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: '220px' }}>
                      <div
                        style={{
                          width: '42px', height: '42px', borderRadius: '10px',
                          background: 'var(--primary-soft)', color: 'var(--primary)',
                          display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '15px', flexShrink: 0,
                        }}
                      >
                        {item.short_name?.charAt(0) || 'NV'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text)' }}>
                            {idx + 1}. {item.full_name}
                          </span>
                          {item.staff.employee_code && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              (#{item.staff.employee_code})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={12} />
                          <span>{item.staff.department_name || 'Văn phòng ET'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Khung Thông Tin Ngân Hàng & Nút Sao Chép */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--bg-input)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {hasBank ? (
                        <>
                          <Building2 size={15} style={{ color: 'var(--primary)' }} />
                          <div style={{ fontSize: '12px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{bankName}</span>: <code style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>{bankAccount}</code>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyBankInfo(bankAccount, bankName, item.id)}
                            className="btn btn--ghost"
                            style={{ padding: '3px 7px', fontSize: '11px', height: 'auto', minHeight: 'unset' }}
                            title="Sao chép số tài khoản"
                          >
                            {copiedBankId === item.id ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Chưa cập nhật STK ngân hàng
                        </span>
                      )}
                    </div>

                    {/* Số tiền cần thanh toán & Nút hành động */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                      <div style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px 0',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            justifyContent: 'flex-end',
                          }}
                          title="Bấm để xem chi tiết và trả riêng từng khoản"
                        >
                          <span>{item.expenses.length} khoản chi gộp</span>
                          <span style={{ fontSize: '10px', textDecoration: 'underline' }}>
                            {isExpanded ? '▲ Thu gọn' : '▼ Trả riêng'}
                          </span>
                        </button>
                        <strong style={{ fontSize: '18px', fontWeight: 900, color: matrixScopeFilter === 'unpaid' ? 'var(--red)' : 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatVND(item.total)}
                        </strong>
                      </div>

                      {/* Nút Xuất PDF Bảng Kê */}
                      <button
                        type="button"
                        onClick={() => handleExportPDF(item)}
                        disabled={isExportingThisPdf}
                        className="btn btn--ghost"
                        style={{ padding: '7px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--primary)' }}
                        title="Xuất bảng kê giải trình PDF A4 gửi sếp/kế toán"
                      >
                        <FileText size={14} /> {isExportingThisPdf ? 'Đang tạo...' : 'Xuất PDF'}
                      </button>

                      {/* Nút Admin chuyển tiền gộp */}
                      {isAdmin && matrixScopeFilter === 'unpaid' && (
                        <button
                          type="button"
                          onClick={() => handleSettleAllForUser(item)}
                          disabled={isSettling}
                          className="btn btn--primary"
                          style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          <CheckCircle2 size={14} /> {isSettling ? 'Đang lưu...' : 'Đã chuyển tiền'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="btn btn--ghost"
                        style={{ padding: '6px 8px' }}
                        title={isExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết các khoản chi'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Chi tiết từng khoản chi của người này (Bung ra khi bấm) */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px dashed var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Chi tiết các khoản cấu thành {formatVND(item.total)}:
                      </div>

                      {item.expenses.map((exp, eIdx) => {
                        const isPaid = exp.payment_status === 'paid';

                        return (
                          <div
                            key={exp._id || eIdx}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-raised)',
                              fontSize: '12px', gap: '10px', flexWrap: 'wrap',
                              border: '1px solid var(--border-muted)',
                            }}
                          >
                            {/* Nội dung khoản chi */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11.5px' }}>{formatDate(exp.date)}</span>
                              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{exp.description}</span>
                              {exp.has_vat_invoice && <span className="badge badge--info" style={{ fontSize: '10px' }}>VAT</span>}
                            </div>

                            {/* Cột số tiền & Nút thao tác duy nhất */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
                              <strong style={{ color: 'var(--text)', fontSize: '13px', fontVariantNumeric: 'tabular-nums', marginRight: '6px' }}>
                                {formatVND(exp.amount)}
                              </strong>

                              {/* Nút Thanh Toán Hoàn Ứng Duy Nhất (Chỉ Admin bấm trả) */}
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setPayingItemId(exp._id);
                                    await handleMarkPaid(exp._id, exp.payment_status);
                                    setPayingItemId(null);
                                  }}
                                  disabled={payingItemId === exp._id}
                                  className={`btn ${isPaid ? 'btn--ghost' : 'btn--primary'}`}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    height: '28px',
                                    minHeight: '28px',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={isPaid ? 'Hoàn tác về Chưa trả' : 'Đánh dấu riêng khoản này đã chuyển khoản'}
                                >
                                  {payingItemId === exp._id ? (
                                    'Đang lưu...'
                                  ) : isPaid ? (
                                    <><RotateCcw size={12} /> Đã trả (Hoàn tác)</>
                                  ) : (
                                    <><Check size={12} /> Trả khoản này</>
                                  )}
                                </button>
                              ) : (
                                <span
                                  className={`badge badge--${isPaid ? 'success' : 'neutral'}`}
                                  style={{ fontSize: '10.5px', padding: '3px 8px' }}
                                  title={isPaid ? 'Khoản chi này đã hoàn trả' : 'Chờ Admin xác nhận chuyển khoản'}
                                >
                                  {isPaid ? '✅ Đã trả' : '⏳ Chưa trả'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* CHẾ ĐỘ 2: LƯỚI MA TRẬN ĐÃ LỌC SẠCH 100% CỘT VÀ Ô 0Đ */
        <div
          className="card animate-fade-in"
          style={{
            padding: 0,
            overflowX: 'auto',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            maxWidth: '100%',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12.5px',
              textAlign: 'center',
              minWidth: `${Math.max(600, 240 + matrixData.displayUsers.length * 125)}px`,
            }}
          >
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: '#1e293b', color: '#ffffff', borderBottom: '2px solid #0f172a' }}>
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 11,
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontWeight: 900,
                    fontSize: '13px',
                    minWidth: '220px',
                    borderRight: '2px solid #334155',
                  }}
                >
                  <div style={{ textTransform: 'uppercase', letterSpacing: '0.8px', fontSize: '13px' }}>TỔNG HOÀN TRẢ</div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '3px', fontWeight: 600 }}>
                    {matrixData.displayUsers.length} người có tiền
                  </div>
                </th>
                {matrixData.displayUsers.map(u => {
                  const tot = matrixData.userTotals.get(u.id) || 0;
                  return (
                    <th
                      key={u.id}
                      style={{
                        padding: '12px 10px',
                        minWidth: '115px',
                        borderRight: '1px solid #334155',
                      }}
                      title={u.full_name}
                    >
                      <div style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.2px' }}>{u.short_name}</div>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: '12.5px',
                          marginTop: '4px',
                          color: tot > 0 ? '#facc15' : '#94a3b8',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatVND(tot)}
                      </div>
                    </th>
                  );
                })}
                <th
                  style={{
                    padding: '12px 14px',
                    minWidth: '130px',
                    background: '#0f172a',
                    color: '#ffffff',
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase' }}>TỔNG CỘNG</div>
                  <div style={{ fontWeight: 900, fontSize: '13px', marginTop: '4px', color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                    {formatVND(matrixData.grandTotal)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixData.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={matrixData.displayUsers.length + 2}
                    style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    Không có dữ liệu chi tiêu trong phạm vi lọc này.
                  </td>
                </tr>
              ) : (
                matrixData.rows.map((row, idx) => (
                  <tr
                    key={row.key}
                    style={{
                      borderBottom: '1px solid var(--border-muted)',
                      background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                    }}
                  >
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 5,
                        background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-raised)',
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: 700,
                        borderRight: '2px solid var(--border)',
                        minWidth: '220px',
                      }}
                    >
                      <div style={{ color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase' }}>
                        {row.title}
                      </div>
                      {row.date && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                          {formatDate(row.date)} {row.items?.length > 1 ? `(${row.items.length} mục)` : ''}
                        </div>
                      )}
                    </td>
                    {matrixData.displayUsers.map(u => {
                      const val = row.userAmounts[u.id] || 0;
                      return (
                        <td
                          key={u.id}
                          style={{
                            padding: '12px 10px',
                            borderRight: '1px solid var(--border-muted)',
                            fontSize: '12.5px',
                            fontWeight: val > 0 ? 800 : 400,
                            color: val > 0 ? 'var(--text)' : 'var(--text-muted)',
                            background: val > 0 ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {val > 0 ? formatVND(val) : <span style={{ color: 'var(--text-muted)', opacity: 0.35 }}>—</span>}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '12px 14px',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        color: 'var(--primary)',
                        background: 'color-mix(in srgb, var(--primary) 5%, transparent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatVND(row.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
