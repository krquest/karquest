require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { getAIResponse } = require('./openai');
const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..')));

// Helper function to detect query type
function detectQueryType(query) {
    const lowerQuery = query.toLowerCase();
    // Location keywords
    if (lowerQuery.includes('near me') || lowerQuery.includes('around') || lowerQuery.includes('in ') || lowerQuery.includes('local')) {
        return 'location_search';
    }
    // Price keywords for specific models
    if (lowerQuery.includes('price of') || lowerQuery.includes('how much is') || lowerQuery.includes('cost of') || lowerQuery.includes('value of')) {
        // Check if it's likely about a specific model (contains year or common model words)
        if (lowerQuery.match(/\b(19|20)\d{2}\b/) || lowerQuery.includes('model') || lowerQuery.includes('suv') || lowerQuery.includes('sedan') || lowerQuery.includes('truck')) {
             return 'specific_price';
        }
    }
    // Default to general info if none match clearly
    return 'general_info'; 
}

// Car information endpoint
app.post('/api/car-info', async (req, res) => {
    console.log(`--- Request received: ${req.method} ${req.url} ---`);
    console.log('Headers:', req.headers);
    console.log('Received /api/car-info request');
    console.log('Request Body:', req.body);
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            console.error('Invalid query format received:', query);
            return res.status(400).json({ error: 'Invalid query format' });
        }

        const queryType = detectQueryType(query);
        let systemPrompt = '';

        if (queryType === 'location_search') {
            systemPrompt = `You are a helpful car finding assistant...`;
        } else if (queryType === 'specific_price') {
            systemPrompt = `You are a car market expert AI assistant...`;
        } else { // Default to general info
             systemPrompt = `You are a knowledgeable and helpful car expert AI assistant...`;
        }

        const aiResponse = await getAIResponse(query, systemPrompt);

        // Basic check if AI asked for location
        const requiresLocation = queryType === 'location_search' && aiResponse.toLowerCase().includes('specify your location') || aiResponse.toLowerCase().includes('city or zip code');

        res.json({
            response: aiResponse,
            requiresLocation: requiresLocation
        });
    } catch (error) {
        console.error('--- ERROR in /api/car-info route handler ---');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: 'An internal server error occurred while processing your request.' });
        }
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});