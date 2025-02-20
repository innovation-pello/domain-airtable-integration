// domainApi.js
const axios = require('axios');
const Airtable = require('airtable');
const { fetchListingStatistics } = require('./domainStatistics');
const { getStoredTokens, refreshToken } = require('../auth');

// Define Domain API endpoint
const baseEndpoint = `${process.env.DOMAIN_API_BASE_URL}/agencies`;

// Agencies list
const agencies = [
    { name: "LNS", id: 2842 },
    { name: "UNS", id: 36084 },
    { name: "NS", id: 36082 },
];

// Initialize Airtable Base
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Function to validate environment variables
function validateEnvironment() {
    if (!process.env.DOMAIN_API_BASE_URL) {
        throw new Error('DOMAIN_API_BASE_URL is not defined in environment variables.');
    }
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        throw new Error('Airtable API credentials are missing.');
    }
}

// Function to find a record by "Listing ID" in Airtable
async function findRecordByListingId(listingId) {
    try {
        const records = await base('Domain API')
            .select({
                filterByFormula: `{Listing ID} = "${listingId}"`,
            })
            .firstPage();

        return records.length > 0 ? records[0] : null;
    } catch (error) {
        console.error('Error finding record in Airtable:', error.message);
        return null;
    }
}

// Function to create or update a record in Airtable
async function createOrUpdateAirtableRecord(fields) {
    try {
        const existingRecord = await findRecordByListingId(fields['Listing ID']);

        if (existingRecord) {
            console.log(`Updating record with Listing ID: ${fields['Listing ID']}`);
            await base('Domain API').update(existingRecord.id, fields);
        } else {
            console.log(`Creating new record with Listing ID: ${fields['Listing ID']}`);
            await base('Domain API').create([{ fields }]);
        }
    } catch (error) {
        console.error('Error syncing data to Airtable:', JSON.stringify(error.response?.data || error.message, null, 2));
    }
}

// Function to fetch data from Domain API with token retry
async function fetchDomainApiData(url) {
    try {
        const tokens = getStoredTokens();
        let accessToken = tokens?.accessToken;

        if (!accessToken) {
            throw new Error('Access token is missing. Please authenticate first.');
        }

        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        // Fetch data
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            console.warn('Access token expired. Refreshing token...');
            await refreshToken();

            // Retry with refreshed token
            const refreshedTokens = getStoredTokens();
            const refreshedAccessToken = refreshedTokens?.accessToken;

            if (refreshedAccessToken) {
                const headers = {
                    Authorization: `Bearer ${refreshedAccessToken}`,
                    'Content-Type': 'application/json',
                };

                // Retry fetching data
                const retryResponse = await axios.get(url, { headers });
                return retryResponse.data;
            }
        }

        console.error('Error fetching data from Domain API:', error.response?.data || error.message);
        throw error;
    }
}

// Function to fetch listings and update Airtable
async function fetchListingsWithStatistics(agencyId, agencyName) {
    const endpoint = `${baseEndpoint}/${agencyId}/listings?pageSize=1000`;

    try {
        const listings = await fetchDomainApiData(endpoint);
        console.log(`Retrieved ${listings.length || 0} listings for agency: ${agencyName}`);

        let recordsProcessed = 0;

        for (const listing of listings) {
            const listingId = listing.id;

            // Fetch statistics for the listing
            const statistics = await fetchListingStatistics(listingId);

            // Construct the fields object to match Airtable's structure
            const fields = {
                'Listing ID': listingId,
                'Property Address': listing.addressParts?.displayAddress || null,
                // 'Trimmed Heading': [
                //     listing.addressParts?.unitNumber && listing.addressParts?.streetNumber
                //         ? `${listing.addressParts?.unitNumber}/${listing.addressParts?.streetNumber}`
                //         : listing.addressParts?.streetNumber,
                //     listing.addressParts?.street,
                // ]
                //     .filter(Boolean)
                //     .join(' ') || null,
                'Suburb': listing.addressParts?.suburb || null,
                'Bathrooms': listing.bathrooms || null,
                'Bedrooms': listing.bedrooms || null,
                'Carspaces': listing.carspaces || null,
                'Date Updated': listing.dateUpdated || null,
                'Date Listed': listing.dateListed || null,
                'Description': listing.description || null,
                'Heading': listing.headline || null,
                'Price Display': listing.priceDetails?.displayPrice || null,
                'Domain URL': listing.seoUrl || null,
                // Add statistics data
                'Total Listing Views': statistics?.totalListingViews || 0,
                'Total Photo Views (Domain)': statistics?.totalPhotoViews || 0,
                'Total Photo Gallery Views (Domain)': statistics?.totalPhotoGalleryViews || 0,
                'Total Floor Plan Views (Domain)': statistics?.totalFloorplanViews || 0,
                'Total Map Views (Domain)': statistics?.totalMapViews || 0,
                'Total Agent Phone Number Reveals (Domain)': statistics?.totalAgentPhoneNumberReveals || 0,
                'Total Email Enquiries (Domain)': statistics?.totalEnquiries || 0,
                'Total Website Views (Domain)': statistics?.percentageWebsiteViews || 0,
                'Total Mobile Site Views (Domain)': statistics?.percentageMobileSiteViews || 0,
            };

            await createOrUpdateAirtableRecord(fields);
            recordsProcessed++;
            console.log(`Syncing data for Listing ID: ${listingId}`);
        }

        console.log(`Successfully processed ${recordsProcessed} listings for ${agencyName}`);
        return recordsProcessed;
    } catch (error) {
        console.error(`Error processing listings for agency ${agencyName}:`, error.message);
        return 0;
    }
}

// Fetch all agencies and update Airtable
async function fetchAllAgenciesListingsWithStatistics() {
    validateEnvironment();

    const recordCounts = {};
    for (const agency of agencies) {
        recordCounts[agency.name] = await fetchListingsWithStatistics(agency.id, agency.name);
    }

    return recordCounts;
}

module.exports = { fetchAllAgenciesListingsWithStatistics };