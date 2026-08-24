// routes/request.routes.js
const express = require('express');
const router = express.Router();
const {
  getMyRequests, createRequest, getPendingRequests, approveRequest, rejectRequest
} = require('../controllers/requestController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/requests - Danh sách đơn của tôi
router.get('/', getMyRequests);
router.get('/my-requests', getMyRequests);

// POST /api/requests - Tạo đơn mới
router.post('/', createRequest);

// GET /api/requests/pending - Đơn chờ duyệt [Leader, Admin]
router.get('/pending', requireRole('admin', 'manager'), getPendingRequests);

// PUT & PATCH /api/requests/:id/approve - [Admin, Leader, Manager]
router.put('/:id/approve', requireRole('admin', 'manager'), approveRequest);
router.patch('/:id/approve', requireRole('admin', 'manager'), approveRequest);

// PUT & PATCH /api/requests/:id/reject - [Admin, Leader, Manager]
router.put('/:id/reject', requireRole('admin', 'manager'), rejectRequest);
router.patch('/:id/reject', requireRole('admin', 'manager'), rejectRequest);

module.exports = router;
