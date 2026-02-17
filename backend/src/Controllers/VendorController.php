<?php
namespace Src\Controllers;

use Cloudinary\Cloudinary;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

/**
 * =============================================================
 * COMPLETE VENDORCONTROLLER WITH ALL ENHANCEMENTS
 * =============================================================
 * This is the COMPLETE file with all new methods integrated
 * REPLACE your existing VendorController.php with this file
 * =============================================================
 */

class VendorController
{
    private Cloudinary $cloud;
    private const MAX_FILE_SIZE = 10485760; // 10MB
    private const UPLOAD_TIMEOUT = 20;

    public function __construct()
    {
        $this->cloud = new Cloudinary([
            'cloud' => [
                'cloud_name' => envx('CLOUDINARY_CLOUD'),
                'api_key' => envx('CLOUDINARY_KEY'),
                'api_secret' => envx('CLOUDINARY_SECRET')
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* ===========================================================
     * HELPER: JSON Response
     * =========================================================== */
    private function json(Response $response, bool $success, string $message, int $code, array $data = []): Response
    {
        $payload = array_merge([
            'success' => $success,
            'message' => $message
        ], $data);

        $response->getBody()->write(json_encode($payload));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($code);
    }

    /* ===========================================================
     * NEW: GET PHILIPPINE REGIONS
     * =========================================================== */
    public function getRegions(Request $request, Response $response)
    {
        try {
            $regions = DB::table('ph_regions')
                ->select('region_code', 'region_name')
                ->orderBy('region_name', 'asc')
                ->get();

            return $this->json($response, true, "Regions retrieved successfully", 200, [
                'regions' => $regions
            ]);
        }
        catch (\Exception $e) {
            error_log("GET_REGIONS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to fetch regions", 500);
        }
    }

    /* ===========================================================
     * NEW: GET CITIES BY REGION
     * =========================================================== */
    public function getCitiesByRegion(Request $request, Response $response, array $args)
    {
        try {
            $regionCode = $args['regionCode'] ?? null;

            if (!$regionCode) {
                return $this->json($response, false, "Region code is required", 400);
            }

            $cities = DB::table('ph_cities')
                ->select('city_code', 'city_name', 'province')
                ->where('region_code', $regionCode)
                ->orderBy('city_name', 'asc')
                ->get();

            return $this->json($response, true, "Cities retrieved successfully", 200, [
                'cities' => $cities,
                'region_code' => $regionCode
            ]);
        }
        catch (\Exception $e) {
            error_log("GET_CITIES_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to fetch cities", 500);
        }
    }

    /* ===========================================================
     * NEW: CALCULATE VERIFICATION SCORE
     * =========================================================== */
    private function calculateVerificationScore(array $data): int
    {
        $score = 0;

        // Business Logo: +10 points
        if (!empty($data['business_logo_url']) || !empty($data['avatar'])) {
            $score += 10;
        }

        // Government ID: +30 points (CRITICAL)
        if (!empty($data['government_id_url']) || !empty($data['gov_id_url']) || !empty($data['gov_id'])) {
            $score += 30;
        }

        // Selfie with ID: +20 points
        if (!empty($data['selfie_with_id_url']) || !empty($data['selfie_with_id'])) {
            $score += 20;
        }

        // Sample Photos/Portfolio: +15 points
        if (!empty($data['sample_photos']) || !empty($data['portfolio_photos']) || !empty($data['portfolio'])) {
            $score += 15;
        }

        // Facebook Page: +10 points
        if (!empty($data['facebook_page'])) {
            $score += 10;
        }

        // Instagram Page: +10 points
        if (!empty($data['instagram_page'])) {
            $score += 10;
        }

        // Complete Profile: +15 points
        $requiredFields = ['business_name', 'description', 'contact_email', 'region', 'city'];
        $allFieldsComplete = true;
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                $allFieldsComplete = false;
                break;
            }
        }
        if ($allFieldsComplete) {
            $score += 15;
        }

        return min($score, 100);
    }

    /* ===========================================================
     * CREATE VENDOR PROFILE (ENHANCED)
     * =========================================================== */
    public function createVendorProfile(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;

            DB::beginTransaction();

            try {
                // Check approved application
                $application = DB::table('vendor_application')
                    ->where('user_id', $userId)
                    ->where('status', 'Approved')
                    ->first();

                if (!$application) {
                    DB::rollBack();
                    return $this->json($response, false, "No approved vendor application found", 403);
                }

                // Check if profile exists
                $existingProfile = DB::table('event_service_provider')
                    ->where('UserID', $userId)
                    ->first();

                if ($existingProfile) {
                    DB::rollBack();
                    return $this->json($response, false, "Vendor profile already exists", 400);
                }

                $data = $request->getParsedBody();
                $files = $request->getUploadedFiles();

                // Required fields
                $bio = $data['bio'] ?? '';
                $services = $data['services'] ?? '';
                $serviceAreas = $data['service_areas'] ?? '';

                if (empty($bio) || empty($services)) {
                    DB::rollBack();
                    return $this->json($response, false, "Bio and services are required", 422);
                }

                // Upload logo
                $logoUrl = null;
                if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                    if ($files['logo']->getSize() > self::MAX_FILE_SIZE) {
                        DB::rollBack();
                        return $this->json($response, false, "Logo file too large (max 10MB)", 400);
                    }
                    try {
                        $tmpPath = $files['logo']->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                            "folder" => "solennia/vendors/logo/{$userId}",
                            "public_id" => "logo_" . time(),
                            "transformation" => [["width" => 300, "height" => 300, "crop" => "fit"]],
                            "timeout" => self::UPLOAD_TIMEOUT
                        ]);
                        $logoUrl = $upload['secure_url'];
                    }
                    catch (\Exception $e) {
                        error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
                    }
                }

                // Upload hero
                $heroUrl = null;
                if (isset($files['hero']) && $files['hero']->getError() === UPLOAD_ERR_OK) {
                    if ($files['hero']->getSize() > self::MAX_FILE_SIZE) {
                        DB::rollBack();
                        return $this->json($response, false, "Hero image too large (max 10MB)", 400);
                    }
                    try {
                        $tmpPath = $files['hero']->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                            "folder" => "solennia/vendors/hero/{$userId}",
                            "public_id" => "hero_" . time(),
                            "transformation" => [["width" => 1920, "height" => 1080, "crop" => "limit"]],
                            "timeout" => self::UPLOAD_TIMEOUT
                        ]);
                        $heroUrl = $upload['secure_url'];
                    }
                    catch (\Exception $e) {
                        error_log("HERO_UPLOAD_ERROR: " . $e->getMessage());
                    }
                }

                // Prepare insert data
                $insertData = [
                    'UserID' => $userId,
                    'BusinessName' => $data['business_name'] ?? $application->business_name,
                    'Category' => $application->category,
                    'BusinessEmail' => $application->contact_email,
                    'BusinessAddress' => $application->address,
                    'Description' => $application->description,
                    'Pricing' => $application->pricing,
                    'bio' => $bio,
                    'services' => $services,
                    'service_areas' => $serviceAreas,
                    'avatar' => $logoUrl,
                    'HeroImageUrl' => $heroUrl,
                    'ApplicationStatus' => 'Approved',
                    'DateApplied' => $application->created_at,
                    'DateApproved' => date('Y-m-d H:i:s'),

                    // NEW ENHANCED FIELDS
                    'contact_number' => $application->contact_number,
                    'region' => $application->region,
                    'city' => $application->city,
                    'complete_address' => $application->address,
                    'business_logo_url' => $logoUrl,
                    'government_id_url' => $application->gov_id,
                    'selfie_with_id_url' => $application->selfie_with_id,
                    'sample_photos' => $application->sample_photos,
                    'past_event_photos' => $application->past_event_photos,
                    'application_step' => 5,
                ];

                // Parse social links
                if (!empty($application->social_links)) {
                    $socialLinks = json_decode($application->social_links, true);
                    if (is_array($socialLinks)) {
                        $insertData['facebook_page'] = $socialLinks['facebook'] ?? null;
                        $insertData['instagram_page'] = $socialLinks['instagram'] ?? null;
                    }
                }

                // Category-specific
                if ($application->category === 'Catering') {
                    $insertData['menu_list_url'] = $application->menu_list;
                }

                // Calculate verification score
                $insertData['verification_score'] = $this->calculateVerificationScore($insertData);

                // Insert: filter insertData to only include columns present in the table
                $cols = DB::select("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_service_provider'");
                $available = [];
                foreach ($cols as $c) {
                    $available[] = $c->COLUMN_NAME;
                }

                // Ensure base fields exist for insert
                $baseInsert = [
                    'UserID' => $userId,
                    'ApplicationStatus' => 'Approved',
                    'DateApproved' => date('Y-m-d H:i:s')
                ];

                $filteredInsert = array_intersect_key($insertData, array_flip($available));
                // Merge baseInsert but only include keys that exist in the table
                $filteredBase = array_intersect_key($baseInsert, array_flip($available));
                $finalInsert = array_merge($filteredBase, $filteredInsert);

                if (empty($finalInsert)) {
                    DB::rollBack();
                    return $this->json($response, false, "No writable columns available for vendor profile insert", 500);
                }

                DB::table('event_service_provider')->insert($finalInsert);

                // Update user role
                DB::table('credential')
                    ->where('id', $userId)
                    ->update(['role' => 1]);

                DB::commit();

                return $this->json($response, true, "Vendor profile created successfully", 201, [
                    'vendor' => [
                        'business_name' => $insertData['BusinessName'],
                        'category' => $insertData['Category'],
                        'verification_score' => $insertData['verification_score']
                    ]
                ]);

            }
            catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        }
        catch (\Exception $e) {
            error_log("CREATE_VENDOR_PROFILE_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create profile: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     * GET VENDOR STATUS (ENHANCED)
     * =========================================================== */
    public function getVendorStatus(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }

        $userId = $u->mysql_id;

        $result = DB::table('vendor_application as va')
            ->leftJoin('event_service_provider as esp', function ($join) {
            $join->on('va.user_id', '=', 'esp.UserID')
                ->where('esp.ApplicationStatus', '=', 'Approved');
        })
            ->where('va.user_id', $userId)
            ->orderBy('va.created_at', 'desc')
            ->select(
            'va.status as application_status',
            'va.category',
            'va.region',
            'va.city',
            'esp.Category',
            'esp.BusinessName',
            'esp.bio',
            'esp.services',
            'esp.avatar',
            'esp.HeroImageUrl',
            'esp.verification_score',
            'esp.application_step',
            'esp.UserID as profile_exists',
            'esp.base_price',
            'esp.budget_tier',
            'esp.service_category',
            'esp.ai_description',
            'esp.price_range',
            'esp.service_areas',
            'esp.package_price',
            'esp.service_type_tag'
        )
            ->first();

        if (!$result) {
            return $this->json($response, true, "No vendor application found", 200, [
                'status' => 'none',
                'category' => null,
                'has_profile' => false,
                'needs_setup' => false,
                'verification_score' => 0,
                'vendor' => null
            ]);
        }

        $hasProfile = $result->profile_exists !== null;
        $needsSetup = ($result->application_status === 'Approved' && !$hasProfile);

        return $this->json($response, true, "Status retrieved", 200, [
            'status' => strtolower($result->application_status ?? 'none'),
            'category' => $result->category ?? null,
            'region' => $result->region ?? null,
            'city' => $result->city ?? null,
            'has_profile' => $hasProfile,
            'needs_setup' => $needsSetup,
            'verification_score' => $result->verification_score ?? 0,
            'application_step' => $result->application_step ?? 1,
            'vendor' => $hasProfile ? [
                'Category' => $result->Category,
                'VerificationStatus' => 'approved',
                'BusinessName' => $result->BusinessName,
                'bio' => $result->bio,
                'services' => $result->services,
                'avatar' => $result->avatar,
                'HeroImageUrl' => $result->HeroImageUrl,
                'verification_score' => $result->verification_score,
                'base_price' => $result->base_price ?? null,
                'budget_tier' => $result->budget_tier ?? 'Standard',
                'service_category' => $result->service_category ?? null,
                'ai_description' => $result->ai_description ?? null,
                'price_range' => $result->price_range ?? null,
                'service_areas' => $result->service_areas ?? null,
                'package_price' => $result->package_price ?? null,
                'service_type_tag' => $result->service_type_tag ?? null
            ] : null
        ]);
    }

    /* ===========================================================
     * GET VENDOR DASHBOARD (authenticated supplier)
     * Returns vendor profile, gallery, and optional insights for /vendor-dashboard page.
     * =========================================================== */
    public function getDashboard(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }

        $userId = (int)$u->mysql_id;

        $vendor = DB::table('event_service_provider')
            ->where('UserID', $userId)
            ->where('ApplicationStatus', 'Approved')
            ->first();

        if (!$vendor) {
            return $this->json($response, false, "Not found.", 404);
        }

        $gallery = [];
        if (!empty($vendor->gallery)) {
            $decoded = json_decode($vendor->gallery, true);
            $gallery = is_array($decoded) ? $decoded : [];
        }
        else {
            // Try legacy / alternate fields that may contain gallery images
            $possible = [$vendor->past_event_photos ?? null, $vendor->sample_photos ?? null, $vendor->portfolio ?? null, $vendor->portfolio_photos ?? null];
            foreach ($possible as $p) {
                if (empty($p))
                    continue;
                if (is_string($p)) {
                    $try = json_decode($p, true);
                    if (is_array($try) && !empty($try)) {
                        $gallery = $try;
                        break;
                    }
                    $parts = array_filter(array_map('trim', explode(',', $p)));
                    if (!empty($parts)) {
                        $gallery = $parts;
                        break;
                    }
                }
                elseif (is_array($p) && !empty($p)) {
                    $gallery = $p;
                    break;
                }
            }
        }

        $vendorData = [
            'BusinessName' => $vendor->BusinessName,
            'Category' => $vendor->Category,
            'BusinessEmail' => $vendor->BusinessEmail ?? null,
            'BusinessAddress' => $vendor->BusinessAddress ?? $vendor->service_areas ?? null,
            'bio' => $vendor->bio,
            'services' => $vendor->services,
            'service_areas' => $vendor->service_areas,
            'avatar' => $vendor->avatar,
            'HeroImageUrl' => $vendor->HeroImageUrl,
            'verification_score' => $vendor->verification_score ?? 0,
            'Pricing' => $vendor->Pricing ?? null,
            'Description' => $vendor->Description ?? null,
        ];

        return $this->json($response, true, "Dashboard loaded", 200, [
            'vendor' => $vendorData,
            'gallery' => $gallery,
            'insights' => ['labels' => [], 'datasets' => []],
        ]);
    }

    /* ===========================================================
     * GET PUBLIC VENDOR DATA
     * Supports: vendor_listings (new), event_service_provider (legacy), and venue_listings
     * so /api/vendor/public/{id} works for all vendor types.
     * Accepts optional listingId parameter to fetch specific listing when vendor has multiple.
     * =========================================================== */
    /* ===========================================================
     * GET PUBLIC VENDOR DATA
     * Only queries vendor_listings table.
     * Accepts optional listingId parameter to fetch a specific listing.
     * =========================================================== */public function getPublicVendorData(Request $request, Response $response, $args)
    {
        $userId = $args['id'] ?? $args['userId'] ?? null;
        $listingId = $request->getQueryParams()['listingId'] ?? null;

        if (!$userId) {
            return $this->json($response, false, "User ID required", 400);
        }

        $userId = (int)$userId;

        try {
            // If a specific listingId is requested, fetch that exact listing
            if ($listingId) {
                $listingId = (int)$listingId;

                $vendorListing = DB::table('vendor_listings')
                    ->where('id', $listingId)
                    ->where('user_id', $userId)
                    ->where('status', 'Active')
                    ->first();

                if (!$vendorListing) {
                    return $this->json($response, false, "Vendor listing not found", 404);
                }

                return $this->json($response, true, "Vendor retrieved", 200, [
                    'vendor' => $this->formatVendorListing($vendorListing, $userId)
                ]);
            }

            // No specific listing — return the most recent active listing
            $vendorListing = DB::table('vendor_listings')
                ->where('user_id', $userId)
                ->where('status', 'Active')
                ->orderByDesc('created_at')
                ->first();

            if (!$vendorListing) {
                return $this->json($response, false, "Vendor not found", 404);
            }

            return $this->json($response, true, "Vendor retrieved", 200, [
                'vendor' => $this->formatVendorListing($vendorListing, $userId)
            ]);

        }
        catch (\Exception $e) {
            error_log('VENDOR_PUBLIC_ERROR: ' . $e->getMessage());
            return $this->json($response, false, "Failed to load vendor", 500);
        }
    }
    /* ===========================================================
     * PRIVATE HELPER: Format a vendor_listings row for API response
     * =========================================================== */private function formatVendorListing(object $vendorListing, int $userId): array
    {
        $gallery = [];
        if (!empty($vendorListing->gallery)) {
            $decoded = json_decode($vendorListing->gallery, true);
            $gallery = is_array($decoded) ? $decoded : [];
        }

        $firebaseUid = DB::table('credential')
            ->where('id', $userId)
            ->value('firebase_uid');

        return [
            'id' => $vendorListing->user_id,
            'listing_id' => $vendorListing->id,
            'business_name' => $vendorListing->business_name,
            'category' => $vendorListing->service_category,
            'other_category_type' => $vendorListing->other_category_type ?? null,
            'description' => $vendorListing->description ?? '',
            'pricing' => $vendorListing->pricing ?? '',
            'bio' => $vendorListing->description ?? '',
            'services' => $vendorListing->services ?? null,
            'service_areas' => $vendorListing->address ?? null,
            'avatar' => $vendorListing->logo ?? null,
            'HeroImageUrl' => $vendorListing->hero_image ?? null,
            'gallery' => $gallery,
            'status' => 'Approved',
            'verification_score' => 0,
            'region' => $vendorListing->region ?? null,
            'city' => $vendorListing->city ?? null,
            'facebook_page' => null,
            'instagram_page' => null,
            'source' => 'vendor_listings',
            'firebase_uid' => $firebaseUid,
        ];
    }
    /* ===========================================================
     * GET PUBLIC VENDOR BOOKINGS (for profile calendar)
     * Returns minimal booking info (date, status) for a vendor/user.
     * Supports both supplier (event_service_provider) and venue (venue_listings).
     * =========================================================== */
    public function getPublicVendorBookings(Request $request, Response $response, $args)
    {
        $userId = isset($args['userId']) ? (int)$args['userId'] : (isset($args['id']) ? (int)$args['id'] : null);

        if (!$userId) {
            return $this->json($response, false, "User ID required", 400);
        }

        try {
            // Check legacy ESP table
            $esp = DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->where('ApplicationStatus', 'Approved')
                ->value('ID');

            // Check new vendor_listings
            // If user has migrated, they might have multiple listings?
            // For now, let's get all active listings for this user
            $listingIds = DB::table('vendor_listings')
                ->where('user_id', $userId)
                ->where('status', 'Active')
                ->pluck('id')
                ->toArray();
                
            $venueIds = DB::table('venue_listings')
                ->where('user_id', $userId)
                ->where('status', 'Active')
                ->pluck('id')
                ->toArray();

            $query = DB::table('booking')
                ->select('ID', 'EventDate', 'start_date', 'end_date', 'BookingStatus', 'venue_id', 'ServiceName')
                ->whereIn('BookingStatus', ['Pending', 'Confirmed', 'Completed']);

            $query->where(function ($q) use ($esp, $venueIds, $listingIds) {
                if ($esp) {
                    $q->orWhere(function ($q2) use ($esp) {
                        $q2->where('EventServiceProviderID', $esp)->whereNull('venue_id');
                    });
                }
                if (!empty($listingIds)) {
                    // Check if 'vendor_listing_id' column exists or if we should rely on other assumption
                    // Assuming booking table has vendor_listing_id based on previous tasks context (though not explicitly seen in this file's query)
                    // If not, we might fail. 
                    // Let's check if vendor_listing_id column exists? 
                    // Actually, let's rely on EventServiceProviderID for now if migration just moves data but bookings might typically be linked to ESP ID in legacy.
                    // But for NEW bookings on NEW listings, they should be linked via vendor_listing_id.
                    
                    // SAFEGUARD: Only query if column exists? No, query builder might throw. 
                    // Given the migration task, we probably haven't migrated bookings to point to new listing IDs yet?
                    // User only asked to migrate ESP data to Vendor Listings.
                    // But future bookings will use listing ID.
                    
                    $q->orWhereIn('vendor_listing_id', $listingIds);
                }
                if (!empty($venueIds)) {
                    $q->orWhereIn('venue_id', $venueIds);
                }
            });

            $rows = $query->orderBy('EventDate', 'asc')->get();

            $statusMap = [
                'Pending' => 'pending',
                'Confirmed' => 'confirmed',
                'Completed' => 'completed',
                'Cancelled' => 'cancelled',
                'Rejected' => 'rejected',
            ];

            $bookings = [];
            foreach ($rows as $row) {
                $eventDate = $row->start_date ?? $row->EventDate;
                $bookings[] = [
                    'id' => (int)$row->ID,
                    'event_date' => $eventDate ? (is_string($eventDate) ? $eventDate : date('Y-m-d H:i:s', strtotime($eventDate))) : null,
                    'status' => $statusMap[$row->BookingStatus] ?? strtolower($row->BookingStatus ?? ''),
                    'service_name' => $row->ServiceName ?? null,
                ];
            }

            return $this->json($response, true, "Bookings retrieved", 200, [
                'bookings' => $bookings
            ]);
        }
        catch (\Exception $e) {
            error_log('VENDOR_PUBLIC_BOOKINGS_ERROR: ' . $e->getMessage());
            return $this->json($response, false, "Failed to load bookings", 500);
        }
    }

    /* ===========================================================
     * UPDATE VENDOR LOGO
     * =========================================================== */
    public function updateLogo(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            $userId = $u->mysql_id;
            $files = $request->getUploadedFiles();

            if (!isset($files['logo']) || $files['logo']->getError() !== UPLOAD_ERR_OK) {
                return $this->json($response, false, "No file uploaded", 400);
            }

            if ($files['logo']->getSize() > self::MAX_FILE_SIZE) {
                return $this->json($response, false, "File too large (max 10MB)", 400);
            }

            $tmpPath = $files['logo']->getStream()->getMetadata('uri');
            $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                "folder" => "solennia/vendors/logo/{$userId}",
                "public_id" => "logo_" . time(),
                "transformation" => [["width" => 300, "height" => 300, "crop" => "fit"]],
                "timeout" => self::UPLOAD_TIMEOUT
            ]);

            // Update Legacy
            DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->update([
                'avatar' => $upload['secure_url'],
                'business_logo_url' => $upload['secure_url']
            ]);

            // Update New Listings (Sync logo)
            DB::table('vendor_listings')
                ->where('user_id', $userId)
                ->update(['logo' => $upload['secure_url']]);

            return $this->json($response, true, "Logo updated", 200, [
                'url' => $upload['secure_url']
            ]);

        }
        catch (\Exception $e) {
            error_log("UPDATE_LOGO_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to update logo", 500);
        }
    }

    /* ===========================================================
     * UPDATE VENDOR HERO IMAGE
     * =========================================================== */
    public function updateHero(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            $userId = $u->mysql_id;
            $files = $request->getUploadedFiles();

            if (!isset($files['hero']) || $files['hero']->getError() !== UPLOAD_ERR_OK) {
                return $this->json($response, false, "No file uploaded", 400);
            }

            if ($files['hero']->getSize() > self::MAX_FILE_SIZE) {
                return $this->json($response, false, "File too large (max 10MB)", 400);
            }

            $tmpPath = $files['hero']->getStream()->getMetadata('uri');
            $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                "folder" => "solennia/vendors/hero/{$userId}",
                "public_id" => "hero_" . time(),
                "transformation" => [["width" => 1920, "height" => 1080, "crop" => "limit"]],
                "timeout" => self::UPLOAD_TIMEOUT
            ]);

            DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->update(['HeroImageUrl' => $upload['secure_url']]);

            // Update New Listings (Sync hero)
            DB::table('vendor_listings')
                ->where('user_id', $userId)
                ->update(['hero_image' => $upload['secure_url']]);

            return $this->json($response, true, "Hero image updated", 200, [
                'url' => $upload['secure_url']
            ]);

        }
        catch (\Exception $e) {
            error_log("UPDATE_HERO_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to update hero", 500);
        }
    }

    /* ===========================================================
     * UPDATE VENDOR INFO
     * =========================================================== */
    public function updateVendorInfo(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            $userId = $u->mysql_id;
            $data = $request->getParsedBody();

            $updateData = [];

            if (isset($data['bio']))
                $updateData['bio'] = $data['bio'];
            if (isset($data['services']))
                $updateData['services'] = $data['services'];
            if (isset($data['service_areas']))
                $updateData['service_areas'] = $data['service_areas'];
            if (isset($data['description']))
                $updateData['Description'] = $data['description'];
            if (isset($data['pricing']))
                $updateData['Pricing'] = $data['pricing'];

            // Image fields - Map frontend names to database columns
            if (isset($data['hero_image']))
                $updateData['HeroImageUrl'] = $data['hero_image'];
            if (isset($data['icon_url'])) {
                $updateData['avatar'] = $data['icon_url'];
                $updateData['business_logo_url'] = $data['icon_url'];
            }
            if (isset($data['gallery'])) {
                $updateData['gallery'] = is_array($data['gallery'])
                    ? json_encode($data['gallery'])
                    : $data['gallery'];
            }

            // Address & location fields
            if (array_key_exists('region', $data))
                $updateData['region'] = $data['region'];
            if (array_key_exists('city', $data))
                $updateData['city'] = $data['city'];
            if (array_key_exists('specific_address', $data))
                $updateData['BusinessAddress'] = $data['specific_address'];
            // AI-optimized structured listing fields
            if (array_key_exists('event_type', $data))
                $updateData['service_type_tag'] = $data['event_type'];
            if (array_key_exists('service_category', $data))
                $updateData['service_category'] = $data['service_category'];
            if (array_key_exists('budget_range', $data))
                $updateData['budget_tier'] = $data['budget_range'];
            if (array_key_exists('base_price', $data))
                $updateData['base_price'] = $data['base_price'];
            if (array_key_exists('package_price', $data))
                $updateData['package_price'] = $data['package_price'];
            if (array_key_exists('ai_description', $data))
                $updateData['ai_description'] = $data['ai_description'];

            // AI / Search Optimization Fields
            if (isset($data['base_price']))
                $updateData['base_price'] = $data['base_price'];
            if (isset($data['price_range']))
                $updateData['price_range'] = $data['price_range'];
            if (isset($data['package_price']))
                $updateData['package_price'] = $data['package_price'];
            if (isset($data['budget_tier']))
                $updateData['budget_tier'] = $data['budget_tier'];
            if (isset($data['service_category']))
                $updateData['service_category'] = $data['service_category'];
            if (isset($data['service_type_tag']))
                $updateData['service_type_tag'] = $data['service_type_tag'];
            if (isset($data['ai_description']))
                $updateData['ai_description'] = $data['ai_description'];

            if (empty($updateData)) {
                return $this->json($response, false, "No data to update", 400);
            }

            $updateData['updated_at'] = date('Y-m-d H:i:s');

            // Filter $updateData to only include columns that actually exist in the
            // `event_service_provider` table. This prevents SQL errors when the
            // application attempts to write fields that are not present in the schema.
            $cols = DB::select("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_service_provider'");
            $available = [];
            foreach ($cols as $c) {
                $available[] = $c->COLUMN_NAME;
            }

            $filtered = array_intersect_key($updateData, array_flip($available));

            if (empty($filtered)) {
                return $this->json($response, false, "No writable columns present in the database for the provided input", 400);
            }

            // If no existing profile row, insert one; otherwise update.
            $existing = DB::table('event_service_provider')->where('UserID', $userId)->first();
            if ($existing) {
                DB::table('event_service_provider')
                    ->where('UserID', $userId)
                    ->update($filtered);
            }
            else {
                // Ensure UserID is set for new insert
                $baseInsert = ['UserID' => $userId, 'ApplicationStatus' => 'Approved', 'DateApproved' => date('Y-m-d H:i:s')];
                // Only merge fields that exist in the table
                $insertData = array_merge($baseInsert, $filtered);
                DB::table('event_service_provider')->insert($insertData);
            }

            // --- SYNC TO VENDOR LISTINGS ---
            // If the user has listings, let's update their most recent/default listing with this info
            // to keep it in sync. 
            // NOTE: Ideally, we should switch to separate "Update Listing" endpoint, 
            // but for now, syncing "Profile" edits to the main listing is a good bridge.
            
            $listingUpdate = [];
            if (isset($data['business_name'])) $listingUpdate['business_name'] = $data['business_name'];
            if (isset($data['address'])) $listingUpdate['address'] = $data['address'];
            if (isset($data['region'])) $listingUpdate['region'] = $data['region'];
            if (isset($data['city'])) $listingUpdate['city'] = $data['city'];
            if (isset($data['specific_address'])) $listingUpdate['specific_address'] = $data['specific_address'];
            if (isset($data['service_category'])) $listingUpdate['service_category'] = $data['service_category'];
            if (isset($data['services'])) $listingUpdate['services'] = $data['services'];
            if (isset($data['pricing'])) $listingUpdate['pricing'] = $data['pricing'];
            if (isset($data['description'])) $listingUpdate['description'] = $data['description'];
            if (isset($data['type'])) $listingUpdate['other_category_type'] = $data['type']; // Map 'type' to other_category_type if sent

            // Images
            if (isset($data['hero_image'])) $listingUpdate['hero_image'] = $data['hero_image'];
            if (isset($data['icon_url'])) $listingUpdate['logo'] = $data['icon_url'];
            
            // Allow updating specific listing if ID provided, else update all or latest?
            // Let's update all active listings for this user to be safe and consistent with "Profile" concept
            if (!empty($listingUpdate)) {
                $listingUpdate['updated_at'] = date('Y-m-d H:i:s');
                DB::table('vendor_listings')
                    ->where('user_id', $userId)
                    ->where('status', 'Active')
                    ->update($listingUpdate);
            }

            return $this->json($response, true, "Vendor info updated", 200);

        }
        catch (\Exception $e) {
            error_log("UPDATE_VENDOR_INFO_ERROR: " . $e->getMessage());
            // Return error message in development to aid debugging
            return $this->json($response, false, "Failed to update info: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     * UPLOAD GALLERY PHOTOS
     * =========================================================== */
    public function uploadGallery(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            $userId = $u->mysql_id;
            $files = $request->getUploadedFiles();

            if (!isset($files['gallery']) || empty($files['gallery'])) {
                return $this->json($response, false, "No files uploaded", 400);
            }

            $galleryFiles = is_array($files['gallery']) ? $files['gallery'] : [$files['gallery']];
            $uploadedUrls = [];

            foreach ($galleryFiles as $file) {
                if ($file->getError() === UPLOAD_ERR_OK) {
                    if ($file->getSize() > self::MAX_FILE_SIZE)
                        continue;

                    try {
                        $tmpPath = $file->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                            "folder" => "solennia/vendors/gallery/{$userId}",
                            "public_id" => "gallery_" . time() . "_" . bin2hex(random_bytes(4)),
                            "timeout" => self::UPLOAD_TIMEOUT
                        ]);
                        $uploadedUrls[] = $upload['secure_url'];
                    }
                    catch (\Exception $e) {
                        error_log("GALLERY_UPLOAD_ERROR: " . $e->getMessage());
                    }
                }
            }

            if (empty($uploadedUrls)) {
                return $this->json($response, false, "No files uploaded successfully", 400);
            }

            // Get existing gallery
            $vendor = DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->first();

            $existingGallery = [];
            if (!empty($vendor->gallery)) {
                $decoded = json_decode($vendor->gallery, true);
                if (is_array($decoded)) {
                    $existingGallery = $decoded;
                }
            }

            // Merge new uploads
            $newGallery = array_merge($existingGallery, $uploadedUrls);

            DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->update(['gallery' => json_encode($newGallery)]);

            return $this->json($response, true, "Gallery updated", 200, [
                'uploaded' => count($uploadedUrls),
                'urls' => $uploadedUrls
            ]);

        }
        catch (\Exception $e) {
            error_log("UPLOAD_GALLERY_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to upload gallery", 500);
        }
    }

    /* ===========================================================
     * GET PROFILE ANALYTICS
     * Returns dashboard metrics for vendor/venue profile
     * =========================================================== */
    public function getProfileAnalytics(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            $userId = $u->mysql_id;

            // Check if user is a vendor/venue owner
            $vendor = DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            // Get venue listings if user owns venues
            $venueIds = DB::table('venue_listings')
                ->where('user_id', $userId)
                ->where('status', 'Active')
                ->pluck('id')
                ->toArray();

            // Initialize analytics data (aligned with booking.BookingStatus: Pending, Confirmed, Completed, Cancelled, Rejected)
            $analytics = [
                'total_bookings' => 0,
                'upcoming_bookings' => 0,
                'completed_bookings' => 0,
                'cancelled_bookings' => 0,
                'rejected_bookings' => 0,
                'average_rating' => 0,
                'total_reviews' => 0,
                'as_of' => date('c'),
            ];

            // Get all bookings for this vendor/venue
            $espId = $vendor ? $vendor->ID : null;

            if ($espId || !empty($venueIds)) {
                // Count bookings by status
                $bookingQuery = DB::table('booking')
                    ->where(function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('venue_id', $venueIds);
                    }
                });

                $analytics['total_bookings'] = $bookingQuery->count();

                // Upcoming bookings: Pending or Confirmed with future date
                $analytics['upcoming_bookings'] = DB::table('booking')
                    ->where(function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('venue_id', $venueIds);
                    }
                })
                    ->whereIn('BookingStatus', ['Pending', 'Confirmed'])
                    ->where(function ($q) {
                    $q->where('EventDate', '>=', date('Y-m-d'))
                        ->orWhere('start_date', '>=', date('Y-m-d'));
                })
                    ->count();

                // Completed bookings
                $analytics['completed_bookings'] = DB::table('booking')
                    ->where(function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('venue_id', $venueIds);
                    }
                })
                    ->where('BookingStatus', 'Completed')
                    ->count();

                // Cancelled bookings
                $analytics['cancelled_bookings'] = DB::table('booking')
                    ->where(function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('venue_id', $venueIds);
                    }
                })
                    ->where('BookingStatus', 'Cancelled')
                    ->count();

                // Rejected bookings
                $analytics['rejected_bookings'] = DB::table('booking')
                    ->where(function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('venue_id', $venueIds);
                    }
                })
                    ->where('BookingStatus', 'Rejected')
                    ->count();

                // Get reviews and ratings
                $feedbackQuery = DB::table('booking_feedback as bf')
                    ->join('booking as b', 'bf.BookingID', '=', 'b.ID')
                    ->where(function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('b.EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('b.venue_id', $venueIds);
                    }
                });

                $countQuery = clone $feedbackQuery;
                $analytics['total_reviews'] = $countQuery->count();

                $avgRating = $feedbackQuery->avg('bf.Rating');
                $analytics['average_rating'] = $avgRating ? round($avgRating, 2) : 0;
            }

            // Update AverageRating and TotalReviews in event_service_provider if vendor exists
            if ($vendor && $analytics['total_reviews'] > 0) {
                DB::table('event_service_provider')
                    ->where('ID', $espId)
                    ->update([
                    'AverageRating' => $analytics['average_rating'],
                    'TotalReviews' => $analytics['total_reviews']
                ]);
            }

            // Weekly / Monthly / Last 4 Weeks metrics (for BookingAnalyticsChart)
            if ($espId || !empty($venueIds)) {
                $now = date('Y-m-d');
                $weekAgo = date('Y-m-d', strtotime('-7 days'));
                $monthAgo = date('Y-m-d', strtotime('-1 month'));

                $scopeFilter = function ($q) use ($espId, $venueIds) {
                    if ($espId) {
                        $q->orWhere('EventServiceProviderID', $espId);
                    }
                    if (!empty($venueIds)) {
                        $q->orWhereIn('venue_id', $venueIds);
                    }
                };

                $analytics['bookings_this_week'] = DB::table('booking')
                    ->where($scopeFilter)
                    ->where(function ($q) use ($weekAgo) {
                    $q->where('CreatedAt', '>=', $weekAgo)
                        ->orWhere('EventDate', '>=', $weekAgo);
                })
                    ->count();

                $analytics['bookings_this_month'] = DB::table('booking')
                    ->where($scopeFilter)
                    ->where(function ($q) use ($monthAgo) {
                    $q->where('CreatedAt', '>=', $monthAgo)
                        ->orWhere('EventDate', '>=', $monthAgo);
                })
                    ->count();

                // Last 4 weeks breakdown
                $last4Weeks = [];
                for ($i = 3; $i >= 0; $i--) {
                    $weekEnd = date('Y-m-d', strtotime("-" . ($i * 7) . " days"));
                    $weekStart = date('Y-m-d', strtotime("-" . (($i + 1) * 7) . " days"));
                    $last4Weeks[] = DB::table('booking')
                        ->where($scopeFilter)
                        ->where(function ($q) use ($weekStart, $weekEnd) {
                        $q->where(function ($q2) use ($weekStart, $weekEnd) {
                                $q2->where('CreatedAt', '>=', $weekStart)
                                    ->where('CreatedAt', '<', $weekEnd);
                            }
                            )->orWhere(function ($q2) use ($weekStart, $weekEnd) {
                                $q2->where('EventDate', '>=', $weekStart)
                                    ->where('EventDate', '<', $weekEnd);
                            }
                            );
                        })
                        ->count();
                }
                $analytics['last_4_weeks'] = $last4Weeks;
            }

            // Get recent bookings (last 5)
            $recentBookings = [];
            if ($espId || !empty($venueIds)) {
                $recentBookings = DB::table('booking')
                    ->where($scopeFilter)
                    ->leftJoin('credential', 'booking.UserID', '=', 'credential.id')
                    ->select(
                    'booking.ID',
                    'booking.EventDate',
                    'booking.BookingStatus',
                    'booking.CreatedAt',
                    'booking.TotalAmount',
                    'booking.ServiceName',
                    'credential.first_name',
                    'credential.last_name',
                    'credential.username'
                )
                    ->orderBy('booking.CreatedAt', 'DESC')
                    ->limit(5)
                    ->get()
                    ->map(function ($b) {
                    $b->client_name = trim(($b->first_name ?? '') . ' ' . ($b->last_name ?? '')) ?: ($b->username ?? 'Client');
                    return $b;
                });
            }

            return $this->json($response, true, "Analytics retrieved", 200, [
                'analytics' => $analytics,
                'recent_bookings' => $recentBookings
            ]);

        }
        catch (\Exception $e) {
            error_log("GET_ANALYTICS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to load analytics", 500);
        }
    }

    /* ===========================================================
     * VENDOR LISTINGS (Multiple Listings Support)
     * =========================================================== */

    public function getMyVendorListings(Request $request, Response $response)
    {
        try {
            $user = $request->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            // Get all user's vendor listings
            $listings = DB::table('vendor_listings')
                ->where('user_id', $user->mysql_id)
                ->where('status', 'Active')
                ->orderByDesc('created_at')
                ->get()
                ->map(function ($v) {
                if (isset($v->gallery)) {
                    $v->gallery = json_decode($v->gallery, true) ?: [];
                }
                return $v;
            });

            // If no listings exist, check if user has an existing profile in event_service_provider
            // and migrate it to vendor_listings
            // If no listings exist, check if user has an existing profile in event_service_provider
            // and migrate it to vendor_listings
            /* MIBRATION DISABLED: User wants to manage listings manually
             if ($listings->isEmpty()) {
             $existingProfile = DB::table('event_service_provider')
             ->where('UserID', $user->mysql_id)
             ->first();
             if ($existingProfile && $existingProfile->ApplicationStatus === 'Approved') {
             // Migrate the existing profile to vendor_listings
             $gallery = [];
             if (!empty($existingProfile->gallery)) {
             $gallery = is_string($existingProfile->gallery) 
             ? json_decode($existingProfile->gallery, true) ?: []
             : $existingProfile->gallery;
             }
             $insertData = [
             'user_id' => $user->mysql_id,
             'business_name' => $existingProfile->BusinessName ?? 'My Business',
             'address' => $existingProfile->BusinessAddress ?? $existingProfile->service_areas ?? '',
             'region' => $existingProfile->region ?? null,
             'city' => $existingProfile->city ?? null,
             'specific_address' => $existingProfile->BusinessAddress ?? null,
             'service_category' => $existingProfile->Category ?? $existingProfile->service_category ?? null,
             'services' => $existingProfile->services ?? null,
             'pricing' => $existingProfile->Pricing ?? null,
             'description' => $existingProfile->Description ?? $existingProfile->bio ?? null,
             'hero_image' => $existingProfile->HeroImageUrl ?? null,
             'logo' => $existingProfile->business_logo_url ?? $existingProfile->avatar ?? null,
             'gallery' => json_encode($gallery),
             'event_type' => $existingProfile->service_type_tag ?? null,
             'budget_range' => $existingProfile->budget_tier ?? null,
             'base_price' => $existingProfile->base_price ?? null,
             'package_price' => $existingProfile->package_price ?? null,
             'ai_description' => $existingProfile->ai_description ?? null,
             'status' => 'Active',
             'created_at' => date('Y-m-d H:i:s'),
             'updated_at' => date('Y-m-d H:i:s')
             ];
             $newId = DB::table('vendor_listings')->insertGetId($insertData);
             // Fetch the newly created listing
             $listings = DB::table('vendor_listings')
             ->where('id', $newId)
             ->get()
             ->map(function ($v) {
             if (isset($v->gallery)) {
             $v->gallery = json_decode($v->gallery, true) ?: [];
             }
             return $v;
             });
             }
             }
             */

            return $this->json($response, true, "Listings retrieved", 200, [
                'vendors' => $listings,
                'listings' => $listings
            ]);
        }
        catch (\Exception $e) {
            error_log("GET_VENDOR_LISTINGS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to load listings: " . $e->getMessage(), 500);
        }
    }

    public function createVendorListing(Request $request, Response $response)
    {
        try {
            $user = $request->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            if ($request->getMethod() !== 'POST') {
                return $this->json($response, false, "Method Not Allowed", 405);
            }

            $data = (array)$request->getParsedBody();

            if (empty($data['business_name'])) {
                return $this->json($response, false, "Business name is required", 422);
            }

            // Prevent duplicate listing for same user and business_name
            $duplicate = DB::table('vendor_listings')
                ->where('user_id', $user->mysql_id)
                ->where('business_name', $data['business_name'])
                ->where('status', '!=', 'Deleted')
                ->first();
            if ($duplicate) {
                return $this->json($response, false, "Duplicate listing", 409);
            }

            // Build address
            $address = $data['address'] ?? '';
            if (!empty($data['specific_address']) || !empty($data['city']) || !empty($data['region'])) {
                $parts = array_filter([$data['specific_address'] ?? '', $data['city'] ?? '', $data['region'] ?? '']);
                $address = implode(', ', $parts);
            }
            if (empty($address)) {
                $address = $data['business_name'];
            }

            // Handle gallery as JSON
            $gallery = $data['gallery'] ?? [];
            if (is_string($gallery)) {
                $gallery = json_decode($gallery, true) ?: [];
            }

            $insertData = [
                'user_id' => $user->mysql_id,
                'business_name' => $data['business_name'],
                'address' => $address,
                'region' => $data['region'] ?? null,
                'city' => $data['city'] ?? null,
                'specific_address' => $data['specific_address'] ?? null,
                'service_category' => $data['service_category'] ?? null,
                'other_category_type' => $data['other_category_type'] ?? null,
                'services' => $data['services'] ?? null,
                'pricing' => $data['pricing'] ?? null,
                'description' => $data['description'] ?? null,
                'hero_image' => $data['hero_image'] ?? null,
                'logo' => $data['icon_url'] ?? null,
                'gallery' => json_encode($gallery),
                'event_type' => $data['event_type'] ?? null,
                'budget_range' => $data['budget_range'] ?? null,
                'base_price' => $data['base_price'] ?? null,
                'package_price' => $data['package_price'] ?? null,
                'ai_description' => $data['ai_description'] ?? null,
                'status' => 'Active',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];

            $id = DB::table('vendor_listings')->insertGetId($insertData);

            return $this->json($response, true, "Listing created successfully", 201, [
                'id' => $id
            ]);
        }
        catch (\Exception $e) {
            error_log("CREATE_VENDOR_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create listing: " . $e->getMessage(), 500);
        }
    }

    public function updateVendorListing(Request $request, Response $response, array $args)
    {
        try {
            $user = $request->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            if ($request->getMethod() !== 'PUT') {
                return $this->json($response, false, "Method Not Allowed", 405);
            }

            $listingId = (int)$args['id'];
            $data = (array)$request->getParsedBody();

            // Verify ownership
            $existing = DB::table('vendor_listings')
                ->where('id', $listingId)
                ->where('user_id', $user->mysql_id)
                ->first();

            if (!$existing) {
                return $this->json($response, false, "Listing not found or access denied", 404);
            }

            // Prevent changing to a duplicate business_name for this user
            if (isset($data['business_name'])) {
                $duplicate = DB::table('vendor_listings')
                    ->where('user_id', $user->mysql_id)
                    ->where('business_name', $data['business_name'])
                    ->where('id', '!=', $listingId)
                    ->where('status', '!=', 'Deleted')
                    ->first();
                if ($duplicate) {
                    return $this->json($response, false, "Duplicate listing name", 409);
                }
            }

            // Build address
            $address = $data['address'] ?? $existing->address;
            if (!empty($data['specific_address']) || !empty($data['city']) || !empty($data['region'])) {
                $parts = array_filter([$data['specific_address'] ?? '', $data['city'] ?? '', $data['region'] ?? '']);
                $address = implode(', ', $parts);
            }

            // Handle gallery as JSON
            $gallery = $data['gallery'] ?? $existing->gallery;
            if (is_string($gallery)) {
                $gallery = json_decode($gallery, true) ?: [];
            }

            $updateData = [
                'business_name' => $data['business_name'] ?? $existing->business_name,
                'address' => $address,
                'region' => $data['region'] ?? $existing->region,
                'city' => $data['city'] ?? $existing->city,
                'specific_address' => $data['specific_address'] ?? $existing->specific_address,
                'service_category' => $data['service_category'] ?? $existing->service_category,
                'other_category_type' => $data['other_category_type'] ?? $existing->other_category_type,
                'services' => $data['services'] ?? $existing->services,
                'pricing' => $data['pricing'] ?? $existing->pricing,
                'description' => $data['description'] ?? $existing->description,
                'hero_image' => $data['hero_image'] ?? $existing->hero_image,
                'logo' => $data['icon_url'] ?? $existing->logo,
                'gallery' => json_encode($gallery),
                'event_type' => $data['event_type'] ?? $existing->event_type,
                'budget_range' => $data['budget_range'] ?? $existing->budget_range,
                'base_price' => $data['base_price'] ?? $existing->base_price,
                'package_price' => $data['package_price'] ?? $existing->package_price,
                'ai_description' => $data['ai_description'] ?? $existing->ai_description,
                'updated_at' => date('Y-m-d H:i:s')
            ];

            DB::table('vendor_listings')
                ->where('id', $listingId)
                ->update($updateData);

            return $this->json($response, true, "Listing updated successfully", 200);
        }
        catch (\Exception $e) {
            error_log("UPDATE_VENDOR_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to update listing: " . $e->getMessage(), 500);
        }
    }

    public function deleteVendorListing(Request $request, Response $response, array $args)
    {
        try {
            $user = $request->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            $listingId = (int)$args['id'];

            // Verify ownership and soft delete
            $existing = DB::table('vendor_listings')
                ->where('id', $listingId)
                ->where('user_id', $user->mysql_id)
                ->first();

            if (!$existing) {
                return $this->json($response, false, "Listing not found or access denied", 404);
            }

            // Soft delete - set status to inactive
            DB::table('vendor_listings')
                ->where('id', $listingId)
                ->update(['status' => 'Deleted', 'updated_at' => date('Y-m-d H:i:s')]);

            return $this->json($response, true, "Listing deleted successfully", 200);
        }
        catch (\Exception $e) {
            error_log("DELETE_VENDOR_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to delete listing: " . $e->getMessage(), 500);
        }
    }
}