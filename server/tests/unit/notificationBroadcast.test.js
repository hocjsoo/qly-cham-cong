// ==============================================
// tests/unit/notificationBroadcast.test.js
// Kiểm thử Hệ thống Thông báo Broadcast & Đích danh (Notifications)
// ==============================================

function getVisibleNotificationsForUser(allNotifications, userId) {
  return allNotifications.filter(n => n.user_id === null || n.user_id === userId);
}

function markAllNotificationsAsRead(notifications, userId) {
  return notifications.map(n => {
    if (n.user_id === null || n.user_id === userId) {
      return { ...n, is_read: true };
    }
    return n;
  });
}

function runNotificationTests(assert) {
  console.log('\n🔔 [TEST SUITE: NOTIFICATIONS & BROADCAST]');

  const mockNotifications = [
    { _id: 'n1', user_id: null, title: 'Thông báo nghỉ lễ', is_read: false },
    { _id: 'n2', user_id: 'u_emp1', title: 'Đơn phép của bạn đã được duyệt', is_read: false },
    { _id: 'n3', user_id: 'u_emp2', title: 'Đơn OT của bạn đã được duyệt', is_read: false },
  ];

  // TC-NOTI-01: Nhân viên 1 nhận được cả thông báo chung (Broadcast) và thông báo riêng của mình
  const emp1Notifs = getVisibleNotificationsForUser(mockNotifications, 'u_emp1');
  assert(emp1Notifs.length === 2 && emp1Notifs.some(n => n._id === 'n1') && emp1Notifs.some(n => n._id === 'n2'),
    'TC-NOTI-01: Nhân viên u_emp1 nhận đúng 2 thông báo (1 chung + 1 riêng)');

  // TC-NOTI-02: Nhân viên 1 không nhìn thấy thông báo riêng của Nhân viên 2
  assert(!emp1Notifs.some(n => n._id === 'n3'),
    'TC-NOTI-02: Bảo mật thông báo — Không nhìn thấy thông báo cá nhân của user khác');

  // TC-NOTI-03: Đánh dấu tất cả đã đọc
  const updatedNotifs = markAllNotificationsAsRead(emp1Notifs, 'u_emp1');
  const allRead = updatedNotifs.every(n => n.is_read === true);
  assert(allRead === true,
    'TC-NOTI-03: Đánh dấu tất cả thông báo của user thành đã đọc (is_read = true)');
}

module.exports = runNotificationTests;
