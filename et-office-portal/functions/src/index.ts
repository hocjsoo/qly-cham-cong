import * as admin from "firebase-admin";

admin.initializeApp();

// Auth
export { onUserSignIn } from "./hr/onUserSignIn";

// Attendance
export { onCheckIn } from "./attendance/onCheckIn";
export { onCheckOut } from "./attendance/onCheckOut";
export { submitExplanation } from "./attendance/submitExplanation";
export { reviewExplanation } from "./attendance/reviewExplanation";
export { closeMonthlyAttendance, unlockAttendanceRecord } from "./attendance/closeMonthlyAttendance";

// HR
export { syncEmployeesFromSheet } from "./hr/syncEmployeesFromSheet";
