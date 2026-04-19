const { pool } = require('../config/db');

exports.createSale = async (req, res) => {
    const { items, payment_method, amount_paid, customer_id, discount } = req.body;
    const cashier_id = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get current active shift
        const { rows: shift } = await client.query(
            "SELECT shift_id FROM shifts WHERE cashier_id = $1 AND status = 'open'",
            [cashier_id]
        );
        if (shift.length === 0) throw new Error("No active shift open for this cashier");

        // Calculate total amount and tax
        let total_amount = 0;
        let total_tax = 0;

        for (let item of items) {
            const { rows: product } = await client.query(
                "SELECT price, tax_rate, stock_quantity FROM products WHERE product_id = $1",
                [item.product_id]
            );
            if (product.length === 0) throw new Error(`Product ${item.product_name || item.product_id} not found`);
            if (product[0].stock_quantity < item.qty) throw new Error(`Insufficient stock for ${item.product_name || item.product_id}`);
             const price = parseFloat(product[0].price);
             const taxRate = parseFloat(product[0].tax_rate || 0);

            const itemTotal = price * item.qty;
            const itemTax = itemTotal * (taxRate / 100);

            total_amount += itemTotal;
            total_tax += itemTax;

        }
        
        const final_discount = discount != null ? parseFloat(discount) : 0;
        const final_total = total_amount + total_tax - final_discount;
        
        // Fix payment method issue
        const method = payment_method && payment_method.trim() !== '' ? payment_method.trim() : 'Cash';
        const paid_amount = amount_paid != null ? parseFloat(amount_paid) : final_total;

        // Insert sale
        const { rows: saleResult } = await client.query(
            `INSERT INTO sales 
                (cashier_id, customer_id, shift_id, total_amount, tax, discount, payment_method, amount_paid, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed') RETURNING id`,
            [cashier_id, customer_id || null, shift[0].shift_id, final_total, total_tax, final_discount, method, paid_amount]
        );

        const sale_id = saleResult[0]?.id;

        // Insert sale items and update stock
        for (let item of items) {
            const { rows: product } = await client.query(
                "SELECT cost_price, price, tax_rate FROM products WHERE product_id = $1",
                [item.product_id]
            );

            await client.query(
                "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, tax_amount) VALUES ($1, $2, $3, $4, $5, $6)",
                [
                    sale_id,
                    item.product_id,
                    item.qty,
                    parseFloat(product[0].price),
                    parseFloat(product[0].cost_price),
                    parseFloat(product[0].price) * (parseFloat(product[0].tax_rate || 0) / 100)
                ]
            );

            await client.query(
                "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2",
                [item.qty, item.product_id]
            );
        }

        await client.query('COMMIT');

        // Update customer stats if exists
        if (customer_id) {
            try {
                await pool.query(
                    "UPDATE customers SET total_spent = COALESCE(total_spent,0) + $1, total_visits = COALESCE(total_visits,0) + 1 WHERE id = $2",

                    [final_total, customer_id]
                );

                const { rows: cust } = await pool.query("SELECT total_visits FROM customers WHERE id = $1", [customer_id]);
                if (cust.length > 0 && cust[0].total_visits % 5 === 0) {
                    await pool.query(
                        "UPDATE customers SET loyalty_points = COALESCE(loyalty_points,0) + 2 WHERE id = $1",
                        [customer_id]
                    );
                }
            } catch (custErr) {
                console.error("Non-fatal error updating customer stats:", custErr);
            }
        }

        res.status(201).json({ message: "Sale completed successfully", sale_id, subtotal: total_amount, tax: total_tax, discount: final_discount, total: final_total });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Create Sale Error:", err);
        res.status(400).json({ error: err.message || "Failed to complete sale" });
    } finally {
        if (client) if (client) client.release();
    }
};

exports.getSales = async (req, res) => {
    try {
        let query = `
            SELECT s.*, u.full_name AS cashier_name,
            c.customer_name AS customer_name,
            ((SELECT SUM((si.unit_price - si.unit_cost) * si.quantity) FROM sale_items si WHERE si.sale_id = s.id) - s.discount) AS profit,
            (SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id) AS total_items
            FROM sales s
            LEFT JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
        `;

        let conditions = [];
        let params = [];

        // Exclude temporarily deleted sales
        conditions.push("s.status != 'deleted'");

        const role = req.user.role.toLowerCase();

        // Only non-admin sees their own sales
        if (role !== 'admin') {
            conditions.push(`s.cashier_id = $${params.length + 1}`);
            params.push(req.user.id);
        }

        const { startDate, endDate } = req.query;
        if (startDate) {
            conditions.push(`DATE(s.created_at) >= $${params.length + 1}`);
            params.push(startDate);
        }
        if (endDate) {
            conditions.push(`DATE(s.created_at) <= $${params.length + 1}`);
            params.push(endDate);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY s.created_at DESC';

        const { rows: rows } = await pool.query(query, params);
        res.json(rows);

    } catch (error) {
        console.error("Get Sales Error:", error);
        res.status(500).json({ message: "Failed to fetch sales" });
    }
};

exports.getSaleDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: sale } = await pool.query("SELECT * FROM sales WHERE id = $1", [id]);
        if (sale.length === 0) return res.status(404).json({ error: "Sale not found" });

        const { rows: items } = await pool.query(`
            SELECT si.*, p.product_name 
            FROM sale_items si 
            JOIN products p ON si.product_id = p.product_id 
            WHERE si.sale_id = $1
        `, [id]);

        res.json({ sale: sale[0], items });

    } catch (err) {
        console.error("Get Sale Details Error:", err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.refundSale = async (req, res) => {
    const { id } = req.params;
    const admin_id = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: sale } = await client.query("SELECT status FROM sales WHERE id = $1", [id]);
        if (sale.length === 0) throw new Error("Sale not found");
        if (sale[0].status === 'refunded') throw new Error("Sale is already refunded");

        await client.query("UPDATE sales SET status = 'refunded' WHERE id = $1", [id]);

        const { rows: items } = await client.query("SELECT product_id, quantity FROM sale_items WHERE sale_id = $1", [id]);

        for (let item of items) {
            await client.query("UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2", [item.quantity, item.product_id]);
            await client.query(
                "INSERT INTO inventory_logs (product_id, change_amount, reason, user_id) VALUES ($1, $2, $3, $4)",
                [item.product_id, item.quantity, `Sale #${id} Refund`, admin_id]
            );
        }

        await client.query(
            "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
            [admin_id, `Refunded sale #${id}`]
        );

        await client.query('COMMIT');
        res.json({ message: "Sale refunded successfully" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Refund Sale Error:", err);
        res.status(400).json({ error: err.message || "Failed to refund sale" });
    } finally {
        if (client) if (client) client.release();
    }
};
// Soft delete sale (admin only)
exports.deleteSale = async (req, res) => {
    const { id } = req.params;
    const role = req.user.role.toLowerCase();

    if (role !== 'admin') {
        return res.status(403).json({ error: "Only admins can delete sales" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: sale } = await client.query("SELECT status FROM sales WHERE id = $1", [id]);
        if (sale.length === 0) throw new Error("Sale not found");

        await client.query("UPDATE sales SET status = 'deleted' WHERE id = $1", [id]);

        await client.query(
            "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
            [req.user.id, `Soft deleted sale #${id}`]
        );

        await client.query('COMMIT');
        res.json({ message: "Sale deleted successfully" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Delete Sale Error:", err);
        res.status(400).json({ error: err.message || "Failed to delete sale" });
    } finally {
        if (client) if (client) client.release();
    }
};

exports.bulkDeleteSales = async (req, res) => {
    const { ids, permanent } = req.body;
    const role = req.user.role.toLowerCase();

    if (role !== 'admin') {
        return res.status(403).json({ error: "Only admins can perform this action" });
    }
    if (!ids || !ids.length) {
        return res.status(400).json({ error: "No sales selected" });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (permanent) {
            // Delete associated items first (if cascade isn't robustly available) then sales
            await client.query("DELETE FROM sale_items WHERE sale_id IN ($1)", [ids]);
            await client.query("DELETE FROM sales WHERE id IN ($1)", [ids]);

            await client.query(
                "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
                [req.user.id, `Permanently deleted ${ids.length} sales`]
            );
        } else {
            await client.query("UPDATE sales SET status = 'deleted' WHERE id IN ($1)", [ids]);

            await client.query(
                "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
                [req.user.id, `Temporarily deleted ${ids.length} sales`]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "Sales deleted successfully" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Bulk Delete Error:", err);
        res.status(400).json({ error: err.message || "Failed to delete sales" });
    } finally {
        if (client) if (client) client.release();
    }
};