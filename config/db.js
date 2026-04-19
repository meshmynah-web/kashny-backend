const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

// Use WebSocket to bypass standard port 5432 blocking on firewalls
neonConfig.webSocketConstructor = ws;

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // The serverless driver ignores `ssl` properties and handles it securely via WSS
});

// Handle idle client terminations from Neon gracefully
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client (Neon timeout)', err);
});

// Helper function to create table schemas
const initializeDB = async () => {
    const client = await pool.connect();
    
    try {
        console.log("Database connected successfully. Checking schemas...");

        // Users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Cashier')),
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Settings
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                store_name VARCHAR(255) DEFAULT 'My POS System',
                store_logo VARCHAR(255) DEFAULT NULL,
                store_address TEXT DEFAULT NULL,
                store_phone VARCHAR(50) DEFAULT NULL,
                currency VARCHAR(10) DEFAULT 'USD',
                tax_rate DECIMAL(5,2) DEFAULT 0.00,
                theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Categories
        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Products
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                product_id SERIAL PRIMARY KEY,
                product_name VARCHAR(255) NOT NULL,
                barcode VARCHAR(100) UNIQUE,
                category_id INT,
                price DECIMAL(10,2) NOT NULL,
                cost_price DECIMAL(10,2) NOT NULL,
                stock_quantity INT NOT NULL DEFAULT 0,
                tax_rate DECIMAL(5,2) DEFAULT 0.00,
                product_image VARCHAR(255) DEFAULT NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            )
        `);

        // Customers
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                email VARCHAR(255) DEFAULT NULL,
                loyalty_points INT DEFAULT 0,
                total_spent DECIMAL(10,2) DEFAULT 0.00,
                total_visits INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Shifts
        await client.query(`
            CREATE TABLE IF NOT EXISTS shifts (
                shift_id SERIAL PRIMARY KEY,
                cashier_id INT NOT NULL,
                opening_cash DECIMAL(10,2) NOT NULL,
                closing_cash DECIMAL(10,2) DEFAULT NULL,
                total_sales DECIMAL(10,2) DEFAULT 0.00,
                shift_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                shift_end_time TIMESTAMP NULL,
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
                FOREIGN KEY (cashier_id) REFERENCES users(id)
            )
        `);

        // Sales
        await client.query(`
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                cashier_id INT NOT NULL,
                customer_id INT DEFAULT NULL,
                shift_id INT DEFAULT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                tax DECIMAL(10,2) DEFAULT 0.00,
                discount DECIMAL(10,2) DEFAULT 0.00,
                amount_paid DECIMAL(10,2) DEFAULT 0.00,
                payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'M-Pesa', 'Card', 'Bank Transfer')),
                transaction_code VARCHAR(100) DEFAULT NULL,
                status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'suspended', 'refunded', 'deleted')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cashier_id) REFERENCES users(id),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        `);

        // Sale Items
        await client.query(`
            CREATE TABLE IF NOT EXISTS sale_items (
                id SERIAL PRIMARY KEY,
                sale_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                unit_price DECIMAL(10,2) NOT NULL,
                unit_cost DECIMAL(10,2) DEFAULT 0.00,
                tax_amount DECIMAL(10,2) DEFAULT 0.00,
                FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(product_id)
            )
        `);

        // Login Logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS login_logs (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45) DEFAULT NULL,
                device VARCHAR(255) DEFAULT NULL,
                login_status VARCHAR(50) DEFAULT 'success',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Inventory Logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS inventory_logs (
                id SERIAL PRIMARY KEY,
                product_id INT NOT NULL,
                change_amount INT NOT NULL,
                reason VARCHAR(255) DEFAULT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(product_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Activity Logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                log_id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Expenses
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                category VARCHAR(100) DEFAULT 'General',
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // M-Pesa Transactions
        await client.query(`
            CREATE TABLE IF NOT EXISTS mpesa_transactions (
                id SERIAL PRIMARY KEY,
                checkout_request_id VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(20) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                sale_id INT DEFAULT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
                result_desc VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Deliveries
        await client.query(`
            CREATE TABLE IF NOT EXISTS deliveries (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                customer_id_no VARCHAR(50),
                delivery_address TEXT NOT NULL,
                pick_up_location TEXT NOT NULL,
                delivery_person_name VARCHAR(255) NOT NULL,
                delivery_person_phone VARCHAR(20) NOT NULL,
                delivery_person_id_no VARCHAR(50),
                number_plate VARCHAR(50),
                sacco VARCHAR(255),
                delivery_fee DECIMAL(10,2) DEFAULT 0.00,
                notes TEXT,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in transit', 'delivered', 'cancelled')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("All PostgreSQL tables checked/created successfully.");
    } catch (error) {
        console.error("Database Initialization Error:", error);
    } finally {
        client.release();
    }
};

module.exports = { pool, initializeDB };
