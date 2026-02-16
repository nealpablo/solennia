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
     * AI Chat Handler - STRICTLY for Solennia Booking & Recommendation ONLY
     * SECURITY: Rejects ALL non-booking/recommendation queries
     * ANTI-HALLUCINATION: Only uses verified database suppliers
     */
    public function chat(string $message, array $history = [], array $context = []): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured'
            ];
        }

        // STRICT SECURITY: Check if message is relevant to booking/recommendation
        $isRelevant = $this->isBookingOrRecommendationRelated($message);
        if (!$isRelevant) {
            return [
                'success' => true,
                'response' => "I am the Solennia Booking Assistant. I can only help you with the following:\n\n- Finding and recommending event vendors and venues registered on Solennia\n- Booking event services through the Solennia platform\n- Checking vendor availability and pricing\n\nI am unable to assist with topics outside of booking and vendor recommendations. Please ask me about finding a vendor or making a booking."
            ];
        }

        // Fetch relevant suppliers from database
        $supplierInfo = $this->checkAndFetchSuppliers($message);

        $currentDate = date('Y-m-d');
        $currentYear = date('Y');

        $systemPrompt = "You are the Solennia Booking Assistant. You exist for ONE purpose only: to help users FIND, RECOMMEND, and BOOK event vendors and venues that are registered on the Solennia platform.

ABSOLUTE RULES YOU MUST NEVER BREAK:

1. PURPOSE RESTRICTION:
   - You ONLY assist with booking event services and recommending vendors/venues from the Solennia database.
   - You do NOT answer general knowledge questions, give opinions on non-booking topics, or engage in casual conversation beyond what is needed to complete a booking.
   - If a user asks anything unrelated to booking or vendor recommendations, respond: 'I can only assist with finding vendors and making bookings on Solennia. How can I help you with your event booking?'

2. ANTI-HALLUCINATION - VENDOR DATA:
   - NEVER invent, fabricate, or suggest any vendor or venue name that is not explicitly provided in the database context below.
   - If no vendors match the user's request, say: 'There are no matching vendors in the Solennia system for that criteria. You may want to adjust your search or check back later as new vendors are added regularly.'
   - NEVER say things like 'You could try...' or 'Popular options include...' unless those vendors are in the provided database list.

3. DATE VALIDATION:
   - Today's date is {$currentDate}. The current year is {$currentYear}.
   - NEVER accept or suggest a date that is in the past. If a user provides a past date, tell them: 'That date has already passed. Please provide a future date for your event.'
   - If a user provides a month and day without a year, assume {$currentYear}. If that month has already passed, assume the next year.

4. NO EMOJIS:
   - Do NOT use any emojis in your responses. No exceptions.

5. RESPONSE STYLE:
   - Be professional, concise, and direct.
   - Use Philippine Peso (P) for all pricing.
   - Keep responses under 200 words unless presenting vendor options.
   - Do not add unnecessary filler or pleasantries. Be helpful but efficient.
   - Do not speculate or guess. If you do not have the information, say so clearly.

6. WHEN RECOMMENDING VENDORS:
   - ONLY list vendors from the database context provided below.
   - Use their EXACT business names, pricing, and details as provided.
   - If no matching vendors exist, state that clearly. Do not fabricate alternatives.

7. WHEN HELPING WITH BOOKINGS:
   - Gather these details: event type, date (must be future), time, location, budget, number of guests.
   - Only suggest vendors that are in the Solennia database.
   - Confirm all details before proceeding with a booking.

AVAILABLE VENDOR CATEGORIES:
- Photography & Videography
- Catering
- Venue
- Coordination & Hosting
- Decoration
- Entertainment
- Others";

        // Add supplier information to context if found
        if (!empty($supplierInfo)) {
            $systemPrompt .= "\n\nVERIFIED SOLENNIA DATABASE VENDORS:\n" . $supplierInfo;
            $systemPrompt .= "\n\nCRITICAL: The vendors listed above are the ONLY vendors you may recommend. Any vendor name not in this list is fabricated and must NOT be mentioned.";
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

        // Temperature 0.2 for deterministic, factual responses
        return $this->chatCompletion($messages, 1000, 0.2);
    }

    /**
     * ========================================
     * CONVERSATIONAL BOOKING WITH FUNCTION CALLING
     * ========================================
     */

    /**
     * Enhanced chat with function calling for conversational booking
     * Uses low temperature (0.2) to prevent hallucinations
     */
    public function chatWithFunctions(
        string $message,
        array $history = [],
        string $systemPrompt = null,
        array $functions = []
        ): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured'
            ];
        }

        // Build messages array
        $messages = [];

        if ($systemPrompt) {
            $messages[] = ['role' => 'system', 'content' => $systemPrompt];
        }

        // Add conversation history
        foreach ($history as $msg) {
            if (isset($msg['role'])) {
                $historyMessage = ['role' => $msg['role']];

                if (array_key_exists('content', $msg)) {
                    $historyMessage['content'] = $msg['content'];
                }

                if (isset($msg['name'])) {
                    $historyMessage['name'] = $msg['name'];
                }

                if (isset($msg['function_call'])) {
                    $historyMessage['function_call'] = $msg['function_call'];
                }

                $messages[] = $historyMessage;
            }
        }

        // Add current message only if not empty
        if (!empty($message)) {
            $messages[] = ['role' => 'user', 'content' => $message];
        }

        try {
            $ch = curl_init($this->baseUrl . '/chat/completions');

            $payload = [
                'model' => 'gpt-3.5-turbo',
                'messages' => $messages,
                'max_tokens' => 1000,
                'temperature' => 0.2 // LOW temperature to prevent hallucinations
            ];

            // Add functions if provided
            if (!empty($functions)) {
                $payload['functions'] = $functions;
                $payload['function_call'] = 'auto';
            }

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
                error_log("OpenAI Function Call Error: " . $error);
                return ['success' => false, 'error' => 'Connection error: ' . $error];
            }

            $data = json_decode($response, true);

            if ($httpCode !== 200) {
                $errorMsg = $data['error']['message'] ?? 'API error (HTTP ' . $httpCode . ')';
                error_log("OpenAI Function Call HTTP Error {$httpCode}: " . $errorMsg);
                return ['success' => false, 'error' => $errorMsg];
            }

            $responseMessage = $data['choices'][0]['message'] ?? null;

            if (!$responseMessage) {
                return ['success' => false, 'error' => 'Invalid response structure'];
            }

            $result = [
                'success' => true,
                'response' => $responseMessage['content'] ?? '',
            ];

            // Include function call if present
            if (isset($responseMessage['function_call'])) {
                $result['function_call'] = [
                    'name' => $responseMessage['function_call']['name'],
                    'arguments' => $responseMessage['function_call']['arguments']
                ];
            }

            return $result;

        }
        catch (\Exception $e) {
            error_log("OpenAI Function Call Exception: " . $e->getMessage());
            return ['success' => false, 'error' => 'Exception: ' . $e->getMessage()];
        }
    }

    /**
     * Check if user message is related to BOOKING or RECOMMENDATION only
     * Much stricter than before - rejects anything not about booking/vendors
     */
    private function isBookingOrRecommendationRelated(string $message): bool
    {
        $message = strtolower(trim($message));

        // BLOCKED TOPICS - reject these immediately regardless of anything else
        $blockedKeywords = [
            // Academic
            'homework', 'assignment', 'essay', 'thesis', 'research paper', 'exam', 'test',
            'solve', 'equation', 'formula', 'calculate', 'proof', 'theorem', 'study',
            // Coding
            'code', 'program', 'script', 'python', 'javascript', 'java', 'html', 'css',
            'debug', 'algorithm', 'function', 'class', 'variable', 'array', 'database',
            'sql', 'api', 'framework', 'react', 'node',
            // General knowledge
            'history of', 'what is the capital', 'who invented', 'who is', 'who was',
            'define', 'explain quantum', 'explain physics', 'explain chemistry',
            'what does', 'how does', 'why does', 'meaning of',
            // News/Politics
            'president', 'election', 'government', 'politics', 'senate', 'congress',
            'war', 'conflict', 'law', 'legislation',
            // Unrelated
            'translate', 'weather', 'stock', 'cryptocurrency', 'bitcoin', 'recipe',
            'medical advice', 'legal advice', 'tax', 'investment', 'crypto',
            'movie', 'game', 'sport', 'score', 'play',
            'joke', 'story', 'poem', 'song', 'lyrics',
            'religion', 'god', 'bible', 'quran',
            'diet', 'workout', 'exercise', 'health',
            'travel tips', 'tourist', 'vacation',
            // AI/Tech
            'chatgpt', 'openai', 'artificial intelligence', 'machine learning',
            'write me', 'tell me a', 'can you write', 'generate a',
        ];

        foreach ($blockedKeywords as $blocked) {
            if (strpos($message, $blocked) !== false) {
                return false;
            }
        }

        // ALLOWED: Booking and recommendation keywords
        $bookingKeywords = [
            // Event types
            'wedding', 'birthday', 'debut', 'party', 'event', 'celebration', 'corporate',
            'anniversary', 'christening', 'baptism', 'reception', 'gathering', 'seminar',
            'conference', 'summit',
            // Booking actions
            'book', 'reserve', 'schedule', 'arrange', 'booking',
            // Recommendation actions
            'recommend', 'suggest', 'find', 'search', 'look for', 'looking for',
            'show me', 'available', 'options', 'choices',
            // Vendor types
            'supplier', 'vendor', 'photographer', 'videographer', 'caterer', 'catering',
            'venue', 'coordinator', 'host', 'emcee', 'decorator', 'decoration',
            'entertainment', 'band', 'dj', 'florist', 'flowers',
            // Booking details
            'budget', 'guest', 'location', 'date', 'time', 'price', 'pricing',
            'package', 'service', 'availability',
            // Platform
            'solennia',
            // Filipino event terms
            'kasalan', 'kasal', 'kaarawan', 'despedida', 'reunion',
            // Confirmation words (for booking flow)
            'yes', 'confirm', 'proceed', 'go ahead', 'book it', 'confirmed',
        ];

        foreach ($bookingKeywords as $keyword) {
            if (strpos($message, $keyword) !== false) {
                return true;
            }
        }

        // Allow very short messages that are likely follow-ups in booking conversation
        if (strlen($message) < 15) {
            $followUpPhrases = [
                'ok', 'sure', 'yes', 'no', 'maybe', 'thanks', 'thank you',
                'hello', 'hi', 'help', 'how much', 'when', 'where',
            ];

            foreach ($followUpPhrases as $phrase) {
                if (strpos($message, $phrase) !== false) {
                    return true;
                }
            }
        }

        // If message is longer than 25 chars without any booking keywords, reject
        if (strlen($message) > 25) {
            return false;
        }

        // Short ambiguous messages - allow as they may be follow-ups
        return true;
    }

    /**
     * Check if user is asking about suppliers and fetch relevant ones from database
     * Only returns VERIFIED suppliers from the Solennia database
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

            // Format supplier information - NO emojis
            $supplierInfo = "\nIMPORTANT: These are the ONLY approved vendors in the Solennia database. Do NOT recommend any other vendors.\n\n";
            $supplierInfo .= "TOTAL APPROVED VENDORS: " . count($allSuppliers) . "\n\n";

            foreach ($allSuppliers as $supplier) {
                $businessName = $supplier['BusinessName'] ?? 'Unknown';
                $category = $supplier['Category'] ?? 'Unknown';
                $address = $supplier['BusinessAddress'] ?? 'Not specified';
                $email = $supplier['BusinessEmail'] ?? 'Not provided';

                $supplierInfo .= "- {$businessName} ({$category}) [VERIFIED]\n";
                $supplierInfo .= "  Location: {$address}\n";

                if (!empty($supplier['Description'])) {
                    $desc = substr($supplier['Description'], 0, 150);
                    $supplierInfo .= "  Description: {$desc}...\n";
                }

                if (!empty($supplier['Pricing'])) {
                    $pricing = substr($supplier['Pricing'], 0, 200);
                    $supplierInfo .= "  Pricing: {$pricing}...\n";
                }

                if (isset($supplier['AverageRating']) && $supplier['AverageRating'] > 0) {
                    $supplierInfo .= "  Rating: {$supplier['AverageRating']}/5.0 ({$supplier['TotalReviews']} reviews)\n";
                }

                $supplierInfo .= "  Contact: {$email}\n";
                $supplierInfo .= "\n";
            }

            $supplierInfo .= "\nREMINDER: Only recommend vendors from the list above. If a vendor is not listed, tell the user there are no matching vendors in the Solennia system.\n";

            return $supplierInfo;

        }
        catch (\Exception $e) {
            error_log("Failed to fetch suppliers for AI: " . $e->getMessage());
            return '';
        }
    }

    /**
     * Get Supplier Recommendations
     * Uses ONLY actual database supplier data - zero hallucination
     */
    public function getSupplierRecommendations(array $eventDetails, array $vendors): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured'
            ];
        }

        $systemPrompt = "You are a vendor matching engine for the Solennia event platform. Your ONLY job is to rank the provided vendors based on how well they match the event requirements.

STRICT RULES:
- ONLY use the vendors provided in the data below. NEVER invent vendor names.
- Do NOT use emojis.
- Be factual and concise.
- If no vendor is a good match, say so clearly.

Evaluation Criteria:
1. Category Match - Does the vendor's category fit the event needs?
2. Budget Alignment - Are their pricing packages within the client's budget?
3. Service Quality - Consider their description and services offered
4. Location Compatibility - Do they serve the event location?

Scoring:
- 90-100: Perfect match
- 80-89: Excellent match
- 70-79: Good match
- 60-69: Acceptable match
- Below 60: Not recommended

Return ONLY valid JSON with this structure:
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

Return top 5 recommendations maximum, ranked by match_score.";

        // Format event details
        $eventType = $eventDetails['event_type'] ?? 'Not specified';
        $eventDate = $eventDetails['event_date'] ?? 'Not specified';
        $location = $eventDetails['location'] ?? 'Not specified';
        $budget = $eventDetails['budget'] ?? 'Not specified';
        $guests = $eventDetails['guests'] ?? 'Not specified';
        $category = $eventDetails['category'] ?? 'Any category';
        $requirements = $eventDetails['requirements'] ?? 'None specified';

        // Format vendor data
        $vendorList = array_map(function ($v) {
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

        $userMessage = "Event Requirements:
- Event Type: {$eventType}
- Event Date: {$eventDate}
- Location: {$location}
- Budget: P{$budget}
- Number of Guests: {$guests}
- Preferred Category: {$category}
- Special Requirements: {$requirements}

Available Vendors:
" . json_encode($vendorList, JSON_PRETTY_PRINT);

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage]
        ];

        // Temperature 0.2 for factual, deterministic output
        $response = $this->chatCompletion($messages, 1500, 0.2);

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

    private function chatCompletion(array $messages, int $maxTokens = 800, float $temperature = 0.2): array
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

        }
        catch (\Exception $e) {
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
    }
}
