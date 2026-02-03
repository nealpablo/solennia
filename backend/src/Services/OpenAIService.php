<?php

namespace Src\Services;

class OpenAIService
{
    private $apiKey;
    private $baseUrl = 'https://api.openai.com/v1';
    private $model = 'gpt-3.5-turbo';

    public function __construct()
    {
        $this->apiKey = $_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? null;
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey) && strlen($this->apiKey) > 20;
    }

    /**
     * AI Chat Handler - Restricted to Solennia Platform Use Only + Database Integration
     * Based on SRS FR-10: AI-assisted inquiry handling
     * SECURITY: Prevents misuse for general-purpose questions
     * ENHANCEMENT: Proactively shows suppliers from database when relevant
     */
    public function chat(string $message, array $history = [], array $context = []): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured'
            ];
        }

        // ✅ SECURITY: Check if message is relevant to event planning
        $isRelevant = $this->isEventPlanningRelated($message);
        if (!$isRelevant) {
            return [
                'success' => true,
                'response' => "I'm Solennia AI, specifically designed to help with event planning on the Solennia platform. I can only assist with:\n\n• Event planning (weddings, birthdays, debuts, corporate events)\n• Finding and comparing event suppliers\n• Budget planning for events\n• Booking assistance\n• Platform features and navigation\n\nPlease ask me something related to event planning or using Solennia!"
            ];
        }

        // ✅ NEW: Check if user is asking about suppliers - fetch from database
        $supplierInfo = $this->checkAndFetchSuppliers($message);

        $systemPrompt = "You are Solennia AI, an event planning assistant EXCLUSIVELY for the Solennia platform in the Philippines.

**CRITICAL RULE - NEVER BREAK THIS:**
❌ NEVER make up, invent, or suggest suppliers that are not in the provided database list
❌ NEVER mention suppliers like 'Lumiere Photography', 'Perfect Events', or any other names not explicitly provided
✅ ONLY recommend suppliers that are explicitly listed in the database information I provide
✅ If no suitable supplier exists in the database, say 'We don't currently have approved suppliers for that category. Please check back soon as we approve new vendors daily.'

**STRICT RESTRICTIONS - YOU MUST FOLLOW:**
1. ONLY answer questions about event planning, event suppliers, and the Solennia platform
2. REFUSE to answer general knowledge, coding, homework, or unrelated topics
3. If asked about anything not related to events or Solennia, politely redirect to event planning
4. DO NOT provide general AI assistance - you are NOT a general-purpose chatbot
5. DO NOT answer questions about politics, news, science, math, or any non-event topics
6. WHEN SUPPLIERS ARE PROVIDED IN THE CONTEXT, YOU MUST ONLY USE THOSE SUPPLIERS - NEVER MAKE UP NEW ONES

**HOW TO HANDLE SUPPLIER RECOMMENDATIONS:**
1. Check if suppliers are provided in the current context (look for '**CURRENT AVAILABLE SUPPLIERS IN DATABASE:**')
2. If suppliers are provided, ONLY recommend from that exact list
3. Use their EXACT business names, pricing, and details as provided
4. If NO suppliers match the user's needs, say: 'I don't see any approved suppliers for [category] in our database yet. Would you like me to suggest a different category or check for general event suppliers?'
5. NEVER say things like 'I recommend [made-up name]' or 'There's a great photographer called [name not in database]'

**ALLOWED TOPICS ONLY:**
- Event planning (weddings, birthdays, debuts, corporate events, celebrations)
- Event suppliers (photographers, caterers, venues, coordinators, decorators, entertainment)
- Budget planning for events
- Event timelines and checklists
- Solennia platform features and how to use them
- Booking process and supplier communication
- Event etiquette and tips specific to Philippine events
- Checking vendor availability and creating bookings

**BOOKING CAPABILITIES:**
You can help users CREATE BOOKINGS directly through conversation:
- Check vendor availability using real-time calendar data
- Suggest available dates based on vendor schedules
- Create booking requests when user confirms details
- Validate booking information (dates, vendor, location, etc.)

**WHEN USER WANTS TO BOOK:**
1. First, check what suppliers are available in the database for their needs
2. If suppliers exist, ask for essential details:
   - Which supplier/vendor? (show ONLY suppliers from database)
   - What date and time?
   - What location?
   - What type of event?
   - Any package preference?
3. Check vendor availability for the requested date
4. If available, confirm all details with the user
5. Create the booking when user confirms

**IF USER ASKS OFF-TOPIC:**
Respond: \"I'm specifically designed to help with event planning on Solennia. I can't assist with [topic]. Would you like help planning an event or finding event suppliers instead?\"

**WHEN DISCUSSING SUPPLIERS:**
- ONLY mention suppliers that are explicitly provided in the database context
- Use their EXACT business names as they appear in the database
- Include their actual pricing, services, and contact details from the database
- Explain why each supplier is suitable for the user's needs
- Encourage users to check their portfolios and book directly on Solennia
- Offer to check their availability if user is interested
- If no suppliers match, be honest: 'We don't have approved suppliers for that yet'

**Your Communication Style:**
- Friendly, helpful, and professional
- Use Philippine Peso (₱) for all prices
- Keep responses under 250 words unless detail is needed
- Always bring conversation back to event planning or Solennia
- Suggest specific Solennia features when relevant
- Be proactive about helping users book suppliers
- Be HONEST when suppliers don't exist in the database

**Available Supplier Categories:**
- Photography & Videography
- Catering
- Venue
- Coordination & Hosting
- Decoration
- Entertainment
- Others

**Key Platform Features:**
- Browse categorized supplier portfolios
- Request bookings and communicate via chat
- View supplier pricing, services, and galleries
- Receive AI-powered recommendations
- Submit feedback and ratings
- AI-assisted booking creation (YOU CAN DO THIS!)

Always gather event details when helping users:
- Event type (wedding, birthday, corporate, etc.)
- Expected date and location
- Number of guests
- Budget range
- Specific requirements or preferences

**REMEMBER: ONLY use suppliers explicitly provided in the database context. NEVER invent supplier names!**";

        // ✅ Add supplier information to context if found
        if (!empty($supplierInfo)) {
            $systemPrompt .= "\n\n**CURRENT AVAILABLE SUPPLIERS IN DATABASE:**\n" . $supplierInfo;
            $systemPrompt .= "\n\n⚠️ CRITICAL: You MUST only recommend suppliers from the list above. These are the ONLY approved suppliers in Solennia. If you recommend ANY other supplier name (like 'Lumiere Photography', 'Perfect Events', etc.), you are making a serious error. When no supplier matches the user's needs, honestly say 'We don't have approved suppliers for that category yet.'";
        }

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        // Add conversation history
        foreach ($history as $msg) {
            if (isset($msg['role']) && isset($msg['content'])) {
                $messages[] = [
                    'role' => $msg['role'],
                    'content' => $msg['content']
                ];
            }
        }

        // Add current message
        $messages[] = ['role' => 'user', 'content' => $message];

        return $this->chatCompletion($messages, 1000); // Increased token limit for supplier details
    }
    
    /**
     * Validate AI response to prevent hallucinations
     * Checks if AI is recommending suppliers that don't exist in database
     */
    private function validateSupplierResponse(string $response, array $validSuppliers): array
    {
        // Get valid supplier names from database
        $validNames = [];
        foreach ($validSuppliers as $supplier) {
            $validNames[] = strtolower($supplier['BusinessName'] ?? '');
        }
        
        // Common hallucinated supplier names to block
        $bannedNames = [
            'lumiere', 'perfect events', 'dream wedding', 'elegant affairs',
            'golden moments', 'precious memories', 'creative vision',
            'artistry studio', 'classic photo', 'modern lens'
        ];
        
        $responseLower = strtolower($response);
        
        // Check for banned hallucinated names
        foreach ($bannedNames as $banned) {
            if (strpos($responseLower, $banned) !== false) {
                // Check if it's a valid supplier
                $isValid = false;
                foreach ($validNames as $valid) {
                    if (strpos($valid, $banned) !== false) {
                        $isValid = true;
                        break;
                    }
                }
                
                if (!$isValid) {
                    return [
                        'is_valid' => false,
                        'error' => 'hallucinated_supplier',
                        'banned_name' => $banned
                    ];
                }
            }
        }
        
        return ['is_valid' => true];
    }

    /**
     * Check if user is asking about suppliers and fetch relevant ones from database
     * This ensures AI always has access to real supplier data from both tables
     */
    private function checkAndFetchSuppliers(string $message): string
    {
        $message = strtolower($message);
        
        // Keywords that indicate user wants supplier information
        $supplierKeywords = [
            'supplier', 'vendor', 'photographer', 'videographer', 'caterer', 'catering',
            'venue', 'coordinator', 'host', 'emcee', 'decorator', 'decoration',
            'entertainment', 'band', 'dj', 'find', 'recommend', 'suggest', 'best',
            'good', 'available', 'wedding', 'birthday', 'debut', 'event'
        ];
        
        $needsSuppliers = false;
        foreach ($supplierKeywords as $keyword) {
            if (strpos($message, $keyword) !== false) {
                $needsSuppliers = true;
                break;
            }
        }
        
        if (!$needsSuppliers) {
            return '';
        }
        
        try {
            $allSuppliers = [];
            
            // Fetch approved event service providers
            $query = \Illuminate\Database\Capsule\Manager::table('event_service_provider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->select(
                    'esp.ID',
                    'esp.BusinessName',
                    'esp.Category',
                    'esp.Description',
                    'esp.Pricing',
                    'esp.BusinessAddress',
                    'esp.BusinessEmail',
                    'esp.services',
                    'esp.service_areas',
                    'esp.AverageRating',
                    'esp.TotalReviews',
                    \Illuminate\Database\Capsule\Manager::raw("'event_service_provider' as source_table")
                )
                ->where('esp.ApplicationStatus', '=', 'Approved')
                ->limit(10);
            
            // Fetch active venues from venue_listings
            $venueQuery = \Illuminate\Database\Capsule\Manager::table('venue_listings as v')
                ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
                ->select(
                    'v.id as ID',
                    'v.venue_name as BusinessName',
                    \Illuminate\Database\Capsule\Manager::raw("'Venue' as Category"),
                    'v.description as Description',
                    'v.pricing as Pricing',
                    'v.address as BusinessAddress',
                    'v.contact_email as BusinessEmail',
                    \Illuminate\Database\Capsule\Manager::raw("CONCAT('Capacity: ', v.venue_capacity, ', Amenities: ', COALESCE(v.venue_amenities, 'N/A')) as services"),
                    \Illuminate\Database\Capsule\Manager::raw("v.address as service_areas"),
                    \Illuminate\Database\Capsule\Manager::raw("NULL as AverageRating"),
                    \Illuminate\Database\Capsule\Manager::raw("0 as TotalReviews"),
                    \Illuminate\Database\Capsule\Manager::raw("'venue_listings' as source_table")
                )
                ->where('v.status', '=', 'Active')
                ->limit(5);
            
            // Try to detect specific category from message
            $categoryMap = [
                'photo' => 'Photography & Videography',
                'video' => 'Photography & Videography',
                'camera' => 'Photography & Videography',
                'food' => 'Catering',
                'cater' => 'Catering',
                'eat' => 'Catering',
                'venue' => 'Venue',
                'place' => 'Venue',
                'location' => 'Venue',
                'coordinate' => 'Coordination & Hosting',
                'host' => 'Coordination & Hosting',
                'emcee' => 'Coordination & Hosting',
                'decor' => 'Decoration',
                'flower' => 'Decoration',
                'entertain' => 'Entertainment',
                'music' => 'Entertainment',
                'band' => 'Entertainment',
                'dj' => 'Entertainment'
            ];
            
            $categoryDetected = null;
            foreach ($categoryMap as $keyword => $category) {
                if (strpos($message, $keyword) !== false) {
                    $categoryDetected = $category;
                    break;
                }
            }
            
            // Apply category filter for event service providers
            if ($categoryDetected && $categoryDetected !== 'Venue') {
                $query->where('esp.Category', '=', $categoryDetected);
            }
            
            // Get event service providers
            if (!$categoryDetected || $categoryDetected !== 'Venue') {
                $suppliers = $query->get()->toArray();
                $allSuppliers = array_merge($allSuppliers, json_decode(json_encode($suppliers), true));
            }
            
            // Get venues if asking about venues or no specific category
            if (!$categoryDetected || $categoryDetected === 'Venue') {
                $venues = $venueQuery->get()->toArray();
                $allSuppliers = array_merge($allSuppliers, json_decode(json_encode($venues), true));
            }
            
            if (empty($allSuppliers)) {
                return '';
            }
            
            // Format supplier information for AI with STRONG emphasis
            $supplierInfo = "\n**IMPORTANT: These are the ONLY approved suppliers in the Solennia database. DO NOT recommend any other suppliers.**\n\n";
            $supplierInfo .= "**TOTAL APPROVED SUPPLIERS: " . count($allSuppliers) . "**\n\n";
            
            foreach ($allSuppliers as $supplier) {
                $businessName = $supplier['BusinessName'] ?? 'Unknown';
                $category = $supplier['Category'] ?? 'Unknown';
                $address = $supplier['BusinessAddress'] ?? 'Not specified';
                $email = $supplier['BusinessEmail'] ?? 'Not provided';
                
                $supplierInfo .= "• **{$businessName}** ({$category}) [APPROVED SUPPLIER]\n";
                $supplierInfo .= "  - Location: {$address}\n";
                
                if (!empty($supplier['Description'])) {
                    $desc = substr($supplier['Description'], 0, 150);
                    $supplierInfo .= "  - Description: {$desc}...\n";
                }
                
                if (!empty($supplier['Pricing'])) {
                    $pricing = substr($supplier['Pricing'], 0, 200);
                    $supplierInfo .= "  - Pricing: {$pricing}...\n";
                }
                
                if (isset($supplier['AverageRating']) && $supplier['AverageRating'] > 0) {
                    $supplierInfo .= "  - Rating: {$supplier['AverageRating']}/5.0 ({$supplier['TotalReviews']} reviews)\n";
                }
                
                $supplierInfo .= "  - Contact: {$email}\n";
                $supplierInfo .= "\n";
            }
            
            $supplierInfo .= "\n**REMINDER: Only recommend suppliers from the list above. If a supplier is not listed, tell the user we don't have approved suppliers for that category yet.**\n";
            
            return $supplierInfo;
            
        } catch (\Exception $e) {
            error_log("Failed to fetch suppliers for AI: " . $e->getMessage());
            return '';
        }
    }

    /**
     * Check if user message is related to event planning
     * Prevents abuse of AI for general-purpose queries
     */
    private function isEventPlanningRelated(string $message): bool
    {
        $message = strtolower($message);
        
        // List of event-related keywords
        $eventKeywords = [
            // Event types
            'wedding', 'birthday', 'debut', 'party', 'event', 'celebration', 'corporate',
            'anniversary', 'christening', 'baptism', 'reception', 'gathering',
            
            // Event planning
            'plan', 'organize', 'book', 'reserve', 'schedule', 'arrange', 'coordinate',
            'budget', 'guest', 'venue', 'location', 'date', 'timeline', 'checklist',
            
            // Suppliers
            'photographer', 'videographer', 'caterer', 'catering', 'food', 'venue',
            'coordinator', 'host', 'emcee', 'decorator', 'decoration', 'flowers',
            'entertainment', 'band', 'dj', 'sound', 'lights', 'supplier', 'vendor',
            
            // Platform features
            'solennia', 'booking', 'portfolio', 'price', 'pricing', 'package',
            'recommendation', 'feedback', 'rating', 'review', 'message', 'chat',
            
            // Filipino event terms
            'kasalan', 'kasal', 'kaarawan', 'debut', 'despedida', 'reunion',
            
            // General event words
            'ceremony', 'program', 'invitation', 'theme', 'motif', 'setup'
        ];
        
        // Check if message contains any event-related keywords
        foreach ($eventKeywords as $keyword) {
            if (strpos($message, $keyword) !== false) {
                return true;
            }
        }
        
        // ✅ STRICT: Blocked topics - reject these immediately
        $blockedKeywords = [
            // Academic
            'homework', 'assignment', 'essay', 'thesis', 'research paper', 'exam', 'test',
            'solve', 'equation', 'formula', 'calculate', 'proof', 'theorem',
            
            // Coding
            'code', 'program', 'script', 'python', 'javascript', 'java', 'html', 'css',
            'debug', 'algorithm', 'function', 'class', 'variable', 'array',
            
            // General knowledge
            'history of', 'what is the capital', 'who invented', 'when was',
            'define', 'explain quantum', 'explain physics', 'explain chemistry',
            
            // News/Politics
            'president', 'election', 'government', 'politics', 'senate', 'congress',
            
            // Unrelated
            'translate', 'weather', 'stock', 'cryptocurrency', 'bitcoin',
            'medical advice', 'legal advice', 'tax', 'investment'
        ];
        
        foreach ($blockedKeywords as $blocked) {
            if (strpos($message, $blocked) !== false) {
                return false; // Explicitly blocked
            }
        }
        
        // ✅ Allow short greetings and platform questions
        $allowedPhrases = [
            'hello', 'hi', 'help', 'how', 'what', 'can you', 'please',
            'thank', 'thanks', 'ok', 'yes', 'no', 'maybe'
        ];
        
        // If message is very short (< 20 chars) and contains allowed phrase, permit it
        if (strlen($message) < 20) {
            foreach ($allowedPhrases as $phrase) {
                if (strpos($message, $phrase) !== false) {
                    return true;
                }
            }
        }
        
        // If we get here and message is longer than 30 chars without event keywords, reject
        if (strlen($message) > 30) {
            return false;
        }
        
        // Allow short messages that might be follow-up questions
        return true;
    }

    /**
     * Get Supplier Recommendations
     * Based on SRS FR-10: AI-assisted supplier recommendations
     * Uses actual database supplier data from event_service_provider table
     */
    public function getSupplierRecommendations(array $eventDetails, array $vendors): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured'
            ];
        }

        $systemPrompt = "You are an expert event planning consultant for the Philippines specializing in matching clients with the perfect event service providers.

Analyze the event requirements and available suppliers to provide intelligent recommendations.

**Evaluation Criteria:**
1. **Category Match** - Does the supplier's category fit the event needs?
2. **Budget Alignment** - Are their pricing packages within the client's budget?
3. **Service Quality** - Consider their description, services offered, and portfolio
4. **Location Compatibility** - Do they serve the event location?
5. **Experience & Specialization** - Do they specialize in this type of event?
6. **Value for Money** - Does their pricing match the services offered?

**Scoring Guidelines:**
- 90-100: Perfect match for all criteria
- 80-89: Excellent match with minor considerations
- 70-79: Good match, suitable for most requirements
- 60-69: Acceptable match with some trade-offs
- Below 60: Not recommended unless no better options

Return ONLY valid JSON with this exact structure:
{
    \"recommendations\": [
        {
            \"vendor_id\": <integer>,
            \"business_name\": \"<string>\",
            \"match_score\": <integer 0-100>,
            \"reasons\": [\"reason1\", \"reason2\", \"reason3\"],
            \"highlights\": \"Brief 1-2 sentence highlight\"
        }
    ],
    \"summary\": \"Brief 2-3 sentence summary\",
    \"tips\": [\"tip1\", \"tip2\", \"tip3\"]
}

Return your top 5 recommendations maximum, ranked by match_score.";

        // Format event details
        $eventType = $eventDetails['event_type'] ?? 'Not specified';
        $eventDate = $eventDetails['event_date'] ?? 'Not specified';
        $location = $eventDetails['location'] ?? 'Not specified';
        $budget = $eventDetails['budget'] ?? 'Not specified';
        $guests = $eventDetails['guests'] ?? 'Not specified';
        $category = $eventDetails['category'] ?? 'Any category';
        $requirements = $eventDetails['requirements'] ?? 'None specified';

        // Format vendor data using correct database schema
        $vendorList = array_map(function($v) {
            $isVenue = ($v['source_table'] ?? '') === 'venue_listings';
            
            return [
                'id' => $v['ID'] ?? $v['id'] ?? null,
                'business_name' => $v['BusinessName'] ?? $v['business_name'] ?? $v['venue_name'] ?? 'Unknown',
                'category' => $v['Category'] ?? $v['category'] ?? 'Unknown',
                'description' => $v['Description'] ?? $v['description'] ?? '',
                'pricing' => $v['Pricing'] ?? $v['pricing'] ?? '',
                'services' => $isVenue ? 
                    sprintf("Capacity: %s, Subcategory: %s, Operating Hours: %s, Parking: %s, Amenities: %s",
                        $v['venue_capacity'] ?? 'N/A',
                        $v['venue_subcategory'] ?? 'N/A',
                        $v['venue_operating_hours'] ?? 'N/A',
                        $v['venue_parking'] ?? 'N/A',
                        $v['venue_amenities'] ?? 'N/A'
                    ) : ($v['services'] ?? ''),
                'service_areas' => $v['service_areas'] ?? $v['BusinessAddress'] ?? '',
                'bio' => $v['bio'] ?? '',
                'average_rating' => $v['AverageRating'] ?? $v['average_rating'] ?? 0,
                'total_reviews' => $v['TotalReviews'] ?? $v['total_reviews'] ?? 0,
                'status' => $v['ApplicationStatus'] ?? $v['status'] ?? 'Pending',
                'source_table' => $v['source_table'] ?? 'event_service_provider'
            ];
        }, array_slice($vendors, 0, 20));

        $userMessage = "**Event Requirements:**
- Event Type: {$eventType}
- Event Date: {$eventDate}
- Location: {$location}
- Budget: ₱{$budget}
- Number of Guests: {$guests}
- Preferred Category: {$category}
- Special Requirements: {$requirements}

**Available Suppliers:**
" . json_encode($vendorList, JSON_PRETTY_PRINT);

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage]
        ];

        $response = $this->chatCompletion($messages, 1500, 0.5);

        if (!$response['success']) {
            return $response;
        }

        $parsed = $this->parseJsonResponse($response['response']);
        
        if ($parsed) {
            return [
                'success' => true,
                'recommendations' => $parsed['recommendations'] ?? [],
                'summary' => $parsed['summary'] ?? '',
                'tips' => $parsed['tips'] ?? []
            ];
        }

        return [
            'success' => true,
            'recommendations' => [],
            'summary' => 'We found suitable suppliers for your event. Please try refining your search criteria for better recommendations.',
            'tips' => [
                'Specify your exact budget range for more accurate pricing matches',
                'Mention specific services you need',
                'Consider booking suppliers 3-6 months in advance'
            ]
        ];
    }

    private function chatCompletion(array $messages, int $maxTokens = 800, float $temperature = 0.7): array
    {
        try {
            $ch = curl_init($this->baseUrl . '/chat/completions');
            
            $payload = [
                'model' => $this->model,
                'messages' => $messages,
                'max_tokens' => $maxTokens,
                'temperature' => $temperature
            ];

            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $this->apiKey
                ],
                CURLOPT_TIMEOUT => 30
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                error_log("OpenAI API Error: " . $error);
                return ['success' => false, 'error' => 'Connection error: ' . $error];
            }

            $data = json_decode($response, true);

            if ($httpCode !== 200) {
                $errorMsg = $data['error']['message'] ?? 'API error (HTTP ' . $httpCode . ')';
                error_log("OpenAI API HTTP Error {$httpCode}: " . $errorMsg);
                return ['success' => false, 'error' => $errorMsg];
            }

            $content = $data['choices'][0]['message']['content'] ?? '';

            return [
                'success' => true,
                'response' => $content
            ];

        } catch (\Exception $e) {
            error_log("OpenAI Exception: " . $e->getMessage());
            return ['success' => false, 'error' => 'Exception: ' . $e->getMessage()];
        }
    }

    private function parseJsonResponse(string $response): ?array
    {
        // Try direct parse
        $data = json_decode($response, true);
        if ($data !== null && json_last_error() === JSON_ERROR_NONE) {
            return $data;
        }

        // Try extracting from markdown code block
        if (preg_match('/```(?:json)?\s*([\s\S]*?)\s*```/', $response, $matches)) {
            $data = json_decode($matches[1], true);
            if ($data !== null && json_last_error() === JSON_ERROR_NONE) {
                return $data;
            }
        }

        error_log("Failed to parse JSON from OpenAI response: " . substr($response, 0, 200));
        
        return null;
        return null;
    }

    /**
     * Generate FAQs based on inquiry patterns
     * UC18: Generate FAQs
     */
    public function generateFAQs(array $inquiries, string $category = 'general'): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured'
            ];
        }

        $systemPrompt = "You are an FAQ generator for Solennia, an event booking platform in the Philippines.

Based on the provided user inquiries and questions, generate helpful FAQ entries.

**Guidelines:**
- Group similar questions together
- Write clear, concise answers
- Focus on event planning, vendor booking, and platform usage
- Use Philippine context (₱ for currency, local terms)
- Each FAQ should be practical and helpful
- Generate FAQs that would help first-time users understand the platform

Return ONLY valid JSON with this exact structure:
{
    \"faqs\": [
        {
            \"category\": \"Booking\" | \"Vendors\" | \"Payment\" | \"Account\" | \"Platform\" | \"Events\",
            \"question\": \"The FAQ question\",
            \"answer\": \"The helpful answer\",
            \"priority\": 1-10
        }
    ],
    \"summary\": \"Brief summary of FAQ themes\"
}

Generate 5-10 FAQs based on the patterns you identify.";

        $inquiryText = !empty($inquiries) 
            ? "User Inquiries to analyze:\n- " . implode("\n- ", array_slice($inquiries, 0, 50))
            : "Generate general FAQs about event planning and booking vendors in the Philippines on the Solennia platform. Include questions about: how to book vendors, how to browse services, how to communicate with vendors, booking process, cancellation policy, and general platform usage.";

        $userMessage = "Category focus: {$category}\n\n{$inquiryText}";

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage]
        ];

        $response = $this->chatCompletion($messages, 2000, 0.5);

        if (!$response['success']) {
            return $response;
        }

        $parsed = $this->parseJsonResponse($response['response']);
        
        if ($parsed) {
            return [
                'success' => true,
                'faqs' => $parsed['faqs'] ?? [],
                'summary' => $parsed['summary'] ?? ''
            ];
        }

        return [
            'success' => true,
            'faqs' => [],
            'summary' => 'Unable to parse FAQ response'
        ];
    }
}
