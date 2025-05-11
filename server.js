require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { getAIResponse } = require('./openai');

// Create Express app
const app = express();
const port = process.env.PORT || 10000;

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Keep the process running despite the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the process running despite the rejection
});

// Implement basic rate limiting
const requestCounts = {};
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

function rateLimiter(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    
    if (!requestCounts[ip]) {
        requestCounts[ip] = {
            count: 1,
            windowStart: now
        };
        return next();
    }

    if (now - requestCounts[ip].windowStart > RATE_LIMIT_WINDOW) {
        requestCounts[ip] = {
            count: 1,
            windowStart: now
        };
        return next();
    }

    if (requestCounts[ip].count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    requestCounts[ip].count++;
    next();
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..')));
app.use(rateLimiter);

// Add request timeout middleware
app.use((req, res, next) => {
    // Set timeout to 30 seconds
    req.setTimeout(30000, () => {
        res.status(408).json({ error: 'Request timeout' });
    });
    next();
});

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

// Simple in-memory cache
const responseCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Car information endpoint
app.post('/api/car-info', async (req, res) => {
    console.log(`--- Request received: ${req.method} ${req.url} ---`);
    
    // Basic request logging
    const requestLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
    };
    console.log('Request details:', JSON.stringify(requestLog, null, 2));

    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            console.error('Invalid query format received:', query);
            return res.status(400).json({ error: 'Invalid query format' });
        }

        // Check cache first
        const cacheKey = query.toLowerCase().trim();
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_DURATION) {
            console.log('Serving cached response for query:', cacheKey);
            return res.json(cachedResponse.data);
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

        const responseData = {
            response: aiResponse,
            requiresLocation: requiresLocation
        };

        // Cache the response
        responseCache.set(cacheKey, {
            timestamp: Date.now(),
            data: responseData
        });

        // Clean up old cache entries
        for (const [key, value] of responseCache.entries()) {
            if (Date.now() - value.timestamp > CACHE_DURATION) {
                responseCache.delete(key);
            }
        }

        res.json(responseData);
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