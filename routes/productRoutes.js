const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', protect, productController.getProducts);
router.post('/', protect, adminOnly, upload.single('image'), productController.createProduct);
router.put('/:id', protect, adminOnly, upload.single('image'), productController.updateProduct);
router.delete('/:id', protect, adminOnly, productController.deleteProduct);

// Inventory specifics
router.post('/:id/adjust-stock', protect, adminOnly, productController.adjustStock);
router.get('/inventory/logs', protect, adminOnly, productController.getInventoryLogs);

module.exports = router;
