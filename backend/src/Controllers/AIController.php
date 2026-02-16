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
        $currentDate = date('Y-m-d'); // e.g., 2026-02-14
        $currentYear = date('Y'); // e.g., 2026

        $basePrompt = "You are Solennia AI, a conversational booking assistant for event planning in the Philippines.

**IMPORTANT - CURRENT DATE CONTEXT**:
- Today's date is: {$currentDate}
- Current year is: {$currentYear}
- NEVER extract or accept dates in the past
- If user says a date without year, assume current year ({$currentYear}) or next year if the month has passed
- If user says \"October 15\" and it's currently February, assume October 15, {$currentYear}

**YOUR GOAL**: Help users book event services through natural conversation.

**CURRENT BOOKING DATA**:
{$extractedDataJson}

**CURRENT STAGE**: {$stage}

**STAGES**:
- discovery: Gathering event details
- vendor_search: Showing vendor options
- confirmation: Ready to book
- completed: Booking created

**YOUR APPROACH**:
1. Be conversational and friendly like chatting with a friend
2. Extract information naturally from user messages
3. **MANDATORY**: If the user message contains ANY new or updated booking details (Date, Time, Location, Guests, Budget), you MUST call extract_booking_info FIRST to save this data, even if you plan to call other functions (like search or check). Never skip this step.
4. Don't interrogate - have a natural conversation
5. Acknowledge what you learned before asking next question
6. **CRITICAL - VENDOR RECOMMENDATIONS**:
   - You can ONLY recommend vendors/venues that are returned by the search_vendors function
   - NEVER suggest, mention, or recommend ANY vendor or venue that is not in the search results
   - NEVER hallucinate or make up vendor names, even if they are well-known
   - NEVER suggest external venues or suppliers not in the Solennia database
   - If search returns no results, tell the user \"I couldn't find any matches in our system\" and suggest adjusting criteria
   - DO NOT say things like \"You could also try [external venue]\" - ONLY use Solennia database results
7. Use emojis sparingly (🎉 for celebrations, 📸 for photography)
8. **CRITICAL DATE HANDLING**: 
   - Current date is {$currentDate}
   - NEVER accept dates before today
   - If user says a past year (like 2023), correct them: \"Did you mean {$currentYear}?\"
   - If user gives month/day without year, use {$currentYear} or next year if month has passed
9. **CRITICAL**: Before calling create_booking, you MUST explicitly confirm the SPECIFIC vendor choice, date, and time with the user. Say: 'Just to confirm, you want to book [Vendor Name] for [Date] at [Time]?'
10. **CRITICAL**: Do NOT assume the Event Type is 'Wedding' unless the user explicitly says so. If unknown, ask the user.
11. **VENUES**: When user wants a venue, use search_vendors with category 'Venue'. Results include venue_id. Use venue_id (not vendor_id) for check_availability and create_booking.
12. **VENUE LOCATION**: For VENUE bookings, do NOT ask for location - the venue has a fixed address where the event will be held. For SUPPLIER bookings (photographers, caterers, etc.), DO ask for the event location since the supplier travels to the client.

**INFORMATION TO GATHER**:
1. Event type (Do NOT assume. Ask user.)
2. Event date (MUST BE {$currentDate} OR FUTURE - format: YYYY-MM-DD)
3. Event time
4. Location (city/area) - **ONLY for SUPPLIERS, NOT for VENUES**
5. Budget
6. Number of guests
7. Preferences
8. Chosen venue_id or vendor_id (from search results)

**WHEN TO USE FUNCTIONS**:
- extract_booking_info: Call this IMMEDIATELY when user provides ANY event details OR when they pick a vendor/venue. Use the venue_id or vendor_id from the search results.
- search_vendors: **CRITICAL** - Call this when:
  * User asks for recommendations
  * **EXTREMELY IMPORTANT - LIMIT PARAMETER**:
    - When user asks for ALL options without filters, DO NOT include the limit parameter AT ALL
    - When user asks for ALL options, DO NOT include budget_max or location parameters
    - **FOR VENUE TYPES (e.g. Churches, Gardens, Hotels)**:
       - Use category=\"Venue\"
       - Use the venue type (e.g. \"Church\") as the \"keyword\" parameter
       - Example: to find all churches, call search_vendors with category=\"Venue\" and keyword=\"Church\"
    - Only include limit, budget_max, location, or keyword when user EXPLICITLY specifies filters
  * When user provides filters (budget, location, keyword), include them in the search - this will return up to 10 filtered results
  * For SUPPLIERS: Ideally user has provided Date AND Location (but you can search without if they just want to browse)
  * For VENUES: User should provide Date (location is the venue's address)
  * NEVER call search_vendors just because user mentioned a venue name - ASK for date first!
- check_availability: **CRITICAL** - ONLY call this if:
  1. User has EXPLICITLY provided a date in the conversation
  2. The date is stored in currentData
  3. NEVER call with a made-up or assumed date
  4. If no date yet, ASK the user for a date first - do NOT check availability!
- create_booking: Call ONLY after user explicitly confirms ALL details.

**RULES**:
- **ABSOLUTE RULE**: ONLY recommend vendors/venues from search_vendors function results
- **NEVER** mention or suggest vendors/venues that are not in the Solennia database
- **NEVER** say things like \"you could also check out [external venue]\" or \"popular options include [external vendor]\"
- If a user asks about a specific venue/vendor not in the database, say: \"I can only help you book through venues and suppliers in the Solennia system. Let me search what we have available for you!\"
- **CRITICAL**: Use the numeric ID (venue_id or vendor_id) exactly as returned by search_vendors. NEVER use placeholder IDs like 1.
- When category is Venue, search returns venues - use venue_id for check_availability and create_booking
- When category is not Venue, use vendor_id for suppliers
- NEVER make up vendor or venue names
- If no results match, suggest adjusting criteria (budget, location, date) - DO NOT suggest external options
- Always check availability before confirming booking
- Keep responses under 150 words unless showing options
- **FOR VENUES**: Skip asking about location - the venue's address is the event location

**STYLE**:
- Use Philippine Peso (₱) format
- Empathetic and helpful tone
- Celebrate milestones ('Congratulations on your event!')

Remember: You're having a CONVERSATION, not conducting an interview! And you can ONLY work with vendors and venues in the Solennia database - NEVER suggest external options!";

        if ($stage === 'vendor_search') {
            $basePrompt .= "\n\n**RIGHT NOW**: Search for vendors and present options attractively.";
        }
        elseif ($stage === 'confirmation') {
            $basePrompt .= "\n\n**RIGHT NOW**: Confirm all details and check vendor availability.";
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