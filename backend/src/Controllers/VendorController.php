<?php
namespace Src\Controllers;

use Cloudinary\Cloudinary;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VendorController
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
     *  VENDOR DASHBOARD (STATIC PLACEHOLDER FOR NOW)
     * =========================================================== */
    public function dashboard($request, $response)
    {
        $user = $request->getAttribute('user');

        $profile = [
            'name'     => $user->first_name . ' ' . $user->last_name,
            'bio'      => 'Custom vendor bio here',
            'style'    => 'Modern Planning',
            'services' => 'Full Service, Coordination',
            'areas'    => 'Metro Manila, Rizal',
            'avatar'   => $user->avatar ?? '/images/default-avatar.png'
        ];

        $bookings = [
            ['title' => 'El Nido Chapel', 'count' => 24],
            ['title' => 'Mactan Venue', 'count' => 18]
        ];

        $listings = [
            ['title' => 'Laguna Garden Venue', 'image' => '/images/gallery1.jpg'],
            ['title' => 'Cebu Ocean Venue', 'image' => '/images/gallery2.jpg']
        ];

        $messages = [
            ['from' => 'Jane Perez', 'message' => 'Interested in your package'],
            ['from' => 'Michael Cruz', 'message' => 'Can I get a quote?']
        ];

        $insights = [
            'labels' => ['Jan','Feb','Mar','Apr'],
            'datasets' => [
                [
                    'label' => 'Visitors',
                    'data' => [120, 190, 170, 220]
                ]
            ]
        ];

        $payload = compact('profile','bookings','listings','messages','insights');
        $response->getBody()->write(json_encode($payload));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /* ===========================================================
     *  VENDOR APPLICATION (WITH VENUE SUPPORT) - NEW METHOD
     * =========================================================== */
    public function applyAsVendor(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->sub)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->sub;

        // Check if user already has a pending/approved application
        $existing = DB::table('eventserviceprovider')
            ->where('UserID', $userId)
            ->first();

        if ($existing) {
            return $this->json($response, false, "You already have a vendor application", 400);
        }

        $data = $request->getParsedBody();
        $files = $request->getUploadedFiles();

        // Get basic vendor info
        $businessName = $data['business_name'] ?? '';
        $fullName = $data['full_name'] ?? '';
        $category = $data['category'] ?? '';
        $categoryOther = $data['category_other'] ?? null;
        $address = $data['address'] ?? '';
        $description = $data['description'] ?? '';
        $pricing = $data['pricing'] ?? '';
        $contactEmail = $data['contact_email'] ?? '';

        // Get venue-specific fields (only if category is "Venue")
        $venueSubcategory = $data['venue_subcategory'] ?? null;
        $venueCapacity = $data['venue_capacity'] ?? null;
        $venueAmenities = $data['venue_amenities'] ?? null;
        $venueOperatingHours = $data['venue_operating_hours'] ?? null;
        $venueParking = $data['venue_parking'] ?? null;

        // Validate required fields
        if (empty($businessName) || empty($fullName) || empty($category) || empty($contactEmail)) {
            return $this->json($response, false, "Missing required fields", 400);
        }

        // Upload files to Cloudinary
        $permitsUrl = null;
        $govIdUrl = null;
        $portfolioUrl = null;

        try {
            // Upload Permits
            if (isset($files['permits']) && $files['permits']->getError() === UPLOAD_ERR_OK) {
                $tmpPath = $files['permits']->getStream()->getMetadata('uri');
                $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                    "folder" => "solennia/vendor/{$userId}/documents",
                    "resource_type" => "auto",
                    "public_id" => "permits_" . time()
                ]);
                $permitsUrl = $upload['secure_url'];
            }

            // Upload Government ID
            if (isset($files['gov_id']) && $files['gov_id']->getError() === UPLOAD_ERR_OK) {
                $tmpPath = $files['gov_id']->getStream()->getMetadata('uri');
                $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                    "folder" => "solennia/vendor/{$userId}/documents",
                    "resource_type" => "auto",
                    "public_id" => "gov_id_" . time()
                ]);
                $govIdUrl = $upload['secure_url'];
            }

            // Upload Portfolio
            if (isset($files['portfolio']) && $files['portfolio']->getError() === UPLOAD_ERR_OK) {
                $tmpPath = $files['portfolio']->getStream()->getMetadata('uri');
                $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                    "folder" => "solennia/vendor/{$userId}/portfolio",
                    "resource_type" => "auto",
                    "public_id" => "portfolio_" . time()
                ]);
                $portfolioUrl = $upload['secure_url'];
            }

        } catch (\Exception $e) {
            return $this->json($response, false, "File upload failed: " . $e->getMessage(), 500);
        }

        // Insert vendor application into database
        try {
            DB::table('eventserviceprovider')->insert([
                'UserID' => $userId,
                'BusinessName' => $businessName,
                'OwnerName' => $fullName,
                'ServiceType' => $category,
                'CategoryOther' => $categoryOther,
                'Address' => $address,
                'Description' => $description,
                'Pricing' => $pricing,
                'ContactEmail' => $contactEmail,
                'Permits' => $permitsUrl,
                'GovID' => $govIdUrl,
                'Portfolio' => $portfolioUrl,
                // Venue-specific fields
                'venue_subcategory' => $venueSubcategory,
                'venue_capacity' => $venueCapacity,
                'venue_amenities' => $venueAmenities,
                'venue_operating_hours' => $venueOperatingHours,
                'venue_parking' => $venueParking,
                'VerificationStatus' => 'pending',
                'created_at' => date('Y-m-d H:i:s')
            ]);

            return $this->json($response, true, "Application submitted successfully!", 200);

        } catch (\Exception $e) {
            return $this->json($response, false, "Database error: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  GET VENDOR STATUS - NEW METHOD
     * =========================================================== */
    public function getVendorStatus(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->sub)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->sub;

        $vendor = DB::table('eventserviceprovider')
            ->where('UserID', $userId)
            ->first();

        if (!$vendor) {
            return $this->json($response, true, "No application found", 200, [
                'status' => null,
                'category' => null
            ]);
        }

        return $this->json($response, true, "Status retrieved", 200, [
            'status' => $vendor->VerificationStatus ?? 'pending',
            'category' => $vendor->ServiceType ?? null
        ]);
    }

    /* ===========================================================
     *  A — UPDATE USER PROFILE PICTURE (PERSONAL AVATAR)
     * =========================================================== */
    public function updateProfile(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->sub)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->sub;

        $files = $request->getUploadedFiles();
        if (!isset($files['avatar'])) {
            return $this->json($response, false, "No avatar file uploaded", 400);
        }

        $avatar = $files['avatar'];
        if ($avatar->getError() !== UPLOAD_ERR_OK) {
            return $this->json($response, false, "Upload error", 400);
        }

        // Upload to Cloudinary
        $tmpPath = $avatar->getStream()->getMetadata('uri');

        $upload = $this->cloud->uploadApi()->upload($tmpPath, [
            "folder"        => "solennia/users/{$userId}",
            "resource_type" => "image",
            "public_id"     => "profile_" . time(),
            "transformation" => [
                ["width" => 400, "height" => 400, "crop" => "fill"]
            ]
        ]);

        $url = $upload['secure_url'];

        DB::table('credential')->where('id', $userId)->update([
            'avatar' => $url
        ]);

        return $this->json($response, true, "Profile updated", 200, [
            "avatar" => $url
        ]);
    }

    /* ===========================================================
     *  B — UPDATE VENDOR LOGO (eventserviceprovider.avatar)
     * =========================================================== */
    public function updateVendorLogo(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u) return $this->json($response, false, "Unauthorized", 401);

        $userId = $u->sub;

        $logo = $request->getUploadedFiles()['logo'] ?? null;
        if (!$logo || $logo->getError() !== UPLOAD_ERR_OK)
            return $this->json($response, false, "Invalid logo upload", 400);

        $tmp = $logo->getStream()->getMetadata('uri');

        $upload = $this->cloud->uploadApi()->upload($tmp, [
            "folder"        => "solennia/vendor/{$userId}/logo",
            "resource_type" => "image",
            "public_id"     => "logo_" . time()
        ]);

        $url = $upload['secure_url'];

        DB::table("eventserviceprovider")
            ->where("UserID", $userId)
            ->update(["avatar" => $url]);

        return $this->json($response, true, "Vendor logo updated", 200, [
            "logo" => $url
        ]);
    }

    /* ===========================================================
     *  C — UPDATE HERO IMAGE
     * =========================================================== */
    public function updateHero(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u) return $this->json($response, false, "Unauthorized", 401);

        $userId = $u->sub;

        $hero = $request->getUploadedFiles()['hero'] ?? null;
        if (!$hero || $hero->getError() !== UPLOAD_ERR_OK)
            return $this->json($response, false, "Invalid hero image", 400);

        $tmp = $hero->getStream()->getMetadata('uri');

        $upload = $this->cloud->uploadApi()->upload($tmp, [
            "folder"        => "solennia/vendor/{$userId}/hero",
            "resource_type" => "image",
            "public_id"     => "hero_" . time()
        ]);

        $url = $upload['secure_url'];

        DB::table("eventserviceprovider")
            ->where("UserID", $userId)
            ->update(["HeroImageUrl" => $url]);

        return $this->json($response, true, "Hero image updated", 200, [
            "hero_image" => $url
        ]);
    }

    /* ===========================================================
     *  D — UPLOAD MULTIPLE GALLERY IMAGES
     * =========================================================== */
    public function uploadGallery(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u) return $this->json($response, false, "Unauthorized", 401);

        $userId = $u->sub;

        if (!DB::schema()->hasTable('vendor_gallery')) {
            DB::statement("
                CREATE TABLE vendor_gallery (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id INT UNSIGNED NOT NULL,
                    image_url TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");
        }

        $files = $request->getUploadedFiles()['gallery'] ?? [];
        if (!$files) {
            return $this->json($response, false, "No gallery images uploaded", 400);
        }

        $urls = [];

        foreach ($files as $file) {
            if ($file->getError() !== UPLOAD_ERR_OK) continue;

            $tmp = $file->getStream()->getMetadata('uri');

            $upload = $this->cloud->uploadApi()->upload($tmp, [
                "folder"        => "solennia/vendor/{$userId}/gallery",
                "resource_type" => "image",
                "public_id"     => "gallery_" . time() . "_" . bin2hex(random_bytes(2))
            ]);

            $url = $upload['secure_url'];
            $urls[] = $url;

            DB::table("vendor_gallery")->insert([
                "user_id"   => $userId,
                "image_url" => $url
            ]);
        }

        return $this->json($response, true, "Gallery updated", 200, [
            "images" => $urls
        ]);
    }

    /* ===========================================================
     *  E — UPDATE TEXT INFO (bio, services, pricing, etc.)
     * =========================================================== */
    public function updateVendorInfo(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u) return $this->json($response, false, "Unauthorized", 401);

        $userId = $u->sub;
        $data = (array)$request->getParsedBody();

        DB::table("eventserviceprovider")
            ->where("UserID", $userId)
            ->update([
                "bio"          => $data['bio'] ?? null,
                "services"     => $data['services'] ?? null,
                "service_areas"=> $data['service_areas'] ?? null,
                "Description"  => $data['description'] ?? null,
                "Pricing"      => $data['pricing'] ?? null
            ]);

        return $this->json($response, true, "Vendor info updated", 200);
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