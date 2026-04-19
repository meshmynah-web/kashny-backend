const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, salesController.createSale);
router.get('/', protect, salesController.getSales);
router.get('/:id', protect, salesController.getSaleDetails);
router.post('/:id/refund', protect, adminOnly, salesController.refundSale);
router.post('/delete', protect, adminOnly, salesController.deleteSale);
router.post('/bulk-delete', protect, adminOnly, salesController.bulkDeleteSales);


module.exports = router;
