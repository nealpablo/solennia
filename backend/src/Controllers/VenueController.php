<?php
// backend/src/Controllers/VenueController.php - COMPLETE FIXED VERSION
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
     *  GET ALL APPROVED VENUES
     * =========================================================== */
    public function getAllVenues(Request $request, Response $response)
    {
        try {
            $providerVenues = DB::table('eventserviceprovider')
                ->where('ServiceType', 'Venue')
                ->where('VerificationStatus', 'approved')
                ->get();

            $listingVenues = DB::table('venue_listings')
                ->where('status', 'active')
                ->get();

            return $this->json($response, true, "Venues retrieved", 200, [
                'venues' => $providerVenues->merge($listingVenues)
            ]);

        } catch (\Exception $e) {
            return $this->json($response, false, "Failed to fetch venues", 500);
        }
    }

    /* ===========================================================
     *  CREATE VENUE LISTING  ✅ FIXED
     * =========================================================== */
    public function createListing(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->sub)) {
                return $this->json($response, false, "Authentication required", 401);
            }
            $userId = $u->sub;

            // ✅ Vendor must be approved venue supplier
            $vendor = DB::table('eventserviceprovider')
                ->where('UserID', $userId)
                ->where('ServiceType', 'Venue')
                ->where('VerificationStatus', 'approved')
                ->first();

            if (!$vendor) {
                return $this->json($response, false, "Only approved venue vendors can create listings", 403);
            }

            $data  = $request->getParsedBody();
            $files = $request->getUploadedFiles();

            /* ===================================================
             * 🔧 FRONTEND → BACKEND FIELD NORMALIZATION (FIX)
             * =================================================== */
            $data['venue_name']        = $data['venue_name']        ?? $data['name']        ?? '';
            $data['venue_subcategory'] = $data['venue_subcategory'] ?? $data['venue_type']  ?? '';
            $data['venue_capacity']    = $data['venue_capacity']    ?? $data['capacity']    ?? '';
            $data['pricing']           = $data['pricing']           ?? $data['price_range'] ?? '';

            /* ===================================================
             * 🔒 REQUIRED FIELD CHECK (FIX)
             * =================================================== */
            if (
                empty($data['venue_name']) ||
                empty($data['venue_subcategory']) ||
                empty($data['venue_capacity']) ||
                empty($data['pricing'])
            ) {
                return $this->json($response, false, "Missing required fields", 422);
            }

            /* ===================================================
             * 🖼 IMAGE UPLOAD (portfolio OR images) (FIX)
             * =================================================== */
            $portfolioUrl = null;
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

                    $portfolioUrl = $upload['secure_url'];
                } catch (\Exception $e) {
                    error_log("Cloudinary upload error: " . $e->getMessage());
                }
            }

            /* ===================================================
             * 🧾 INSERT LISTING
             * =================================================== */
            $listingId = DB::table('venue_listings')->insertGetId([
                'user_id'               => $userId,
                'provider_id'           => $vendor->ProviderID,
                'venue_name'            => $data['venue_name'],
                'venue_subcategory'     => $data['venue_subcategory'],
                'address'               => $data['address'] ?? '',
                'venue_capacity'        => $data['venue_capacity'],
                'venue_parking'         => $data['venue_parking'] ?? '',
                'venue_operating_hours' => $data['venue_operating_hours'] ?? '',
                'venue_amenities'       => $data['venue_amenities'] ?? '',
                'description'           => $data['description'] ?? '',
                'pricing'               => $data['pricing'],
                'contact_email'         => $data['contact_email'] ?? '',
                'portfolio'             => $portfolioUrl,
                'status'                => 'active',
                'created_at'            => date('Y-m-d H:i:s')
            ]);

            return $this->json($response, true, "Listing created successfully", 200, [
                'listing_id' => $listingId,
                'portfolio_url' => $portfolioUrl
            ]);

        } catch (\Exception $e) {
            error_log("CREATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create listing", 500);
        }
    }

    /* ===========================================================
     * JSON Helper
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
