const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initializeDB } = require('./config/db');


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const salesRoutes = require('./routes/salesRoutes');
const mpesaRoutes = require('./routes/mpesaRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const logRoutes = require('./routes/logRoutes');
const financeRoutes = require('./routes/financeRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const paystackRoutes = require('./routes/paystackRoutes');
// Static Route for Uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api', paystackRoutes);
const fs = require('fs');

// Serve React Frontend
app.use(express.static(path.join(__dirname, '../frontend/dist'), { dotfiles: 'allow' }));
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();

    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath, { dotfiles: 'allow' }, err => {
            if (err) {
                console.error("Error sending index.html:", err);
                res.status(500).send("Error loading frontend. Please restart the server.");
            }
        });
    } else {
        res.status(404).send("Frontend build not found. Please run 'npm run build' in the frontend directory.");
    }
});

// Start Server & Init DB
initializeDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
