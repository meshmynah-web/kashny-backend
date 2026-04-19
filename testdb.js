require('dotenv').config();
const { pool } = require('./config/db');

async function test() {
    try {
        console.log("Testing dashboard stats query...");
        await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE DATE(created_at) = CURRENT_DATE AND status != 'refunded'`);
        await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' AND status != 'refunded'`);
        await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE TO_CHAR(created_at, 'IYYY-IW') = TO_CHAR(CURRENT_DATE, 'IYYY-IW') AND status != 'refunded'`);
        await pool.query(`SELECT SUM(total_amount) as total FROM sales WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM') AND status != 'refunded'`);
        await pool.query(`SELECT DATE(created_at) as date, SUM(total_amount) as amount FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '6 days' AND status != 'refunded' GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`);
        console.log("Dashboard Stats Queries OK");

        console.log("Testing dashboard products / categories queries...");
        await pool.query(`SELECT p.product_name, SUM(si.quantity) as sold_qty, SUM(si.quantity * si.unit_price) as revenue FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.product_id WHERE s.status != 'refunded' AND s.status != 'deleted' GROUP BY si.product_id, p.product_name ORDER BY sold_qty DESC LIMIT 5`);
        await pool.query(`SELECT COALESCE(c.name, 'Uncategorized') as category, SUM(si.quantity * si.unit_price) as value FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.product_id LEFT JOIN categories c ON p.category_id = c.id WHERE s.status != 'refunded' AND s.status != 'deleted' GROUP BY 1`);
        console.log("Dashboard categories OK");

        console.log("Testing report queries...");
        await pool.query(`SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(id) as transactions FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND status != 'refunded' GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`);
        await pool.query(`SELECT TO_CHAR(created_at, 'IYYY-IW') as week, SUM(total_amount) as revenue, COUNT(id) as transactions FROM sales WHERE status != 'refunded' GROUP BY TO_CHAR(created_at, 'IYYY-IW') ORDER BY week DESC LIMIT 12`);
        await pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(total_amount) as revenue, COUNT(id) as transactions FROM sales WHERE status != 'refunded' GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month DESC LIMIT 12`);
        await pool.query(`SELECT u.full_name, COUNT(s.id) as transactions, SUM(s.total_amount) as total_sold FROM sales s JOIN users u ON s.cashier_id = u.id WHERE s.status != 'refunded' GROUP BY s.cashier_id, u.full_name ORDER BY total_sold DESC`);
        console.log("Report queries OK");

        console.log("Testing finance query...");
        await pool.query(`SELECT DATE(s.created_at) as date, SUM(s.total_amount) as revenue, SUM(s.total_amount - COALESCE(s.tax, 0) - COALESCE(si_agg.total_cost, 0)) as profit, COUNT(s.id) as order_count FROM sales s LEFT JOIN ( SELECT sale_id, SUM(unit_cost * quantity) as total_cost FROM sale_items GROUP BY sale_id ) si_agg ON s.id = si_agg.sale_id WHERE s.status != 'refunded' AND s.status != 'deleted' GROUP BY DATE(s.created_at) ORDER BY DATE(s.created_at) ASC`);
        console.log("Finance query OK");

        console.log("Testing sales query again...");
        await pool.query(`
            SELECT s.*, u.full_name AS cashier_name,
            c.customer_name AS customer_name,
            ((SELECT SUM((si.unit_price - si.unit_cost) * si.quantity) FROM sale_items si WHERE si.sale_id = s.id) - s.discount) AS profit,
            (SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id) AS total_items
            FROM sales s
            LEFT JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
        `);
        console.log("Sales OK");

        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
test();
