const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/activity', protect, adminOnly, logController.getActivityLogs);
router.get('/logins', protect, adminOnly, logController.getLoginLogs);

module.exports = router;
