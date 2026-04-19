const { pool } = require('../config/db');

exports.getComprehensiveReports = async (req, res) => {
    try {
        // Daily Sales Report (Last 30 Days)
        const { rows: dailySales } = await pool.query(`
            SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(id) as transactions
            FROM sales
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND status != 'refunded'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        `);

        // Weekly Sales Report
        const { rows: weeklySales } = await pool.query(`
            SELECT TO_CHAR(created_at, 'IYYY-IW') as week, SUM(total_amount) as revenue, COUNT(id) as transactions
            FROM sales
            WHERE status != 'refunded'
            GROUP BY TO_CHAR(created_at, 'IYYY-IW')
            ORDER BY week DESC
            LIMIT 12
        `);

        // Monthly Sales Report
        const { rows: monthlySales } = await pool.query(`
            SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(total_amount) as revenue, COUNT(id) as transactions
            FROM sales
            WHERE status != 'refunded'
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 12
        `);

        // Cashier Performance
        const { rows: cashierPerf } = await pool.query(`
            SELECT u.full_name, COUNT(s.id) as transactions, SUM(s.total_amount) as total_sold
            FROM sales s
            JOIN users u ON s.cashier_id = u.id
            WHERE s.status != 'refunded'
            GROUP BY s.cashier_id, u.full_name
            ORDER BY total_sold DESC
        `);

        // Product Segment Metrics
        const { rows: productSales } = await pool.query(`
            SELECT p.product_name, SUM(si.quantity) as sold_qty, SUM(si.quantity * si.unit_price) as revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.product_id
            WHERE s.status != 'refunded'
            GROUP BY si.product_id, p.product_name
            ORDER BY revenue DESC
            LIMIT 20
        `);

        res.json({
            daily: dailySales,
            weekly: weeklySales,
            monthly: monthlySales,
            cashiers: cashierPerf,
            products: productSales
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate reports" });
    }
};
