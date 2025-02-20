const express = require('express');
const { getAuthUrl, exchangeCodeForToken, refreshToken, getStoredTokens } = require('./auth');
const { fetchAllAgenciesListingsWithStatistics } = require('./services/domainApi');
const { authenticate } = require('./middleware/authMiddleware');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express(); // Initialize app

// Middleware
app.use(cors()); // Enable CORS
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Redirect to Domain's authorization page
app.get('/auth', (req, res) => {
    const authUrl = getAuthUrl();
    console.log('Redirecting to Domain authorization page...');
    res.redirect(authUrl);
});

// Handle OAuth callback
app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        console.error('Authorization code missing.');
        return res.status(400).send('Authorization code missing.');
    }

    try {
        const tokens = await exchangeCodeForToken(code);
        console.log('Tokens:', tokens);

        // Redirect to the main page with a query parameter to enable "Sync Data"
        res.redirect('/?authenticated=true');
    } catch (error) {
        console.error('Error during token exchange:', error.response?.data || error.message);
        res.status(500).send('Failed to authenticate.');
    }
});

// Protected route (secured with the `authenticate` middleware)
app.get('/protected', authenticate, (req, res) => {
    res.send('Protected content accessed!');
});

// Sync data with Domain API and Airtable
app.get('/sync', authenticate, async (req, res) => {
    try {
        const result = await fetchAllAgenciesListingsWithStatistics();
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error during data sync:', error.message || error);
        res.status(500).json({ success: false, message: 'Data sync failed.' });
    }
});

// Refresh token every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    try {
        await refreshToken();
        console.log('Token refreshed successfully via cron job.');
    } catch (error) {
        console.error('Error during scheduled token refresh:', error.response?.data || error.message);
    }
});

// Sync to Airtable every 10 minutes
cron.schedule('*/10 * * * *', async () => {
    try {
        console.log('Cron job triggered: Running Airtable sync...');
        const recordCounts = await fetchAllAgenciesListingsWithStatistics();
        const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);
        console.log(`Data synced successfully to Airtable. Total records processed: ${totalRecords}`);
    } catch (error) {
        console.error('Error during Airtable sync:', error.message || error);
    }
});

// Define the /fetch-data route for manual sync
app.get('/fetch-data', authenticate, async (req, res) => {
    try {
        const recordCounts = await fetchAllAgenciesListingsWithStatistics();
        const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);

        res.json({
            success: true,
            message: `Data synced successfully to Airtable. Total records processed: ${totalRecords}`,
            recordsProcessed: recordCounts,
        });
    } catch (error) {
        console.error('Error syncing data to Airtable:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync data to Airtable.',
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));