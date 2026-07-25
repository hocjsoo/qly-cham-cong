import { useCallback, useState } from "react";

interface GeoResult {
  lat: number;
  lng: number;
}

/** Lấy GPS trình duyệt — dùng riêng cho Check In/Out (mục 9 kiến trúc: dùng GPS, không WiFi). */
export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPosition = useCallback((): Promise<GeoResult> => {
    setLoading(true);
    setError(null);
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const msg = "Trình duyệt không hỗ trợ định vị GPS.";
        setError(msg);
        setLoading(false);
        reject(new Error(msg));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setLoading(false);
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  }, []);

  return { getPosition, loading, error };
}
