require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

// Generate a secure nonce
function generateNonce() {
    return crypto.randomBytes(16).toString('base64url'); // Base64url encoding
}

// Securely store tokens
function storeTokens(tokens) {
    const data = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null, // Handle missing refreshToken gracefully
    };

    try {
        fs.writeFileSync('./tokens.json', JSON.stringify(data, null, 2));
        console.log('Tokens saved to tokens.json:', data);
    } catch (error) {
        console.error('Error saving tokens to tokens.json:', error.message);
    }
}

// Retrieve stored tokens
function getStoredTokens() {
    try {
        if (fs.existsSync('./tokens.json')) {
            const tokens = JSON.parse(fs.readFileSync('./tokens.json', 'utf8'));
            if (tokens.accessToken) {
                return tokens;
            } else {
                console.error('Stored tokens are invalid or missing accessToken.');
            }
        } else {
            console.warn('tokens.json file does not exist. Please authenticate.');
        }
    } catch (error) {
        console.error('Error reading tokens from tokens.json:', error.message);
    }
    return null;
}

// Refresh the access token
async function refreshToken() {
    try {
        const tokens = getStoredTokens();
        if (!tokens || !tokens.refreshToken) {
            console.error('No refresh token available. Please authenticate first.');
            return null;
        }

        console.log('Refreshing access token using refresh token...');
        const response = await axios.post(
            `${process.env.DOMAIN_AUTH_URL}/connect/token`,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token } = response.data;
        storeTokens({ accessToken: access_token, refreshToken: refresh_token });
        console.log('Tokens refreshed successfully.');
        return { accessToken: access_token, refreshToken: refresh_token };
    } catch (error) {
        console.error('Error refreshing token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        throw error;
    }
}

// Exchange authorization code for tokens
async function exchangeCodeForToken(code) {
    try {
        console.log('Exchanging authorization code for tokens...');
        const tokenResponse = await axios.post(
            `${process.env.DOMAIN_AUTH_URL}/connect/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI,
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        storeTokens({ accessToken: access_token, refreshToken: refresh_token });

        return { accessToken: access_token, refreshToken: refresh_token };
    } catch (error) {
        console.error('Error exchanging authorization code for tokens:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        throw error;
    }
}

// Construct the authorization URL
function getAuthUrl() {
    const nonce = generateNonce();
    const state = generateNonce();

    const authUrl = `${process.env.DOMAIN_AUTH_URL}/connect/authorize` +
        `?client_id=${process.env.CLIENT_ID}` +
        `&response_type=code` +
        `&scope=openid profile api_listings_read api_agencies_read offline_access` +
        `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
        `&state=${state}` +
        `&nonce=${nonce}`;

    console.log('Constructed Authorization URL:', authUrl);
    return authUrl;
}

module.exports = { getAuthUrl, exchangeCodeForToken, refreshToken, getStoredTokens };
