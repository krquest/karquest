// OpenRouter API integration
const fetch = require('node-fetch');

async function getAIResponse(query, systemPrompt) {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
        throw new Error('OpenRouter API key is not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://karquest.vercel.app',
            'X-Title': 'KarQuest'
        },
        body: JSON.stringify({
            model: 'openai/gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: query
                }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API request failed: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

module.exports = { getAIResponse };