// client/src/components/requests/FlaggedVerificationTab.jsx
// Trung tâm xét duyệt ca cảnh báo thiết bị lạ & xác thực selfie (Admin/Leader)

import { Search, RefreshCw, Camera, ZoomIn, Check, X, RotateCcw } from 'lucide-react';

export default function FlaggedVerificationTab({
  flaggedSearch,
  setFlaggedSearch,
  fetchFlagged,
  flaggedLoading,
  flaggedCounts,
  flaggedTab,
  setFlaggedTab,
  flaggedList,
  selfieCacheRef,
  failedSelfieRef,
  setFlaggedList,
  selfieLoadingId,
  handleOpenSelfiePhoto,
  handleVerifyFlagged,
  setRejectFlaggedTarget,
  setRejectFlaggedReason,
  setAllowRecheckin,
  verifyingId,
  formatDate,
  isAdmin,
}) {
  return (
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
            onClick={() => { if (flaggedTab === ft.key) fetchFlagged(); else setFlaggedTab(ft.key); }}
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
            const isPending = item.verification_status === 'pending_review' ||
              (item.is_flagged === true && !isApproved && !isRejected);
            const isAutoApproved = item.verification_status === 'auto_approved' && !isPending;
            const isPastOpenShift = isAdmin && Boolean(item.check_in_time) && !item.check_out_time &&
              item.date < new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            const statusColor = isApproved || isAutoApproved ? 'var(--green)' : isRejected ? 'var(--red)' : isPending ? 'var(--yellow)' : 'var(--text-muted)';
            const empName = item.user_id?.full_name || 'Nhân sự';
            const empCode = item.user_id?.employee_code || item.user_id?.code || 'NS';
            const deptName = item.user_id?.department_id?.name || 'Văn Phòng';

            return (
              <div
                key={item._id}
                className="card request-list-card animate-fade-in"
                style={{
                  padding: '16px', borderRadius: '14px',
                  borderLeft: `4px solid ${statusColor}`,
                  background: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                      {empName} <span style={{ color: 'var(--primary)', fontSize: '12px' }}>(#{empCode})</span>
                    </span>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>🏢 {deptName}</div>
                  </div>
                  <span className={`badge badge--${isApproved || isAutoApproved ? 'success' : isRejected ? 'danger' : isPending ? 'warning' : 'neutral'}`} style={{ fontSize: '11.5px', padding: '4px 9px' }}>
                    {isApproved ? '✅ Đã xác minh' : isRejected ? '❌ Bị từ chối' : isPending ? '⏳ Chờ xem xét' : isAutoApproved ? '✅ Tự động xác nhận' : 'Chưa có trạng thái xác minh'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {(() => {
                    const recordId = String(item._id || item.id || '');
                    const resolvedSelfie = item.selfie_url || (selfieCacheRef.current && selfieCacheRef.current.get(recordId));
                    const hasPhoto = Boolean(item.has_selfie || resolvedSelfie);

                    if (!hasPhoto) {
                      return (
                        <div style={{ width: 78, height: 78, borderRadius: '12px', background: 'var(--bg-raised)', color: 'var(--text-muted)', fontSize: '10.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px', flexShrink: 0, border: '1px dashed var(--border)' }}>
                          <Camera size={18} style={{ marginBottom: '2px' }} />
                          Không có ảnh
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        aria-label={`Xem ảnh selfie của ${empName}`}
                        disabled={selfieLoadingId === recordId}
                        onClick={() => handleOpenSelfiePhoto(item, empName, formatDate(item.date))}
                        style={{ position: 'relative', cursor: 'pointer', flexShrink: 0, padding: 0, border: 0, background: 'transparent', borderRadius: '12px' }}
                      >
                        {resolvedSelfie ? (
                          <img
                            src={resolvedSelfie}
                            alt="Selfie"
                            loading="lazy"
                            decoding="async"
                            onError={() => {
                              selfieCacheRef.current?.delete(recordId);
                              failedSelfieRef.current?.add(recordId);
                              setFlaggedList(prev => prev.map(row => (
                                String(row._id || row.id) === recordId ? { ...row, selfie_url: null } : row
                              )));
                            }}
                            style={{ width: 78, height: 78, borderRadius: '12px', objectFit: 'cover', border: `2px solid ${statusColor}` }}
                          />
                        ) : null}
                        <div style={{
                          width: 78, height: 78, borderRadius: '12px', background: 'var(--bg-raised)',
                          color: 'var(--primary)', display: resolvedSelfie ? 'none' : 'flex',
                          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          border: `2px solid ${statusColor}`, fontSize: '10.5px',
                        }}>
                          {selfieLoadingId === recordId ? (
                            <>
                              <RefreshCw size={18} className="spinner" />
                              <span style={{ fontSize: '10px', fontWeight: 600 }}>Đang tải...</span>
                            </>
                          ) : (
                            <>
                              <Camera size={22} />
                              <span>Có ảnh selfie</span>
                            </>
                          )}
                        </div>
                        <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', borderRadius: '4px', padding: '1px 5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <ZoomIn size={10} /> Xem
                        </div>
                      </button>
                    );
                  })()}

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
                    {isPending && isPastOpenShift && (
                      <div style={{ fontSize: '11.5px', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '6px 10px', borderRadius: '8px', marginBottom: '6px', fontWeight: 600 }}>
                        Duyệt ngày công sẽ tự chốt giờ ra theo giờ kết thúc ca; nhân viên không cần nộp thêm đơn quên checkout.
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
                {(isPending || isApproved || isRejected) && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleVerifyFlagged(item._id, 'approve')}
                          disabled={verifyingId === item._id}
                          className="btn btn--primary"
                          style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 700 }}
                        >
                          <Check size={14} /> {isPastOpenShift ? 'Duyệt ngày công & Chốt ca' : 'Duyệt ca & Tin cậy máy'}
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
