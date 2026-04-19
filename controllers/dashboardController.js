const { pool } = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        // Today's Sales
        const { rows: todaySales } = await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE DATE(created_at) = CURRENT_DATE AND status != 'refunded'`);
        
        // Yesterday's Sales
        const { rows: yesterdaySales } = await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' AND status != 'refunded'`);

        // Weekly Sales
        const { rows: weeklySales } = await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE TO_CHAR(created_at, 'IYYY-IW') = TO_CHAR(CURRENT_DATE, 'IYYY-IW') AND status != 'refunded'`);

        // Monthly Sales
        const { rows: monthlySales } = await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM') AND status != 'refunded'`);

        // Total Revenue
        const { rows: totalRevenue } = await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE status != 'refunded'`);

        // Counts
        const { rows: products } = await pool.query('SELECT COUNT(*) as count FROM products');
        const { rows: orders } = await pool.query(`SELECT COUNT(*) as count FROM sales WHERE status != 'refunded' AND status != 'deleted'`);
        const { rows: customers } = await pool.query('SELECT COUNT(*) as count FROM customers');
        const { rows: cashiers } = await pool.query(`SELECT COUNT(*) as count FROM users WHERE role = 'Cashier'`);

        // Profit & Loss
        const { rows: profitQuery } = await pool.query(`
            SELECT SUM((si.unit_price - si.unit_cost) * si.quantity) as profit
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status != 'refunded' AND s.status != 'deleted'
        `);
        const { rows: lossQuery } = await pool.query(`
            SELECT SUM((si.unit_cost - si.unit_price) * si.quantity) as loss
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status != 'refunded' AND s.status != 'deleted' AND si.unit_cost > si.unit_price
        `);

        // Sales Chart (Last 7 Days)
        const { rows: salesChart } = await pool.query(`
            SELECT DATE(created_at) as date, SUM(total_amount) as amount 
            FROM sales 
            WHERE created_at >= CURRENT_DATE - INTERVAL '6 days' AND status != 'refunded'
            GROUP BY DATE(created_at) 
            ORDER BY DATE(created_at) ASC
        `);

        // Payment Methods Pie
        const { rows: paymentMethods } = await pool.query(`
            SELECT payment_method, SUM(total_amount) as amount 
            FROM sales 
            WHERE status != 'refunded'
            GROUP BY payment_method
        `);

        // Top Selling Products
        const { rows: topProducts } = await pool.query(`
            SELECT p.product_name, SUM(si.quantity) as sold_qty, SUM(si.quantity * si.unit_price) as revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.product_id
            WHERE s.status != 'refunded' AND s.status != 'deleted'
            GROUP BY si.product_id, p.product_name
            ORDER BY sold_qty DESC
            LIMIT 5
        `);

        // Revenue by Category
        const { rows: revenueByCategory } = await pool.query(`
            SELECT COALESCE(c.name, 'Uncategorized') as category, SUM(si.quantity * si.unit_price) as value
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.product_id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE s.status != 'refunded' AND s.status != 'deleted'
            GROUP BY 1
        `);

        res.json({
            today_sales: todaySales[0].total || 0,
            yesterday_sales: yesterdaySales[0].total || 0,
            weekly_sales: weeklySales[0].total || 0,
            monthly_sales: monthlySales[0].total || 0,
            total_revenue: totalRevenue[0].total || 0,
            total_products: products[0].count,
            total_orders: orders[0].count,
            total_customers: customers[0].count,
            total_cashiers: cashiers[0].count,
            total_profit: profitQuery[0].profit || 0,
            total_loss: lossQuery[0].loss || 0,
            sales_chart: salesChart,
            payment_methods: paymentMethods,
            top_products: topProducts,
            revenue_by_category: revenueByCategory
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ error: "Server error getting stats" });
    }
};
