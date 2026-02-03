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

    public function chat(Request $request, Response $response): Response
    {
        try {
            // ✅ SECURITY: Rate limiting - max 20 messages per hour per user
            $user = $request->getAttribute('user');
            $userId = $user->mysql_id ?? $user->sub ?? null;
            
            if ($userId && !$this->checkRateLimit($userId)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Rate limit exceeded. Please wait before sending more messages. This helps us prevent abuse and keep the service available for all users.'
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
            
            // ✅ SECURITY: Message length limit
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
            
            // ✅ SECURITY: Record successful request for rate limiting
            if ($userId) {
                $this->recordRequest($userId);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'response' => $result['response']
            ]);

        } catch (\Exception $e) {
            error_log("AI Chat Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Server error: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Check rate limit for AI chat
     * Prevents abuse by limiting requests per user
     */
    private function checkRateLimit(int $userId): bool
    {
        $cacheFile = sys_get_temp_dir() . '/solennia_ai_rate_limit.json';
        $maxRequests = 20; // Max 20 messages per hour
        $timeWindow = 3600; // 1 hour in seconds
        
        try {
            // Load existing rate limit data
            $data = [];
            if (file_exists($cacheFile)) {
                $json = file_get_contents($cacheFile);
                $data = json_decode($json, true) ?: [];
            }
            
            $now = time();
            $userKey = "user_{$userId}";
            
            // Clean old entries
            if (isset($data[$userKey])) {
                $data[$userKey] = array_filter($data[$userKey], function($timestamp) use ($now, $timeWindow) {
                    return ($now - $timestamp) < $timeWindow;
                });
            } else {
                $data[$userKey] = [];
            }
            
            // Check if user exceeded rate limit
            if (count($data[$userKey]) >= $maxRequests) {
                return false;
            }
            
            return true;
            
        } catch (\Exception $e) {
            error_log("Rate limit check error: " . $e->getMessage());
            return true; // Allow on error to avoid blocking legitimate users
        }
    }
    
    /**
     * Record AI chat request for rate limiting
     */
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
            
        } catch (\Exception $e) {
            error_log("Failed to record request: " . $e->getMessage());
        }
    }

    public function recommendations(Request $request, Response $response): Response
    {
        try {
            $data = $request->getParsedBody();
            
            $eventDetails = [
                'event_type' => $data['event_type'] ?? '',
                'event_date' => $data['event_date'] ?? '',
                'location' => $data['location'] ?? '',
                'budget' => $data['budget'] ?? '',
                'guests' => $data['guests'] ?? '',
                'category' => $data['category'] ?? '',
                'requirements' => $data['requirements'] ?? ''
            ];

            // ✅ FIXED: Fetch both event_service_provider AND venue_listings
            $vendors = [];
            
            // Get approved event service providers
            $query = DB::table('event_service_provider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->select(
                    'esp.ID',
                    'esp.BusinessName',
                    'esp.Category',
                    'esp.Description',
                    'esp.Pricing',
                    'esp.BusinessAddress',
                    'esp.services',
                    'esp.service_areas',
                    'esp.bio',
                    'esp.AverageRating',
                    'esp.TotalReviews',
                    'esp.ApplicationStatus',
                    'c.email',
                    'c.first_name',
                    'c.last_name',
                    DB::raw("'event_service_provider' as source_table")
                )
                ->where('esp.ApplicationStatus', '=', 'Approved');
            
            // ✅ Filter by category if specified (for non-venue categories)
            if (!empty($eventDetails['category']) && $eventDetails['category'] !== 'Venue') {
                $query->where('esp.Category', '=', $eventDetails['category']);
            }
            
            $serviceProviders = $query->limit(30)->get()->toArray();
            $vendors = array_merge($vendors, json_decode(json_encode($serviceProviders), true));
            
            // ✅ Get active venues from venue_listings
            if (empty($eventDetails['category']) || $eventDetails['category'] === 'Venue') {
                $venueQuery = DB::table('venue_listings as v')
                    ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
                    ->select(
                        'v.id as ID',
                        'v.venue_name as BusinessName',
                        DB::raw("'Venue' as Category"),
                        'v.description as Description',
                        'v.pricing as Pricing',
                        'v.address as BusinessAddress',
                        DB::raw("NULL as services"),
                        DB::raw("NULL as service_areas"),
                        DB::raw("NULL as bio"),
                        DB::raw("NULL as AverageRating"),
                        DB::raw("0 as TotalReviews"),
                        'v.status as ApplicationStatus',
                        'v.contact_email as email',
                        'c.first_name',
                        'c.last_name',
                        DB::raw("'venue_listings' as source_table"),
                        'v.venue_subcategory',
                        'v.venue_capacity',
                        'v.venue_amenities',
                        'v.venue_operating_hours',
                        'v.venue_parking'
                    )
                    ->where('v.status', '=', 'Active')
                    ->limit(20)
                    ->get()
                    ->toArray();
                
                $venues = json_decode(json_encode($venueQuery), true);
                $vendors = array_merge($vendors, $venues);
            }

            if (empty($vendors)) {
                return $this->jsonResponse($response, [
                    'success' => true,
                    'recommendations' => [],
                    'summary' => 'No approved suppliers found matching your criteria. Please try broadening your search or check back later as new suppliers join the platform.',
                    'tips' => [
                        'Try removing category filters to see more options',
                        'Consider nearby locations if your specific area has limited suppliers',
                        'Check back regularly as we approve new suppliers daily'
                    ]
                ]);
            }

            $result = $this->openAI->getSupplierRecommendations($eventDetails, $vendors);

            if (!$result['success']) {
                return $this->jsonResponse($response, $result, 503);
            }

            // Enrich recommendations with full vendor data
            $recommendations = $result['recommendations'] ?? [];
            foreach ($recommendations as &$rec) {
                $vendorId = $rec['vendor_id'] ?? null;
                if ($vendorId) {
                    foreach ($vendors as $vendor) {
                        if (($vendor['ID'] ?? $vendor['id']) == $vendorId) {
                            $rec['vendor_data'] = $vendor;
                            break;
                        }
                    }
                }
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'recommendations' => $recommendations,
                'summary' => $result['summary'] ?? '',
                'tips' => $result['tips'] ?? []
            ]);

        } catch (\Exception $e) {
            error_log("AI Recommendations Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Server error: ' . $e->getMessage()
            ], 500);
        }
    }

    public function status(Request $request, Response $response): Response
    {
        return $this->jsonResponse($response, [
            'success' => true,
            'configured' => $this->openAI->isConfigured(),
            'message' => $this->openAI->isConfigured() ? 'AI service is ready' : 'OpenAI API key not configured'
        ]);
    }

    public function categories(Request $request, Response $response): Response
    {
        try {
            $categories = DB::table('event_service_provider')
                ->whereNotNull('Category')
                ->where('Category', '!=', '')
                ->distinct()
                ->pluck('Category')
                ->toArray();

            return $this->jsonResponse($response, [
                'success' => true,
                'categories' => $categories
            ]);
        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to fetch categories'
            ], 500);
        }
    }

    /**
     * Get database statistics - Shows AI is reading from actual SQL database
     * Includes both event_service_provider AND venue_listings
     */
    public function stats(Request $request, Response $response): Response
    {
        try {
            $stats = [
                'total_suppliers' => DB::table('event_service_provider')->count(),
                'approved_suppliers' => DB::table('event_service_provider')
                    ->where('ApplicationStatus', 'Approved')->count(),
                'pending_suppliers' => DB::table('event_service_provider')
                    ->where('ApplicationStatus', 'Pending')->count(),
                'total_venues' => DB::table('venue_listings')->count(),
                'active_venues' => DB::table('venue_listings')
                    ->where('status', 'Active')->count(),
                'categories' => [],
                'sample_suppliers' => [],
                'sample_venues' => []
            ];
            
            // Get supplier count by category
            $categoryCounts = DB::table('event_service_provider')
                ->select('Category', DB::raw('COUNT(*) as count'))
                ->where('ApplicationStatus', 'Approved')
                ->whereNotNull('Category')
                ->groupBy('Category')
                ->get();
            
            foreach ($categoryCounts as $cat) {
                $stats['categories'][$cat->Category] = $cat->count;
            }
            
            // Add venue count to categories
            $venueCount = DB::table('venue_listings')
                ->where('status', 'Active')
                ->count();
            if ($venueCount > 0) {
                $stats['categories']['Venue'] = $venueCount;
            }
            
            // Get sample of approved suppliers (proof AI reads from SQL)
            $samples = DB::table('event_service_provider')
                ->select('ID', 'BusinessName', 'Category', 'BusinessAddress')
                ->where('ApplicationStatus', 'Approved')
                ->limit(5)
                ->get()
                ->toArray();
            
            $stats['sample_suppliers'] = array_map(function($s) {
                return [
                    'id' => $s->ID,
                    'name' => $s->BusinessName,
                    'category' => $s->Category,
                    'location' => $s->BusinessAddress
                ];
            }, $samples);
            
            // Get sample of active venues
            $venueSamples = DB::table('venue_listings')
                ->select('id', 'venue_name', 'venue_subcategory', 'address')
                ->where('status', 'Active')
                ->limit(5)
                ->get()
                ->toArray();
            
            $stats['sample_venues'] = array_map(function($v) {
                return [
                    'id' => $v->id,
                    'name' => $v->venue_name,
                    'subcategory' => $v->venue_subcategory,
                    'location' => $v->address
                ];
            }, $venueSamples);
            
            $stats['message'] = 'These are REAL suppliers and venues from your MySQL database that the AI can access and recommend!';

            return $this->jsonResponse($response, [
                'success' => true,
                'stats' => $stats
            ]);
        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to fetch stats: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * AI-assisted booking creation
     * Creates a booking based on AI conversation context
     */
    public function createBookingFromAI(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Unauthorized. Please log in to create bookings.'
                ], 401);
            }

            $userId = $user->mysql_id;
            $data = $request->getParsedBody();

            // Validate required fields
            $required = ['vendor_id', 'event_date', 'event_location'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $this->jsonResponse($response, [
                        'success' => false,
                        'error' => "Missing required field: {$field}",
                        'missing_field' => $field
                    ], 400);
                }
            }

            $vendorId = $data['vendor_id'];
            $eventDate = $data['event_date'];
            
            // Validate event date is in the future
            if (strtotime($eventDate) <= time()) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Event date must be in the future',
                    'validation_error' => 'invalid_date'
                ], 400);
            }

            // Get vendor information
            $vendor = DB::table('event_service_provider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->select('esp.*', 'c.email as vendor_email', 'c.first_name', 'c.last_name')
                ->where('esp.UserID', $vendorId)
                ->where('esp.ApplicationStatus', 'Approved')
                ->first();

            if (!$vendor) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Vendor not found or not approved',
                    'validation_error' => 'invalid_vendor'
                ], 404);
            }

            // Check vendor availability in vendor_availability table
            $dateOnly = date('Y-m-d', strtotime($eventDate));
            $availability = DB::table('vendor_availability')
                ->where('vendor_user_id', $vendorId)
                ->where('date', $dateOnly)
                ->first();

            // If availability record exists and vendor is NOT available
            if ($availability && !$availability->is_available) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Vendor is not available on this date',
                    'conflict' => true,
                    'reason' => 'vendor_unavailable',
                    'notes' => $availability->notes ?? 'Vendor marked as unavailable'
                ], 409);
            }

            // Check for existing bookings on the same date
            $existingBooking = DB::table('booking')
                ->where('EventServiceProviderID', $vendor->ID)
                ->where('EventDate', $eventDate)
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($existingBooking) {
                $formattedDate = date('F j, Y \a\t g:i A', strtotime($eventDate));
                
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Vendor already has a booking on this date',
                    'conflict' => true,
                    'reason' => 'already_booked',
                    'message' => "Unfortunately, {$vendor->BusinessName} is already booked for {$formattedDate}.",
                    'conflicting_booking_id' => $existingBooking->ID
                ], 409);
            }

            // Create the booking
            $bookingId = DB::table('booking')->insertGetId([
                'UserID' => $userId,
                'EventServiceProviderID' => $vendor->ID,
                'ServiceName' => $data['service_name'] ?? $vendor->Category,
                'EventDate' => $eventDate,
                'EventLocation' => $data['event_location'],
                'EventType' => $data['event_type'] ?? null,
                'PackageSelected' => $data['package_selected'] ?? null,
                'AdditionalNotes' => $data['additional_notes'] ?? 'Booking created via AI assistant',
                'TotalAmount' => $data['total_amount'] ?? 0.00,
                'BookingStatus' => 'Pending',
                'Remarks' => 'Created via AI booking assistant',
                'BookingDate' => DB::raw('NOW()'),
                'CreatedAt' => DB::raw('NOW()'),
                'CreatedBy' => $userId
            ]);

            // Get client info
            $client = DB::table('credential')->where('id', $userId)->first();
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'A client';

            // Send notification to vendor
            try {
                DB::table('notifications')->insert([
                    'user_id' => $vendorId,
                    'type' => 'booking_request',
                    'title' => 'New AI-Assisted Booking Request',
                    'message' => "{$clientName} has requested to book {$vendor->BusinessName} for " . 
                                 date('F j, Y', strtotime($eventDate)),
                    'read' => false,
                    'created_at' => DB::raw('NOW()')
                ]);
            } catch (\Exception $e) {
                error_log("Notification error: " . $e->getMessage());
            }

            // Get the complete booking details
            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->select('b.*', 'esp.BusinessName', 'esp.BusinessEmail', 'esp.Category')
                ->where('b.ID', $bookingId)
                ->first();

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Booking request created successfully! The vendor will review your request.',
                'booking_id' => $bookingId,
                'booking' => [
                    'id' => $booking->ID,
                    'vendor_name' => $booking->BusinessName,
                    'service_name' => $booking->ServiceName,
                    'event_date' => $booking->EventDate,
                    'event_location' => $booking->EventLocation,
                    'status' => $booking->BookingStatus,
                    'total_amount' => $booking->TotalAmount
                ],
                'next_steps' => [
                    'The vendor will be notified of your booking request',
                    'You will receive a notification when the vendor responds',
                    'You can view and manage your booking in "My Bookings" page'
                ]
            ], 201);

        } catch (\Exception $e) {
            error_log("AI Booking Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to create booking: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check vendor availability for specific dates
     * Used by AI to suggest available dates
     */
    public function checkVendorAvailability(Request $request, Response $response): Response
    {
        try {
            $params = $request->getQueryParams();
            $vendorId = $params['vendor_id'] ?? null;
            $startDate = $params['start_date'] ?? date('Y-m-d');
            $endDate = $params['end_date'] ?? date('Y-m-d', strtotime('+30 days'));

            if (!$vendorId) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'vendor_id is required'
                ], 400);
            }

            // Verify vendor exists and is approved
            $vendor = DB::table('event_service_provider')
                ->where('UserID', $vendorId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$vendor) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Vendor not found or not approved'
                ], 404);
            }

            // Get availability records
            $availabilityRecords = DB::table('vendor_availability')
                ->where('vendor_user_id', $vendorId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get()
                ->keyBy('date');

            // Get existing bookings
            $bookings = DB::table('booking')
                ->where('EventServiceProviderID', $vendor->ID)
                ->whereBetween('EventDate', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->get();

            $bookedDates = [];
            foreach ($bookings as $booking) {
                $date = date('Y-m-d', strtotime($booking->EventDate));
                $bookedDates[$date] = [
                    'date' => $date,
                    'time' => date('H:i', strtotime($booking->EventDate)),
                    'status' => $booking->BookingStatus,
                    'event_type' => $booking->EventType
                ];
            }

            // Build availability calendar
            $calendar = [];
            $current = strtotime($startDate);
            $end = strtotime($endDate);

            while ($current <= $end) {
                $dateStr = date('Y-m-d', $current);
                $availRecord = $availabilityRecords->get($dateStr);
                $isBooked = isset($bookedDates[$dateStr]);
                
                $calendar[] = [
                    'date' => $dateStr,
                    'day_of_week' => date('l', $current),
                    'is_available' => !$isBooked && (!$availRecord || $availRecord->is_available == 1),
                    'is_booked' => $isBooked,
                    'has_availability_record' => $availRecord !== null,
                    'availability_notes' => $availRecord->notes ?? null,
                    'booking_info' => $bookedDates[$dateStr] ?? null
                ];

                $current = strtotime('+1 day', $current);
            }

            // Get suggested available dates (next 5 available dates)
            $suggestedDates = array_filter($calendar, function($day) {
                return $day['is_available'] && strtotime($day['date']) > time();
            });
            $suggestedDates = array_slice($suggestedDates, 0, 5);

            return $this->jsonResponse($response, [
                'success' => true,
                'vendor_id' => $vendorId,
                'vendor_name' => $vendor->BusinessName,
                'date_range' => [
                    'start' => $startDate,
                    'end' => $endDate
                ],
                'calendar' => $calendar,
                'suggested_dates' => array_values($suggestedDates),
                'summary' => [
                    'total_days' => count($calendar),
                    'available_days' => count(array_filter($calendar, fn($d) => $d['is_available'])),
                    'booked_days' => count($bookedDates),
                    'unavailable_days' => count(array_filter($calendar, fn($d) => !$d['is_available'] && !$d['is_booked']))
                ]
            ]);

        } catch (\Exception $e) {
            error_log("Check Availability Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to check availability'
            ], 500);
        }
    }

    /**
     * Generate FAQs - UC18
     */
    public function generateFAQs(Request $request, Response $response): Response
    {
        try {
            $data = $request->getParsedBody();
            $category = $data['category'] ?? 'general';
            
            // Get recent inquiries from database to analyze patterns
            $inquiries = [];
            try {
                $recentBookings = DB::table('booking')
                    ->select('AdditionalNotes')
                    ->whereNotNull('AdditionalNotes')
                    ->where('AdditionalNotes', '!=', '')
                    ->orderBy('CreatedAt', 'desc')
                    ->limit(100)
                    ->get();
                
                foreach ($recentBookings as $booking) {
                    if (!empty($booking->AdditionalNotes)) {
                        $inquiries[] = $booking->AdditionalNotes;
                    }
                }
            } catch (\Exception $e) {
                // Continue without inquiry data
            }

            $result = $this->openAI->generateFAQs($inquiries, $category);

            if (!$result['success']) {
                return $this->jsonResponse($response, $result, 503);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'faqs' => $result['faqs'],
                'summary' => $result['summary'],
                'analyzed_inquiries' => count($inquiries)
            ]);

        } catch (\Exception $e) {
            error_log("FAQ Generation Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to generate FAQs: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Save FAQ to database
     */
    public function saveFAQ(Request $request, Response $response): Response
    {
        try {
            $data = $request->getParsedBody();
            
            if (empty($data['question']) || empty($data['answer'])) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'error' => 'Question and answer are required'
                ], 400);
            }
            
            $faqId = DB::table('faqs')->insertGetId([
                'category' => $data['category'] ?? 'General',
                'question' => $data['question'],
                'answer' => $data['answer'],
                'priority' => $data['priority'] ?? 5,
                'is_published' => $data['is_published'] ?? false,
                'created_at' => DB::raw('NOW()'),
                'updated_at' => DB::raw('NOW()')
            ]);

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'FAQ saved successfully',
                'faq_id' => $faqId
            ], 201);

        } catch (\Exception $e) {
            error_log("Save FAQ Error: " . $e->getMessage());
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to save FAQ: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all FAQs
     */
    public function getFAQs(Request $request, Response $response): Response
    {
        try {
            $params = $request->getQueryParams();
            $publishedOnly = isset($params['published']) && $params['published'] === 'true';
            
            $query = DB::table('faqs')->orderBy('priority', 'desc')->orderBy('category');
            
            if ($publishedOnly) {
                $query->where('is_published', true);
            }
            
            $faqs = $query->get();

            return $this->jsonResponse($response, [
                'success' => true,
                'faqs' => $faqs
            ]);

        } catch (\Exception $e) {
            // Table might not exist yet
            return $this->jsonResponse($response, [
                'success' => true,
                'faqs' => [],
                'note' => 'FAQ table not found - please create it using the SQL in the README'
            ]);
        }
    }

    /**
     * Update FAQ
     */
    public function updateFAQ(Request $request, Response $response, array $args): Response
    {
        try {
            $faqId = $args['id'];
            $data = $request->getParsedBody();
            
            $updateData = ['updated_at' => DB::raw('NOW()')];
            
            if (isset($data['category'])) $updateData['category'] = $data['category'];
            if (isset($data['question'])) $updateData['question'] = $data['question'];
            if (isset($data['answer'])) $updateData['answer'] = $data['answer'];
            if (isset($data['priority'])) $updateData['priority'] = $data['priority'];
            if (isset($data['is_published'])) $updateData['is_published'] = $data['is_published'];
            
            DB::table('faqs')->where('id', $faqId)->update($updateData);

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'FAQ updated successfully'
            ]);

        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to update FAQ: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete FAQ
     */
    public function deleteFAQ(Request $request, Response $response, array $args): Response
    {
        try {
            $faqId = $args['id'];
            
            DB::table('faqs')->where('id', $faqId)->delete();

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'FAQ deleted successfully'
            ]);

        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'error' => 'Failed to delete FAQ: ' . $e->getMessage()
            ], 500);
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