const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// For optional admin check on register route
const { optionalAuth } = require('../middleware/authMiddleware');

router.post('/request-verification', authController.requestVerification);
router.post('/register', optionalAuth, authController.register);
router.post('/login', authController.login);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
