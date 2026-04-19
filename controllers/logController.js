const { pool } = require('../config/db');

exports.getActivityLogs = async (req, res) => {
    try {
        const { rows: logs } = await pool.query(`
            SELECT a.*, u.full_name as user_name, u.role 
            FROM activity_logs a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.timestamp DESC LIMIT 200
        `);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch activity logs" });
    }
};

exports.getLoginLogs = async (req, res) => {
    try {
        const { rows: logs } = await pool.query(`
            SELECT l.*, u.full_name as user_name, u.role
            FROM login_logs l
            JOIN users u ON l.user_id = u.id
            ORDER BY l.login_time DESC LIMIT 200
        `);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch login logs" });
    }
};
