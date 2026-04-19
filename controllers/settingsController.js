const { pool } = require('../config/db');

exports.getSettings = async (req, res) => {
    try {
        const { rows: settings } = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
        if (settings.length === 0) {
            await pool.query("INSERT INTO settings (store_name) VALUES ('My POS System')");
            const { rows: newSettings } = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
            return res.json(newSettings[0]);
        }
        res.json(settings[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        let { store_name, store_logo, store_address, store_phone, currency, tax_rate, theme } = req.body;
        
        // Handle file upload if present
        if (req.file) {
            store_logo = req.file.path;
        }
        
        tax_rate = parseFloat(tax_rate) || 0.00;

        await pool.query(`
            UPDATE settings 
            SET store_name=COALESCE($1, store_name), 
                store_logo=COALESCE($2, store_logo), 
                store_address=COALESCE($3, store_address), 
                store_phone=COALESCE($4, store_phone), 
                currency=COALESCE($5, currency), 
                tax_rate=COALESCE($6, tax_rate), 
                theme=COALESCE($7, theme)
        `, [
            store_name ?? null, 
            store_logo ?? null, 
            store_address ?? null, 
            store_phone ?? null, 
            currency ?? null, 
            tax_rate ?? null, 
            theme ?? null
        ]);
        
        res.json({ message: "Settings updated successfully", store_logo });
    } catch (err) {
        console.error("Settings Update Error:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
};
