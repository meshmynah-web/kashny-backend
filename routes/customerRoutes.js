const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, customerController.getCustomers);
router.post('/', protect, customerController.createCustomer);
router.put('/:id', protect, adminOnly, customerController.updateCustomer);
router.delete('/:id', protect, adminOnly, customerController.deleteCustomer);

module.exports = router;
