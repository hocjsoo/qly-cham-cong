// client/src/components/expenses/ReimbursementMatrixTable.jsx
// Thành phần hiển thị Bảng Ma Trận Chi Tiêu & Hoàn Ứng (Chuẩn mẫu Google Sheets)

import { Download } from 'lucide-react';

export default function ReimbursementMatrixTable({
  matrixData,
  matrixScopeFilter,
  setMatrixScopeFilter,
  matrixHideZeros,
  setMatrixHideZeros,
  handleExportMatrixCSV,
  formatVND,
  formatDate,
}) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Sub-toolbar Ma Trận */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>
            🎯 Xem theo:
          </span>
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)', padding: '2px' }}>
            {[
              { id: 'unpaid', label: '💸 Phải trả ai bao nhiêu (Chưa trả)' },
              { id: 'all', label: '📊 Toàn bộ chi tiêu' },
              { id: 'paid', label: '✅ Đã hoàn ứng' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMatrixScopeFilter(tab.id)}
                style={{
                  padding: '5px 12px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700,
                  cursor: 'pointer',
                  background: matrixScopeFilter === tab.id ? 'var(--primary)' : 'transparent',
                  color: matrixScopeFilter === tab.id ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginLeft: '6px', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={matrixHideZeros}
              onChange={e => setMatrixHideZeros(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Chỉ hiện người có tiền (&gt; 0đ)</span>
          </label>
        </div>

        <button
          onClick={handleExportMatrixCSV}
          className="btn btn--ghost"
          style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
          title="Tải bảng ma trận tổng hợp theo người ra file CSV UTF-8"
        >
          <Download size={13} /> Xuất Ma Trận (.csv)
        </button>
      </div>

      {/* Quick summary badges if there are amounts to reimburse */}
      {matrixData.grandTotal > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            padding: '8px 12px',
            background: 'var(--bg-raised)',
            borderRadius: '10px',
            border: '1px solid var(--border-muted)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            💡 Chi tiết:
          </span>
          {matrixData.displayUsers
            .filter(u => (matrixData.userTotals.get(u.id) || 0) > 0)
            .map(u => {
              const amt = matrixData.userTotals.get(u.id) || 0;
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{u.short_name}:</span>
                  <strong style={{ color: matrixScopeFilter === 'unpaid' ? 'var(--red)' : 'var(--primary)' }}>
                    {formatVND(amt)}
                  </strong>
                </div>
              );
            })}
        </div>
      )}

      {/* Matrix Spreadsheet Table */}
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
            minWidth: `${Math.max(900, 240 + matrixData.displayUsers.length * 125)}px`,
          }}
        >
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#343a40', color: '#ffffff', borderBottom: '2px solid #212529' }}>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 11,
                  background: '#2b3035',
                  color: '#ffffff',
                  padding: '14px 16px',
                  textAlign: 'left',
                  fontWeight: 900,
                  fontSize: '13px',
                  minWidth: '220px',
                  borderRight: '2px solid #495057',
                  borderBottom: '2px solid #212529',
                }}
              >
                <div style={{ textTransform: 'uppercase', letterSpacing: '0.8px', fontSize: '13px' }}>TỔNG</div>
                <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '3px', fontWeight: 600 }}>
                  {matrixScopeFilter === 'unpaid' ? 'Phải trả từng người' : 'Tổng chi từng người'}
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
                      borderRight: '1px solid #495057',
                      borderBottom: '2px solid #212529',
                    }}
                    title={u.full_name}
                  >
                    <div style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.2px' }}>{u.short_name}</div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: '12.5px',
                        marginTop: '4px',
                        color: tot > 0 ? '#ffc107' : '#adb5bd',
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
                  minWidth: '140px',
                  background: '#212529',
                  color: '#ffffff',
                  borderBottom: '2px solid #111',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase' }}>NOTE / TỔNG</div>
                <div style={{ fontWeight: 900, fontSize: '13px', marginTop: '4px', color: '#20c997' }}>
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
                          fontWeight: val > 0 ? 800 : 500,
                          color: val > 0 ? 'var(--text)' : 'var(--text-muted)',
                          background: val > 0 ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                        }}
                      >
                        {formatVND(val)}
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
    </div>
  );
}
