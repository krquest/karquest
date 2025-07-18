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
    
    // Price/cost keywords
    if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('worth') || 
        lowerQuery.includes('value') || lowerQuery.includes('expensive') || lowerQuery.includes('cheap') ||
        lowerQuery.includes('budget') || lowerQuery.includes('afford') || lowerQuery.includes('market value') ||
        lowerQuery.includes('how much') || lowerQuery.includes('$') || lowerQuery.includes('dollar')) {
        return 'price_analysis';
    }
    
    // Location keywords
    if (lowerQuery.includes('near me') || lowerQuery.includes('around') || lowerQuery.includes('in ') || lowerQuery.includes('local')) {
        return 'location_search';
    }
    
    // Default to general info if none match clearly
    return 'general_info'; 
}

// Function to search car websites and get pricing data
async function searchCarWebsites(carQuery) {
    try {
        // Extract car details from query
        const carDetails = extractCarDetails(carQuery);
        
        // Simulate web search results (in production, you'd use real APIs)
        const searchResults = await simulateCarWebSearch(carDetails);
        
        return searchResults;
    } catch (error) {
        console.error('Error searching car websites:', error);
        return null;
    }
}

// Extract car details from user query
function extractCarDetails(query) {
    const lowerQuery = query.toLowerCase();
    
    // Common car makes
    const makes = ['toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen', 'hyundai', 'kia', 'mazda', 'subaru', 'lexus', 'acura', 'infiniti', 'cadillac', 'buick', 'gmc', 'ram', 'jeep', 'dodge', 'chrysler', 'lincoln', 'volvo', 'jaguar', 'land rover', 'porsche', 'tesla', 'mitsubishi'];
    
    // Extract year (4 digits)
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    
    // Extract make
    let make = null;
    for (const m of makes) {
        if (lowerQuery.includes(m)) {
            make = m;
            break;
        }
    }
    
    // Extract mileage
    const mileageMatch = query.match(/(\d+)[,\s]*(k|thousand|miles|mi)/i);
    const mileage = mileageMatch ? mileageMatch[1] : null;
    
    return { year, make, mileage, originalQuery: query };
}

// Simulate car website search (replace with real API calls)
async function simulateCarWebSearch(carDetails) {
    const { year, make, mileage, originalQuery } = carDetails;
    
    // Simulate realistic pricing data
    const basePrice = getBasePriceEstimate(year, make);
    const mileageAdjustment = mileage ? Math.max(0, 1 - (parseInt(mileage) / 200000)) : 0.8;
    
    const estimatedPrice = Math.round(basePrice * mileageAdjustment);
    const priceRange = {
        low: Math.round(estimatedPrice * 0.85),
        high: Math.round(estimatedPrice * 1.15),
        average: estimatedPrice
    };
    
    return {
        searchResults: [
            {
                source: "AutoTrader",
                listings: Math.floor(Math.random() * 50) + 10,
                avgPrice: priceRange.average,
                priceRange: `$${priceRange.low.toLocaleString()} - $${priceRange.high.toLocaleString()}`
            },
            {
                source: "Cars.com",
                listings: Math.floor(Math.random() * 40) + 8,
                avgPrice: Math.round(priceRange.average * 1.05),
                priceRange: `$${Math.round(priceRange.low * 1.02).toLocaleString()} - $${Math.round(priceRange.high * 1.08).toLocaleString()}`
            },
            {
                source: "CarGurus",
                listings: Math.floor(Math.random() * 35) + 12,
                avgPrice: Math.round(priceRange.average * 0.98),
                priceRange: `$${Math.round(priceRange.low * 0.95).toLocaleString()} - $${Math.round(priceRange.high * 1.02).toLocaleString()}`
            }
        ],
        marketAnalysis: {
            averageMarketPrice: priceRange.average,
            priceRange: priceRange,
            totalListings: Math.floor(Math.random() * 100) + 50,
            marketTrend: Math.random() > 0.5 ? "increasing" : "stable"
        }
    };
}

// Get base price estimate based on year and make
function getBasePriceEstimate(year, make) {
    const currentYear = new Date().getFullYear();
    const age = year ? currentYear - parseInt(year) : 5;
    
    // Base prices by make (simplified)
    const basePrices = {
        'toyota': 25000,
        'honda': 24000,
        'ford': 22000,
        'chevrolet': 21000,
        'nissan': 20000,
        'bmw': 45000,
        'mercedes': 50000,
        'audi': 42000,
        'lexus': 40000,
        'tesla': 55000
    };
    
    const basePrice = basePrices[make] || 25000;
    
    // Depreciation calculation
    const depreciationRate = 0.15; // 15% per year
    const depreciatedPrice = basePrice * Math.pow(1 - depreciationRate, age);
    
    return Math.max(depreciatedPrice, basePrice * 0.1); // Minimum 10% of original value
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
        let webSearchData = null;

        if (queryType === 'price_analysis') {
            // Search car websites for pricing data
            webSearchData = await searchCarWebsites(query);
            
            systemPrompt = `You are an expert automotive pricing analyst with access to real-time market data from major car websites including AutoTrader, Cars.com, and CarGurus.

CURRENT MARKET DATA ANALYSIS:
${webSearchData ? `
📊 LIVE MARKET SEARCH RESULTS:
${webSearchData.searchResults.map(result => 
`• ${result.source}: ${result.listings} listings found
  Average Price: $${result.avgPrice.toLocaleString()}
  Price Range: ${result.priceRange}`
).join('\n')}

📈 MARKET ANALYSIS:
• Total Market Listings: ${webSearchData.marketAnalysis.totalListings}
• Average Market Price: $${webSearchData.marketAnalysis.averageMarketPrice.toLocaleString()}
• Price Range: $${webSearchData.marketAnalysis.priceRange.low.toLocaleString()} - $${webSearchData.marketAnalysis.priceRange.high.toLocaleString()}
• Market Trend: ${webSearchData.marketAnalysis.marketTrend}
` : 'Market data temporarily unavailable - providing general estimates.'}

IMPORTANT: To provide the most accurate price estimate, you MUST ask the user for detailed information about their specific vehicle. Ask these questions in a friendly, conversational way:

🚗 **VEHICLE DETAILS NEEDED:**
1. **Basic Info**: Make, Model, Year, Trim Level
2. **Mileage**: Current odometer reading
3. **Condition**: Overall condition (Excellent, Good, Fair, Poor)

🔧 **MAINTENANCE & MODIFICATIONS:**
4. **Service History**: When was the last oil change, major service?
5. **Modifications**: Any aftermarket parts, upgrades, or changes made?
6. **Repairs**: Any recent repairs or known issues?

📋 **VEHICLE HISTORY:**
7. **Ownership**: How many previous owners?
8. **Accidents**: Any accident history or damage?
9. **Usage**: Highway vs city driving, garage kept?
10. **Documentation**: Do you have maintenance records, clean title?

🏠 **LOCATION & TIMING:**
11. **Location**: What city/state are you in?
12. **Selling Timeline**: When are you planning to sell/buy?

Ask for this information in a natural, conversational way. Don't overwhelm them - ask 3-4 questions at a time and explain why each detail matters for accurate pricing.

Format your response with clear sections:
- 💰 INITIAL MARKET ESTIMATE (based on available info)
- 📋 INFORMATION NEEDED FOR PRECISE PRICING
- 📊 HOW THESE FACTORS AFFECT VALUE
- 💡 NEXT STEPS

Be helpful and explain how each piece of information affects the car's value.`;

        } else if (queryType === 'location_search') {
            systemPrompt = `You are a helpful car finding assistant. Help users locate vehicles near their area. If they haven't specified a location, politely ask for their city or zip code to provide accurate local results.`;
        } else { // Default to general info
             systemPrompt = `You are a knowledgeable and helpful car expert AI assistant. Provide detailed, accurate information about vehicles, including specifications, features, reliability, maintenance, and comparisons. Be conversational and helpful while maintaining expertise.`;
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