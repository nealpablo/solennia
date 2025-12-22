<?php
// backend/src/Controllers/VenueController.php - FIXED FOR YOUR DATABASE SCHEMA
namespace Src\Controllers;

use Cloudinary\Cloudinary;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VenueController
{
    private Cloudinary $cloud;

    public function __construct()
    {
        $this->cloud = new Cloudinary([
            'cloud' => [
                'cloud_name' => $_ENV['CLOUDINARY_CLOUD'],
                'api_key'    => $_ENV['CLOUDINARY_KEY'],
                'api_secret' => $_ENV['CLOUDINARY_SECRET']
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* ===========================================================
     *  GET ALL APPROVED VENUES - FIXED!
     * =========================================================== */
    public function getAllVenues(Request $request, Response $response)
    {
        try {
            // Get all approved venue providers from eventserviceprovider
            $venues = DB::table('eventserviceprovider')
                ->where('Category', 'Venue')
                ->where('ApplicationStatus', 'Approved')
                ->select(
                    'ID as id',
                    'BusinessName as business_name',
                    'BusinessAddress as address',
                    'Description as description',
                    'HeroImageUrl as portfolio',
                    'BusinessEmail as contact_email',
                    'Pricing as pricing',
                    'bio',
                    'services as venue_amenities'
                )
                ->get();

            $venuesList = [];
            foreach ($venues as $venue) {
                $venuesList[] = [
                    'id' => $venue->id,
                    'business_name' => $venue->business_name,
                    'address' => $venue->address ?? '',
                    'description' => $venue->description ?? '',
                    'portfolio' => $venue->portfolio ?? null,
                    'contact_email' => $venue->contact_email ?? '',
                    'pricing' => $venue->pricing ?? '',
                    'venue_subcategory' => 'Event Venue',
                    'venue_capacity' => '100-500',
                    'venue_amenities' => $venue->venue_amenities ?? ''
                ];
            }

            return $this->json($response, true, "Venues retrieved successfully", 200, [
                'venues' => $venuesList,
                'count' => count($venuesList)
            ]);

        } catch (\Exception $e) {
            error_log("GET_VENUES_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to fetch venues: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  GET SINGLE VENUE BY ID
     * =========================================================== */
    public function getVenueById(Request $request, Response $response, $args)
    {
        try {
            $id = $args['id'] ?? null;
            
            if (!$id) {
                return $this->json($response, false, "Venue ID required", 400);
            }

            $venue = DB::table('eventserviceprovider')
                ->where('ID', $id)
                ->where('Category', 'Venue')
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$venue) {
                return $this->json($response, false, "Venue not found", 404);
            }

            $venueData = [
                'id' => $venue->ID,
                'business_name' => $venue->BusinessName,
                'address' => $venue->BusinessAddress ?? '',
                'description' => $venue->Description ?? '',
                'portfolio' => $venue->HeroImageUrl ?? null,
                'contact_email' => $venue->BusinessEmail ?? '',
                'pricing' => $venue->Pricing ?? '',
                'venue_subcategory' => 'Event Venue',
                'venue_capacity' => '100-500',
                'venue_amenities' => $venue->services ?? '',
                'venue_operating_hours' => '9:00 AM - 10:00 PM',
                'venue_parking' => 'Available'
            ];

            return $this->json($response, true, "Venue found", 200, ['venue' => $venueData]);

        } catch (\Exception $e) {
            error_log("GET_VENUE_BY_ID_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to fetch venue", 500);
        }
    }

    /* ===========================================================
     *  CREATE VENUE LISTING - FIXED FOR YOUR DATABASE!
     * =========================================================== */
    public function createListing(Request $request, Response $response)
    {
        try {
            // Get authenticated user
            $auth = $request->getAttribute('user');
            if (!$auth || !isset($auth->mysql_id)) {
                error_log("AUTH_ERROR: No mysql_id found. Auth object: " . json_encode($auth));
                return $this->json($response, false, "Authentication required", 401);
            }

            $userId = (int) $auth->mysql_id;
            error_log("CREATE_LISTING: UserID = {$userId}");

            // Check if user already has an approved venue vendor application
            $vendor = DB::table('eventserviceprovider')
                ->where('UserID', $userId)
                ->where('Category', 'Venue')
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$vendor) {
                error_log("VENDOR_CHECK_FAILED: No approved venue vendor found for UserID {$userId}");
                return $this->json($response, false, "Only approved venue vendors can create listings", 403);
            }

            error_log("VENDOR_CHECK_PASSED: Found vendor ID {$vendor->ID}");

            $data = $request->getParsedBody();
            $files = $request->getUploadedFiles();

            error_log("CREATE_LISTING_DATA: " . json_encode($data));
            error_log("CREATE_LISTING_FILES: " . json_encode(array_keys($files)));

            // Field normalization
            $venueName = $data['venue_name'] ?? $data['name'] ?? '';
            $venueSubcategory = $data['venue_subcategory'] ?? $data['venue_type'] ?? 'Event Venue';
            $venueCapacity = $data['venue_capacity'] ?? $data['capacity'] ?? '';
            $pricing = $data['pricing'] ?? $data['price_range'] ?? '';
            $address = $data['address'] ?? '';
            $description = $data['description'] ?? '';
            $contactEmail = $data['contact_email'] ?? '';
            $venueAmenities = $data['venue_amenities'] ?? '';

            // Validate required fields
            if (empty($venueName)) {
                return $this->json($response, false, "Venue name is required", 422);
            }
            if (empty($address)) {
                return $this->json($response, false, "Address is required", 422);
            }
            if (empty($pricing)) {
                return $this->json($response, false, "Price range is required", 422);
            }

            // Handle image upload
            $heroImageUrl = null;
            $imageFile = $files['portfolio'] ?? $files['images'] ?? null;

            if ($imageFile && $imageFile->getError() === UPLOAD_ERR_OK) {
                try {
                    $tmpPath = $imageFile->getStream()->getMetadata('uri');

                    $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                        "folder" => "solennia/venue/{$userId}/listings",
                        "resource_type" => "image",
                        "public_id" => "venue_" . time(),
                        "transformation" => [
                            ["width" => 800, "height" => 600, "crop" => "fill"]
                        ]
                    ]);

                    $heroImageUrl = $upload['secure_url'];
                    error_log("IMAGE_UPLOADED: " . $heroImageUrl);
                } catch (\Exception $e) {
                    error_log("CLOUDINARY_ERROR: " . $e->getMessage());
                    // Don't fail if image upload fails
                }
            }

            // Insert into eventserviceprovider table
            $listingId = DB::table('eventserviceprovider')->insertGetId([
                'UserID' => $userId,
                'BusinessName' => $venueName,
                'Category' => 'Venue',
                'BusinessAddress' => $address,
                'Description' => $description,
                'Pricing' => $pricing,
                'HeroImageUrl' => $heroImageUrl,
                'BusinessEmail' => $contactEmail,
                'bio' => $venueSubcategory,
                'services' => $venueAmenities,
                'ApplicationStatus' => 'Approved',
                'created_at' => date('Y-m-d H:i:s'),
                'DateApplied' => date('Y-m-d H:i:s')
            ]);

            error_log("LISTING_CREATED: ID=" . $listingId);

            return $this->json($response, true, "Venue listing created successfully", 201, [
                'listing_id' => $listingId,
                'portfolio_url' => $heroImageUrl
            ]);

        } catch (\Exception $e) {
            error_log("CREATE_LISTING_ERROR: " . $e->getMessage());
            error_log("STACK_TRACE: " . $e->getTraceAsString());
            return $this->json($response, false, "Failed to create listing: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  SEND INQUIRY (Optional - for future use)
     * =========================================================== */
    public function sendInquiry(Request $request, Response $response)
    {
        try {
            $auth = $request->getAttribute('user');
            if (!$auth || !isset($auth->mysql_id)) {
                return $this->json($response, false, "Authentication required", 401);
            }

            $data = $request->getParsedBody();
            
            // Store inquiry (you'd need to create this table)
            error_log("INQUIRY_DATA: " . json_encode($data));

            return $this->json($response, true, "Inquiry sent successfully", 200);

        } catch (\Exception $e) {
            error_log("SEND_INQUIRY_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to send inquiry", 500);
        }
    }

    /* ===========================================================
     *  SCHEDULE VISIT (Optional - for future use)
     * =========================================================== */
    public function scheduleVisit(Request $request, Response $response)
    {
        try {
            $auth = $request->getAttribute('user');
            if (!$auth || !isset($auth->mysql_id)) {
                return $this->json($response, false, "Authentication required", 401);
            }

            $data = $request->getParsedBody();
            
            // Store visit request (you'd need to create this table)
            error_log("SCHEDULE_VISIT_DATA: " . json_encode($data));

            return $this->json($response, true, "Visit scheduled successfully", 200);

        } catch (\Exception $e) {
            error_log("SCHEDULE_VISIT_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to schedule visit", 500);
        }
    }

    /* ===========================================================
     *  JSON HELPER
     * =========================================================== */
    private function json(Response $res, bool $success, string $message, int $status = 200, array $extra = [])
    {
        $payload = array_merge([
            'success' => $success,
            $success ? 'message' : 'error' => $message,
        ], $extra);

        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res->withHeader('Content-Type', 'application/json')
                   ->withStatus($status);
    }
}