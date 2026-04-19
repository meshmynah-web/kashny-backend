const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/advanced', protect, adminOnly, reportController.getComprehensiveReports);

module.exports = router;
