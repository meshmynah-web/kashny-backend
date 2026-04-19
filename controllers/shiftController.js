const { pool } = require('../config/db');

exports.startShift = async (req, res) => {
    const { opening_cash } = req.body;
    const cashier_id = req.user.id;

    try {
        const { rows: activeShift } = await pool.query("SELECT * FROM shifts WHERE cashier_id = $1 AND status = 'open'", [cashier_id]);
        if (activeShift.length > 0) return res.status(400).json({ error: "You already have an open shift.", shift: activeShift[0] });

        const { rows: result } = await pool.query(
            "INSERT INTO shifts (cashier_id, opening_cash, status) VALUES ($1, $2, 'open') RETURNING shift_id as id",
            [cashier_id, opening_cash || 0]
        );
        res.status(201).json({ message: "Shift started", shift_id: result[0]?.id });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.endShift = async (req, res) => {
    const { closing_cash } = req.body;
    const cashier_id = req.user.id;

    try {
        const { rows: activeShift } = await pool.query("SELECT * FROM shifts WHERE cashier_id = $1 AND status = 'open'", [cashier_id]);
        if (activeShift.length === 0) return res.status(400).json({ error: "No open shift found." });

        const shift = activeShift[0];
        
        const { rows: salesRes } = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) as shift_sales 
            FROM sales 
            WHERE cashier_id = $1 AND created_at >= $2 AND status = 'completed'
        `, [cashier_id, shift.shift_start_time]);

        const total_sales = salesRes[0].shift_sales;

        await pool.query(`
            UPDATE shifts 
            SET closing_cash = $1, total_sales = $2, shift_end_time = CURRENT_TIMESTAMP, status = 'closed'
            WHERE shift_id = $3
        `, [closing_cash, total_sales, shift.shift_id]);

        res.json({ message: "Shift ended", total_sales });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.getCurrentShift = async (req, res) => {
    const cashier_id = req.user.id;
    try {
        const { rows: activeShift } = await pool.query("SELECT * FROM shifts WHERE cashier_id = $1 AND status = 'open'", [cashier_id]);
        if (activeShift.length === 0) return res.json({ active: false });

        const shift = activeShift[0];
        
        const { rows: salesRes } = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) as shift_sales, COUNT(id) as transaction_count 
            FROM sales 
            WHERE cashier_id = $1 AND created_at >= $2 AND status = 'completed'
        `, [cashier_id, shift.shift_start_time]);

        res.json({ active: true, shift, sales: salesRes[0] });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.getAllShifts = async (req, res) => {
    try {
        const { rows: rows } = await pool.query(`
            SELECT s.*, u.full_name as cashier_name 
            FROM shifts s 
            JOIN users u ON s.cashier_id = u.id 
            ORDER BY s.shift_id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};
