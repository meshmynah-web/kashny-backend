const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Expenses
router.get('/expenses', protect, adminOnly, financeController.getExpenses);
router.post('/expenses', protect, adminOnly, financeController.addExpense);
router.delete('/expenses/:id', protect, adminOnly, financeController.deleteExpense);

// Analytics
router.get('/overview', protect, adminOnly, financeController.getFinancialOverview);

module.exports = router;
