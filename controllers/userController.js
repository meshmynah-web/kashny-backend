const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
    try {
        const { rows: users } = await pool.query('SELECT id, full_name, username, email, phone_number, role, status, created_at FROM users');
        
        for (let user of users) {
            const { rows: logs } = await pool.query('SELECT login_time FROM login_logs WHERE user_id = $1 ORDER BY login_time DESC LIMIT 1', [user.id]);
            user.last_login = logs.length > 0 ? logs[0].login_time : null;
        }

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.createUser = async (req, res) => {
    const { full_name, username, email, phone_number, password, role, status } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (full_name, username, email, phone_number, password, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [full_name, username, email, phone_number, hashedPassword, role || 'Cashier', status || 'active']
        );
        res.status(201).json({ message: "User created successfully" });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: "Username or email already exists" });
        }
        res.status(500).json({ error: "Server error" });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { full_name, username, email, phone_number, role, status, password } = req.body;
    
    try {
        // Build dynamic update query
        let query = 'UPDATE users SET full_name=$1, username=$2, email=$3, phone_number=$4, role=$5, status=$6';
        let params = [full_name, username, email, phone_number, role, status];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            params.push(hashedPassword);
            query += `, password=$${params.length}`;
        }
        
        params.push(id);
        query += ` WHERE id=$${params.length}`;

        await pool.query(query, params);
        res.json({ message: "User updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: "Cannot delete your own account while logged in." });
        }
        // Instead of hard delete, maybe just change status to disabled, but requirements asked for delete.
        await pool.query('DELETE FROM users WHERE id=$1', [id]);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot delete user. They might be tied to sales data." });
    }
};
