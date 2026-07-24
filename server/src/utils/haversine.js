// ==============================================
// utils/haversine.js - Tính khoảng cách GPS
// ==============================================

/**
 * Tính khoảng cách giữa 2 toạ độ GPS bằng công thức Haversine
 * Kết quả chính xác trong vòng vài mét (đủ dùng cho geofencing)
 *
 * @param {number} lat1 - Vĩ độ điểm 1 (đơn vị: độ thập phân)
 * @param {number} lng1 - Kinh độ điểm 1
 * @param {number} lat2 - Vĩ độ điểm 2
 * @param {number} lng2 - Kinh độ điểm 2
 * @returns {number} Khoảng cách tính bằng mét
 *
 * Ví dụ: haversineDistance(10.7769, 106.7009, 10.7780, 106.7020) → ~145 mét
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Bán kính Trái Đất (mét)

  // Chuyển độ sang radian
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  // Công thức Haversine
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Làm tròn thành số nguyên (mét)
}

/**
 * Kiểm tra xem một toạ độ có trong vùng geofence không
 *
 * @param {number} userLat - Vĩ độ người dùng
 * @param {number} userLng - Kinh độ người dùng
 * @param {number} officeLat - Vĩ độ văn phòng
 * @param {number} officeLng - Kinh độ văn phòng
 * @param {number} radiusMeters - Bán kính cho phép (mét, mặc định 100m)
 * @returns {{ isInside: boolean, distance: number }} Kết quả kiểm tra
 */
function isInsideGeofence(userLat, userLng, officeLat, officeLng, radiusMeters = 100) {
  const distance = haversineDistance(userLat, userLng, officeLat, officeLng);
  return {
    isInside: distance <= radiusMeters,
    distance,
  };
}

module.exports = { haversineDistance, isInsideGeofence };
