const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Mock sending email
const sendVerificationEmail = (email, code) => {
    console.log(`\n================================================`);
    console.log(`📧 MOCK EMAIL SENT TO: ${email}`);
    console.log(`🔑 VERIFICATION CODE: ${code}`);
    console.log(`================================================\n`);
};

// Generate a random 6-digit code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.requestVerification = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        // Check if email already exists in users
        const { rows: users } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (users.length > 0) return res.status(400).json({ error: "Email already registered." });

        const code = generateCode();
        
        // Create table if not exists (Note: Postgres timestamps)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP NOT NULL
            )
        `);

        // Insert or update code using Postgres ON CONFLICT syntax
        await pool.query(`
            INSERT INTO verification_codes (email, code, expires_at) 
            VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
            ON CONFLICT (email) DO UPDATE 
            SET code = EXCLUDED.code, expires_at = NOW() + INTERVAL '15 minutes'
        `, [email, code]);

        sendVerificationEmail(email, code);

        res.json({ message: "Verification code sent to email.", mock_code: code });
    } catch (err) {
        console.error("Verification Request Error:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
};

exports.register = async (req, res) => {
    const { full_name, username, email, phone_number, password, code } = req.body;

    if (!full_name || !username || !email || !phone_number || !password || !code) {
        return res.status(400).json({ error: "All fields and verification code are required." });
    }

    try {
        // Verify code
        const { rows: codes } = await pool.query('SELECT code, (expires_at > NOW()) as is_valid FROM verification_codes WHERE email = $1', [email]);
        if (codes.length === 0) return res.status(400).json({ error: "No verification code requested." });
        
        const verification = codes[0];
        if (verification.code !== code) return res.status(400).json({ error: "Invalid verification code." });
        if (!verification.is_valid) return res.status(400).json({ error: "Verification code expired." });

        // Check for existing user or username
        const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (existing.length > 0) return res.status(400).json({ error: "Email or username already exists." });

        // Determine Role
        let role = 'Cashier';
        let status = 'disabled'; // Default for public registrations
        
        const { rows: countRes } = await pool.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(countRes[0].count, 10);

        if (userCount === 0) {
            role = 'Admin';
            status = 'active'; // First user is active Admin
        } else if (req.user && req.user.role === 'Admin') {
            // Admin is creating the user
            role = req.body.role || 'Cashier';
            status = req.body.status || 'active';
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user and return the inserted ID
        const { rows: result } = await pool.query(`
            INSERT INTO users (full_name, username, email, phone_number, password, role, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [full_name, username, email, phone_number, hashedPassword, role, status]);

        const nextId = result[0].id;

        // Delete verification code
        await pool.query('DELETE FROM verification_codes WHERE email = $1', [email]);

        res.status(201).json({ message: "Registration successful", userId: nextId, role, status });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.login = async (req, res) => {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
        return res.status(400).json({ error: "Identifier and password required" });
    }

    try {
        const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $2', [identifier, identifier]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = users[0];

        if (user.status === 'disabled') {
            await logLogin(user.id, req, 'failed - disabled');
            return res.status(403).json({ error: "Account disabled. Please contact admin." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await logLogin(user.id, req, 'failed - wrong password');
            return res.status(401).json({ error: "Invalid credentials" });
        }

        await logLogin(user.id, req, 'success');

        const token = jwt.sign(
            { id: user.id, role: user.role, status: user.status }, 
            process.env.JWT_SECRET || 'fallback_secret', 
            { expiresIn: '1d' }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

const logLogin = async (userId, req, status) => {
    try {
        const ip = req.ip || req.client.remoteAddress;
        const device = req.headers['user-agent'];
        await pool.query(
            'INSERT INTO login_logs (user_id, ip_address, device, login_status) VALUES ($1, $2, $3, $4)',
            [userId, ip, device, status]
        );
    } catch (error) {
        console.error("Failed to log login:", error);
    }
};

exports.resetPassword = async (req, res) => {
    const { username, phone_number, new_password } = req.body;

    if (!username || !phone_number || !new_password) {
        return res.status(400).json({ error: "Username, phone number and new password are required" });
    }

    try {
        const { rows: users } = await pool.query('SELECT id FROM users WHERE username = $1 AND phone_number = $2', [username, phone_number]);
        if (users.length === 0) {
            return res.status(404).json({ error: "No matching account found with that username and phone number" });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, users[0].id]);
        
        await pool.query(
            "INSERT INTO activity_logs (user_id, action) VALUES ($1, $2)",
            [users[0].id, "Reset password via self-service recovery"]
        );

        res.json({ message: "Password reset successfully. You can now login." });
    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ error: "Server error during password reset" });
    }
};
