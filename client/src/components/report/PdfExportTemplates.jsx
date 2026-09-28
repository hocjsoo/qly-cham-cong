// client/src/components/report/PdfExportTemplates.jsx
// Mẫu in PDF Bảng công tháng ngang & Phiếu xác nhận cá nhân A4 đứng

import { forwardRef } from 'react';

/**
 * Mẫu in PDF Bảng tổng hợp công tháng (Khổ A4 ngang - 2150px)
 */
export const PdfMatrixTemplate = forwardRef(function PdfMatrixTemplate(
  { matrixData, month, year, filterStaffId, pdfMatrixRows, headerDayByDay, resolveTimesheetSymbol, isHolidayWorkSymbol, user },
  ref
) {
  const renderPdfSum = (val, color) => {
    if (!val || val === 0) return <span style={{ color: '#cbd5e1', opacity: 0.3 }}>—</span>;
    return <span style={{ fontWeight: 800, color }}>{val.toFixed(2)}</span>;
  };

  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '2150px', pointerEvents: 'none' }}>
      <div ref={ref} style={{ background: '#ffffff', color: '#0f172a', padding: '24px', fontFamily: 'Arial, sans-serif', width: '2150px' }}>
        {/* Corporate Header Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '3px solid #1e293b', paddingBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              CÔNG TY TNHH THIẾT KẾ KIẾN TRÚC ET
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
              BẢNG TỔNG HỢP CHẤM CÔNG & PHỤ CẤP TĂNG CA
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginTop: '3px' }}>
              KỲ CÔNG: THÁNG {month} / {year} {filterStaffId && `— [Nhân sự: ${matrixData?.staff_rows?.find(s => s.id === filterStaffId)?.full_name}]`}
            </div>
          </div>
          <div style={{ fontSize: '11.5px', textAlign: 'right', color: '#475569', lineHeight: 1.6 }}>
            <div>Biểu mẫu kế toán: <strong style={{ color: '#0f172a' }}>ET_Staff {year}</strong></div>
            <div>Trạng thái sổ công: <strong style={{ color: matrixData?.global_locked ? '#dc2626' : '#059669', padding: '2px 8px', borderRadius: '4px', background: matrixData?.global_locked ? '#fee2e2' : '#dcfce7' }}>{matrixData?.global_locked ? '🔒 ĐÃ CHỐT KHÓA' : '🟢 ĐANG CẬP NHẬT'}</strong></div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>Ngày xuất: {new Date().toLocaleDateString('vi-VN')}</div>
          </div>
        </div>

        <table className="pdf-export-table" style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap', border: '1.5px solid #1e293b' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#ffffff', fontWeight: 800 }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '60px', border: '1px solid #334155' }}>ID</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px', border: '1px solid #334155' }}>NHÂN SỰ</th>
              <th style={{ padding: '8px 10px', minWidth: '70px', border: '1px solid #334155' }}>NV</th>

              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#10b981' }}>NLV tại VP</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#3b82f6' }}>CT Trong nước</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#8b5cf6' }}>CT Nước ngoài</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#06b6d4' }}>Work from home</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#8b5cf6' }}>Nghỉ phép</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#ef4444' }}>Nghỉ ốm</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#64748b' }}>Nghỉ không lương</th>
              <th style={{ padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', color: '#94a3b8' }}>Khác</th>

              {matrixData?.header_days?.map(hd => {
                const isSun = hd.weekday === 'CN' || hd.isSunday;
                return (
                  <th key={hd.day} style={{ padding: '4px 6px', background: isSun ? '#991b1b' : '#334155', color: isSun ? '#fca5a5' : '#ffffff', minWidth: '28px', border: '1px solid #334155' }}>
                    {hd.weekday}
                  </th>
                );
              })}
            </tr>

            <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800 }}>
              <th colSpan="3" style={{ padding: '6px 10px', textAlign: 'left', border: '1px solid #334155' }}>BẢNG CHẤM CÔNG THÁNG</th>
              <th colSpan="8" style={{ padding: '6px 8px', fontSize: '10px', color: '#94a3b8', border: '1px solid #334155' }}>TỔNG CỘNG THEO LOẠI CÔNG</th>

              {matrixData?.header_days?.map(hd => {
                const isSun = hd.weekday === 'CN' || hd.isSunday;
                return (
                  <th key={hd.day} style={{ padding: '4px 6px', background: isSun ? '#7f1d1d' : '#0f172a', color: isSun ? '#fca5a5' : '#ffffff', border: '1px solid #334155' }}>
                    {hd.dayStr}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pdfMatrixRows.map((r, idx) => (
              <tr key={r.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#0f172a', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: '#2563eb', border: '1px solid #cbd5e1' }}>{r.code}</td>
                <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a', border: '1px solid #cbd5e1' }}>{r.full_name}</td>
                <td style={{ padding: '8px 10px', color: '#475569', border: '1px solid #cbd5e1' }}>{r.role_label}</td>

                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.nlv_office, '#059669')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.ct_domestic, '#2563eb')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.ct_foreign, '#7c3aed')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.wfh, '#0891b2')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.annual_leave, '#7c3aed')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.sick_leave, '#dc2626')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.unpaid_leave, '#475569')}</td>
                <td style={{ padding: '8px 6px', border: '1px solid #cbd5e1' }}>{renderPdfSum(r.other_leave, '#64748b')}</td>

                {r.days.map(d => {
                  const hdObj = headerDayByDay.get(d.day);
                  const daySymbol = resolveTimesheetSymbol(d);
                  const isSun = hdObj?.weekday === 'CN' || hdObj?.isSunday;
                  return (
                    <td
                      key={d.day}
                      style={{
                        padding: '6px 4px', fontWeight: 800, border: '1px solid #cbd5e1',
                        background: isSun ? '#fef2f2' : d.ot_hours > 0 ? '#fff7ed' : 'transparent',
                        color: isHolidayWorkSymbol(daySymbol) ? '#be185d' :
                               daySymbol === 'x' || daySymbol === '0,75x' ? '#059669' :
                               daySymbol === '0,5x' ? '#d97706' :
                               daySymbol === 'CT1' ? '#2563eb' :
                               daySymbol === 'CT2' ? '#7c3aed' :
                               daySymbol === 'WFH' ? '#0891b2' :
                               daySymbol === 'P' ? '#7c3aed' :
                               daySymbol === 'O' ? '#dc2626' :
                               daySymbol === 'KL' ? '#475569' : '#0f172a'
                      }}
                    >
                      {daySymbol || '—'}
                      {d.ot_hours > 0 && (
                        <div style={{ fontSize: '7.5px', color: '#c2410c', fontWeight: 900, marginTop: '1px' }}>
                          +{d.ot_hours}h
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* Total Footer Row for PDF */}
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #1e293b' }}>
              <td colSpan="3" style={{ padding: '10px 10px', textAlign: 'left', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                TỔNG CỘNG HỆ THỐNG ({pdfMatrixRows.length} NV)
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#059669' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.nlv_office, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#2563eb' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.ct_domestic, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#7c3aed' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.ct_foreign, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#0891b2' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.wfh, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#7c3aed' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.annual_leave, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#dc2626' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.sick_leave, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#475569' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.unpaid_leave, 0).toFixed(2)}
              </td>
              <td style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#64748b' }}>
                {pdfMatrixRows.reduce((s, r) => s + r.other_leave, 0).toFixed(2)}
              </td>
              {matrixData?.header_days?.map(hd => (
                <td key={hd.day} style={{ padding: '6px 4px', fontSize: '10px', color: '#94a3b8', border: '1px solid #cbd5e1' }}>—</td>
              ))}
            </tr>
          </tfoot>
        </table>

        {/* Matrix PDF Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', marginTop: '36px', textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>NGƯỜI LẬP BIỂU</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ height: '70px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{user?.full_name || 'Người lập'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>KẾ TOÁN TRƯỞNG</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ height: '70px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Bộ phận Kế toán</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>BAN GIÁM ĐỐC PHÊ DUYỆT</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký tên, đóng dấu)</div>
            <div style={{ height: '70px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Ban Giám Đốc</div>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Mẫu in PDF Phiếu xác nhận chấm công cá nhân (Khổ A4 đứng - 920px)
 */
export const PdfIndividualTemplate = forwardRef(function PdfIndividualTemplate(
  { indUser, indSum, lc, indLogs, month, year },
  ref
) {
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '920px', pointerEvents: 'none' }}>
      <div ref={ref} style={{ background: '#ffffff', color: '#0f172a', padding: '28px 32px', fontFamily: 'Arial, sans-serif', width: '920px', boxSizing: 'border-box' }}>
        {/* Executive Header Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '2.5px solid #1e293b', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              CÔNG TY TNHH THIẾT KẾ KIẾN TRÚC ET
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              PHIẾU XÁC NHẬN CHẤM CÔNG & TĂNG CA
            </div>
            <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700, marginTop: '2px' }}>
              KỲ LƯƠNG: THÁNG {month} / {year}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
            <div>Mã phiếu: <strong style={{ color: '#0f172a' }}>{indUser.employee_code || indUser.code || indUser.id || 'NS'}</strong></div>
            <div>Ngày in: <strong>{new Date().toLocaleDateString('vi-VN')}</strong></div>
            <div style={{ color: '#059669', fontWeight: 700 }}>● Bản in chính thức</div>
          </div>
        </div>

        {/* Employee ID Card Summary Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Họ và tên nhân sự</span>
            <strong style={{ fontSize: '14px', color: '#0f172a' }}>{indUser.full_name || '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Phòng ban / Đơn vị</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{indUser.department_name || 'Phòng Thiết Kế'}</span>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Chức danh vị trí</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>{indUser.position || indUser.role_label || 'Kiến trúc sư'}</span>
          </div>
        </div>

        {/* 4 KPI Metrics Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>🏢 Tổng công chuẩn</span>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
              {Number(indSum.total_work_hours ? indSum.total_work_hours / 8 : 0).toFixed(2)} công
            </div>
            <small style={{ fontSize: '9.5px', color: '#166534' }}>{indSum.total_work_hours || 0} giờ làm</small>
          </div>
          <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '8px', border: '1px solid #fed7aa', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>🔥 Tăng ca (OT)</span>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>
              {(Number(indSum.ot1_hours || 0) + Number(indSum.ot2_hours || 0) + Number(indSum.ot3_hours || 0)).toFixed(1)}h
            </div>
            <small style={{ fontSize: '9.5px', color: '#9a3412' }}>Thường: {indSum.ot1_hours || 0}h · Nghỉ: {indSum.ot2_hours || 0}h</small>
          </div>
          <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd6fe', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase' }}>🏖️ Nghỉ phép & Lễ</span>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#6d28d9', marginTop: '2px' }}>
              {Number(lc.P || 0) + Number(lc.OM || 0) + Number(lc.KL || 0)} ngày
            </div>
            <small style={{ fontSize: '9.5px', color: '#5b21b6' }}>{lc.P || 0} phép · {lc.OM || 0} ốm · {lc.KL || 0} KL</small>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>⏱️ Kỷ luật giờ giấc</span>
            <div style={{ fontSize: '16px', fontWeight: 900, color: indSum.late_count > 0 ? '#dc2626' : '#059669', marginTop: '2px' }}>
              {indSum.late_count || 0} lần muộn
            </div>
            <small style={{ fontSize: '9.5px', color: '#64748b' }}>Trễ {indSum.late_minutes || 0}p · Sớm {indSum.early_count || 0} lần</small>
          </div>
        </div>

        {/* Main Detailed Logs Table */}
        <table className="pdf-export-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #1e293b', fontSize: '10.5px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#ffffff', fontWeight: 'bold' }}>
              <th style={{ border: '1px solid #334155', padding: '7px 5px', width: '75px' }}>Ngày</th>
              <th style={{ border: '1px solid #334155', padding: '7px 4px', width: '45px' }}>Thứ</th>
              <th style={{ border: '1px solid #334155', padding: '7px 4px', color: '#34d399', width: '65px' }}>Giờ vào</th>
              <th style={{ border: '1px solid #334155', padding: '7px 4px', color: '#60a5fa', width: '65px' }}>Giờ ra</th>
              <th style={{ border: '1px solid #334155', padding: '7px 5px', width: '65px' }}>Loại công</th>
              <th style={{ border: '1px solid #334155', padding: '7px 5px' }}>Quy đổi công</th>
              <th style={{ border: '1px solid #334155', padding: '7px 5px', width: '65px' }}>Giờ làm</th>
              <th style={{ border: '1px solid #334155', padding: '7px 5px', color: '#c084fc', width: '65px' }}>Tăng ca</th>
              <th style={{ border: '1px solid #334155', padding: '7px 6px' }}>Địa điểm / Dự án</th>
            </tr>
          </thead>
          <tbody>
            {indLogs.map((row) => {
              const isSun = row.weekday === 'CN' || row.weekday === 'Chủ Nhật';
              const inTime = row.shift1?.in || row.shift2?.in || row.shift3?.in || '—';
              const outTime = row.shift3?.out || row.shift2?.out || row.shift1?.out || '—';
              const otVal = (row.ot1 || 0) + (row.ot2 || 0) + (row.ot3 || 0);
              const otStr = otVal > 0 ? `${otVal.toFixed(1)}h` : '—';
              const numCredit = parseFloat(row.workCredit || 0);

              let creditBadge = <span style={{ color: '#64748b' }}>0 công</span>;
              if (numCredit >= 1 || row.workCredit === '1.0' || row.workCredit === 'x') {
                creditBadge = <span style={{ color: '#059669', fontWeight: 800 }}>1.0 công (Đủ)</span>;
              } else if (numCredit > 0) {
                creditBadge = <span style={{ color: '#d97706', fontWeight: 800 }}>{numCredit} công</span>;
              } else if (row.workCredit && row.workCredit !== '0' && row.workCredit !== '—') {
                creditBadge = <span style={{ color: '#7c3aed', fontWeight: 800 }}>{row.workCredit}</span>;
              }

              return (
                <tr key={row.day} style={{ background: isSun ? '#fef2f2' : row.isWeekend ? '#f8fafc' : '#ffffff', color: '#0f172a' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 700 }}>{row.dateFormatted}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 700, color: isSun ? '#dc2626' : '#0f172a' }}>{row.weekday}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', color: '#059669', fontWeight: 700 }}>{inTime}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', color: '#2563eb', fontWeight: 700 }}>{outTime}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 700, color: '#475569' }}>{row.workCredit || '—'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px' }}>{creditBadge}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 800 }}>{row.totalHours ? `${row.totalHours}h` : '—'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', fontWeight: 800, color: otVal > 0 ? '#7c3aed' : '#cbd5e1' }}>{otStr}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 4px', color: '#475569' }}>{row.locationName}</td>
                </tr>
              );
            })}
            {/* Bottom Summary Row */}
            <tr style={{ fontWeight: 'bold', background: '#f1f5f9', color: '#0f172a', borderTop: '2px solid #1e293b' }}>
              <td colSpan="6" style={{ border: '1.5px solid #1e293b', padding: '8px 10px', textAlign: 'left' }}>
                TỔNG CỘNG THÁNG {month} / {year}:
              </td>
              <td colSpan="3" style={{ border: '1.5px solid #1e293b', padding: '8px', textAlign: 'center', color: '#059669', fontSize: '12px' }}>
                {indSum.total_work_hours} giờ làm việc chính thức
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signature Block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px', textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#1e293b' }}>NGƯỜI LAO ĐỘNG XÁC NHẬN</div>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký và ghi rõ họ tên)</div>
            <div style={{ height: '65px' }} />
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{indUser.full_name}</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#1e293b' }}>PHỤ TRÁCH DUYỆT BẢNG LƯƠNG</div>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký tên, đóng dấu)</div>
            <div style={{ height: '65px' }} />
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>Ban Giám Đốc / Kế Toán</div>
          </div>
        </div>
      </div>
    </div>
  );
});
