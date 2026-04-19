const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', deliveryController.getDeliveries);
router.post('/', adminOnly, deliveryController.createDelivery);
router.put('/:id', adminOnly, deliveryController.updateDelivery);
router.delete('/:id', adminOnly, deliveryController.deleteDelivery);

module.exports = router;
