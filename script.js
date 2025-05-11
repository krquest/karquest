document.addEventListener('DOMContentLoaded', () => {
    // Existing elements (keep for initial search)
    const searchButton = document.getElementById('searchButton');
    const carQuery = document.getElementById('carQuery');
    // const resultContainer = document.getElementById('resultContainer'); // No longer used for results

    // New Chat Screen Elements
    const searchScreen = document.getElementById('searchScreen');
    const chatScreen = document.getElementById('chatScreen');
    const chatMessagesContainer = document.getElementById('chatMessagesNew');
    const chatInput = document.getElementById('chatInputNew');
    const sendChatButton = document.getElementById('sendChatBtnNew');
    const backToSearchButton = document.getElementById('backToSearchBtn');
    const clearChatButton = document.getElementById('clearChatBtn');

    let currentConversation = []; // Store conversation history

    // --- Initial Search Logic --- 
    searchButton.addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent form submission if it's inside a form
        const query = carQuery.value.trim();
        
        if (!query) {
            // Maybe add a small inline error message near the input?
            carQuery.style.borderColor = 'red';
            setTimeout(() => carQuery.style.borderColor = '', 2000);
            return;
        }

        // Transition to chat screen
        searchScreen.style.display = 'none';
        chatScreen.style.display = 'flex'; // Use flex as defined in CSS
        chatMessagesContainer.innerHTML = ''; // Clear previous messages
        currentConversation = []; // Reset conversation

        addUserMessage(query);
        await fetchAndDisplayAiResponse(query);
        carQuery.value = ''; // Clear the initial search input
    });

    // Allow Enter key for initial search
    carQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior (like form submission)
            searchButton.click();
        }
    });

    // --- Chat Screen Logic --- 

    // Send message from chat input
    sendChatButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline
            e.preventDefault();
            handleSendMessage();
        }
        autoResizeTextarea(chatInput);
    });
    chatInput.addEventListener('input', () => autoResizeTextarea(chatInput)); // Resize on input

    async function handleSendMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        addUserMessage(messageText);
        chatInput.value = '';
        autoResizeTextarea(chatInput); // Reset size after sending
        await fetchAndDisplayAiResponse(messageText);
    }

    async function fetchAndDisplayAiResponse(userQuery) {
        addAiMessage("Thinking...", true); // Show thinking indicator
        currentConversation.push({ role: 'user', content: userQuery });

        try {
            // Use production API endpoint
            const apiBaseUrl = 'https://karquest.onrender.com/api/car-info';
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(apiBaseUrl, {
                signal: controller.signal,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Send the whole conversation history if your API supports it
                // body: JSON.stringify({ conversation: currentConversation })
                // Or just send the latest query if it doesn't
                body: JSON.stringify({ query: userQuery }) 
            });

            // Check if the response was successful (status code 200-299)
            if (!response.ok) {
                // Try to get error text, but don't assume it's JSON
                const errorText = await response.text(); 
                throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText.substring(0, 100)}`); // Include status and part of the body
            }

            // Now it's safer to parse as JSON
            const data = await response.json();
            removeThinkingMessage(); // Remove the 'Thinking...' message

            // Check for application-level errors within the JSON response
            if (data.error) {
                throw new Error(data.error);
            }

            const aiResponseText = data.response; // Get the raw response text
            const formattedResponse = formatResponse(aiResponseText); // Format for display

            // Check if the AI is asking for more model details
            const asksForModelDetails = /provide the full model details|specify which car model/i.test(aiResponseText);

            addAiMessage(formattedResponse, false, false, data.requiresLocation, false, asksForModelDetails); // Pass asksForModelDetails flag
            currentConversation.push({ role: 'assistant', content: aiResponseText }); // Store raw response in history

            // If AI asked for location, add a hint for the user
            if (data.requiresLocation) {
                addAiMessage("*(Please provide your city or zip code so I can find cars near you.)*", false, false, false, true); // Add a hint message
            }

        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId); // Clean up timeout if defined
            removeThinkingMessage(); // Remove thinking message on error too
            const errorMessage = error.name === 'AbortError'
                ? 'Request timed out. Please try again.'
                : `Sorry, an error occurred: ${error.message}`;
            addAiMessage(errorMessage, false, true); // Indicate error
            console.error("API Error:", error);
        }
    }

    function addUserMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-new', 'user-message-new');
        messageElement.textContent = text;
        chatMessagesContainer.appendChild(messageElement);
        scrollToBottom();
    }

    // Updated addAiMessage to handle requiresLocation, hint messages, and incomplete model prompts
    function addAiMessage(text, isThinking = false, isError = false, requiresLocation = false, isHint = false, isModelPrompt = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-new', 'ai-message-new');
        if (isHint) {
             messageElement.classList.add('hint-message'); // Add a class for styling hints
             messageElement.style.fontStyle = 'italic';
             messageElement.style.color = 'var(--text-secondary)';
             messageElement.style.fontSize = '0.9em';
        }
        if (isThinking) {
            messageElement.classList.add('thinking-new');
            messageElement.id = 'thinking-message'; // ID to easily remove it
        }
        if (isError) {
            messageElement.classList.add('error-new'); // Add specific error class
        }
        if (isModelPrompt) {
            messageElement.classList.add('incomplete-model-prompt'); // Add class for incomplete model prompt
            // Optionally prepend a standard message if needed, or handle in CSS
            // text = `<div class="prompt-header">Please provide more details:</div>` + text;
        }
        // Basic Markdown-like formatting (bold, italics)
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');       // Italics
        text = text.replace(/\n/g, '<br>'); // Newlines
        messageElement.innerHTML = text; // Use innerHTML to render formatting
        chatMessagesContainer.appendChild(messageElement);
        scrollToBottom();
    }

    function removeThinkingMessage() {
        const thinkingMsg = document.getElementById('thinking-message');
        if (thinkingMsg) {
            thinkingMsg.remove();
        }
    }

    // Format the response (keep simple text formatting)
    function formatResponse(text) {
        // Keep basic text, maybe handle newlines better if needed
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text; // Let browser parse potential HTML
        // Return text content, preserving basic structure if possible
        return tempDiv.textContent || tempDiv.innerText || ''; 
    }

    // Auto-resize textarea
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = textarea.scrollHeight + 'px'; // Set to scroll height
    }

    // Scroll to bottom of chat messages
    function scrollToBottom() {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // Back to Search Button
    backToSearchButton.addEventListener('click', () => {
        chatScreen.style.display = 'none';
        searchScreen.style.display = 'block'; // Or 'flex' depending on its default
        currentConversation = []; // Clear conversation when going back
    });

    // Clear Chat Button
    clearChatButton.addEventListener('click', () => {
        chatMessagesContainer.innerHTML = ''; // Clear visual messages
        currentConversation = []; // Clear stored conversation
        addAiMessage("Chat cleared. Ask me anything!"); // Optional confirmation
    });

    // Initial setup
    autoResizeTextarea(chatInput); // Set initial size
});