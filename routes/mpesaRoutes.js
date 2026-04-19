const express = require('express');
const router = express.Router();
const mpesaController = require('../controllers/mpesaController');

// Trigger STK Push
router.post('/stkpush', mpesaController.initiatePayment);

// Daraja Callback
router.post('/callback', mpesaController.mpesaCallback);

// Status Checker
router.get('/status/:checkoutRequestId', mpesaController.checkStatus);

module.exports = router;