const { pool } = require('../config/db');

exports.getProducts = async (req, res) => {
    try {
        const { rows: rows } = await pool.query(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.product_id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.createProduct = async (req, res) => {
    const { product_name, barcode, category_id, price, cost_price, stock_quantity, tax_rate, status } = req.body;
    const product_image = req.file ? req.file.path : req.body.product_image || null;

    try {
        const { rows: result } = await pool.query(`
            INSERT INTO products 
            (product_name, barcode, category_id, price, cost_price, stock_quantity, tax_rate, product_image, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING product_id as id
        `, [
            product_name, 
            barcode || null, 
            category_id || null, 
            parseFloat(price), 
            parseFloat(cost_price), 
            parseInt(stock_quantity), 
            parseFloat(tax_rate || 0), 
            product_image, 
            status || 'active'
        ]);
        
        res.status(201).json({ message: "Product created", id: result[0]?.id });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: "Barcode already exists" });
        res.status(500).json({ error: "Server error" });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { product_name, barcode, category_id, price, cost_price, stock_quantity, tax_rate, status } = req.body;
    
    try {
        let query = `UPDATE products SET product_name=$1, barcode=$2, category_id=$3, price=$4, cost_price=$5, stock_quantity=$6, tax_rate=$7, status=$8`;
        let params = [
            product_name, 
            barcode || null, 
            category_id || null, 
            parseFloat(price), 
            parseFloat(cost_price), 
            parseInt(stock_quantity), 
            parseFloat(tax_rate || 0), 
            status || 'active'
        ];

        if (req.file) {
            params.push(req.file.path);
            query += `, product_image=$${params.length}`;
        } else if (req.body.product_image) {
            params.push(req.body.product_image);
            query += `, product_image=$${params.length}`;
        }

        params.push(id);
        query += ` WHERE product_id=$${params.length}`;

        await pool.query(query, params);
        res.json({ message: "Product updated" });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: "Barcode already exists" });
        res.status(500).json({ error: "Server error" });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE product_id = $1', [req.params.id]);
        res.json({ message: "Product deleted" });
    } catch (err) {
        res.status(500).json({ error: "Server error or product in use by sales" });
    }
};

exports.adjustStock = async (req, res) => {
    const { id } = req.params;
    const { change_amount, reason } = req.body;
    const user_id = req.user.id;

    if (!change_amount) return res.status(400).json({ error: "Change amount required" });

    try {
        await pool.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [parseInt(change_amount), id]);
        await pool.query('INSERT INTO inventory_logs (product_id, change_amount, reason, user_id) VALUES ($1, $2, $3, $4)', [id, parseInt(change_amount), reason, user_id]);
        res.json({ message: "Stock adjusted" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.getInventoryLogs = async (req, res) => {
    try {
        const { rows: rows } = await pool.query(`
            SELECT il.*, p.product_name, u.full_name as user_name 
            FROM inventory_logs il 
            JOIN products p ON il.product_id = p.product_id 
            JOIN users u ON il.user_id = u.id 
            ORDER BY il.created_at DESC LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};
