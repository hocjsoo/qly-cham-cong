# Firestore Security Rules Documentation
## ET Office Portal

Nguyên tắc chủ đạo: **client chỉ được đọc theo role, gần như không được ghi trực tiếp field nghiệp vụ quan trọng — mọi write nhạy cảm đi qua Cloud Function (Admin SDK, bỏ qua rules nhưng tự kiểm soát logic)**.

---

## 1. Helper functions dùng chung

```js
function isSignedIn() {
  return request.auth != null;
}

function currentRole() {
  return request.auth.token.role; // custom claim, set bởi Cloud Function
}

function isOwner(employeeId) {
  return isSignedIn() && request.auth.uid == employeeId;
}

function isRole(role) {
  return isSignedIn() && currentRole() == role;
}

function isAtLeastLeader() {
  return isSignedIn() && currentRole() in ["leader", "deputy_director", "admin"];
}

function isAdminOrPGD() {
  return isSignedIn() && currentRole() in ["deputy_director", "admin"];
}
```

---

## 2. Rules theo collection

### `employees/{employeeId}`
```js
match /employees/{employeeId} {
  allow read: if isOwner(employeeId) || isAtLeastLeader();
  allow write: if false; // chỉ Cloud Function (Admin SDK) ghi
}
```
**Giải thích**: Leader cần đọc để xem nhóm mình, nhưng lọc theo `managerId` xử lý ở tầng query/UI (rules Firestore không lọc theo field liên collection dễ dàng ở list query — Leader UI chỉ query `where("managerId","==",uid)`, rules chỉ đảm bảo *role* đủ điều kiện đọc, không đảm bảo *đúng nhóm*; điều này chấp nhận được vì dữ liệu employees không phải bí mật tuyệt đối trong nội bộ công ty — nếu cần siết chặt hơn, chuyển sang đọc qua Cloud Function `getTeamMembers`).

### `attendance/{attendanceId}`
```js
match /attendance/{attendanceId} {
  allow read: if isOwner(resource.data.employeeId) || isAtLeastLeader();

  allow create: if isOwner(request.resource.data.employeeId)
                && request.resource.data.date == today()
                && request.resource.data.workflowStatus == "draft";

  allow update: if isAdminOrPGD()
                || (
                     isOwner(resource.data.employeeId)
                     && resource.data.workflowStatus != "locked"
                     && onlyCheckInOutFieldsChanged()
                   );

  allow delete: if false;
}
```
**Giải thích**:
- Nhân viên chỉ tạo/sửa bản ghi **của chính mình**, **ngày hôm nay**, và **không được sửa nếu đã `locked`**.
- Các field tính toán (`lateStatus`, `otMinutes`, `flags`, `workflowStatus` transition) không nằm trong `onlyCheckInOutFieldsChanged()` — client gửi field đó lên sẽ bị rules chặn; giá trị thật do Cloud Function ghi bằng Admin SDK (bỏ qua rules).
- PGĐ/Admin có thể update kể cả khi `locked` (sửa dữ liệu đã khóa) — **nhưng hành động này bắt buộc đi qua Cloud Function riêng có ghi audit log**, không phải update thẳng từ client (xem `04-api-cloud-functions.md`).

### `explanations/{explanationId}`
```js
match /explanations/{explanationId} {
  allow read: if isOwner(resource.data.employeeId) || isAtLeastLeader();
  allow create: if isOwner(request.resource.data.employeeId);
  allow update: if isAdminOrPGD()
                || (isOwner(resource.data.employeeId) && request.time < resource.data.editableUntil);
  allow delete: if false;
}
```

### `dailyReports/{reportId}`
```js
match /dailyReports/{reportId} {
  allow read: if isOwner(resource.data.employeeId) || isAtLeastLeader();
  allow write: if isOwner(request.resource.data.employeeId);
}
```

### `projects/{projectId}`
```js
match /projects/{projectId} {
  allow read: if isSignedIn();
  allow write: if isRole("admin");
}
```

### `projectStats/{statId}`
```js
match /projectStats/{statId} {
  allow read: if isAtLeastLeader();
  allow write: if false; // chỉ Cloud Function trigger
}
```

### `leaveRequests/{leaveId}`
```js
match /leaveRequests/{leaveId} {
  allow read: if isOwner(resource.data.employeeId) || isAtLeastLeader();
  allow create: if isOwner(request.resource.data.employeeId);
  allow update: if isAdminOrPGD()
                || (isOwner(resource.data.employeeId) && resource.data.status == "pending");
}
```

### `auditLogs/{logId}`
```js
match /auditLogs/{logId} {
  allow read: if isAtLeastLeader();
  allow write: if false; // TUYỆT ĐỐI chỉ Cloud Function, không ai khác kể cả admin qua client SDK
}
```

### `activityFeedEvents/{eventId}`
```js
match /activityFeedEvents/{eventId} {
  allow read: if isSignedIn();
  allow write: if false;
}
```

### `notifications/{notificationId}`
```js
match /notifications/{notificationId} {
  allow read: if resource.data.recipientId == null || resource.data.recipientId == request.auth.uid || isAtLeastLeader();
  allow update: if isOwner(resource.data.recipientId) && onlyIsReadChanged(); // đánh dấu đã đọc
  allow create, delete: if false; // chỉ Cloud Function
}
```

### `monthlyClosures/{closureId}`
```js
match /monthlyClosures/{closureId} {
  allow read: if isAtLeastLeader();
  allow write: if false; // chỉ Cloud Function closeMonthlyAttendance
}
```

### `companies/{companyId}`, `offices/{officeId}`, `workSchedules/{id}`, `holidays/{id}`
```js
match /{collection}/{docId} {
  allow read: if isSignedIn();
  allow write: if isRole("admin");
}
```

### `settings/{key}`
```js
match /settings/{key} {
  allow read: if isSignedIn();
  allow write: if isRole("admin");
}
```

---

## 3. Nguyên tắc kiểm thử Rules

- Dùng **Firebase Emulator Suite** + `@firebase/rules-unit-testing` để viết test case cho từng rule ở trên trước khi deploy production.
- Test bắt buộc phải có:
  1. Employee A không đọc/sửa được `attendance` của Employee B.
  2. Employee không tự set được `lateStatus`/`otMinutes`/`workflowStatus` qua client.
  3. Không ai (kể cả admin qua client SDK) ghi được `auditLogs`.
  4. `attendance` đã `locked` không update được từ client role `employee`.
  5. Giải trình quá `editableUntil` bị chặn update từ `employee`.

## 4. Quy trình thay đổi Rules
1. Sửa `firestore.rules` trong nhánh riêng.
2. Chạy test emulator (bắt buộc pass 100% trước khi merge).
3. Deploy qua `firebase deploy --only firestore:rules` (xem `07-deployment-guide.md`).
4. Ghi lại thay đổi vào changelog cuối file `firestore.rules` (comment ngày + lý do).
