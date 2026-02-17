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
            $extractedInfo = [];
            $suggestedVendors = [];
            $bookingCreated = false;
            $bookingId = null;
            $newStage = $stage;

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
                    break;
                }

                $functionResult = null;

                switch ($functionName) {
                    case 'extract_booking_info':
                        $extractedInfo = $this->processExtractedInfo($arguments, $currentData);
                        $currentData = $extractedInfo;
                        $newStage = $this->determineBookingStage($extractedInfo);

                        $systemPrompt = $this->getConversationalBookingPrompt($currentData, $newStage);

                        $functionResult = [
                            'status' => 'success',
                            'extracted' => $extractedInfo,
                            'stage' => $newStage
                        ];

                        // AUTO-CHECK AVAILABILITY
                        $autoDate = $currentData['date'] ?? null;
                        $autoVendorId = $currentData['vendor_id'] ?? null;
                        $autoVenueId = $currentData['venue_id'] ?? null;

                        if ($autoDate && ($autoVendorId || $autoVenueId)) {
                            $autoAvailability = $autoVenueId
                                ? $this->checkVenueAvailabilityForDate((int)$autoVenueId, $autoDate)
                                : $this->checkVendorAvailabilityForDate((int)$autoVendorId, $autoDate);

                            $functionResult['availability_auto_check'] = $autoAvailability;
                            $functionResult['availability_note'] = $autoAvailability['available']
                                ? 'The vendor/venue IS available on ' . $autoDate . '.'
                                : 'The vendor/venue is NOT available on ' . $autoDate . '. Reason: ' . ($autoAvailability['reason'] ?? 'Unavailable') . '. Ask the user to pick a different date.';
                            $extractedInfo['availability_checked'] = $autoAvailability;
                        }
                        break;

                    case 'search_vendors':
                        $implicitInfo = [];
                        if (!empty($arguments['location']))
                            $implicitInfo['location'] = $arguments['location'];
                        if (!empty($arguments['budget_max']))
                            $implicitInfo['budget'] = $arguments['budget_max'];

                        if (!empty($implicitInfo)) {
                            $extractedInfo = array_merge($extractedInfo, $implicitInfo);
                            $currentData = array_merge($currentData, $implicitInfo);
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

                        if ($venueId) {
                            $extractedInfo['venue_id'] = (int)$venueId;
                            $currentData['venue_id'] = (int)$venueId;
                        }
                        if ($vendorId) {
                            $extractedInfo['vendor_id'] = (int)$vendorId;
                            $currentData['vendor_id'] = (int)$vendorId;
                        }

                        $systemPrompt = $this->getConversationalBookingPrompt($currentData, $newStage);

                        $availability = $venueId
                            ? $this->checkVenueAvailabilityForDate((int)$venueId, $arguments['date'])
                            : ($vendorId ? $this->checkVendorAvailabilityForDate((int)$vendorId, $arguments['date']) : ['available' => false, 'reason' => 'No vendor_id or venue_id provided']);

                        $extractedInfo['availability_checked'] = $availability;
                        $functionResult = ['status' => 'success', 'availability' => $availability];
                        break;

                    case 'create_booking':
                        $venueId = $arguments['venue_id'] ?? null;
                        $vendorId = $arguments['vendor_id'] ?? null;

                        if ($venueId) {
                            $extractedInfo['venue_id'] = (int)$venueId;
                            $currentData['venue_id'] = (int)$venueId;
                        }
                        if ($vendorId) {
                            $extractedInfo['vendor_id'] = (int)$vendorId;
                            $currentData['vendor_id'] = (int)$vendorId;
                        }

                        $isVenueBooking = !empty($venueId);

                        $missingFields = [];
                        if (empty($currentData['date']))
                            $missingFields[] = 'Date';
                        if (empty($currentData['time']))
                            $missingFields[] = 'Time';
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
                            $bookingData = array_merge($currentData, $extractedInfo);

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

                if ($loopCount === 0) {
                    $history[] = ['role' => 'user', 'content' => $message];
                }

                $history[] = [
                    'role' => 'assistant',
                    'content' => null,
                    'function_call' => [
                        'name' => $functionName,
                        'arguments' => json_encode($arguments)
                    ]
                ];

                $history[] = [
                    'role' => 'function',
                    'name' => $functionName,
                    'content' => json_encode($functionResult)
                ];

                $result = $this->openAI->chatWithFunctions(
                    '',
                    $history,
                    $systemPrompt,
                    $functions
                );

                $loopCount++;
            }

            if ($userId) {
                $this->recordRequest($userId);
            }

            // FIX #3: Normalize line breaks in AI response so frontend renders them correctly
            // Replace literal \n sequences and normalize multiple blank lines
            $aiResponse = str_replace('\n', "\n", $aiResponse);
            $aiResponse = preg_replace("/\n{3,}/", "\n\n", $aiResponse);
            $aiResponse = trim($aiResponse);

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
        $tomorrowDate = date('Y-m-d', strtotime('+1 day'));
        $currentYear = date('Y');

        $basePrompt = "You are the Solennia Booking Assistant. Your SOLE purpose is to help users find, recommend, and book event vendors and venues registered on the Solennia platform.

CURRENT DATE: {$currentDate}
TOMORROW'S DATE: {$tomorrowDate}
CURRENT YEAR: {$currentYear}

CURRENT BOOKING DATA:
{$extractedDataJson}

CURRENT STAGE: {$stage}

STAGES:
- discovery: Gathering event details from user
- recommendation: Presenting vendor/venue recommendations to user
- vendor_search: User is browsing and selecting from vendor options
- confirmation: Confirming final details before booking
- completed: Booking successfully created

ABSOLUTE RULES - NEVER BREAK THESE:

1. PURPOSE & INPUT VALIDATION:
   A. You ONLY handle booking and vendor/venue recommendation. If user asks anything unrelated (general questions, coding, homework, trivia, opinions, etc.), respond: 'I can only assist with finding vendors and making bookings on Solennia. What event are you planning?'

   B. GIBBERISH / MEANINGLESS INPUT DETECTION - CRITICAL:
      - Before doing ANYTHING with a user message, check if it contains meaningful content.
      - A message is GIBBERISH if it consists of random repeated characters, keyboard mashing, or nonsense strings (e.g. 'awdawdawdaw', 'asdfasdf', 'qwerty123', 'aaaaaaa', 'zxcvzxcv').
      - HOW TO DETECT: If the message has NO recognizable words, dates, numbers with context, event types, vendor names, or booking-related intent - it is gibberish.
      - IF GIBBERISH: Do NOT call extract_booking_info. Do NOT update booking data. Do NOT infer any event type, date, or booking detail. Simply respond: 'I did not understand that. Could you please describe what event you are planning?'
      - NEVER extract event_type, date, time, budget, guests, location, vendor_id, or venue_id from a gibberish message.
      - Examples of gibberish: 'awdawdawdawdaw', 'sdfgsdfg', 'aaaaabbbbb', 'qqqqqq', repeated keyboard patterns.
      - Examples of valid input: 'birthday', 'tomorrow', 'wedding next month', 'I need a photographer', '50 guests', 'budget 30000'.

   C. KEYWORD ALIASES - treat these words as requests to search for vendors:
      - 'supplier', 'suppliers', 'vendor', 'vendors' with no specific category = call search_vendors with NO category filter to return ALL types
      - 'all suppliers', 'all vendors', 'available suppliers', 'show all', 'list all', 'send all' = call search_vendors with NO category filter
      - 'photographer', 'photography', 'videographer' = category: 'Photography & Videography'
      - 'caterer', 'catering', 'food' = category: 'Catering'
      - 'venue', 'venues', 'hall', 'church', 'garden', 'hotel' = category: 'Venue'
      - 'coordinator', 'coordination', 'host', 'emcee' = category: 'Coordination & Hosting'
      - 'decorator', 'decoration', 'flowers', 'florist' = category: 'Decoration'
      - 'entertainment', 'band', 'singer', 'dj' = category: 'Entertainment'

2. NO EMOJIS: Do not use any emojis whatsoever. Not a single one.

3. NO HALLUCINATION: 
   - ONLY recommend vendors/venues returned by the search_vendors function.
   - NEVER invent, fabricate, or guess vendor names.
   - NEVER say 'You could also try...' or 'Popular options include...' unless those vendors came from search_vendors results.
   - If no vendors match, say: 'No matching vendors were found in the Solennia system for that criteria. You may want to adjust your budget, location, or category.'

4. DATE VALIDATION - READ CAREFULLY:
   - Today is {$currentDate}. Tomorrow is {$tomorrowDate}.
   - VALID future dates include: 'tomorrow', 'next week', 'next month', specific future dates, etc.
   - 'Tomorrow' means {$tomorrowDate} which IS a valid future date. NEVER reject 'tomorrow'.
   - ONLY reject dates that are strictly BEFORE {$currentDate} (i.e., yesterday or earlier).
   - If user says 'tomorrow', extract date as {$tomorrowDate}.
   - If user says 'next [weekday]', calculate the next occurrence of that weekday.
   - If user says 'next week', use 7 days from today: {$tomorrowDate} onwards.
   - If user gives a date before {$currentDate}, respond: 'That date has already passed. Please provide a future date.'
   - If user provides month/day without year, use {$currentYear}. If that month is already past, use next year.
   - MONTH ABBREVIATIONS: Users may type abbreviated month names. You MUST recognize these and convert to YYYY-MM-DD:
     jan=01, feb=02, mar=03, apr=04, may=05, jun=06, jul=07, aug=08, sep=09, oct=10, nov=11, dec=12.
     Examples: 'feb 20 2027' = 2027-02-20, 'jan 5' = {$currentYear}-01-05 (or next year if Jan already passed), 'march 15 2027' = 2027-03-15.
     Also recognize full month names: january, february, march, april, may, june, july, august, september, october, november, december.
   - NEVER call extract_booking_info with a date before {$currentDate}. Reject it in your response instead.

5. HUMAN-LIKE BOOKING LOGIC:
   - Ask questions one at a time, not all at once.
   - If user provides multiple details at once, acknowledge all of them.
   - NEVER assume or infer the event type. ALWAYS ask the user what type of event they are planning.
   - Even if a vendor's listing mentions specific event types (e.g. 'Wedding Packages', 'Debut Packages'), do NOT assume the user wants that event type. Present the vendor's information neutrally and ask the user what event they are planning.
   - When presenting vendor details, show the vendor's services and pricing as listed WITHOUT framing them for a specific event type that the user has not mentioned.
   - Confirm the vendor choice, date, and time before creating any booking.
   - Before calling create_booking, explicitly summarize: 'To confirm: you want to book [Vendor] for [Event Type] on [Date] at [Time]. Shall I proceed?'

6. RESPONSE STYLE:
   - Professional, concise, and direct.
   - Use Philippine Peso (P) for pricing.
   - Keep responses under 150 words unless presenting vendor options.
   - No unnecessary filler or pleasantries. Be helpful but efficient.
   - Write in plain prose. Do NOT use numbered lists when asking one question. Only use numbered lists when presenting multiple vendor options.

INFORMATION TO GATHER (in order):
1. Event type (ALWAYS ask the user - NEVER infer from vendor data)
2. Event date (must be {$currentDate} or later, format YYYY-MM-DD; 'tomorrow' = {$tomorrowDate})
3. Event time
4. Location - ONLY ask for location if booking a SUPPLIER (photographer, caterer, coordinator, etc.). ACCEPT ANY location description provided by the user (e.g. city, area, landmark). Do NOT be strict or ask for a specific address. If the user mentions a city (e.g. 'Mandaluyong'), accept it immediately. Do NOT ask for location when booking a VENUE because the client goes to the venue.
5. Budget
6. Number of guests
7. Vendor/venue selection (from search results only)

FUNCTION USAGE:
- extract_booking_info: Call IMMEDIATELY when user provides ANY booking detail. NEVER skip this. Always validate dates are not before {$currentDate} before extracting.
- search_vendors: Call when user asks to find/browse vendors or says ANY of: 'supplier', 'suppliers', 'vendor', 'vendors', 'show all', 'list all', 'send all', 'available suppliers', 'available vendors', OR mentions a specific vendor/category name.
  - When user says 'supplier(s)' or 'vendor(s)' with NO category specified, call search_vendors with NO category parameter - this returns ALL types.
  - CRITICAL: If 'vendor_id' or 'venue_id' is ALREADY present in CURRENT BOOKING DATA, do NOT call search_vendors. Focus ONLY on completing the booking for the selected ID.
  - NEVER call search_vendors just because the user provided a date, time, budget, or event type alone. Those should only trigger extract_booking_info.
  - For venue types (Churches, Gardens, Hotels): use category='Venue' and keyword for the type.
- check_availability: Call this IMMEDIATELY and AUTOMATICALLY whenever BOTH of these conditions are true: (1) a vendor_id or venue_id exists in currentData AND (2) a date exists in currentData. Do not wait for the user to ask you to check. Do not skip this step. If the vendor is unavailable on the requested date, inform the user and ask for an alternative date.
- create_booking: ONLY after user explicitly confirms ALL details.
  - FOR VENUE BOOKING: Must have event_type, date, time, budget, guests, and venue_id. Location is NOT required.
  - FOR SUPPLIER BOOKING: Must have event_type, date, time, location, budget, guests, and vendor_id. Location IS required.

IMPORTANT - DO NOT REPEAT VENDOR INFO:
- Once you have already presented a vendor's details (name, pricing, packages), do NOT show them again.
- When the user provides additional booking details (date, time, budget, guests, location), simply acknowledge those details and ask for the next missing piece (especially Event Type). Do NOT re-display vendor information.
- Vendor cards appear automatically from search results. You do not need to and should not trigger another search for the same vendor.
- CONTEXT MAINTENANCE: If a vendor is selected, and the user answers a question (e.g. provides 'Birthday' as the event type), APPLY that answer to the CURRENT vendor booking. Do NOT treat it as a request to search for new vendors.

RECOMMENDATION-TO-BOOKING FLOW:
- After presenting vendor/venue recommendations from search_vendors, ALWAYS ask: 'Would you like to proceed with booking any of these options?'
- If user selects a vendor/venue, extract the vendor_id or venue_id immediately.
- Once vendor is selected and date is provided, IMMEDIATELY call check_availability before proceeding.
- If the vendor is NOT available, tell the user and ask for a different date. Do NOT proceed to confirmation.
- If the vendor IS available, continue gathering remaining details (time, location for suppliers, budget, guests).
- The flow is: discovery -> recommendation -> vendor_search -> confirmation -> completed.

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
- Venues: Use venue_id for check_availability and create_booking. Do NOT ask for location. The venue's address IS the event location. If user chose a venue, set location to null or skip it entirely.
- Suppliers (Photography, Catering, Coordination, Decoration, Entertainment, Others): Use vendor_id. You MUST ask for the event location because the supplier needs to travel to the client's event.

CRITICAL: Use exact numeric IDs from search_vendors results. NEVER use placeholder IDs like 1.";

        if ($stage === 'recommendation') {
            $basePrompt .= "\n\nCURRENT TASK: You have presented recommendations. Ask the user if they would like to proceed with booking one of the options, or if they need different recommendations.";
        }
        elseif ($stage === 'vendor_search') {
            $basePrompt .= "\n\nCURRENT TASK: Search for vendors and present options to the user. After presenting, ask if they want to proceed with booking.";
        }
        elseif ($stage === 'confirmation') {
            $basePrompt .= "\n\nCURRENT TASK: Confirm all booking details with the user before proceeding. Remember: location is only required for supplier bookings, not venue bookings.";
        }

        return $basePrompt;
    }

    private function getBookingFunctions(): array
    {
        $tomorrowDate = date('Y-m-d', strtotime('+1 day'));
        $currentDate = date('Y-m-d');

        return [
            [
                'name' => 'extract_booking_info',
                'description' => 'Extract event details from user message',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'event_type' => ['type' => 'string', 'description' => 'Explicitly stated event type only. Do NOT guess.'],
                        'date' => ['type' => 'string', 'description' => "Event date in YYYY-MM-DD format. Must be {$currentDate} or later. IMPORTANT: 'tomorrow' = {$tomorrowDate} which IS a valid future date. 'Next week' = 7+ days from today. Parse common formats: 'feb 20 2027' = '2027-02-20', 'january 5' = current or next year. Recognize month abbreviations (jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec) and full month names. NEVER reject 'tomorrow' or any future date."],
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
                'description' => 'Search for vendors/venues. Results come ONLY from vendor_listings and venue_listings tables. TRIGGER when user says: supplier, suppliers, vendor, vendors, available suppliers, show all, list all, or any category keyword. When user says supplier(s) or vendor(s) with NO specific category, call with NO category parameter to return ALL types. Returns ALL results when no filters; up to 10 when filters applied.',
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
                        'vendor_id' => ['type' => 'integer', 'description' => 'Supplier ID from vendor_listings search results'],
                        'venue_id' => ['type' => 'integer', 'description' => 'Venue ID from venue_listings search results (use when booking a venue)'],
                        'date' => ['type' => 'string']
                    ],
                    'required' => ['date']
                ]
            ],
            [
                'name' => 'create_booking',
                'description' => 'Create booking when user confirms all details. Use vendor_id for suppliers from vendor_listings, venue_id for venues from venue_listings.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'vendor_id' => ['type' => 'integer', 'description' => 'Supplier ID from vendor_listings search results. DO NOT GUESS.'],
                        'venue_id' => ['type' => 'integer', 'description' => 'Venue ID from venue_listings search results. DO NOT GUESS.'],
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
                if ($key === 'date') {
                    // FIX #1: normalizeDate now handles 'tomorrow', 'next week', etc.
                    $value = $this->normalizeDate($value);
                    if (!$value) {
                        error_log("REJECTED UNPARSEABLE DATE from AI");
                        continue;
                    }
                    // Only reject dates strictly before TODAY (yesterday and earlier)
                    // 'Tomorrow' and all future dates are valid
                    $today = date('Y-m-d');
                    if ($value < $today) {
                        error_log("REJECTED PAST DATE: {$value} (today is {$today})");
                        continue;
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

    /**
     * FIX #1: Normalize date strings into YYYY-MM-DD format.
     * Now properly handles: 'tomorrow', 'next week', 'next [weekday]',
     * 'feb 20 2027', 'february 20 2027', '2027-02-20', '20 feb 2027', etc.
     */
    private function normalizeDate(string $dateStr): ?string
    {
        $dateStr = trim($dateStr);

        // Already in YYYY-MM-DD format
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
            return $dateStr;
        }

        $lower = strtolower($dateStr);

        // Handle relative terms FIRST before strtotime (more reliable)
        if ($lower === 'tomorrow') {
            return date('Y-m-d', strtotime('+1 day'));
        }

        if ($lower === 'today') {
            return date('Y-m-d');
        }

        if (in_array($lower, ['next week', 'the following week'])) {
            return date('Y-m-d', strtotime('+7 days'));
        }

        if ($lower === 'next month') {
            return date('Y-m-d', strtotime('+1 month'));
        }

        // Handle 'next [weekday]' e.g. 'next friday', 'next saturday'
        if (preg_match('/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i', $lower)) {
            $timestamp = strtotime($dateStr);
            if ($timestamp !== false) {
                return date('Y-m-d', $timestamp);
            }
        }

        // Try PHP's strtotime which handles most natural date formats
        $timestamp = strtotime($dateStr);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }

        // Manual parsing for formats like "feb 20 2027" or "20 feb 2027"
        $months = [
            'jan' => 1, 'january' => 1,
            'feb' => 2, 'february' => 2,
            'mar' => 3, 'march' => 3,
            'apr' => 4, 'april' => 4,
            'may' => 5,
            'jun' => 6, 'june' => 6,
            'jul' => 7, 'july' => 7,
            'aug' => 8, 'august' => 8,
            'sep' => 9, 'sept' => 9, 'september' => 9,
            'oct' => 10, 'october' => 10,
            'nov' => 11, 'november' => 11,
            'dec' => 12, 'december' => 12,
        ];

        $parts = preg_split('/[\s,\/\-]+/', strtolower($dateStr));
        $month = null;
        $day = null;
        $year = null;

        foreach ($parts as $part) {
            if (isset($months[$part])) {
                $month = $months[$part];
            }
            elseif (is_numeric($part)) {
                $num = (int)$part;
                if ($num > 31) {
                    $year = $num;
                }
                elseif ($day === null) {
                    $day = $num;
                }
                else {
                    $year = $num;
                }
            }
        }

        if ($month && $day) {
            if (!$year) {
                $year = (int)date('Y');
                $currentMonth = (int)date('n');
                $currentDay = (int)date('j');
                if ($month < $currentMonth || ($month === $currentMonth && $day < $currentDay)) {
                    $year++;
                }
            }
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }

        return null;
    }

    private function determineBookingStage(array $data): string
    {
        $hasBasics = !empty($data['event_type'])
            && !empty($data['date'])
            && !empty($data['time']);

        if ($hasBasics && (!empty($data['location']) || !empty($data['venue_id']))) {
            if (!empty($data['venue_id']) || !empty($data['vendor_id'])) {
                return 'confirmation';
            }
            return 'vendor_search';
        }

        return 'discovery';
    }

    /**
     * FIX #2: searchVendorsForBooking now queries ONLY vendor_listings and venue_listings.
     * The legacy event_service_provider table is completely removed from search results.
     */
    private function searchVendorsForBooking(array $criteria): array
    {
        if (strtolower($criteria['category'] ?? '') === 'venue') {
            return $this->searchVenuesForBooking($criteria);
        }

        // ONLY query vendor_listings (legacy event_service_provider is excluded)
        $query = DB::table('vendor_listings')
            ->where('status', 'Active');

        if (!empty($criteria['category'])) {
            $query->where('service_category', $criteria['category']);
        }

        if (!empty($criteria['keyword'])) {
            $query->where(function ($q) use ($criteria) {
                $q->where('business_name', 'LIKE', '%' . $criteria['keyword'] . '%')
                    ->orWhere('description', 'LIKE', '%' . $criteria['keyword'] . '%')
                    ->orWhere('services', 'LIKE', '%' . $criteria['keyword'] . '%');
            });
        }

        if (!empty($criteria['location']) && empty($criteria['keyword'])) {
            $query->where(function ($q) use ($criteria) {
                $q->where('address', 'LIKE', '%' . $criteria['location'] . '%');
            });
        }

        // Smart limit: Show ALL if no filters, limit to 10 if filters applied
        $hasFilters = !empty($criteria['location']) || !empty($criteria['budget_max']) || !empty($criteria['keyword']);
        $limit = $hasFilters ? ($criteria['limit'] ?? 10) : 100;

        $vendors = $query->select(
            'id',
            'business_name',
            'service_category',
            'pricing',
            'description',
            'address',
            'user_id'
        )->limit($limit)->get()->toArray();

        $result = json_decode(json_encode($vendors), true);
        foreach ($result as &$v) {
            $v['ID'] = (int)$v['id'];
            $v['vendor_id'] = (int)$v['id'];
            $v['BusinessName'] = $v['business_name'];
            $v['Category'] = $v['service_category'] ?? 'Others';
            $v['Pricing'] = $v['pricing'];
            $v['Description'] = $v['description'];
            $v['BusinessAddress'] = $v['address'];
            $v['UserID'] = $v['user_id'];
            $v['AverageRating'] = null;
            $v['TotalReviews'] = 0;
            $v['type'] = 'supplier';
            $v['source'] = 'vendor_listings';
        }
        unset($v);

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

        $hasFilters = !empty($criteria['location']) || !empty($criteria['budget_max']) || !empty($criteria['keyword']);
        $limit = $hasFilters ? ($criteria['limit'] ?? 10) : 100;
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
            $v['ID'] = (int)$v['id'];
            $v['venue_id'] = (int)$v['id'];
            $v['BusinessName'] = $v['venue_name'];
            $v['Pricing'] = $v['pricing'];
            $v['BusinessAddress'] = $v['address'];
            $v['Category'] = 'Venue';
        }
        unset($v);

        return $result;
    }

    private function checkVendorAvailabilityForDate(int $vendorId, string $date): array
    {
        $vendorUserId = null;
        $espId = null;

        // FIX #2: Check vendor_listings ONLY (no fallback to event_service_provider for search)
        $listing = DB::table('vendor_listings')
            ->where('id', $vendorId)
            ->where('status', 'Active')
            ->first();

        if ($listing) {
            $vendorUserId = $listing->user_id;

            // Still check event_service_provider for existing bookings via ESP ID linkage
            // (booking table uses EventServiceProviderID which may reference legacy IDs)
            $espId = DB::table('event_service_provider')
                ->where('UserID', $listing->user_id)
                ->where('ApplicationStatus', 'Approved')
                ->value('ID');
        }
        else {
            // The vendor_id does not exist in vendor_listings - vendor not found
            return ['available' => false, 'reason' => 'Vendor not found in the system'];
        }

        // Check 1: Existing bookings using ESP ID (booking table integrity)
        if ($espId) {
            $existingBooking = DB::table('booking')
                ->where('EventServiceProviderID', $espId)
                ->where(function ($q) use ($date) {
                $q->whereRaw('DATE(EventDate) = ?', [$date])
                    ->orWhere(function ($q2) use ($date) {
                    $q2->where('start_date', '<=', $date)
                        ->where('end_date', '>=', $date);
                });
            })
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($existingBooking) {
                return [
                    'available' => false,
                    'reason' => 'Already booked on this date'
                ];
            }
        }

        // Check 2: Vendor availability calendar (marked unavailable by vendor)
        if ($vendorUserId) {
            $unavailable = DB::table('vendor_availability')
                ->where('vendor_user_id', $vendorUserId)
                ->where('date', $date)
                ->where('is_available', 0)
                ->first();

            if ($unavailable) {
                $reason = 'Vendor marked this date as unavailable';
                if (!empty($unavailable->notes)) {
                    $reason .= ': ' . $unavailable->notes;
                }
                return [
                    'available' => false,
                    'reason' => $reason
                ];
            }
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
                ->orWhereRaw('DATE(EventDate) = ?', [$date])
                ->orWhere(function ($q2) use ($date) {
                $q2->where('start_date', '<=', $date)->where('end_date', '>=', $date);
            });
        })
            ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
            ->exists();

        if ($conflict) {
            return ['available' => false, 'reason' => 'Already booked on this date'];
        }

        // Check 2: Venue availability table
        $unavailable = DB::table('venue_availability')
            ->where('venue_id', $venueId)
            ->where('date', $date)
            ->where('is_available', 0)
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

        // Check 3: Venue owner's vendor_availability calendar
        if ($venue->user_id) {
            $vendorUnavailable = DB::table('vendor_availability')
                ->where('vendor_user_id', $venue->user_id)
                ->where('date', $date)
                ->where('is_available', 0)
                ->first();

            if ($vendorUnavailable) {
                return [
                    'available' => false,
                    'reason' => 'Venue owner marked this date as unavailable'
                ];
            }
        }

        return ['available' => true];
    }

    private function createBookingFromConversation(array $bookingData, int $vendorId, int $userId): ?int
    {
        try {
            $businessName = null;
            $espId = null;
            $vendorUserId = null;
            $pricing = 0;

            // FIX #2: Only look up from vendor_listings
            $listing = DB::table('vendor_listings')
                ->where('id', $vendorId)
                ->where('status', 'Active')
                ->first();

            if (!$listing && !empty($bookingData['vendor_name'])) {
                // Fallback: search by name in vendor_listings only
                $listing = DB::table('vendor_listings')
                    ->where('business_name', 'LIKE', '%' . $bookingData['vendor_name'] . '%')
                    ->where('status', 'Active')
                    ->first();
            }

            if (!$listing) {
                error_log("CREATE_BOOKING: Vendor not found in vendor_listings. vendor_id={$vendorId}");
                return null;
            }

            $businessName = $listing->business_name;
            $vendorUserId = $listing->user_id;
            $pricing = floatval($listing->pricing ?? 0);

            // Find ESP ID for booking table linkage (booking table requires EventServiceProviderID)
            $espId = DB::table('event_service_provider')
                ->where('UserID', $listing->user_id)
                ->where('ApplicationStatus', 'Approved')
                ->value('ID');

            // If no ESP exists, use the vendor_listings id as a reference
            if (!$espId) {
                $espId = $listing->id;
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
                'EventServiceProviderID' => $espId,
                'ServiceName' => $businessName,
                'EventDate' => $bookingData['date'] ?? null,
                'EventLocation' => $bookingData['location'] ?? '',
                'EventType' => $bookingData['event_type'] ?? null,
                'PackageSelected' => 'AI Conversational Booking',
                'AdditionalNotes' => $notes,
                'TotalAmount' => $pricing,
                'BookingStatus' => 'Pending',
                'BookingDate' => date('Y-m-d H:i:s'),
                'CreatedAt' => date('Y-m-d H:i:s'),
                'CreatedBy' => $userId
            ]);

            $client = DB::table('credential')->where('id', $userId)->first();
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));
            $eventType = $bookingData['event_type'] ?? 'an event';

            if ($vendorUserId) {
                $this->sendNotification(
                    $vendorUserId,
                    'booking_request',
                    'New AI Booking Request',
                    "{$clientName} created a booking via AI assistant for {$eventType}"
                );
            }

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
                if (!empty($bookingData['venue_name'])) {
                    $venue = DB::table('venue_listings')
                        ->where('venue_name', 'LIKE', '%' . $bookingData['venue_name'] . '%')
                        ->where('status', 'Active')
                        ->first();
                }

                if (!$venue) {
                    error_log("CREATE_VENUE_BOOKING: ERROR - Venue not found. venue_id={$venueId}");
                    return null;
                }
                $venueId = $venue->id;
            }

            error_log("CREATE_VENUE_BOOKING: Venue found - {$venue->venue_name}");

            $startDate = $bookingData['date'] ?? null;
            if (!$startDate) {
                error_log("CREATE_VENUE_BOOKING: ERROR - No date provided");
                return null;
            }
            $endDate = $startDate;

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
                });
            })
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($conflict) {
                error_log("CREATE_VENUE_BOOKING: ERROR - Conflict found for date {$startDate}");
                return null;
            }

            $eventTime = $bookingData['time'] ?? '00:00';

            if (stripos($eventTime, 'PM') !== false || stripos($eventTime, 'AM') !== false) {
                $timeParts = preg_split('/\s+/', $eventTime);
                $time = $timeParts[0];
                $meridiem = strtoupper($timeParts[1] ?? 'AM');

                list($hour, $minute) = explode(':', $time);
                $hour = (int)$hour;
                $minute = (int)$minute;

                if ($meridiem === 'PM' && $hour < 12) {
                    $hour += 12;
                }
                elseif ($meridiem === 'AM' && $hour === 12) {
                    $hour = 0;
                }

                $eventTime24 = sprintf('%02d:%02d:00', $hour, $minute);
            }
            else {
                $eventTime24 = (strpos($eventTime, ':') !== false) ? $eventTime . ':00' : $eventTime;
            }

            $eventDateTime = $startDate . ' ' . $eventTime24;

            $eventServiceProviderId = DB::table('event_service_provider')
                ->where('UserID', $venue->user_id)
                ->where('ApplicationStatus', 'Approved')
                ->value('ID');

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
                'EventDate' => $eventDateTime,
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

            error_log("CREATE_VENUE_BOOKING: SUCCESS - Booking ID={$bookingId}");

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