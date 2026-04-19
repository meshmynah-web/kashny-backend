const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/start', protect, shiftController.startShift);
router.post('/end', protect, shiftController.endShift);
router.get('/current', protect, shiftController.getCurrentShift);
router.get('/', protect, adminOnly, shiftController.getAllShifts);

module.exports = router;
