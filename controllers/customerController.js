const { pool } = require('../config/db');

exports.getCustomers = async (req, res) => {
    try {
        const { rows: customers } = await pool.query(
            'SELECT 
  id,
  customer_name AS name,
  phone,
  email,
  loyalty_points,
  total_spent,
  total_visits
FROM customers ORDER BY id DESC'
        );
        res.json(customers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const { name, phone, email, loyalty_points } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: "Name and phone are required" });
        }

        const { rows: existing } = await pool.query(
            'SELECT id FROM customers WHERE phone = $1',
            [phone]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: "Customer with this phone already exists" });
        }

        await pool.query(
            'INSERT INTO customers (customer_name, phone, email, loyalty_points) VALUES ($1, $2, $3, $4)',
            [
                name,
                phone,
                email || null,
                Number(loyalty_points) || 0
            ]
        );

        res.status(201).json({ message: "Customer created successfully" });

    } catch (err) {
        console.error("Create Customer Error:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const { name, phone, email, loyalty_points } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: "Name and phone are required" });
        }

        await pool.query(
            'UPDATE customers SET customer_name = $1, phone = $2, email = $3, loyalty_points = $4 WHERE id = $5',
            [
                name,
                phone,
                email || null,
                Number(loyalty_points) || 0,
                req.params.id
            ]
        );

        res.json({ message: "Customer updated successfully" });

    } catch (err) {
        console.error("Update Customer Error:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
};

exports.deleteCustomer = async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM customers WHERE id = $1',
            [req.params.id]
        );

        res.json({ message: "Customer deleted successfully" });

    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: "Cannot delete customer with past sales" });
        }

        console.error("Delete Customer Error:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
};