// client/src/components/MapGpsPicker.jsx
// Bản đồ tương tác chọn vị trí GPS Văn Phòng / Công Trình (OpenStreetMap / Leaflet)

import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Navigation, Compass, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

function loadLeafletAssets() {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.body.appendChild(script);
    } else {
      const timer = setInterval(() => {
        if (window.L) {
          clearInterval(timer);
          resolve(window.L);
        }
      }, 50);
    }
  });
}

export default function MapGpsPicker({ lat, lng, radius = 100, onSelectLocation }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const defaultLat = parseFloat(lat) || 21.028511; // Mặc định Hà Nội
  const defaultLng = parseFloat(lng) || 105.804817;

  const [currentLat, setCurrentLat] = useState(defaultLat);
  const [currentLng, setCurrentLng] = useState(defaultLng);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [addressDisplay, setAddressDisplay] = useState('');
  const [mapLoading, setMapLoading] = useState(true);

  // Khởi tạo bản đồ Leaflet theo nhu cầu
  useEffect(() => {
    let isMounted = true;
    loadLeafletAssets().then((L) => {
      if (!isMounted || !mapContainerRef.current || !L) return;
      setMapLoading(false);

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLng],
          zoom: 16,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map);

        // Custom Red Pin Icon
        const customIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `<div style="
            width: 36px; height: 36px; border-radius: 50%;
            background: #ef4444; border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
            display: flex; align-items: center; justify-content: center;
            color: #ffffff; font-size: 18px; font-weight: bold;
          ">📍</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        // Marker
        const marker = L.marker([defaultLat, defaultLng], {
          draggable: true,
          icon: customIcon,
        }).addTo(map);

        // Bán kính vùng cho phép (Circle overlay)
        const circle = L.circle([defaultLat, defaultLng], {
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.18,
          radius: parseInt(radius, 10) || 100,
        }).addTo(map);

        markerRef.current = marker;
        circleRef.current = circle;
        mapInstanceRef.current = map;

        // Sự kiện Click chọn vị trí trên bản đồ
        map.on('click', (e) => {
          const { lat: newLat, lng: newLng } = e.latlng;
          updateLocation(newLat, newLng);
        });

        // Sự kiện Kéo/Rê Marker Pin
        marker.on('dragend', () => {
          const position = marker.getLatLng();
          updateLocation(position.lat, position.lng);
        });
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cập nhật marker & circle khi prop lat/lng/radius thay đổi
  useEffect(() => {
    if (lat && lng && mapInstanceRef.current && markerRef.current) {
      const nLat = parseFloat(lat);
      const nLng = parseFloat(lng);
      if (!isNaN(nLat) && !isNaN(nLng)) {
        setCurrentLat(nLat);
        setCurrentLng(nLng);
        markerRef.current.setLatLng([nLat, nLng]);
        if (circleRef.current) {
          circleRef.current.setLatLng([nLat, nLng]);
          circleRef.current.setRadius(parseInt(radius, 10) || 100);
        }
      }
    }
  }, [lat, lng, radius]);

  const updateLocation = (newLat, newLng) => {
    const formattedLat = parseFloat(newLat.toFixed(6));
    const formattedLng = parseFloat(newLng.toFixed(6));

    setCurrentLat(formattedLat);
    setCurrentLng(formattedLng);

    if (markerRef.current) markerRef.current.setLatLng([formattedLat, formattedLng]);
    if (circleRef.current) circleRef.current.setLatLng([formattedLat, formattedLng]);
    if (mapInstanceRef.current) mapInstanceRef.current.panTo([formattedLat, formattedLng]);

    if (onSelectLocation) {
      onSelectLocation(formattedLat, formattedLng);
    }
  };

  // Lấy GPS hiện tại từ thiết bị
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ Geolocation GPS');
      return;
    }
    toast.loading('Đang định vị GPS...', { id: 'gps_load' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss('gps_load');
        toast.success('Đã lấy được vị trí GPS hiện tại! 📍');
        updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        toast.dismiss('gps_load');
        toast.error('Không thể lấy vị trí GPS: ' + (err.message || 'Bị từ chối truy cập'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tìm kiếm địa chỉ qua Nominatim OpenStreetMap API
  const handleSearchAddress = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await res.json();

      if (results && results.length > 0) {
        const item = results[0];
        const nLat = parseFloat(item.lat);
        const nLng = parseFloat(item.lon);

        updateLocation(nLat, nLng);
        setAddressDisplay(item.display_name);
        toast.success(`Đã tìm thấy: ${item.display_name.split(',')[0]}`);
      } else {
        toast.error('Không tìm thấy địa chỉ này');
      }
    } catch {
      toast.error('Lỗi kết nối bản đồ tìm kiếm');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Search Bar & Geolocation Button */}
      <form onSubmit={handleSearchAddress} style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', fontSize: '13px', padding: '7px 10px 7px 32px' }}
            placeholder="Gõ tên đường, tòa nhà hoặc địa chỉ để tìm..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="submit" disabled={searching} className="btn btn--primary" style={{ padding: '7px 12px', fontSize: '12px' }}>
          {searching ? <span className="spinner" /> : 'Tìm'}
        </button>
        <button
          type="button"
          onClick={handleGetCurrentGps}
          className="btn btn--ghost"
          style={{ padding: '7px 10px', fontSize: '12px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
          title="Tự động định vị GPS thiết bị"
        >
          <Navigation size={15} /> GPS
        </button>
      </form>

      {/* Interactive Leaflet Map Container */}
      <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '2px solid var(--border)' }}>
        {mapLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-raised)', color: 'var(--text-muted)',
            gap: '8px', fontSize: '12px'
          }}>
            <div style={{
              width: '18px', height: '18px',
              border: '2px solid var(--border)', borderTopColor: 'var(--primary)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite'
            }} />
            <span>Đang tải bản đồ OpenStreetMap...</span>
          </div>
        )}
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '300px', zIndex: 1, background: 'var(--bg-raised)' }}
        />

        {/* Floating Hint Overlay */}
        <div style={{
          position: 'absolute', bottom: '10px', left: '10px', right: '10px',
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)',
          color: '#ffffff', padding: '8px 12px', borderRadius: '10px',
          fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 10, border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color="#ef4444" />
            <span>Chạm/Kéo ghim trên bản đồ để chọn tọa độ VP</span>
          </div>
          <div style={{ fontWeight: 700, color: 'var(--green)' }}>
            {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
          </div>
        </div>
      </div>

      {addressDisplay && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '6px 10px', borderRadius: '8px' }}>
          📍 {addressDisplay}
        </div>
      )}
    </div>
  );
}
