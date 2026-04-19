const { pool } = require('./config/db');

async function checkDB() {
    try {
        const { rows } = await pool.query('SELECT product_id, product_name, product_image FROM products ORDER BY product_id DESC LIMIT 5');
        console.log("Recent products:", rows);
        
        const { rows: settingsRows } = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
        console.log("Settings:", settingsRows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkDB();
