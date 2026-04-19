const { pool } = require('../config/db');
const { stkPush } = require('../utils/mpesa');

exports.initiatePayment = async (req, res) => {
    let { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({ error: 'Phone and amount required' });
    }

    // Safaricom Daraja requires the phone number to be in 254XXXXXXXXX format
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.slice(1);
    } else if (formattedPhone.length === 9) {
        formattedPhone = '254' + formattedPhone;
    }

    // Safaricom Daraja requires the amount to be an integer without decimals
    const finalAmount = Math.ceil(Number(amount));

    try {
        const response = await stkPush(formattedPhone, finalAmount);
        
        // Save to DB
        if (response && response.CheckoutRequestID) {
            await pool.query(
                "INSERT INTO mpesa_transactions (checkout_request_id, phone, amount, status) VALUES ($1, $2, $3, 'pending')",
                [response.CheckoutRequestID, formattedPhone, finalAmount]
            );
        }

        res.json(response);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({
            error: 'STK push failed',
            details: err.response?.data || err.message
        });
    }
};

exports.mpesaCallback = async (req, res) => {
    console.log('M-Pesa Callback:', JSON.stringify(req.body, null, 2));
    try {
        const callbackData = req.body?.Body?.stkCallback;
        if (!callbackData) return res.status(200).send('OK');

        const checkoutRequestId = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode;
        const resultDesc = callbackData.ResultDesc;

        let status = resultCode === 0 ? 'completed' : 'failed';

        await pool.query(
            "UPDATE mpesa_transactions SET status = $1, result_desc = $2 WHERE checkout_request_id = $3",
            [status, resultDesc, checkoutRequestId]
        );
    } catch (error) {
        console.error("M-Pesa Callback Error:", error);
    }
    res.status(200).send('OK');
};

exports.checkStatus = async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;
        const { rows: rows } = await pool.query(
            "SELECT status, result_desc FROM mpesa_transactions WHERE checkout_request_id = $1",
            [checkoutRequestId]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Transaction not found" });

        res.json(rows[0]);
    } catch (error) {
        console.error("M-Pesa Status Error:", error);
        res.status(500).json({ error: "Server error" });
    }
};