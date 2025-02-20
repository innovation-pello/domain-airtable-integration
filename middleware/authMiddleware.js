const { getStoredTokens } = require('../auth');

function authenticate(req, res, next) {
    try {
        const tokens = getStoredTokens();

        if (!tokens || !tokens.accessToken) {
            console.error('Authentication failed: No access token found.');
            return res.status(401).json({ success: false, message: 'Unauthorized: Please authenticate first.' });
        }

        // If token has expiration logic, include a check here (optional).
        // Example (if exp field exists in tokens.json):
        // const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
        // if (tokens.exp && tokens.exp < now) {
        //     console.error('Authentication failed: Access token expired.');
        //     return res.status(401).json({ success: false, message: 'Access token expired. Please re-authenticate.' });
        // }

        // Attach the access token to the request object
        req.accessToken = tokens.accessToken;

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error('Error in authentication middleware:', error.message || error);
        res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
    }
}

module.exports = { authenticate };
