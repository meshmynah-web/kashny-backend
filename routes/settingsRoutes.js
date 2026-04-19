const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', settingsController.getSettings); // Public
router.put('/', protect, adminOnly, upload.single('logo_file'), settingsController.updateSettings);

module.exports = router;
