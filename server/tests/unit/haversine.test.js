// ==============================================
// tests/unit/haversine.test.js
// Kiểm thử công thức GPS Haversine & Geofencing
// Độc lập 100% không đụng vào Database
// ==============================================

const path = require('path');
const { haversineDistance, isInsideGeofence } = require(path.join(__dirname, '../../src/utils/haversine'));

function runHaversineTests(assert) {
  console.log('\n📍 [TEST SUITE: GPS & GEOFENCING]');

  // Tọa độ văn phòng mẫu: 10.7769 (Lat), 106.7009 (Lng) - TP.HCM
  const officeLat = 10.7769;
  const officeLng = 106.7009;

  // TC-GPS-01: Trùng khớp 100% tọa độ
  const d1 = haversineDistance(officeLat, officeLng, officeLat, officeLng);
  assert(d1 === 0, 'TC-GPS-01: Trùng vị trí tuyệt đối -> Khoảng cách 0m', `d=${d1}m`);

  // TC-GPS-02: Khoảng cách ngắn ~15m (Nằm trong bán kính 100m)
  const userLatClose = 10.77699;
  const userLngClose = 106.70099;
  const geoClose = isInsideGeofence(userLatClose, userLngClose, officeLat, officeLng, 100);
  assert(geoClose.isInside === true && geoClose.distance < 50, 'TC-GPS-02: Vị trí cách ~15m -> Hợp lệ trong bán kính 100m', `d=${geoClose.distance}m`);

  // TC-GPS-03: Khoảng cách xa 120m (Vượt quá bán kính 100m nhưng trong 200m)
  const userLatMid = 10.7780;
  const userLngMid = 106.7015;
  const geoMid100 = isInsideGeofence(userLatMid, userLngMid, officeLat, officeLng, 100);
  const geoMid200 = isInsideGeofence(userLatMid, userLngMid, officeLat, officeLng, 200);
  assert(geoMid100.isInside === false && geoMid200.isInside === true, 'TC-GPS-03: Vị trí cách ~138m -> Bị từ chối ở mốc 100m, chấp nhận ở mốc 200m', `d=${geoMid100.distance}m`);

  // TC-GPS-04: Khoảng cách xa hơn 8km (Ngoài phạm vi văn phòng)
  const userLatFar = 10.8231;
  const userLngFar = 106.6297;
  const geoFar = isInsideGeofence(userLatFar, userLngFar, officeLat, officeLng, 250);
  assert(geoFar.isInside === false && geoFar.distance > 5000, 'TC-GPS-04: Vị trí cách xa >5km -> Ngoài phạm vi Geofence', `d=${geoFar.distance}m`);

  // TC-GPS-05: Kiểm tra tính đối xứng của công thức (A -> B bằng B -> A)
  const distAB = haversineDistance(officeLat, officeLng, userLatMid, userLngMid);
  const distBA = haversineDistance(userLatMid, userLngMid, officeLat, officeLng);
  assert(distAB === distBA, 'TC-GPS-05: Tính chất đối xứng khoảng cách Haversine (d(A,B) == d(B,A))', `AB=${distAB}m, BA=${distBA}m`);
}

module.exports = runHaversineTests;
