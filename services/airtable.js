const Airtable = require('airtable');

// Initialize Airtable Base
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Reference your Airtable table
const table = base('Domain API');

// Function to fetch available options for single-select fields in Airtable
async function fetchAvailableOptions() {
    try {
        // Fetch records from Airtable to get the options
        const records = await table.select({}).firstPage();

        // Extract the options from your records for fields "MOS", "Listing Type", and "Office"
        const mosOptions = [...new Set(records.map(record => record.get('MOS')))].filter(Boolean);
        const saleModeOptions = [...new Set(records.map(record => record.get('Listing Type')))].filter(Boolean);
        const officeOptions = [...new Set(records.map(record => record.get('Office')))].filter(Boolean);

        return { mosOptions, saleModeOptions, officeOptions };
    } catch (error) {
        console.error('Error fetching available options from Airtable:', error);
        throw error;
    }
}

// Function to create a record in Airtable
async function createAirtableRecord(fields) {
    try {
        // Create the record with proper formatting for single-select fields
        await base('Domain API').create([{ fields }]);
        console.log('Record created successfully:', fields);
    } catch (error) {
        console.error('Airtable error response:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    fetchAvailableOptions,
    createAirtableRecord
};