const express = require('express');
const router = express.Router();
const paystackController = require('../controllers/paystackController');
const { protect } = require('../middleware/authMiddleware');

router.post('/order', protect, paystackController.createOrder);
router.post('/pay', protect, paystackController.processPayment);
// Webhook doesn't use protect because it's called by Paystack!
router.post('/webhook', paystackController.webhook);

module.exports = router;
