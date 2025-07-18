class CarQuestApp {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.searchInput = document.getElementById('carQuery');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navLinks = document.querySelector('.nav-links');
        this.setupEventListeners();
        this.OPENAI_API_KEY = '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';
        this.networkListeners = new Map(); // Track active network status listeners
        this.conversationHistory = []; // Store conversation history
        this.currentSessionId = this.generateSessionId(); // Generate unique session ID
    }

    setupEventListeners() {
        // Mobile menu toggle
        if (this.mobileMenuToggle) {
            this.mobileMenuToggle.addEventListener('click', () => {
                this.mobileMenuToggle.classList.toggle('active');
                this.navLinks.classList.toggle('active');
            });
        }
        
        // Add global online/offline event listeners
        window.addEventListener('online', () => {
            console.log('Connection restored');
            // Show connection restored notification
            this.showConnectionStatus(true);
        });
        
        window.addEventListener('offline', () => {
            console.log('Connection lost');
            // Show connection lost notification
            this.showConnectionStatus(false);
        });
        
        // Search form submission
        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                this.handleSearch();
            } catch (err) {
                console.error('Error in search form submit:', err);
                alert('An error occurred. Please check the console for details.');
            }
        });

        // Search button click
        document.getElementById('searchButton').addEventListener('click', () => {
            try {
                this.handleSearch();
            } catch (err) {
                console.error('Error in search button click:', err);
                alert('An error occurred. Please check the console for details.');
            }
        });

        // Enter key in search input
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                try {
                    this.handleSearch();
                } catch (err) {
                    console.error('Error in search input enter:', err);
                    alert('An error occurred. Please check the console for details.');
                }
            }
        });

        // New question button
        document.getElementById('sendButton').addEventListener('click', () => {
            try {
                this.handleNewQuestion();
            } catch (err) {
                console.error('Error in sendButton click:', err);
                alert('An error occurred. Please check the console for details.');
            }
        });

        // Enter key in new question input
        document.getElementById('newQuestion').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                try {
                    this.handleNewQuestion();
                } catch (err) {
                    console.error('Error in newQuestion enter:', err);
                    alert('An error occurred. Please check the console for details.');
                }
            }
        });

        // Back button
        document.querySelector('.back-button').addEventListener('click', () => {
            try {
                this.showSearchScreen();
            } catch (err) {
                console.error('Error in back-button click:', err);
                alert('An error occurred. Please check the console for details.');
            }
        });

        // Handle desktop close button click
        document.addEventListener('click', (e) => {
            const chatHeader = document.querySelector('.chat-header-new');
            if (chatHeader && chatHeader.contains(e.target)) {
                // Check if click is on the close button area (right side)
                const rect = chatHeader.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const headerWidth = rect.width;
                
                // If click is in the right 60px area (close button)
                if (clickX > headerWidth - 60) {
                    this.showSearchScreen();
                }
            }
        });

        // Handle escape key to close chat on desktop
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const chatScreen = document.getElementById('chatScreen');
                if (chatScreen && chatScreen.style.display === 'block') {
                    this.showSearchScreen();
                }
            }
        });
    }

    handleSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            this.showError('Please enter a car model to search');
            return;
        }

        if (!this.validateCarQuery(query)) {
            return;
        }

        // Show chat screen first
        this.showChatScreen();
        
        // Clear any existing messages
        this.chatMessages.innerHTML = '';
        
        // Get AI response
        this.getAIResponse(query);
        
        // Clear input
        this.searchInput.value = '';
    }

    handleNewQuestion() {
        const newQuestionInput = document.getElementById('newQuestion');
        const query = newQuestionInput.value.trim();
        
        if (!query) {
            return;
        }

        // Validate the query
        if (!this.validateCarQuery(query)) {
            // Add error message to chat
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message ai-message error';
            
            // Get the error message from the search box
            const searchError = document.querySelector('.error-message');
            if (searchError) {
                errorDiv.textContent = searchError.textContent;
            } else {
                errorDiv.textContent = 'Please use the correct format: Year Make Model (e.g., 2024 Toyota Camry)';
            }
            
            this.chatMessages.appendChild(errorDiv);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            return;
        }

        this.getAIResponse(query);
        newQuestionInput.value = '';
    }

    showChatScreen() {
        const searchScreen = document.getElementById('searchScreen');
        const chatScreen = document.getElementById('chatScreen');
        
        // Hide search screen
        searchScreen.style.display = 'none';
        
        // Show chat screen
        chatScreen.style.display = 'block';
        chatScreen.classList.add('active');
    }

    showSearchScreen() {
        const searchScreen = document.getElementById('searchScreen');
        const chatScreen = document.getElementById('chatScreen');
        
        // Hide chat screen
        chatScreen.style.display = 'none';
        chatScreen.classList.remove('active');
        
        // Show search screen
        searchScreen.style.display = 'block';
        
        // Clear chat messages
        this.chatMessages.innerHTML = '';
        
        // Clear conversation history for new session
        this.conversationHistory = [];
        this.currentSessionId = this.generateSessionId();
    }

    validateCarQuery(query) {
        // Check if this is a comparison query
        const isComparisonQuery = query.toLowerCase().includes('compare') || 
                                query.toLowerCase().includes('vs') || 
                                query.toLowerCase().includes('versus') ||
                                query.toLowerCase().includes('between');

        if (isComparisonQuery) {
            // Split the query into two car specifications
            const cars = query.split(/vs|versus|compare|between/i).map(car => car.trim());
            
            // Remove empty strings and "compare" if it's at the beginning
            const filteredCars = cars.filter(car => car && !car.toLowerCase().includes('compare'));
            
            if (filteredCars.length !== 2) {
                this.showError('Please specify two cars to compare (e.g., "Compare 2024 Toyota Camry vs 2024 Honda Accord")');
                return false;
            }

            // Validate each car specification
            for (const carSpec of filteredCars) {
                const yearPattern = /\b(19|20)\d{2}\b/;
                const year = carSpec.match(yearPattern);
                
                if (!year) {
                    this.showError('Please include the car year for both cars (e.g., "2024 Toyota Camry vs 2024 Honda Accord")');
                    return false;
                }

                const carYear = parseInt(year[0]);
                if (carYear < 1900 || carYear > new Date().getFullYear() + 1) {
                    this.showError(`Invalid year: ${carYear}. Please provide a year between 1900 and ${new Date().getFullYear() + 1}`);
                    return false;
                }

                const queryWithoutYear = carSpec.replace(yearPattern, '').trim();
                const parts = queryWithoutYear.split(' ');
                const make = parts[0].toLowerCase();

                // Check for common car makes with fuzzy matching
                const commonMakes = [
                    'toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi',
                    'hyundai', 'kia', 'volkswagen', 'subaru', 'mazda', 'lexus', 'acura', 'infiniti',
                    'porsche', 'tesla', 'jeep', 'ram', 'gmc', 'cadillac', 'buick', 'chrysler',
                    'dodge', 'fiat', 'mini', 'volvo', 'jaguar', 'land rover', 'mitsubishi'
                ];

                const findClosestMake = (input) => {
                    const makeDistances = commonMakes.map(commonMake => ({
                        make: commonMake,
                        distance: this.levenshteinDistance(input, commonMake)
                    }));
                    return makeDistances.sort((a, b) => a.distance - b.distance)[0];
                };

                const closestMake = findClosestMake(make);
                if (closestMake.distance > 3) {
                    this.showError(`Please use a valid car make. Common examples: Toyota, Honda, Ford, BMW, Mercedes`);
                    return false;
                }
            }

            return true;
        }

        // Check for year (4 digits) and car model
        const yearPattern = /\b(19|20)\d{2}\b/;
        const year = query.match(yearPattern);
        
        if (!year) {
            this.showError('Please include the car year (e.g., 2024 Toyota Camry)');
            return false;
        }

        const carYear = parseInt(year[0]);
        if (carYear < 1900 || carYear > new Date().getFullYear() + 1) {
            this.showError(`Invalid year: ${carYear}. Please provide a year between 1900 and ${new Date().getFullYear() + 1}`);
            return false;
        }

        // Check if there's text besides the year
        const queryWithoutYear = query.replace(yearPattern, '').trim();
        if (!queryWithoutYear) {
            this.showError('Please include both car make and model (e.g., 2024 Toyota Camry)');
            return false;
        }

        // Split into make and model
        const parts = queryWithoutYear.split(' ');
        if (parts.length < 2) {
            this.showError('Please specify both make and model (e.g., 2024 Toyota Camry)');
            return false;
        }

        const make = parts[0].toLowerCase();
        const model = parts.slice(1).join(' ').toLowerCase();

        // Updated list of valid makes including specialty vehicles and their parent companies
        const validMakes = {
            'toyota': 'Toyota',
            'honda': 'Honda',
            'ford': 'Ford',
            'chevrolet': 'Chevrolet',
            'chevy': 'Chevrolet',
            'corvette': 'Chevrolet',
            'nissan': 'Nissan',
            'bmw': 'BMW',
            'mercedes': 'Mercedes-Benz',
            'mercedes-benz': 'Mercedes-Benz',
            'audi': 'Audi',
            'hyundai': 'Hyundai',
            'kia': 'Kia',
            'volkswagen': 'Volkswagen',
            'vw': 'Volkswagen',
            'subaru': 'Subaru',
            'mazda': 'Mazda',
            'lexus': 'Lexus',
            'acura': 'Acura',
            'infiniti': 'Infiniti',
            'porsche': 'Porsche',
            'tesla': 'Tesla',
            'jeep': 'Jeep',
            'ram': 'RAM',
            'gmc': 'GMC',
            'cadillac': 'Cadillac',
            'buick': 'Buick',
            'chrysler': 'Chrysler',
            'dodge': 'Dodge',
            'fiat': 'Fiat',
            'mini': 'MINI',
            'volvo': 'Volvo',
            'jaguar': 'Jaguar',
            'land rover': 'Land Rover',
            'mitsubishi': 'Mitsubishi',
            'lamborghini': 'Lamborghini',
            'ferrari': 'Ferrari',
            'maserati': 'Maserati',
            'bentley': 'Bentley',
            'rolls-royce': 'Rolls-Royce',
            'rolls royce': 'Rolls-Royce',
            'aston martin': 'Aston Martin',
            'mclaren': 'McLaren',
            'bugatti': 'Bugatti',
            'koenigsegg': 'Koenigsegg',
            'pagani': 'Pagani'
        };

        // Check if the make is valid
        const normalizedMake = make.toLowerCase();
        if (!validMakes[normalizedMake]) {
            // Try to find the closest match
            const findClosestMake = (input) => {
                const makeDistances = Object.keys(validMakes).map(validMake => ({
                    make: validMake,
                    distance: this.levenshteinDistance(input, validMake)
                }));
                return makeDistances.sort((a, b) => a.distance - b.distance)[0];
            };

            const closestMake = findClosestMake(normalizedMake);
            if (closestMake.distance > 3) {
                this.showError(`Please use a valid car make. Common examples: Toyota, Honda, Ford, BMW, Mercedes, Chevrolet, Corvette, Porsche`);
                return false;
            }
        }

        return true;
    }

    // Helper function to calculate Levenshtein distance for fuzzy matching
    levenshteinDistance(a, b) {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // deletion
                    matrix[j - 1][i] + 1, // insertion
                    matrix[j - 1][i - 1] + substitutionCost // substitution
                );
            }
        }

        return matrix[b.length][a.length];
    }

    showError(message) {
        const searchBox = document.querySelector('.search-box');
        
        // Remove existing error message if any
        const existingError = searchBox.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Create and add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        searchBox.appendChild(errorDiv);

        // Remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Helper to render car info as a nice table
    renderCarInfoTable(carInfoObj, carTitle = "Vehicle Information") {
        const container = document.createElement('div');
        container.className = 'info-table-container';

        const header = document.createElement('div');
        header.className = 'table-section-header';
        header.innerHTML = `<h3>${carTitle}</h3>`;
        container.appendChild(header);

        const table = document.createElement('table');
        table.className = 'info-table';

        // Add table header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.className = 'table-header';
        const thKey = document.createElement('th');
        thKey.className = 'table-header';
        thKey.textContent = 'Specification';
        const thValue = document.createElement('th');
        thValue.className = 'table-header';
        thValue.textContent = 'Details';
        headerRow.appendChild(thKey);
        headerRow.appendChild(thValue);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement('tbody');
        Object.entries(carInfoObj).forEach(([key, value]) => {
            const row = document.createElement('tr');
            row.className = 'table-row';

            const keyCell = document.createElement('td');
            keyCell.className = 'table-cell key';
            keyCell.textContent = key;

            const valueCell = document.createElement('td');
            valueCell.className = 'table-cell value';
            valueCell.textContent = value;

            row.appendChild(keyCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.appendChild(table);
        return container;
    }

    async getAIResponse(query) {
        try {
            // Add user message to conversation history
            this.addToConversationHistory('user', query);
            
            // Add user message to chat
            const userDiv = document.createElement('div');
            userDiv.className = 'message user-message';
            userDiv.textContent = query;
            this.chatMessages.appendChild(userDiv);
            
            // Add thinking message
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'message ai-message thinking';
            thinkingDiv.innerHTML = 'Thinking...<div class="thinking-indicator"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
            this.chatMessages.appendChild(thinkingDiv);
            
            // Scroll to bottom
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            
            // Enhanced network check with connection test
            if (!navigator.onLine) {
                // Try to retrieve cached response before showing error
                const cachedResponse = this.getCachedResponse(query);
                if (cachedResponse) {
                    // Remove thinking indicator
                    this.chatMessages.removeChild(thinkingDiv);
                    
                    // Show cached response with a notice
                    this.showCachedResponse(cachedResponse, query);
                    return;
                }
                throw new Error('Network error: You appear to be offline. Please check your internet connection and try again.');
            }
            
            // Additional connection test to verify actual connectivity
            try {
                const connectionTestPromise = fetch('https://openrouter.ai/api/v1/status', {
                    method: 'HEAD',
                    cache: 'no-cache',
                    signal: AbortSignal.timeout(5000) // 5 second timeout for connection test
                });
                
                // Set a timeout for the connection test
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Connection test timed out')), 5000);
                });
                
                // Race the connection test against the timeout
                await Promise.race([connectionTestPromise, timeoutPromise]);
            } catch (connectionError) {
                console.warn('Connection test failed:', connectionError);
                // Try to retrieve cached response before showing error
                const cachedResponse = this.getCachedResponse(query);
                if (cachedResponse) {
                    // Remove thinking indicator
                    this.chatMessages.removeChild(thinkingDiv);
                    
                    // Show cached response with a notice
                    this.showCachedResponse(cachedResponse, query);
                    return;
                }
                throw new Error('Network error: Connection to the server failed. Please check your internet connection and try again.');
            }

            // Check query type
            const isComparisonQuery = query.toLowerCase().includes('compare') || 
                                    query.toLowerCase().includes('vs') || 
                                    query.toLowerCase().includes('versus') ||
                                    query.toLowerCase().includes('between');

            let systemPrompt;
            if (isComparisonQuery) {
                // Extract both cars from the comparison query
                const cars = query.split(/vs|versus|compare|between/i)
                    .map(car => car.trim())
                    .filter(car => car && !car.toLowerCase().includes('compare'));

                if (cars.length !== 2) {
                    throw new Error('Please specify two cars to compare (e.g., "Compare 2024 Toyota Camry vs 2024 Honda Accord")');
                }

                systemPrompt = `You are a precise automotive comparison assistant. Compare these two vehicles in this exact format. Only include information that is confirmed and accurate. If you are unsure about any specification, omit it rather than providing incorrect information:\n\n## Vehicle Comparison\n\n### ${cars[0]}\nEngine: [engine type]\nHorsepower: [hp]\nTorque: [torque]\n0-60 MPH: [time]\nMPG City/Highway: [city/hwy]\nSafety Rating: [rating]\n\n### ${cars[1]}\nEngine: [engine type]\nHorsepower: [hp]\nTorque: [torque]\n0-60 MPH: [time]\nMPG City/Highway: [city/hwy]\nSafety Rating: [rating]\n\n## Key Differences\n- [Difference 1]\n- [Difference 2]\n- [Difference 3]\n\n## Which One to Choose?\n[Detailed recommendation based on different needs]`;
            } else {
                // General car information query - Focus on confirmed specifications
                systemPrompt = `You are a precise automotive information assistant. Provide detailed and accurate information about the ${query} in this exact format. Only include specifications that are confirmed and verified. If you are unsure about any detail, omit it rather than providing incorrect information. If the model did not exist in the specified year, provide information about when it was first introduced:

## Vehicle Information
Make: [make]
Model: [model]
Year: [year]
Body Style: [body style]
Seating Capacity: [number]

## Performance
Engine Type: [engine type]
Horsepower: [hp]
Torque: [torque]
Transmission: [transmission type]
Drivetrain: [drivetrain type]
Acceleration:
0-60 MPH: [time] seconds
0-100 MPH: [time] seconds
Top Speed: [speed]

## Fuel Economy
City: [mpg]
Highway: [mpg]
Combined: [mpg]
Fuel Tank Capacity: [capacity]
Range: [range]

## Dimensions
Length: [length]
Width: [width]
Height: [height]
Wheelbase: [wheelbase]
Curb Weight: [weight]

## Features
Safety Features: [List all safety features including:
- Anti-lock braking system (ABS)
- Electronic stability control (ESC)
- Traction control
- Forward collision warning
- Automatic emergency braking
- Lane departure warning
- Lane keeping assist
- Blind spot monitoring
- Rear cross-traffic alert
- Adaptive cruise control
- 360-degree camera system
- Parking sensors
- Driver attention monitoring
- Airbags (front, side, curtain, knee)
- Tire pressure monitoring
- Pre-collision safety system
- Emergency brake assist
- Hill start assist
- Auto high beam]

Technology Features: [List all technology features including:
- Infotainment screen size and type
- Navigation system
- Apple CarPlay/Android Auto
- Bluetooth connectivity
- Wi-Fi hotspot
- Wireless phone charging
- Head-up display
- Digital instrument cluster
- Premium audio system details
- Voice recognition
- Remote start
- Smartphone app integration
- USB ports and power outlets
- OTA (Over-the-air) updates
- Driver profiles
- Digital key
- Ambient lighting
- Connected car services]

Comfort Features: [List all comfort features including:
- Seat material and type
- Heated/ventilated seats
- Heated steering wheel
- Multi-zone climate control
- Power-adjustable seats
- Memory seat settings
- Lumbar support
- Massage function
- Panoramic sunroof
- Power liftgate/trunk
- Hands-free trunk access
- Keyless entry
- Push-button start
- Auto-dimming mirrors
- Power-folding mirrors
- Cabin air filtration
- Noise reduction features
- Storage solutions]

## Notes
- [Important note 1]
- [Important note 2]
- [Important note 3]

## Model History
- First introduced in: [year]
- [Additional historical information]`;
            }

            // Check if we're on a mobile device to adjust fetch settings
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Build messages array with conversation history
            const messages = [
                {
                    role: "system",
                    content: systemPrompt
                }
            ];
            
            // Add conversation history (excluding system messages)
            this.conversationHistory.forEach(msg => {
                if (msg.role !== 'system') {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
            
            // Create fetch options with appropriate settings
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'KarQuest'
                },
                body: JSON.stringify({
                    model: "google/gemini-pro",
                    messages: messages,
                    temperature: 0.3,
                    max_tokens: 2000
                }),
                // Add cache control and timeout settings for better mobile compatibility
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow',
                referrerPolicy: 'no-referrer',
                // Longer timeout for mobile connections
                signal: AbortSignal.timeout(30000) // 30 second timeout
            };
            
            // Enhanced retry logic with exponential backoff
            let retries = isMobile ? 4 : 2;
            let response;
            let lastError;
            
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    // Update thinking message to show retry attempt
                    if (attempt > 0) {
                        thinkingDiv.innerHTML = `Retrying (attempt ${attempt+1}/${retries})...<div class="thinking-indicator"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
                    }
                    
                    // Add connection timeout handling
                    const fetchPromise = fetch('https://openrouter.ai/api/v1/chat/completions', fetchOptions);
                    const timeoutDuration = 15000 * (attempt + 1); // Increase timeout with each retry
                    
                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Request timed out')), timeoutDuration);
                    });
                    
                    // Race the fetch against the timeout
                    response = await Promise.race([fetchPromise, timeoutPromise]);
                    
                    if (response.ok) break;
                    
                    // Handle specific error status codes
                    if (response.status === 429) {
                        // Rate limiting - wait longer before retry
                        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                    } else {
                        // Exponential backoff for other errors
                        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                    }
                    
                    lastError = new Error(`API error: ${response.status}`);
                } catch (fetchError) {
                    console.error(`Fetch error (attempt ${attempt+1}/${retries}):`, fetchError);
                    lastError = fetchError;
                    
                    // Exponential backoff between retries
                    if (attempt < retries - 1) {
                        const backoffTime = 1000 * Math.pow(2, attempt);
                        await new Promise(r => setTimeout(r, backoffTime));
                    }
                }
            }
            
            // If all retries failed, throw the last error
            if (!response || !response.ok) {
                throw lastError || new Error('Failed to connect to the server after multiple attempts');
            }

            if (!response.ok) {
                // Provide more detailed error messages based on status code
                let errorMessage = `API error: ${response.status}`;
                
                if (response.status === 0) {
                    errorMessage = "Network connection error. Please check your internet connection and try again.";
                } else if (response.status === 429) {
                    errorMessage = "Too many requests. Please try again in a few moments.";
                } else if (response.status >= 500) {
                    errorMessage = "Server error. Our service is currently experiencing issues. Please try again later.";
                } else if (response.status === 403) {
                    errorMessage = "Access denied. API key may be invalid or expired.";
                }
                
                throw new Error(errorMessage);
            }

            const responseData = await response.json();
            
            if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
                throw new Error('Invalid response format from API');
            }

            const aiResponse = responseData.choices[0].message.content;
            
            // Add AI response to conversation history
            this.addToConversationHistory('assistant', aiResponse);
            
            // Remove thinking indicator
            this.chatMessages.removeChild(thinkingDiv);
            
            // Create AI response message
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.className = 'message ai-message';
            aiMessageDiv.innerHTML = this.formatResponse(aiResponse);
            this.chatMessages.appendChild(aiMessageDiv);
            
            // Cache successful responses locally to help with mobile connectivity issues
            try {
                localStorage.setItem(`karquest_response_${query.substring(0, 50)}`, aiResponse);
            } catch (cacheError) {
                console.warn('Could not cache response:', cacheError);
            }

            // Scroll to bottom
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        catch (error) {
            console.error('Error:', error);
            
            // Remove thinking indicator
            const thinkingDiv = this.chatMessages.querySelector('.thinking');
            if (thinkingDiv) {
                this.chatMessages.removeChild(thinkingDiv);
            }
            
            // Try to retrieve cached response for this query
            const cachedResponse = this.getCachedResponse(query);
            
            if (cachedResponse) {
                // Show cached response with a notice
                this.showCachedResponse(cachedResponse, query);
            } else {
                // Show error message with retry button and more helpful information
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message ai-message error';
                errorDiv.innerHTML = `
                    <p>${error.message}</p>
                    <p class="error-help-text">This could be due to a temporary network issue or server unavailability.</p>
                    <button class="retry-button">Retry</button>
                `;
                this.chatMessages.appendChild(errorDiv);
                
                // Add event listener to retry button
                const retryButton = errorDiv.querySelector('.retry-button');
                if (retryButton) {
                    retryButton.addEventListener('click', () => {
                        // Remove error message
                        this.chatMessages.removeChild(errorDiv);
                        // Try again
                        this.getAIResponse(query);
                    });
                }
                
                // Add network status listener to automatically retry when connection is restored
                this.addNetworkStatusListener(query, errorDiv);
            }
            
            // Scroll to bottom
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    // Helper method to get cached response
    getCachedResponse(query) {
        let cachedResponse = null;
        try {
            cachedResponse = localStorage.getItem(`karquest_response_${query.substring(0, 50)}`);
        } catch (cacheError) {
            console.warn('Could not retrieve from cache:', cacheError);
        }
        return cachedResponse;
    }
    
    // Helper method to add network status listener
    addNetworkStatusListener(query, element) {
        // Generate a unique ID for this listener
        const listenerId = `network_listener_${Date.now()}`;
        
        // Create the listener function
        const listener = () => {
            if (navigator.onLine) {
                console.log('Connection restored, retrying query');
                // Remove the element from the chat
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                // Try the query again
                this.getAIResponse(query);
                // Remove this listener
                window.removeEventListener('online', this.networkListeners.get(listenerId));
                this.networkListeners.delete(listenerId);
            }
        };
        
        // Store the listener in our map
        this.networkListeners.set(listenerId, listener);
        
        // Add the listener
        window.addEventListener('online', listener);
        
        // Automatically clean up after 10 minutes to prevent memory leaks
        setTimeout(() => {
            if (this.networkListeners.has(listenerId)) {
                window.removeEventListener('online', this.networkListeners.get(listenerId));
                this.networkListeners.delete(listenerId);
            }
        }, 10 * 60 * 1000);
    }
    
    // Helper method to show connection status notifications
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addToConversationHistory(role, content) {
        this.conversationHistory.push({
            role: role,
            content: content,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10 messages to prevent token limit issues
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    showConnectionStatus(isOnline) {
        // Remove any existing status notifications
        const existingNotifications = document.querySelectorAll('.network-status-notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = `network-status-notification ${isOnline ? 'online' : 'offline'}`;
        notification.textContent = isOnline ? 'Connection restored! Retrying...' : 'Connection lost. Showing cached results when available.';
        
        // Check if we're on a mobile device to adjust notification position
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            notification.style.top = '70px';
            notification.style.maxWidth = '85%';
        }
        
        // Add to body
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 500);
            }
        }, 5000);
    }

    // Helper method to show cached response
    showCachedResponse(cachedResponse, query) {
        const cachedNotice = document.createElement('div');
        cachedNotice.className = 'cached-notice';
        cachedNotice.textContent = 'Showing cached result due to connection issues. Pull down to refresh for latest data.';
        this.chatMessages.appendChild(cachedNotice);
        
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message cached';
        aiMessageDiv.innerHTML = this.formatResponse(cachedResponse);
        this.chatMessages.appendChild(aiMessageDiv);
        
        // Add a retry button
        const retryContainer = document.createElement('div');
        retryContainer.className = 'retry-container';
        retryContainer.innerHTML = '<button class="retry-button">Try Again with Live Data</button>';
        this.chatMessages.appendChild(retryContainer);
        
        // Add event listener to retry button
        const retryButton = retryContainer.querySelector('.retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                // Remove cached notice, response and retry button
                this.chatMessages.removeChild(cachedNotice);
                this.chatMessages.removeChild(aiMessageDiv);
                this.chatMessages.removeChild(retryContainer);
                // Try again
                this.getAIResponse(query);
            });
        }
    }

    formatResponse(response) {
        // Split response into sections
        const sections = response.split(/(?=^##\s)/m);
        let html = '';

        // First, check if there's a Model History section and show it first
        const modelHistorySection = sections.find(section => section.trim().startsWith('## Model History'));
        if (modelHistorySection) {
            const historyItems = modelHistorySection.split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.replace('-', '').trim());
            if (historyItems.length > 0) {
                html += `
                    <div class="history-container">
                        <h3 class="section-header">Model History</h3>
                        <ul class="history-list">
                            ${historyItems.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }

        // Table mapping for emoji/label
        const sectionIcons = {
            'Performance & Engine': '🔧',
            'Driving Experience': '🏁',
            'Tech & Features': '🧰',
            'Styling': '🎨',
            'Notes': '📝',
            'Model History': '📜'
        };

        // Custom table rendering for car model summary
        const carModelSection = sections.find(section => section.match(/Performance & Engine|Driving Experience|Tech & Features|Styling/));
        if (carModelSection) {
            // Gather all relevant sections
            const keys = ['Performance & Engine', 'Driving Experience', 'Tech & Features', 'Styling'];
            let rows = [];
            keys.forEach(key => {
                const regex = new RegExp(`^${key}([\s\S]*?)(?=^\w|^$|^##|^\uD83C|^\uD83D|^\uD83E|^\uD83D)`, 'm');
                const match = response.match(new RegExp(`^${key}([\s\S]*?)(?=^\w|^$|^##|^🔧|^🏁|^🧰|^🎨|^📝|^📜)`, 'm'));
                if (match) {
                    let value = match[1].trim();
                    // Remove leading/trailing colons or dashes
                    value = value.replace(/^[:\-\s]+|[:\-\s]+$/g, '');
                    rows.push({
                        key: `${sectionIcons[key] || ''} ${key}`,
                        value: value.replace(/\n/g, '<br>')
                    });
                }
            });
            if (rows.length > 0) {
                html += `<div class="info-table-container"><div class="table-section-header"><h3>Car Model Summary</h3></div><table class="info-table"><tbody>${rows.map(row => `<tr class="table-row"><td class="table-cell key">${row.key}</td><td class="table-cell value">${row.value}</td></tr>`).join('')}</tbody></table></div>`;
            }
        }

        // Then process other sections as before
        sections.forEach(section => {
            if (!section.trim()) return;
            if (section.startsWith('## Model History')) return;
            if (section.startsWith('## Features')) return;
            if (section.startsWith('## Performance')) {
                // Handle Performance section with special formatting for acceleration times
                const lines = section.split('\n').filter(line => line.trim());
                html += `
                    <div class="info-section card-section">
                        <div class="table-section-header">
                            <h3>${section.replace(/##/g, '').trim()}</h3>
                        </div>
                        <div class="card-list">`;

                let isAccelerationSection = false;
                lines.forEach(line => {
                    if (line.trim() === 'Acceleration:') {
                        isAccelerationSection = true;
                        html += `
                            <div class="card-row">
                                <div class="card-key">Acceleration</div>
                                <div class="card-value">
                                    <div class="acceleration-table-wrapper">
                                        <table class="acceleration-table">
                                            <tbody>`;
                    } else if (isAccelerationSection && line.trim().startsWith('0-')) {
                        const [speed, time] = line.split(':').map(part => part.trim());
                        html += `
                                                <tr>
                                                    <td>${speed}</td>
                                                    <td>${time}</td>
                                                </tr>`;
                    } else if (isAccelerationSection && !line.trim().startsWith('0-')) {
                        isAccelerationSection = false;
                        html += `
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>`;
                    } else if (!isAccelerationSection && line.includes(':')) {
                        const [key, value] = line.split(':').map(part => part.trim());
                        html += `
                            <div class="card-row">
                                <div class="card-key">${key}</div>
                                <div class="card-value">${this.formatTableValue(value)}</div>
                            </div>`;
                    }
                });

                if (isAccelerationSection) {
                    html += `
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>`;
                }

                html += `
                        </div>
                    </div>`;
            } else if (section.startsWith('## Vehicle Comparison')) {
                // Responsive two-column comparison table for all devices
                const carSections = section.split(/(?=###\s+)/);
                if (carSections.length === 3) carSections.shift(); // Remove empty if split at start
                const carTitles = carSections.map(carSection => carSection.split('\n')[0].replace(/###/g, '').trim());
                // Collect all keys for both cars
                const carSpecs = carSections.map(carSection => {
                    const lines = carSection.split('\n').slice(1).filter(line => line.trim() && line.includes(':'));
                    const specs = {};
                    lines.forEach(line => {
                        const [key, value] = line.split(/:/).map(part => part.trim());
                        specs[key] = value;
                    });
                    return specs;
                });
                // Union of all keys
                const allKeys = Array.from(new Set([...Object.keys(carSpecs[0]), ...Object.keys(carSpecs[1])]))
                    .filter(key => key && key !== '');
                html += '<div class="comparison-table-container card-section">';
                html += '<div class="comparison-table-responsive">';
                html += '<table class="comparison-table">';
                html += '<thead><tr class="table-row">';
                html += '<th class="table-cell key"></th>';
                html += `<th class="table-cell value">${carTitles[0]}</th>`;
                html += `<th class="table-cell value">${carTitles[1]}</th>`;
                html += '</tr></thead><tbody>';
                allKeys.forEach(key => {
                    html += '<tr class="table-row">';
                    html += `<td class="table-cell key">${key}</td>`;
                    html += `<td class="table-cell value">${this.formatTableValue(carSpecs[0][key] || '-')}</td>`;
                    html += `<td class="table-cell value">${this.formatTableValue(carSpecs[1][key] || '-')}</td>`;
                    html += '</tr>';
                });
                html += '</tbody></table></div></div>';
            } else if (section.startsWith('## Key Differences')) {
                // Handle key differences as a list
                const differences = section
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.replace('-', '').trim());
                
                html += `
                    <div class="differences-container">
                        <h3>${section.replace(/##/g, '').trim()}</h3>
                        <ul class="differences-list">
                            ${differences.map(diff => `<li>${diff}</li>`).join('')}
                        </ul>
                    </div>`;
            } else if (section.startsWith('## Which One to Choose?')) {
                // Handle recommendation section as a table with improved parsing
                const lines = section.split('\n').slice(1).filter(line => line.trim());
                let seen = new Set();
                let rows = [];
                lines.forEach(line => {
                    let key = '', value = '';
                    // Try markdown bolded key
                    const boldMatch = line.match(/^\*\*(.*?)\*\*\s*(.*)/);
                    if (boldMatch) {
                        key = boldMatch[1].trim();
                        value = boldMatch[2].trim();
                    } else if (line.includes(':')) {
                        [key, value] = line.split(/:(.+)/).map(s => s.trim());
                    } else if (line.match(/^\*\s/)) {
                        // Markdown bullet point, treat as value only
                        key = '';
                        value = line.replace(/^\*\s*/, '').trim();
                    } else if (line.includes('. ')) {
                        [key, value] = line.split(/\.\s+(.+)/).map(s => s.trim());
                    } else {
                        key = '';
                        value = line.trim();
                    }
                    // Prevent empty or duplicate rows
                    if (value && !seen.has(value)) {
                        rows.push({ key, value });
                        seen.add(value);
                    }
                });
                // Remove rows that are just empty or whitespace
                rows = rows.filter(row => row.value && row.value.replace(/\s+/g, '').length > 0);
                html += `
                    <div class="info-table-container">
                        <div class="table-section-header">
                            <h3>Which One to Choose?</h3>
                        </div>
                        <table class="info-table">
                            <tbody>
                                ${rows.map(row => `<tr class="table-row">${row.key ? `<td class="table-cell key">${row.key}</td>` : '<td class="table-cell key"></td>'}<td class="table-cell value">${row.value}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>`;
            } else if (section.startsWith('## Notes')) {
                // Handle notes section
                const notes = section
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.replace('-', '').trim());
                
                if (notes.length > 0) {
                    html += `
                        <div class="notes-container">
                            <h3 class="section-header">Important Notes</h3>
                            <ul class="notes-list">
                                ${notes.map(note => `<li>${note}</li>`).join('')}
                            </ul>
                        </div>`;
                }
            } else {
                // Handle regular information sections as cards
                html += `
                    <div class="info-section card-section">
                        <div class="table-section-header">
                            <h3>${section.replace(/##/g, '').trim()}</h3>
                        </div>
                        <div class="card-list">`;
                // Special handling for feature sections
                if (section.includes('Features')) {
                    const featureLines = section.split('\n')
                        .filter(line => line.trim() && !line.startsWith('##'));
                    if (featureLines.length === 0) {
                        html += `
                            <div class="card-row">
                                <div class="card-value" style="width:100%">No features available</div>
                            </div>`;
                    } else {
                        featureLines.forEach(line => {
                            if (line.includes(':')) {
                                const [featureType, features] = line.split(':').map(part => part.trim());
                                const featureList = features.split(',').map(f => f.trim());
                                if (featureList.length === 0) {
                                    html += `
                                        <div class="card-row">
                                            <div class="card-value" style="width:100%">No ${featureType.toLowerCase()} available</div>
                                        </div>`;
                                } else {
                                    html += `
                                        <div class="card-row card-header-row">
                                            <div class="card-key" style="width:100%">${featureType}</div>
                                        </div>`;
                                    featureList.forEach(feature => {
                                        html += `
                                            <div class="card-row">
                                                <div class="card-value" style="width:100%">${feature}</div>
                                            </div>`;
                                    });
                                }
                            }
                        });
                    }
                } else {
                    // Regular card rows for other sections
                    const lines = section.split('\n')
                        .filter(line => line.trim() && !line.startsWith('##'));
                    if (lines.length === 0) {
                        html += `
                            <div class="card-row">
                                <div class="card-value" style="width:100%">No information available</div>
                            </div>`;
                    } else {
                        lines.forEach(line => {
                            if (line.includes(':')) {
                                const [key, value] = line.split(':').map(part => part.trim());
                                html += `
                                    <div class="card-row">
                                        <div class="card-key">${key}</div>
                                        <div class="card-value">${this.formatTableValue(value)}</div>
                                    </div>`;
                            }
                        });
                    }
                }
                html += `</div></div>`;
            }
        });

        // Now add the Features sections in table format
        const featuresSection = sections.find(section => section.trim().startsWith('## Features'));
        if (featuresSection) {
            html += `
                <div class="info-section">
                    <div class="table-section-header">
                        <h3>Features</h3>
                    </div>
                    <div class="comparison-table-responsive">
                        <table class="comparison-table">
                            <thead>
                                <tr class="table-row">
                                    <th class="table-cell key">Feature Type</th>
                                    <th class="table-cell value">Features</th>
                                </tr>
                            </thead>
                            <tbody>`;

            const featureTypes = ['Safety Features', 'Technology Features', 'Comfort Features'];
            featureTypes.forEach(featureType => {
                const featureRegex = new RegExp(`${featureType}:\\s*(.+)`, 'i');
                const match = featuresSection.match(featureRegex);
                if (match) {
                    html += `
                        <tr class="table-row feature-header">
                            <td class="table-cell key" colspan="2">${featureType}</td>
                        </tr>`;
                    const features = match[1].split(',').map(f => f.trim());
                    features.forEach((feature) => {
                        if (feature) {
                            html += `
                                <tr class="table-row">
                                    <td class="table-cell key">${featureType}</td>
                                    <td class="table-cell value">${feature}</td>
                                </tr>`;
                        }
                    });
                }
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
        }

        return html;
    }

    formatTableValue(value) {
        return value;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CarQuestApp();
});
