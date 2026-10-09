// client/src/components/expenses/ExpensePdfTemplate.jsx
// Mẫu in PDF Bảng Kê Quyết Toán Hoàn Ứng & Giải Trình Chi Tiêu chuẩn OpenDesign

import { forwardRef } from 'react';

export const ExpensePdfTemplate = forwardRef(function ExpensePdfTemplate({
  beneficiary,
  expenses = [],
  totalAmount = 0,
  fundStats = null,
  formatVND,
  formatDate,
  companyName = 'CÔNG TY TNHH THIẾT KẾ KIẾN TRÚC ET',
  companyAddress = 'Số 7 Phố Nguyễn Thị Định, P. Trung Hòa, Cầu Giấy, Hà Nội',
}, ref) {
  const printDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1000px', pointerEvents: 'none' }}>
      <div
        ref={ref}
        style={{
          background: '#ffffff',
          color: '#0f172a',
          padding: '36px 40px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          width: '1000px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header Công Ty */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
              {companyName}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {companyAddress}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
            <div>Biểu mẫu: <strong>ET-ACC-EXP-01</strong></div>
            <div>Ngày lập: <strong>{printDate}</strong></div>
          </div>
        </div>

        {/* Tiêu đề Bảng Kê */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            BẢNG KÊ QUYẾT TOÁN HOÀN ỨNG & GIẢI TRÌNH CHI TIÊU
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
            (Chứng từ tổng hợp các khoản chi phí phục vụ hoạt động công ty)
          </div>
        </div>

        {/* Thông tin Người Nhận Hoàn Ứng */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '12.5px' }}>
          <div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Người thụ hưởng: </span>
              <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>{beneficiary?.full_name || '—'}</strong>
              {beneficiary?.employee_code && (
                <span style={{ marginLeft: '6px', fontSize: '11px', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {beneficiary.employee_code}
                </span>
              )}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Phòng ban / Vị trí: </span>
              <strong>{beneficiary?.department_name || beneficiary?.position || 'Văn phòng ET'}</strong>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Ngân hàng: </span>
              <strong style={{ color: '#0f172a' }}>{beneficiary?.bank_name || 'Chưa cập nhật'}</strong>
              {beneficiary?.branch && <span style={{ color: '#64748b' }}> ({beneficiary.branch})</span>}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Số tài khoản: </span>
              <strong style={{ color: '#2563eb', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                {beneficiary?.bank_account || 'Chưa cập nhật'}
              </strong>
            </div>
          </div>
        </div>

        {/* Cân Đối Sổ Quỹ Tạm Ứng (Nếu có dữ liệu quỹ) */}
        {fundStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#f1f5f9', padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '18px', textAlign: 'center', fontSize: '11.5px' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Tổng Sếp Đã Cấp Quỹ</div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#2563eb', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{formatVND(fundStats.totalFundIn)}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Tổng Đã Xuất Quỹ Trả</div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{formatVND(fundStats.totalFundOut)}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                {fundStats.fundBalance >= 0 ? 'Số Dư Quỹ Hiện Còn' : 'Cty Cần Cấp Bù'}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: fundStats.fundBalance >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                {formatVND(Math.abs(fundStats.fundBalance))}
              </div>
            </div>
          </div>
        )}

        {/* Bảng kê chi tiết các khoản chi */}
        <table className="pdf-export-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '20px' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left', fontWeight: 800 }}>
              <th style={{ padding: '9px 10px', width: '40px', textAlign: 'center', border: '1px solid #334155' }}>STT</th>
              <th style={{ padding: '9px 10px', width: '90px', border: '1px solid #334155' }}>NGÀY CHI</th>
              <th style={{ padding: '9px 10px', width: '140px', border: '1px solid #334155' }}>NGƯỜI CHI</th>
              <th style={{ padding: '9px 10px', border: '1px solid #334155' }}>NỘI DUNG KHOẢN CHI</th>
              <th style={{ padding: '9px 10px', width: '80px', textAlign: 'center', border: '1px solid #334155' }}>HÓA ĐƠN</th>
              <th style={{ padding: '9px 10px', width: '140px', textAlign: 'right', border: '1px solid #334155' }}>SỐ TIỀN (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, idx) => {
              const spenderName = exp.user_id?.full_name || exp.user_name || '—';
              const isAdvanced = exp.advanced_by && String(exp.advanced_by?._id || exp.advanced_by) === String(beneficiary?.id || beneficiary?._id);
              return (
                <tr key={exp._id || idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{formatDate(exp.date)}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{spenderName}</div>
                    {isAdvanced && <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600 }}>(Đã ứng thay)</div>}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{exp.description}</div>
                    {exp.notes && <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>{exp.notes}</div>}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                    {exp.has_vat_invoice ? (
                      <span style={{ fontSize: '10px', color: '#059669', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>VAT</span>
                    ) : (
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', border: '1px solid #cbd5e1', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {formatVND(exp.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 900, borderTop: '2px solid #0f172a' }}>
              <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', border: '1px solid #cbd5e1', fontSize: '12.5px', textTransform: 'uppercase' }}>
                TỔNG CỘNG TIỀN CÔNG TY CẦN HOÀN ỨNG:
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', border: '1px solid #cbd5e1', color: '#dc2626', fontSize: '14.5px', fontVariantNumeric: 'tabular-nums' }}>
                {formatVND(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Chữ ký & Phê duyệt */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', marginTop: '36px', fontSize: '12px', lineHeight: 1.6 }}>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>NGƯỜI ĐỀ NGHỊ</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '60px' }}>(Ký và ghi rõ họ tên)</div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{beneficiary?.full_name || '—'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>KẾ TOÁN / THỦ QUỸ</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '60px' }}>(Xác nhận đối soát)</div>
            <div style={{ fontWeight: 700, color: '#64748b' }}>..........................................</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>GIÁM ĐỐC DUYỆT</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '60px' }}>(Ký và phê duyệt chi)</div>
            <div style={{ fontWeight: 700, color: '#64748b' }}>..........................................</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ExpensePdfTemplate;
