require('dotenv').config();
const axios = require('axios');

// Generate access token
async function getAccessToken() {
    const auth = Buffer.from(
        `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
    ).toString('base64');

    const res = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
            headers: { Authorization: `Basic ${auth}` }
        }
    );

    console.log("ACCESS TOKEN GENERATED:", res.data.access_token);

    return res.data.access_token;
}

// Generate password
function getPassword() {
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);

    const str = process.env.SHORTCODE + process.env.PASSKEY + timestamp;
    const password = Buffer.from(str).toString('base64');

    return { password, timestamp };
}

// STK Push
async function stkPush(phoneNumber, amount) {
    const accessToken = await getAccessToken();
    const { password, timestamp } = getPassword();

    const data = {
        BusinessShortCode: process.env.SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: process.env.SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: 'POS',
        TransactionDesc: 'POS Payment'
    };

    const res = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        data,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return res.data;
}

module.exports = { stkPush };