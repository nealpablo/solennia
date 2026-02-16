<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Services\OpenAIService;
use Illuminate\Database\Capsule\Manager as DB;

class AIController
{
    private $openAI;

    public function __construct()
    {
        $this->openAI = new OpenAIService();
    }

    /**
     * Regular AI Chat (existing feature - for general Q&A)
     */
    public function chat(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            $userId = $user->mysql_id ?? $user->sub ?? null;

            if ($userId && !$this->checkRateLimit($userId)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Rate limit exceeded. Please wait before sending more messages.'
                ], 429);
            }

            $data = $request->getParsedBody();
            $message = $data['message'] ?? '';
            $history = $data['history'] ?? [];
            $context = $data['context'] ?? [];

            if (empty($message)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Message is required'
                ], 400);
            }

            if (strlen($message) > 1000) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Message is too long. Please keep messages under 1000 characters.'
                ], 400);
            }

            $result = $this->openAI->chat($message, $history, $context);

            if (!$result['success']) {
                return $this->jsonResponse($response, $result, 503);
            }

            if ($userId) {
                $this->recordRequest($userId);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'response' => $result['response']
            ]);

        }
        catch (\Exception $e) {
            error_log("AI Chat Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Server error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Main conversational booking endpoint
     * Handles natural language booking through AI with function calling
     */
    public function conversationalBooking(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            $userId = $user->mysql_id ?? $user->sub ?? null;

            if ($userId && !$this->checkRateLimit($userId)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Rate limit exceeded. Please wait before continuing.'
                ], 429);
            }

            $data = $request->getParsedBody();
            $message = $data['message'] ?? '';
            $currentData = $data['currentData'] ?? [];
            $stage = $data['stage'] ?? 'discovery';
            $history = $data['history'] ?? [];

            if (empty($message)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Message is required'
                ], 400);
            }

            $systemPrompt = $this->getConversationalBookingPrompt($currentData, $stage);
            $functions = $this->getBookingFunctions();

            // Initialize loop variables
            $loopCount = 0;
            $maxLoops = 5;
            $aiResponse = '';
            $extractedInfo = []; // Initialize here to be available outside the loop
            $suggestedVendors = []; // Initialize here
            $bookingCreated = false; // Initialize here
            $bookingId = null; // Initialize here
            $newStage = $stage; // Initialize here

            // Initial AI call
            $result = $this->openAI->chatWithFunctions(
                $message,
                $history,
                $systemPrompt,
                $functions
            );

            // Loop to handle function chaining (e.g. Extract -> Search -> Respond)
            while ($loopCount < $maxLoops) {
                if (!$result['success']) {
                    return $this->jsonResponse($response, $result, 503);
                }

                // Capture proper text response if available
                if (!empty($result['response'])) {
                    $aiResponse = $result['response'];
                }

                // If no function call, we are done
                if (!isset($result['function_call'])) {
                    break;
                }

                // Process function call
                $functionName = $result['function_call']['name'];
                $arguments = json_decode($result['function_call']['arguments'], true);

                if ($arguments === null && json_last_error() !== JSON_ERROR_NONE) {
                    error_log("OpenAI Function Call JSON Error: " . json_last_error_msg());
                    error_log("Raw Arguments: " . $result['function_call']['arguments']);
                    // Attempt to sanitize or skip, but for now break to avoid crash
                    break;
                }

                $functionResult = null;

                switch ($functionName) {
                    case 'extract_booking_info':
                        $extractedInfo = $this->processExtractedInfo($arguments, $currentData);
                        // Update current data so subsequent steps have latest info
                        $currentData = $extractedInfo;
                        $newStage = $this->determineBookingStage($extractedInfo);

                        // ⚠️ CRITICAL: Regenerate System Prompt with updated data
                        // This ensures the AI sees the NEW date/location immediately in the next turn
                        $systemPrompt = $this->getConversationalBookingPrompt($currentData, $newStage);

                        $functionResult = [
                            'status' => 'success',
                            'extracted' => $extractedInfo,
                            'stage' => $newStage
                        ];
                        break;

                    case 'search_vendors':
                        // SAFETY NET: Capturing data used in search
                        $implicitInfo = [];
                        if (!empty($arguments['location']))
                            $implicitInfo['location'] = $arguments['location'];
                        if (!empty($arguments['budget_max']))
                            $implicitInfo['budget'] = $arguments['budget_max'];

                        if (!empty($implicitInfo)) {
                            $extractedInfo = array_merge($extractedInfo, $implicitInfo);
                            $currentData = array_merge($currentData, $implicitInfo);
                            // Update prompt so AI knows we captured this
                            $systemPrompt = $this->getConversationalBookingPrompt($currentData, $newStage);
                        }

                        $suggestedVendors = $this->searchVendorsForBooking($arguments);
                        $functionResult = [
                            'status' => 'success',
                            'vendors' => $suggestedVendors,
                            'count' => count($suggestedVendors)
                        ];
                        break;

                    case 'check_availability':
                        if (!empty($arguments['date'])) {
                            $extractedInfo['date'] = $arguments['date'];
                            $currentData['date'] = $arguments['date'];
                        }

                        $venueId = $arguments['venue_id'] ?? null;
                        $vendorId = $arguments['vendor_id'] ?? null;

                        // PERSIST ID: If AI passed an ID, remember it in the state
                        if ($venueId) {
                            $extractedInfo['venue_id'] = (int)$venueId;
                            $currentData['venue_id'] = (int)$venueId;
                        }
                        if ($vendorId) {
                            $extractedInfo['vendor_id'] = (int)$vendorId;
                            $currentData['vendor_id'] = (int)$vendorId;
                        }

                        // Regenerate system prompt with updated ID/date
                        $systemPrompt = $this->getConversationalBookingPrompt($currentData, $newStage);

                        $availability = $venueId
                            ? $this->checkVenueAvailabilityForDate((int)$venueId, $arguments['date'])
                            : ($vendorId ? $this->checkVendorAvailabilityForDate((int)$vendorId, $arguments['date']) : ['available' => false, 'reason' => 'No vendor_id or venue_id provided']);

                        $extractedInfo['availability_checked'] = $availability;
                        $functionResult = ['status' => 'success', 'availability' => $availability];
                        break;

                    case 'create_booking':
                        // Get venue_id or vendor_id to determine booking type
                        $venueId = $arguments['venue_id'] ?? null;
                        $vendorId = $arguments['vendor_id'] ?? null;

                        // PERSIST ID: If AI passed an ID, remember it in the state
                        if ($venueId) {
                            $extractedInfo['venue_id'] = (int)$venueId;
                            $currentData['venue_id'] = (int)$venueId;
                        }
                        if ($vendorId) {
                            $extractedInfo['vendor_id'] = (int)$vendorId;
                            $currentData['vendor_id'] = (int)$vendorId;
                        }

                        $isVenueBooking = !empty($venueId);

                        // Validation: Ensure we have required fields
                        $missingFields = [];
                        if (empty($currentData['date']))
                            $missingFields[] = 'Date';
                        if (empty($currentData['time']))
                            $missingFields[] = 'Time';
                        // Location only required for supplier bookings, not venues
                        if (!$isVenueBooking && empty($currentData['location']))
                            $missingFields[] = 'Location';
                        if (empty($currentData['event_type']))
                            $missingFields[] = 'Event Type';
                        if (empty($currentData['budget']))
                            $missingFields[] = 'Budget';
                        if (empty($currentData['guests']))
                            $missingFields[] = 'Number of Guests';

                        if (!empty($missingFields)) {
                            $functionResult = [
                                'status' => 'error',
                                'message' => 'Cannot create booking. Missing information: ' . implode(', ', $missingFields) . '. Please ask user for these details.'
                            ];
                        }
                        else if ($arguments['confirmed']) {
                            // Merge everything we have
                            $bookingData = array_merge($currentData, $extractedInfo);

                            // Ensure the specific ID from arguments is in the booking data
                            if ($venueId)
                                $bookingData['venue_id'] = (int)$venueId;
                            if ($vendorId)
                                $bookingData['vendor_id'] = (int)$vendorId;

                            $bookingId = $venueId
                                ? $this->createVenueBookingFromConversation($bookingData, (int)$venueId, $userId)
                                : ($vendorId ? $this->createBookingFromConversation($bookingData, (int)$vendorId, $userId) : null);

                            if ($bookingId) {
                                $bookingCreated = true;
                                $newStage = 'completed';
                                $functionResult = [
                                    'status' => 'success',
                                    'booking_id' => $bookingId,
                                    'message' => 'Booking created successfully'
                                ];
                            }
                            else {
                                $functionResult = [
                                    'status' => 'error',
                                    'message' => 'Failed to create booking in database.'
                                ];
                            }
                        }
                        else {
                            $functionResult = ['status' => 'cancelled', 'message' => 'User did not confirm.'];
                        }
                        break;
                }

                // Prepare history for next turn
                // If this is the first loop, we need to add the user message to history
                // (Subsequent loops operate on the accumulated history)
                if ($loopCount === 0) {
                    $history[] = ['role' => 'user', 'content' => $message];
                }

                // Add assistant's function call
                $history[] = [
                    'role' => 'assistant',
                    'content' => null,
                    'function_call' => [
                        'name' => $functionName,
                        'arguments' => json_encode($arguments)
                    ]
                ];

                // Add function result
                $history[] = [
                    'role' => 'function',
                    'name' => $functionName,
                    'content' => json_encode($functionResult)
                ];

                // Get next response from AI
                $result = $this->openAI->chatWithFunctions(
                    '', // Empty message as we're continuing conversation
                    $history,
                    $systemPrompt,
                    $functions
                );

                $loopCount++;
            }

            if ($userId) {
                $this->recordRequest($userId);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'aiResponse' => $aiResponse,
                'extractedInfo' => $extractedInfo,
                'stage' => $newStage,
                'suggestedVendors' => $suggestedVendors,
                'bookingCreated' => $bookingCreated,
                'bookingId' => $bookingId
            ]);

        }
        catch (\Throwable $e) {
            error_log("Conversational Booking Error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to process booking conversation'
            ], 500);
        }
    }

    private function getConversationalBookingPrompt(array $currentData, string $stage): string
    {
        $extractedDataJson = json_encode($currentData, JSON_PRETTY_PRINT);
        $currentDate = date('Y-m-d');
        $currentYear = date('Y');

        $basePrompt = "You are the Solennia Booking Assistant. Your SOLE purpose is to help users find, recommend, and book event vendors and venues registered on the Solennia platform.

CURRENT DATE: {$currentDate}
CURRENT YEAR: {$currentYear}

CURRENT BOOKING DATA:
{$extractedDataJson}

CURRENT STAGE: {$stage}

STAGES:
- discovery: Gathering event details from user
- vendor_search: Searching and presenting vendor options
- confirmation: Confirming final details before booking
- completed: Booking successfully created

ABSOLUTE RULES - NEVER BREAK THESE:

1. PURPOSE: You ONLY handle booking and vendor/venue recommendation. If user asks anything unrelated (general questions, coding, homework, trivia, opinions, etc.), respond: 'I can only assist with finding vendors and making bookings on Solennia. What event are you planning?'

2. NO EMOJIS: Do not use any emojis whatsoever. Not a single one.

3. NO HALLUCINATION: 
   - ONLY recommend vendors/venues returned by the search_vendors function.
   - NEVER invent, fabricate, or guess vendor names.
   - NEVER say 'You could also try...' or 'Popular options include...' unless those vendors came from search_vendors results.
   - If no vendors match, say: 'No matching vendors were found in the Solennia system for that criteria. You may want to adjust your budget, location, or category.'

4. DATE VALIDATION:
   - Today is {$currentDate}. NEVER accept a past date.
   - If user gives a date before {$currentDate}, respond: 'That date has already passed. Please provide a future date.'
   - If user provides month/day without year, use {$currentYear}. If that month is already past, use next year.
   - NEVER call extract_booking_info with a past date. Reject it in your response instead.

5. HUMAN-LIKE BOOKING LOGIC:
   - Ask questions one at a time, not all at once.
   - If user provides multiple details at once, acknowledge all of them.
   - Do NOT assume event type. Ask the user.
   - Confirm the vendor choice, date, and time before creating any booking.
   - Before calling create_booking, explicitly summarize: 'To confirm: you want to book [Vendor] for [Event Type] on [Date] at [Time]. Shall I proceed?'

6. RESPONSE STYLE:
   - Professional, concise, and direct.
   - Use Philippine Peso (P) for pricing.
   - Keep responses under 150 words unless presenting vendor options.
   - No unnecessary filler or pleasantries. Be helpful but efficient.

INFORMATION TO GATHER (in order):
1. Event type (ask - do not assume)
2. Event date (must be {$currentDate} or later, format YYYY-MM-DD)
3. Event time
4. Location (ONLY for suppliers, NOT for venues since venues have fixed addresses)
5. Budget
6. Number of guests
7. Vendor/venue selection (from search results only)

FUNCTION USAGE:
- extract_booking_info: Call IMMEDIATELY when user provides ANY booking detail. NEVER skip this. Always validate dates are not in the past before extracting.
- search_vendors: Call when user asks for recommendations or is ready to see options. Use category and keyword parameters. Do NOT include limit/budget_max/location unless user explicitly specified those filters.
  - For venue types (Churches, Gardens, Hotels): use category='Venue' and keyword for the type.
- check_availability: ONLY call when a specific date exists in currentData AND user has selected a specific vendor/venue. NEVER call with made-up dates.
- create_booking: ONLY after user explicitly confirms ALL details. Must have: event_type, date, time, budget, guests, and vendor_id or venue_id.

RECOMMENDATION POLICIES - FOLLOW THESE STRICTLY:

A. BUDGET GUIDELINES PER GUEST COUNT (Philippine Peso):
   Use these as reference. If a user's budget is significantly below the minimum, warn them.

   WEDDING:
   - 50 guests: Minimum P80,000 to P150,000 (modest); P150,000 to P300,000 (mid-range); P300,000+ (premium)
   - 100 guests: Minimum P150,000 to P300,000 (modest); P300,000 to P600,000 (mid-range); P600,000+ (premium)
   - 150 guests: Minimum P250,000 to P450,000 (modest); P450,000 to P900,000 (mid-range)
   - 200 guests: Minimum P350,000 to P600,000 (modest); P600,000 to P1,200,000 (mid-range)
   - 300+ guests: Minimum P500,000+

   DEBUT (18th Birthday):
   - 50 guests: P50,000 to P100,000 (simple); P100,000 to P200,000 (mid-range)
   - 100 guests: P100,000 to P200,000 (simple); P200,000 to P400,000 (mid-range)
   - 150 guests: P150,000 to P300,000 (simple); P300,000 to P600,000 (mid-range)

   BIRTHDAY (General):
   - 30 guests: P15,000 to P40,000 (simple); P40,000 to P80,000 (mid-range)
   - 50 guests: P30,000 to P60,000 (simple); P60,000 to P120,000 (mid-range)
   - 100 guests: P60,000 to P120,000 (simple); P120,000 to P250,000 (mid-range)

   CORPORATE EVENT:
   - 50 attendees: P80,000 to P200,000
   - 100 attendees: P150,000 to P400,000
   - 200 attendees: P300,000 to P800,000

   CHRISTENING / BAPTISM:
   - 30 guests: P20,000 to P50,000
   - 50 guests: P35,000 to P80,000
   - 100 guests: P70,000 to P150,000

B. BUDGET VALIDATION RULES:
   - If the user's budget is below the minimum for their guest count and event type, inform them: 'Based on typical Philippine event pricing, a [event type] for [X] guests usually requires a minimum budget of around P[amount]. Your current budget of P[amount] may be tight. Would you like to adjust your guest count or budget?'
   - NEVER ignore an unrealistic budget. Always flag it.
   - If no budget is provided, ask for one before recommending vendors.
   - Per-head cost reference: Catering alone typically ranges from P350 to P1,500 per head in the Philippines.

C. VENDOR CATEGORY REQUIREMENTS BY EVENT TYPE:
   WEDDING typically needs: Venue (required), Catering (required), Photography and Videography (required), Coordination and Hosting (recommended), Decoration (recommended), Entertainment (optional).
   DEBUT typically needs: Venue (required), Catering (required), Photography and Videography (required), Coordination (recommended), Entertainment (recommended for 18 roses/candles program).
   BIRTHDAY typically needs: Venue or location (required), Catering (required), Photography (optional), Decoration (optional).
   CORPORATE EVENT typically needs: Venue (required), Catering (required), Coordination (recommended), Entertainment (optional).

   When a user tells you their event type, proactively mention what vendor categories they will likely need.

D. MINIMUM LEAD TIME RULES:
   - Wedding: Recommend booking at least 6 months in advance. If less than 3 months away, warn about limited availability.
   - Debut: Recommend booking at least 3 months in advance.
   - Birthday / Christening: Recommend booking at least 1 month in advance.
   - Corporate Event: Recommend booking at least 2 months in advance.
   - If event is less than 2 weeks away, warn: 'Your event date is very soon. Vendor availability may be limited on short notice.'

E. PRACTICAL RECOMMENDATIONS:
   - If user has a limited budget, suggest prioritizing essential vendors (venue, catering, photography) over optional ones.
   - When comparing vendors, mention pricing, location, ratings, and services.
   - Present vendor options clearly with pricing and key details.

VENUE VS SUPPLIER:
- Venues: Use venue_id for check_availability and create_booking. Do NOT ask for location (venue has its own address).
- Suppliers: Use vendor_id. DO ask for event location since supplier travels to client.

CRITICAL: Use exact numeric IDs from search_vendors results. NEVER use placeholder IDs like 1.";

        if ($stage === 'vendor_search') {
            $basePrompt .= "\n\nCURRENT TASK: Search for vendors and present options to the user.";
        }
        elseif ($stage === 'confirmation') {
            $basePrompt .= "\n\nCURRENT TASK: Confirm all booking details with the user before proceeding.";
        }

        return $basePrompt;
    }

    private function getBookingFunctions(): array
    {
        return [
            [
                'name' => 'extract_booking_info',
                'description' => 'Extract event details from user message',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'event_type' => ['type' => 'string', 'description' => 'Explicitly stated event type only. Do NOT guess.'],
                        'date' => ['type' => 'string', 'description' => 'YYYY-MM-DD format. Must be a future date.'],
                        'time' => ['type' => 'string', 'description' => 'Event start time (e.g. 2:00 PM)'],
                        'location' => ['type' => 'string'],
                        'budget' => ['type' => 'number'],
                        'guests' => ['type' => 'integer'],
                        'venue_id' => ['type' => 'integer', 'description' => 'Venue ID chosen by user'],
                        'venue_name' => ['type' => 'string', 'description' => 'Name of the venue chosen by user'],
                        'vendor_id' => ['type' => 'integer', 'description' => 'Supplier ID chosen by user'],
                        'vendor_name' => ['type' => 'string', 'description' => 'Business name of the supplier chosen by user'],
                        'preferences' => [
                            'type' => 'array',
                            'items' => ['type' => 'string']
                        ]
                    ],
                    'required' => []
                ]
            ],
            [
                'name' => 'search_vendors',
                'description' => 'Search for vendors/venues matching criteria. Returns ALL matching results when no filters (budget, location, keyword) are specified. Returns up to 10 when filters are applied.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'category' => [
                            'type' => 'string',
                            'enum' => ['Photography & Videography', 'Catering', 'Venue', 'Coordination & Hosting', 'Decoration', 'Entertainment', 'Others']
                        ],
                        'keyword' => ['type' => 'string', 'description' => 'Specific vendor name, venue type (e.g. Church, Garden), or keyword'],
                        'budget_max' => ['type' => 'number'],
                        'location' => ['type' => 'string'],
                        'limit' => ['type' => 'integer', 'description' => 'Optional: Override default limit. Leave empty to show all when no filters, or 10 when filters applied.']
                    ],
                    'required' => []
                ]
            ],
            [
                'name' => 'check_availability',
                'description' => 'Check if vendor or venue is available on date',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'vendor_id' => ['type' => 'integer', 'description' => 'Supplier ID from search results'],
                        'venue_id' => ['type' => 'integer', 'description' => 'Venue ID from search results (use when booking a venue)'],
                        'date' => ['type' => 'string']
                    ],
                    'required' => ['date']
                ]
            ],
            [
                'name' => 'create_booking',
                'description' => 'Create booking when user confirms all details. Use vendor_id for suppliers, venue_id for venues.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'vendor_id' => ['type' => 'integer', 'description' => 'Supplier ID from search results. DO NOT GUESS.'],
                        'venue_id' => ['type' => 'integer', 'description' => 'Venue ID from search results. DO NOT GUESS.'],
                        'confirmed' => ['type' => 'boolean', 'description' => 'User explicitly said yes/confirmed']
                    ],
                    'required' => ['confirmed']
                ]
            ]
        ];
    }

    private function processExtractedInfo(array $newInfo, array $currentData): array
    {
        $merged = $currentData;

        foreach ($newInfo as $key => $value) {
            if ($value !== null && $value !== '') {
                // SERVER-SIDE DATE VALIDATION: Reject past dates
                if ($key === 'date') {
                    $today = date('Y-m-d');
                    if ($value < $today) {
                        error_log("REJECTED PAST DATE: {$value} (today is {$today})");
                        continue; // Skip this value - do not store past dates
                    }
                }

                if ($key === 'preferences' && isset($merged['preferences'])) {
                    $merged['preferences'] = array_unique(
                        array_merge($merged['preferences'], $value)
                    );
                }
                else {
                    $merged[$key] = $value;
                }
            }
        }

        return $merged;
    }

    private function determineBookingStage(array $data): string
    {
        $hasBasics = !empty($data['event_type'])
            && !empty($data['date'])
            && !empty($data['time']);

        // Vendor search stage: basics + (location OR venue_id)
        if ($hasBasics && (!empty($data['location']) || !empty($data['venue_id']))) {
            // Confirmation stage: basics + (venue_id OR vendor_id)
            if (!empty($data['venue_id']) || !empty($data['vendor_id'])) {
                return 'confirmation';
            }
            return 'vendor_search';
        }

        return 'discovery';
    }

    private function searchVendorsForBooking(array $criteria): array
    {
        if (strtolower($criteria['category'] ?? '') === 'venue') {
            return $this->searchVenuesForBooking($criteria);
        }

        $query = DB::table('event_service_provider')
            ->where('ApplicationStatus', 'Approved');

        if (!empty($criteria['category'])) {
            $query->where('Category', $criteria['category']);
        }

        if (!empty($criteria['keyword'])) {
            $query->where(function ($q) use ($criteria) {
                $q->where('BusinessName', 'LIKE', '%' . $criteria['keyword'] . '%')
                    ->orWhere('Description', 'LIKE', '%' . $criteria['keyword'] . '%');
            });
        }

        if (!empty($criteria['location']) && empty($criteria['keyword'])) {
            $query->where(function ($q) use ($criteria) {
                $q->where('BusinessAddress', 'LIKE', '%' . $criteria['location'] . '%')
                    ->orWhere('service_areas', 'LIKE', '%' . $criteria['location'] . '%');
            });
        }

        // Smart limit: Show ALL if no filters, limit to 10 if filters applied
        $hasFilters = !empty($criteria['location']) || !empty($criteria['budget_max']) || !empty($criteria['keyword']);
        $limit = $hasFilters ? ($criteria['limit'] ?? 10) : 100; // 100 = effectively "all"
        $query->limit($limit);

        $vendors = $query->select(
            'ID',
            'BusinessName',
            'Category',
            'Pricing',
            'Description',
            'BusinessAddress',
            'AverageRating',
            'TotalReviews',
            'UserID'
        )->get()->toArray();

        $result = json_decode(json_encode($vendors), true);
        foreach ($result as &$v) {
            $v['type'] = 'supplier';
            $v['vendor_id'] = $v['ID'];
        }
        return $result;
    }

    private function searchVenuesForBooking(array $criteria): array
    {
        $query = DB::table('venue_listings')
            ->where('status', 'Active');

        if (!empty($criteria['keyword'])) {
            $query->where(function ($q) use ($criteria) {
                $q->where('venue_name', 'LIKE', '%' . $criteria['keyword'] . '%')
                    ->orWhere('description', 'LIKE', '%' . $criteria['keyword'] . '%')
                    ->orWhere('venue_subcategory', 'LIKE', '%' . $criteria['keyword'] . '%');
            });
        }

        if (!empty($criteria['location'])) {
            $query->where('address', 'LIKE', '%' . $criteria['location'] . '%');
        }

        // Smart limit: Show ALL if no filters, limit to 10 if filters applied
        $hasFilters = !empty($criteria['location']) || !empty($criteria['budget_max']) || !empty($criteria['keyword']);
        $limit = $hasFilters ? ($criteria['limit'] ?? 10) : 100; // 100 = effectively "all"
        $query->limit($limit);

        $venues = $query->select(
            'id',
            'venue_name',
            'venue_subcategory',
            'venue_capacity',
            'address',
            'description',
            'pricing',
            'user_id'
        )->get()->toArray();

        $result = json_decode(json_encode($venues), true);
        foreach ($result as &$v) {
            $v['type'] = 'venue';
            $v['ID'] = (int)$v['id']; // Match frontend Capital ID
            $v['venue_id'] = (int)$v['id'];
            $v['BusinessName'] = $v['venue_name'];
            $v['Pricing'] = $v['pricing'];
            $v['BusinessAddress'] = $v['address'];
            $v['Category'] = 'Venue';
        }
        return $result;
    }

    private function checkVendorAvailabilityForDate(int $vendorId, string $date): array
    {
        $vendor = DB::table('event_service_provider')
            ->where('ID', $vendorId)
            ->first();

        if (!$vendor) {
            return ['available' => false, 'reason' => 'Vendor not found'];
        }

        $existingBooking = DB::table('booking')
            ->where('EventServiceProviderID', $vendorId)
            ->where('EventDate', $date)
            ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
            ->first();

        if ($existingBooking) {
            return [
                'available' => false,
                'reason' => 'Already booked on this date'
            ];
        }

        $unavailable = DB::table('vendor_availability')
            ->where('vendor_user_id', $vendor->UserID)
            ->where('date', $date)
            ->where('is_available', false)
            ->first();

        if ($unavailable) {
            return [
                'available' => false,
                'reason' => 'Vendor marked as unavailable'
            ];
        }

        return ['available' => true];
    }

    private function checkVenueAvailabilityForDate(int $venueId, string $date): array
    {
        $venue = DB::table('venue_listings')
            ->where('id', $venueId)
            ->where('status', 'Active')
            ->first();

        if (!$venue) {
            return ['available' => false, 'reason' => 'Venue not found'];
        }

        // Check 1: Existing bookings (hard conflicts)
        $conflict = DB::table('booking')
            ->where('venue_id', $venueId)
            ->where(function ($q) use ($date) {
            $q->whereBetween('start_date', [$date, $date])
                ->orWhereBetween('end_date', [$date, $date])
                ->orWhere(function ($q2) use ($date) {
                $q2->where('start_date', '<=', $date)->where('end_date', '>=', $date);
            }
            );
        })
            ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
            ->exists();

        if ($conflict) {
            return ['available' => false, 'reason' => 'Already booked on this date'];
        }

        // Check 2: Venue availability table (venue owner's calendar)
        $unavailable = DB::table('venue_availability')
            ->where('venue_id', $venueId)
            ->where('date', $date)
            ->where('is_available', false)
            ->first();

        if ($unavailable) {
            $reason = 'Venue marked as unavailable';
            if (!empty($unavailable->notes)) {
                $reason .= ': ' . $unavailable->notes;
            }
            return [
                'available' => false,
                'reason' => $reason
            ];
        }

        return ['available' => true];
    }

    private function createBookingFromConversation(array $bookingData, int $vendorId, int $userId): ?int
    {
        try {
            $vendor = DB::table('event_service_provider')
                ->where('ID', $vendorId)
                ->first();

            if (!$vendor) {
                // Fallback: If ID is invalid but we have a name, try to find it
                if (!empty($bookingData['vendor_name'])) {
                    $vendor = DB::table('event_service_provider')
                        ->where('BusinessName', 'LIKE', '%' . $bookingData['vendor_name'] . '%')
                        ->where('ApplicationStatus', 'Approved')
                        ->first();
                }

                if (!$vendor)
                    return null;
                $vendorId = $vendor->ID;
            }

            $notes = "AI Booking\n\n";
            if (!empty($bookingData['guests'])) {
                $notes .= "Expected Guests: {$bookingData['guests']}\n";
            }
            if (!empty($bookingData['time'])) {
                $notes .= "Event Time: {$bookingData['time']}\n";
            }
            if (!empty($bookingData['budget'])) {
                $budget = $bookingData['budget'];
                $budgetStr = is_numeric($budget)
                    ? "₱" . number_format($budget)
                    : $budget;
                $notes .= "Budget: " . $budgetStr . "\n";
            }
            if (!empty($bookingData['preferences']) && is_array($bookingData['preferences'])) {
                $notes .= "Preferences: " . implode(', ', $bookingData['preferences']) . "\n";
            }

            $bookingId = DB::table('booking')->insertGetId([
                'UserID' => $userId,
                'EventServiceProviderID' => $vendorId,
                'ServiceName' => $vendor->BusinessName,
                'EventDate' => $bookingData['date'] ?? null,
                'EventLocation' => $bookingData['location'] ?? '',
                'EventType' => $bookingData['event_type'] ?? null,
                'PackageSelected' => 'AI Conversational Booking',
                'AdditionalNotes' => $notes,
                'TotalAmount' => floatval($vendor->Pricing ?? 0),
                'BookingStatus' => 'Pending',
                'BookingDate' => date('Y-m-d H:i:s'),
                'CreatedAt' => date('Y-m-d H:i:s'),
                'CreatedBy' => $userId
            ]);

            $client = DB::table('credential')->where('id', $userId)->first();
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));

            // ✅ FIXED: Extract event type first, then use it in string
            $eventType = $bookingData['event_type'] ?? 'an event';
            $notificationMessage = "{$clientName} created a booking via AI assistant for {$eventType}";

            $this->sendNotification(
                $vendor->UserID,
                'booking_request',
                'New AI Booking Request',
                $notificationMessage
            );

            return $bookingId;

        }
        catch (\Exception $e) {
            error_log("Create Booking From Conversation Error: " . $e->getMessage());
            return null;
        }
    }

    private function createVenueBookingFromConversation(array $bookingData, int $venueId, int $userId): ?int
    {
        try {
            error_log("CREATE_VENUE_BOOKING: Starting for venue_id={$venueId}, user_id={$userId}");
            error_log("CREATE_VENUE_BOOKING: bookingData=" . json_encode($bookingData));

            $venue = DB::table('venue_listings')
                ->where('id', $venueId)
                ->where('status', 'Active')
                ->first();

            if (!$venue) {
                // Fallback: If ID is invalid (like placeholder 1) but we have a name
                if (!empty($bookingData['venue_name'])) {
                    $venue = DB::table('venue_listings')
                        ->where('venue_name', 'LIKE', '%' . $bookingData['venue_name'] . '%')
                        ->where('status', 'Active')
                        ->first();
                }

                if (!$venue) {
                    error_log("CREATE_VENUE_BOOKING: ERROR - Venue not found or not active. venue_id={$venueId}, name=" . ($bookingData['venue_name'] ?? 'null'));
                    return null;
                }
                $venueId = $venue->id;
            }

            error_log("CREATE_VENUE_BOOKING: Venue found - {$venue->venue_name}");

            $startDate = $bookingData['date'] ?? null;
            if (!$startDate) {
                error_log("CREATE_VENUE_BOOKING: ERROR - No date provided in bookingData");
                return null;
            }
            $endDate = $startDate;

            error_log("CREATE_VENUE_BOOKING: Date={$startDate}");

            $notes = "AI Booking\n\n";
            if (!empty($bookingData['guests'])) {
                $notes .= "Expected Guests: {$bookingData['guests']}\n";
            }
            if (!empty($bookingData['time'])) {
                $notes .= "Event Time: {$bookingData['time']}\n";
            }
            if (!empty($bookingData['budget'])) {
                $budget = $bookingData['budget'];
                $budgetStr = is_numeric($budget) ? "₱" . number_format($budget) : $budget;
                $notes .= "Budget: " . $budgetStr . "\n";
            }
            if (!empty($bookingData['preferences']) && is_array($bookingData['preferences'])) {
                $notes .= "Preferences: " . implode(', ', $bookingData['preferences']) . "\n";
            }

            // Check for conflicts
            $conflict = DB::table('booking')
                ->where('venue_id', $venueId)
                ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($q2) use ($startDate, $endDate) {
                    $q2->where('start_date', '<=', $startDate)->where('end_date', '>=', $endDate);
                }
                );
            })
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($conflict) {
                error_log("CREATE_VENUE_BOOKING: ERROR - Conflict found for date {$startDate}");
                return null;
            }

            error_log("CREATE_VENUE_BOOKING: No conflicts, proceeding to insert");

            // Format EventDate as DATETIME (required by booking table)
            $eventTime = $bookingData['time'] ?? '00:00';

            // Convert time to 24-hour format if needed (e.g., "3:30 PM" -> "15:30:00")
            if (stripos($eventTime, 'PM') !== false || stripos($eventTime, 'AM') !== false) {
                // Parse 12-hour format (e.g., "3:30 PM")
                $timeParts = preg_split('/\s+/', $eventTime);
                $time = $timeParts[0];
                $meridiem = strtoupper($timeParts[1] ?? 'AM');

                list($hour, $minute) = explode(':', $time);
                $hour = (int)$hour;
                $minute = (int)$minute;

                // Convert to 24-hour
                if ($meridiem === 'PM' && $hour < 12) {
                    $hour += 12;
                }
                elseif ($meridiem === 'AM' && $hour === 12) {
                    $hour = 0;
                }

                $eventTime24 = sprintf('%02d:%02d:00', $hour, $minute);
            }
            else {
                // Already in 24-hour format or just HH:MM
                $eventTime24 = (strpos($eventTime, ':') !== false) ? $eventTime . ':00' : $eventTime;
            }

            $eventDateTime = $startDate . ' ' . $eventTime24;

            // CRITICAL: Get proper EventServiceProviderID (must exist in event_service_provider table)
            // Venue owners are linked via their mysql user id
            $eventServiceProviderId = DB::table('event_service_provider')
                ->where('UserID', $venue->user_id)
                ->where('ApplicationStatus', 'Approved')
                ->value('ID');

            // Fallback: If venue owner doesn't have an ESP account, use a placeholder
            if (!$eventServiceProviderId) {
                $eventServiceProviderId = DB::table('event_service_provider')
                    ->where('ApplicationStatus', 'Approved')
                    ->value('ID');
            }

            $bookingId = DB::table('booking')->insertGetId([
                'UserID' => $userId,
                'venue_id' => $venueId,
                'EventServiceProviderID' => $eventServiceProviderId,
                'ServiceName' => $venue->venue_name,
                'EventDate' => $eventDateTime, // FIXED: Use DATETIME format
                'start_date' => $startDate,
                'end_date' => $endDate,
                'EventLocation' => $venue->address ?? '',
                'EventType' => $bookingData['event_type'] ?? null,
                'guest_count' => (int)($bookingData['guests'] ?? 0),
                'PackageSelected' => 'AI Conversational Booking',
                'AdditionalNotes' => $notes,
                'TotalAmount' => 0,
                'BookingStatus' => 'Pending',
                'BookingDate' => date('Y-m-d H:i:s'),
                'CreatedAt' => date('Y-m-d H:i:s'),
                'CreatedBy' => $userId
            ]);

            error_log("CREATE_VENUE_BOOKING: SUCCESS - Booking created with ID={$bookingId}");

            $client = DB::table('credential')->where('id', $userId)->first();
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));

            $eventType = $bookingData['event_type'] ?? 'an event';

            if ($venue->user_id) {
                $this->sendNotification(
                    $venue->user_id,
                    'venue_booking_request',
                    'New AI Venue Booking Request',
                    "{$clientName} requested to book {$venue->venue_name} for {$eventType} via AI assistant"
                );
            }

            return $bookingId;

        }
        catch (\Exception $e) {
            error_log("Create Venue Booking From Conversation Error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * ========================================
     * HELPER METHODS
     * ========================================
     */

    private function checkRateLimit(int $userId): bool
    {
        $cacheFile = sys_get_temp_dir() . '/solennia_ai_rate_limit.json';
        $maxRequests = 100;
        $timeWindow = 3600;

        try {
            $data = [];
            if (file_exists($cacheFile)) {
                $json = file_get_contents($cacheFile);
                $data = json_decode($json, true) ?: [];
            }

            $now = time();
            $userKey = "user_{$userId}";

            if (isset($data[$userKey])) {
                $data[$userKey] = array_filter($data[$userKey], function ($timestamp) use ($now, $timeWindow) {
                    return ($now - $timestamp) < $timeWindow;
                });
            }
            else {
                $data[$userKey] = [];
            }

            if (count($data[$userKey]) >= $maxRequests) {
                return false;
            }

            return true;

        }
        catch (\Exception $e) {
            error_log("Rate limit check error: " . $e->getMessage());
            return true;
        }
    }

    private function recordRequest(int $userId): void
    {
        $cacheFile = sys_get_temp_dir() . '/solennia_ai_rate_limit.json';

        try {
            $data = [];
            if (file_exists($cacheFile)) {
                $json = file_get_contents($cacheFile);
                $data = json_decode($json, true) ?: [];
            }

            $userKey = "user_{$userId}";
            if (!isset($data[$userKey])) {
                $data[$userKey] = [];
            }

            $data[$userKey][] = time();
            file_put_contents($cacheFile, json_encode($data));

        }
        catch (\Exception $e) {
            error_log("Failed to record request: " . $e->getMessage());
        }
    }

    private function sendNotification($userId, $type, $title, $message)
    {
        try {
            DB::table('notifications')->insert([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'read' => false,
                'created_at' => date('Y-m-d H:i:s')
            ]);

        }
        catch (\Throwable $e) {
            error_log("Notification Error: " . $e->getMessage());
        }
    }

    private function jsonResponse(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}