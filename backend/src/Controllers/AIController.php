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
                        // SAFETY NET: Capture date if used here
                        if (!empty($arguments['date'])) {
                            $extractedInfo['date'] = $arguments['date'];
                            $currentData['date'] = $arguments['date'];
                            $systemPrompt = $this->getConversationalBookingPrompt($currentData, $newStage);
                        }

                        $availability = $this->checkVendorAvailabilityForDate(
                            $arguments['vendor_id'],
                            $arguments['date']
                        );
                        $extractedInfo['availability_checked'] = $availability;
                        $functionResult = ['status' => 'success', 'availability' => $availability];
                        break;

                    case 'create_booking':
                        // Validation: Ensure we have date and location before booking
                        $missingFields = [];
                        if (empty($currentData['date']))
                            $missingFields[] = 'Date';
                        if (empty($currentData['time']))
                            $missingFields[] = 'Time';
                        if (empty($currentData['location']))
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
                            $bookingId = $this->createBookingFromConversation(
                                array_merge($currentData, $extractedInfo),
                                $arguments['vendor_id'],
                                $userId
                            );

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

        $basePrompt = "You are Solennia AI, a conversational booking assistant for event planning in the Philippines.

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
6. When suggesting vendors, ONLY use the verify suppliers returned by the search_vendors function. NEVER invent or hallucinate vendors not in the system.
7. Use emojis sparingly (🎉 for celebrations, 📸 for photography)
8. **IMPORTANT**: If the user provides a year like 2023, assume they made a typo and ask for clarification or assume next occurance. NEVER book past dates.
9. **CRITICAL**: Before calling create_booking, you MUST explicitly confirm the SPECIFIC vendor choice, date, and time with the user. Say: 'Just to confirm, you want to book [Vendor Name] for [Date] at [Time]?'
10. **CRITICAL**: Do NOT assume the Event Type is 'Wedding' unless the user explicitly says so. If unknown, ask the user.

**INFORMATION TO GATHER**:
1. Event type (Do NOT assume. Ask user.)
2. Event date (MUST BE TODAY OR FUTURE)
3. Event time
4. Location (city/area)
5. Budget
6. Number of guests
7. Preferences

**WHEN TO USE FUNCTIONS**:
- extract_booking_info: Call this IMMEDIATELY when user provides ANY event details.
- search_vendors: Call ONLY when you have minimal details (Date, Location) OR if user asks for specific vendor.
- check_availability: Call when user asks if specific vendor is free.
- create_booking: Call ONLY after user explicitly confirms ALL details.

**RULES**:
- ONLY recommend vendors from search_vendors function results
- NEVER make up vendor names
- If no vendors match, suggest adjusting criteria
- Always check availability before confirming booking
- Keep responses under 150 words unless showing vendor options

**STYLE**:
- Use Philippine Peso (₱) format
- Empathetic and helpful tone
- Celebrate milestones ('Congratulations on your event!')

Remember: You're having a CONVERSATION, not conducting an interview!";

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
                'description' => 'Search for vendors matching criteria',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'category' => [
                            'type' => 'string',
                            'enum' => ['Photography & Videography', 'Catering', 'Venue', 'Coordination & Hosting', 'Decoration', 'Entertainment', 'Others']
                        ],
                        'keyword' => ['type' => 'string', 'description' => 'Specific vendor name or keyword'],
                        'budget_max' => ['type' => 'number'],
                        'location' => ['type' => 'string'],
                        'limit' => ['type' => 'integer', 'default' => 3]
                    ],
                    'required' => []
                ]
            ],
            [
                'name' => 'check_availability',
                'description' => 'Check if vendor is available on date',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'vendor_id' => ['type' => 'integer'],
                        'date' => ['type' => 'string']
                    ],
                    'required' => ['vendor_id', 'date']
                ]
            ],
            [
                'name' => 'create_booking',
                'description' => 'Create booking when user confirms all details including supplier',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'vendor_id' => ['type' => 'integer', 'description' => 'The ID of the SPECIFIC supplier the user chose'],
                        'confirmed' => ['type' => 'boolean']
                    ],
                    'required' => ['vendor_id', 'confirmed']
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
        $hasEssentials = !empty($data['event_type'])
            && !empty($data['date'])
            && !empty($data['time'])
            && !empty($data['location']);

        return $hasEssentials ? 'vendor_search' : 'discovery';
    }

    private function searchVendorsForBooking(array $criteria): array
    {
        $query = DB::table('event_service_provider')
            ->where('ApplicationStatus', 'Approved');

        if (!empty($criteria['keyword'])) {
            $query->where('BusinessName', 'LIKE', '%' . $criteria['keyword'] . '%');
        // If keyword is used, we generally want to find that specific vendor regardless of category/budget
        }
        elseif (!empty($criteria['category'])) {
            // Only enforce category if NO keyword is provided
            $query->where('Category', $criteria['category']);
        }

        if (!empty($criteria['location']) && empty($criteria['keyword'])) {
            $query->where(function ($q) use ($criteria) {
                $q->where('BusinessAddress', 'LIKE', '%' . $criteria['location'] . '%')
                    ->orWhere('service_areas', 'LIKE', '%' . $criteria['location'] . '%');
            });
        }

        // REMOVED budget filter because 'Pricing' column is unstructured text (e.g. "Package A - 15k"), 
        // causing CAST() to fail and exclude valid vendors. We let the AI filter by price.
        /*
         if (!empty($criteria['budget_max'])) {
         $query->whereRaw('CAST(Pricing AS DECIMAL) <= ?', [$criteria['budget_max']]);
         }
         */

        $limit = $criteria['limit'] ?? 3;
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

        return json_decode(json_encode($vendors), true);
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

    private function createBookingFromConversation(array $bookingData, int $vendorId, int $userId): ?int
    {
        try {
            $vendor = DB::table('event_service_provider')
                ->where('ID', $vendorId)
                ->first();

            if (!$vendor) {
                return null;
            }

            $notes = "🤖 AI Conversational Booking\n\n";
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
                'BookingDate' => DB::raw('NOW()'),
                'CreatedAt' => DB::raw('NOW()'),
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
                '🤖 New AI Booking Request',
                $notificationMessage
            );

            return $bookingId;

        }
        catch (\Exception $e) {
            error_log("Create Booking From Conversation Error: " . $e->getMessage());
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