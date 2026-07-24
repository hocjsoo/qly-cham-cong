// src/hooks/useGeolocation.js
// Custom hook lấy GPS từ thiết bị

import { useState, useCallback } from 'react';

export function useGeolocation() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [position, setPosition] = useState(null);

  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      setError(null);

      // Kiểm tra browser hỗ trợ không
      if (!navigator.geolocation) {
        const msg = 'Trình duyệt không hỗ trợ GPS. Dùng Chrome hoặc Safari mới nhất.';
        setError(msg);
        setLoading(false);
        reject(msg);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result = {
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy, // Độ chính xác (mét)
          };
          setPosition(result);
          setLoading(false);
          resolve(result);
        },
        (err) => {
          // Các mã lỗi GPS chuẩn
          const messages = {
            1: 'Bạn đã từ chối quyền GPS. Vào Cài đặt trình duyệt → Quyền → Vị trí → Cho phép.',
            2: 'Không thể xác định vị trí. Kiểm tra GPS trên thiết bị.',
            3: 'GPS phản hồi quá lâu. Thử lại.',
          };
          const msg = messages[err.code] || 'Lỗi GPS không xác định';
          setError(msg);
          setLoading(false);
          reject(msg);
        },
        {
          enableHighAccuracy: true,  // Dùng GPS thật (không dùng IP)
          timeout: 12000,            // Chờ tối đa 12 giây
          maximumAge: 0,             // Không dùng cache GPS cũ
        }
      );
    });
  }, []);

  return { getPosition, loading, error, position };
}
