// ==============================================
// tests/unit/multiOfficeLocation.test.js
// Kiểm thử Điểm danh Đa Chi Nhánh / Văn Phòng (Multi-Office Geofencing)
// ==============================================

const path = require('path');
const { haversineDistance } = require(path.join(__dirname, '../../src/utils/haversine'));

function validateMultiOfficeCheckin(officeList, userLat, userLng) {
  const activeOffices = officeList.filter(o => o.is_active !== false);

  for (const office of activeOffices) {
    const radius = office.radius_m || 100;
    const distance = haversineDistance(userLat, userLng, office.lat, office.lng);
    if (distance <= radius) {
      return {
        isInside: true,
        matchedOffice: office.name,
        distance,
      };
    }
  }

  // Nếu không nằm trong chi nhánh nào, tìm chi nhánh gần nhất để báo khoảng cách
  let minDistance = Infinity;
  let nearestOffice = null;
  activeOffices.forEach(o => {
    const d = haversineDistance(userLat, userLng, o.lat, o.lng);
    if (d < minDistance) {
      minDistance = d;
      nearestOffice = o.name;
    }
  });

  return {
    isInside: false,
    nearestOffice,
    minDistance,
    error: `Bạn đang ở ngoài tất cả các chi nhánh văn phòng (Gần nhất: ${nearestOffice}, cách ${minDistance}m)`
  };
}

function runMultiOfficeTests(assert) {
  console.log('\n🏢 [TEST SUITE: MULTI-OFFICE LOCATIONS GEOFENCING]');

  const mockOffices = [
    { _id: 'loc_hcm', name: 'Trụ sở TP.HCM', lat: 10.7769, lng: 106.7009, radius_m: 100, is_active: true },
    { _id: 'loc_hn', name: 'Chi nhánh Hà Nội', lat: 21.0285, lng: 105.8542, radius_m: 150, is_active: true },
    { _id: 'loc_old', name: 'Văn phòng cũ đã đóng', lat: 10.7800, lng: 106.7000, radius_m: 100, is_active: false },
  ];

  // TC-LOC-01: Check-in tại Trụ sở TP.HCM
  const checkHCM = validateMultiOfficeCheckin(mockOffices, 10.77695, 106.70092);
  assert(checkHCM.isInside === true && checkHCM.matchedOffice === 'Trụ sở TP.HCM',
    'TC-LOC-01: Check-in hợp lệ tại Trụ sở TP.HCM');

  // TC-LOC-02: Check-in tại Chi nhánh Hà Nội
  const checkHN = validateMultiOfficeCheckin(mockOffices, 21.0286, 105.8543);
  assert(checkHN.isInside === true && checkHN.matchedOffice === 'Chi nhánh Hà Nội',
    'TC-LOC-02: Check-in hợp lệ tại Chi nhánh Hà Nội');

  // TC-LOC-03: Bỏ qua chi nhánh đã vô hiệu hóa (is_active = false)
  const checkOldOffice = validateMultiOfficeCheckin(mockOffices, 10.7800, 106.7000);
  assert(checkOldOffice.isInside === false,
    'TC-LOC-03: Bỏ qua văn phòng đã vô hiệu hóa (is_active=false)');

  // TC-LOC-04: Ở ngoài tất cả các chi nhánh
  const checkOutside = validateMultiOfficeCheckin(mockOffices, 16.0544, 108.2022); // Đà Nẵng
  assert(checkOutside.isInside === false && checkOutside.error.includes('ngoài tất cả'),
    'TC-LOC-04: Chặn điểm danh khi ở ngoài toàn bộ các chi nhánh công ty');
}

module.exports = runMultiOfficeTests;
