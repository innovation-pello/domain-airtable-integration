const axios = require('axios');
const { getStoredTokens, refreshToken } = require('../auth');

// Function to fetch statistics for a given listing ID
async function fetchListingStatistics(listingId) {
    if (!listingId) {
        console.error('Invalid listing ID provided.');
        return null;
    }

    const endpoint = `${process.env.DOMAIN_API_BASE_URL}/listings/${listingId}/statistics`;

    try {
        // Retrieve the current access token
        const tokens = getStoredTokens();
        let accessToken = tokens?.accessToken;

        if (!accessToken) {
            throw new Error('Access token is missing. Please authenticate first.');
        }

        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        console.log('Fetching statistics with endpoint:', endpoint);
        console.log('Request headers:', headers);

        // Make the API call
        const response = await axios.get(endpoint, { headers });

        // Log the full response for debugging
        console.log(`Full API response for listing ID ${listingId}:`, JSON.stringify(response.data, null, 2));

        // Return the statistics summary
        return response.data.summary;
    } catch (error) {
        // Handle token expiration and retry the request
        if (error.response?.status === 401) {
            console.warn('Access token expired. Refreshing token...');
            try {
                await refreshToken();

                // Retry with the refreshed token
                const refreshedTokens = getStoredTokens();
                const refreshedAccessToken = refreshedTokens?.accessToken;

                if (refreshedAccessToken) {
                    const retryHeaders = {
                        Authorization: `Bearer ${refreshedAccessToken}`,
                        'Content-Type': 'application/json',
                    };

                    console.log('Retrying request with refreshed token...');
                    const retryResponse = await axios.get(endpoint, { headers: retryHeaders });
                    return retryResponse.data.summary;
                }
            } catch (refreshError) {
                console.error('Error refreshing token:', refreshError.response?.data || refreshError.message);
            }
        }

        // Log detailed error information
        if (error.response) {
            console.error(`API response error for listing ID ${listingId}:`, JSON.stringify(error.response.data, null, 2));
            console.error('API response status:', error.response.status);
            console.error('API response headers:', error.response.headers);
        } else if (error.request) {
            console.error('API request made but no response received:', error.request);
        } else {
            console.error('Error setting up API request:', error.message);
        }
        return null;
    }
}

module.exports = { fetchListingStatistics };
