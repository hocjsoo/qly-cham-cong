// ==============================================
// tests/unit/projectSite.test.js
// Kiểm thử Quản lý Dự án & Điểm danh Công trình (Site / Geofenced Projects)
// ==============================================

const path = require('path');
const { haversineDistance } = require(path.join(__dirname, '../../src/utils/haversine'));

function validateSiteCheckin(project, userLat, userLng) {
  if (!project || project.status === 'completed' || project.status === 'closed') {
    return { valid: false, error: 'Dự án không tồn tại hoặc đã kết thúc.' };
  }

  if (project.lat && project.lng) {
    const radius = project.radius_meters || 500;
    const distance = haversineDistance(userLat, userLng, project.lat, project.lng);
    if (distance > radius) {
      return { valid: false, distance, error: `Bạn đang ở ngoài phạm vi công trình (${distance}m > ${radius}m).` };
    }
    return { valid: true, distance, isInside: true };
  }

  return { valid: true, note: 'Dự án không yêu cầu Geofence cố định' };
}

function runProjectSiteTests(assert) {
  console.log('\n🏗️ [TEST SUITE: PROJECT & SITE GEOFENCING]');

  const mockProject = {
    _id: 'proj_01',
    name: 'Công trình Nhà máy KCN VSIP 1',
    code: 'DA-VSIP1',
    lat: 10.9328,
    lng: 106.6974,
    radius_meters: 500,
    status: 'in_progress',
    members: ['u_emp1', 'u_emp2']
  };

  // TC-PROJ-01: Điểm danh tại công trình nằm trong bán kính 500m
  const checkInNear = validateSiteCheckin(mockProject, 10.9330, 106.6975);
  assert(checkInNear.valid === true && checkInNear.distance < 100,
    'TC-PROJ-01: Check-in Site tại Công trường VSIP 1 trong bán kính 500m -> Hợp lệ');

  // TC-PROJ-02: Điểm danh ngoài bán kính công trình (cách 3km) -> Bị từ chối
  const checkInFar = validateSiteCheckin(mockProject, 10.9600, 106.6974);
  assert(checkInFar.valid === false && checkInFar.distance > 2000,
    'TC-PROJ-02: Check-in Site quá xa công trình (>2km) -> Bị từ chối');

  // TC-PROJ-03: Dự án đã đóng (status = completed) -> Không cho phép điểm danh
  const closedProject = { ...mockProject, status: 'completed' };
  const checkClosed = validateSiteCheckin(closedProject, 10.9328, 106.6974);
  assert(checkClosed.valid === false && checkClosed.error.includes('kết thúc'),
    'TC-PROJ-03: Chặn điểm danh đối với dự án đã hoàn thành / kết thúc');
}

module.exports = runProjectSiteTests;
