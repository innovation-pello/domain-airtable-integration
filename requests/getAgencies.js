require('dotenv').config();
const axios = require('axios');
const { getStoredTokens } = require('../auth');

// Define the API URL using the base URL from the environment variable
const apiUrl = `${process.env.API_BASE_URL}/agencies`;

async function getAgencies() {
    try {
        // Retrieve the stored access token
        const tokens = getStoredTokens();
        const accessToken = tokens?.accessToken;

        if (!accessToken) {
            throw new Error('Access token is missing. Please authenticate first.');
        }

        if (!process.env.API_BASE_URL) {
            throw new Error('API_BASE_URL is not defined in the environment variables.');
        }

        // Make the API request
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching agencies:', {
            message: error.response?.data || error.message,
            status: error.response?.status || 'Unknown',
            url: apiUrl,
        });
        throw error;
    }
}

module.exports = getAgencies;
