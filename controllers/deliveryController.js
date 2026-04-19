const { pool } = require('../config/db');

exports.createDelivery = async (req, res) => {
    const { customer_name, customer_phone, customer_id_no, delivery_address, pick_up_location, delivery_person_name, delivery_person_phone, delivery_person_id_no, number_plate, sacco, delivery_fee, notes, status } = req.body;
    try {
        const { rows: result } = await pool.query(
            `INSERT INTO deliveries (customer_name, customer_phone, customer_id_no, delivery_address, pick_up_location, delivery_person_name, delivery_person_phone, delivery_person_id_no, number_plate, sacco, delivery_fee, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [customer_name, customer_phone, customer_id_no, delivery_address, pick_up_location, delivery_person_name, delivery_person_phone, delivery_person_id_no, number_plate, sacco, delivery_fee || 0, notes, status || 'pending']
        );
        res.status(201).json({ message: "Delivery created", id: result[0]?.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create delivery" });
    }
};

exports.getDeliveries = async (req, res) => {
    try {
        const { rows: deliveries } = await pool.query("SELECT * FROM deliveries ORDER BY created_at DESC");
        res.json(deliveries);
    } catch (err) {
        res.status(500).json({ error: "Failed to get deliveries" });
    }
};

exports.updateDelivery = async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    try {
        await pool.query(
            "UPDATE deliveries SET status = COALESCE($1, status), notes = COALESCE($2, notes) WHERE id = $3",
            [status, notes, id]
        );
        res.json({ message: "Delivery updated" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update delivery" });
    }
};

exports.deleteDelivery = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM deliveries WHERE id = $1", [id]);
        res.json({ message: "Delivery deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete delivery" });
    }
};
