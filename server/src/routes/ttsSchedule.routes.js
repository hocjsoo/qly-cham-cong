const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getWeeklySchedule,
  updateMyRegistration,
  updateRegistrationByManager,
  updateDuties,
  updateInstructions,
  toggleLock,
} = require('../controllers/ttsScheduleController');

const router = express.Router();
router.use(authMiddleware);

router.get('/', getWeeklySchedule);
router.put('/my-registration', updateMyRegistration);
router.put('/:weekStart/registration/:userId', updateRegistrationByManager);
router.put('/:weekStart/duties', updateDuties);
router.put('/:weekStart/instructions', updateInstructions);
router.post('/:weekStart/lock', toggleLock);

module.exports = router;
