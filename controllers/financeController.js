const { pool } = require('../config/db');

// Expenses Logic
exports.getExpenses = async (req, res) => {
    try {
        const { rows: expenses } = await pool.query('SELECT * FROM expenses ORDER BY date DESC');
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
};

exports.addExpense = async (req, res) => {
    const { title, amount, category, description, date } = req.body;
    try {
        await pool.query(
            "INSERT INTO expenses (title, amount, category, description, date) VALUES ($1, $2, $3, $4, $5)",
            [title, amount, category || 'General', description || '', date ? new Date(date) : new Date()]
        );
        res.status(201).json({ message: "Expense added" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add expense' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        await pool.query("DELETE FROM expenses WHERE id = $1", [req.params.id]);
        res.json({ message: "Expense deleted" });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
};

// Overview Logic
exports.getFinancialOverview = async (req, res) => {
    try {
        const { rows: sales } = await pool.query(`
            SELECT 
                DATE(s.created_at) as date,
                SUM(s.total_amount) as revenue,
                SUM(s.total_amount - COALESCE(s.tax, 0) - COALESCE(si_agg.total_cost, 0)) as profit,
                COUNT(s.id) as order_count
            FROM sales s
            LEFT JOIN (
                SELECT sale_id, SUM(unit_cost * quantity) as total_cost
                FROM sale_items
                GROUP BY sale_id
            ) si_agg ON s.id = si_agg.sale_id
            WHERE s.status != 'refunded' AND s.status != 'deleted'
            GROUP BY DATE(s.created_at)
            ORDER BY DATE(s.created_at) ASC
        `);

        const { rows: expenses } = await pool.query(`
            SELECT DATE(date) as date, category, SUM(amount) as amount
            FROM expenses
            GROUP BY DATE(date), category
            ORDER BY DATE(date) ASC
        `);

        res.json({ sales, expenses });
    } catch (err) {
        console.error("Finance Error:", err);
        res.status(500).json({ error: 'Failed to fetch overview' });
    }
};
