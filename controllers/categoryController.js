const { pool } = require('../config/db');

exports.getCategories = async (req, res) => {
    try {
        const { rows: rows } = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.createCategory = async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });
    
    try {
        await pool.query('INSERT INTO categories (name, description) VALUES ($1, $2)', [name, description || null]);
        res.status(201).json({ message: "Category created" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        await pool.query('UPDATE categories SET name = $1, description = $2 WHERE id = $3', [name, description || null, id]);
        res.json({ message: "Category updated" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        res.json({ message: "Category deleted" });
    } catch (err) {
        res.status(500).json({ error: "Server error or category in use" });
    }
};
