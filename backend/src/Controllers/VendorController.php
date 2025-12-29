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
     *  ✅ NEW: CREATE VENDOR PROFILE (First time setup)
     *  This is called after vendor is approved by admin
     * =========================================================== */
    public function createVendorProfile(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;

            // Check if user is approved vendor
            $application = DB::table('vendor_application')
                ->where('user_id', $userId)
                ->where('status', 'Approved')
                ->first();

            if (!$application) {
                return $this->json($response, false, "No approved vendor application found", 403);
            }

            // Check if profile already exists
            $existingProfile = DB::table('eventserviceprovider')
                ->where('UserID', $userId)
                ->first();

            if ($existingProfile) {
                return $this->json($response, false, "Vendor profile already exists", 400);
            }

            $data = $request->getParsedBody();
            $files = $request->getUploadedFiles();

            // Required fields
            $businessName = $data['business_name'] ?? $application->business_name;
            $bio = $data['bio'] ?? '';
            $services = $data['services'] ?? '';
            $serviceAreas = $data['service_areas'] ?? '';

            if (empty($bio) || empty($services)) {
                return $this->json($response, false, "Bio and services are required", 422);
            }

            // Upload images with optimization
            $logoUrl = null;
            $heroUrl = null;

            // Upload Logo
            if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                try {
                    $tmpPath = $files['logo']->getStream()->getMetadata('uri');
                    $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                        "folder" => "solennia/vendors/logo/{$userId}",
                        "resource_type" => "image",
                        "public_id" => "logo_" . time(),
                        "transformation" => [
                            ["width" => 300, "height" => 300, "crop" => "fit", "quality" => "auto:good"]
                        ],
                        "timeout" => 60
                    ]);
                    $logoUrl = $upload['secure_url'];
                } catch (\Exception $e) {
                    error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
                }
            }

            // Upload Hero Image
            if (isset($files['hero']) && $files['hero']->getError() === UPLOAD_ERR_OK) {
                try {
                    $tmpPath = $files['hero']->getStream()->getMetadata('uri');
                    $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                        "folder" => "solennia/vendors/hero/{$userId}",
                        "resource_type" => "image",
                        "public_id" => "hero_" . time(),
                        "transformation" => [
                            ["width" => 1920, "height" => 1080, "crop" => "limit", "quality" => "auto:good"]
                        ],
                        "timeout" => 60
                    ]);
                    $heroUrl = $upload['secure_url'];
                } catch (\Exception $e) {
                    error_log("HERO_UPLOAD_ERROR: " . $e->getMessage());
                }
            }

            // Create vendor profile
            DB::table('eventserviceprovider')->insert([
                'UserID' => $userId,
                'BusinessName' => $businessName,
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
                'created_at' => DB::raw('NOW()')
            ]);

            error_log("VENDOR_PROFILE_CREATED: UserID={$userId}");

            return $this->json($response, true, "Vendor profile created successfully!", 201, [
                'logo' => $logoUrl,
                'hero' => $heroUrl
            ]);

        } catch (\Exception $e) {
            error_log("CREATE_VENDOR_PROFILE_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create profile: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  ✅ OPTIMIZED: Check Profile Setup Status
     * =========================================================== */
    public function getVendorStatus(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        // Check vendor_application
        $application = DB::table('vendor_application')
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->first();

        // Check if profile exists
        $profile = DB::table('eventserviceprovider')
            ->where('UserID', $userId)
            ->where('ApplicationStatus', 'Approved')
            ->first();

        $needsSetup = false;
        if ($application && $application->status === 'Approved' && !$profile) {
            $needsSetup = true; // Approved but profile not created yet
        }

        return $this->json($response, true, "Status retrieved", 200, [
            'status' => strtolower($application->status ?? 'none'),
            'category' => $application->category ?? null,
            'has_profile' => $profile !== null,
            'needs_setup' => $needsSetup,
            'vendor' => $profile ? [
                'ServiceType' => $profile->Category,
                'Category' => $profile->Category,
                'VerificationStatus' => 'approved',
                'BusinessName' => $profile->BusinessName,
                'bio' => $profile->bio,
                'services' => $profile->services,
                'avatar' => $profile->avatar,
                'HeroImageUrl' => $profile->HeroImageUrl
            ] : null
        ]);
    }

    /* ===========================================================
     *  GET VENDOR PUBLIC DATA
     * =========================================================== */
    public function getPublicVendorData(Request $request, Response $response, $args)
    {
        $userId = $args['id'] ?? null;
        
        if (!$userId) {
            return $this->json($response, false, "User ID required", 400);
        }

        $vendor = DB::table('eventserviceprovider')
            ->where('UserID', $userId)
            ->where('ApplicationStatus', 'Approved')
            ->first();

        if (!$vendor) {
            return $this->json($response, false, "Vendor not found", 404);
        }

        $gallery = DB::table('vendor_gallery')
            ->where('user_id', $userId)
            ->pluck('image_url')
            ->toArray();

        $vendorData = [
            'id' => $vendor->ID,
            'business_name' => $vendor->BusinessName,
            'category' => $vendor->Category,
            'description' => $vendor->Description,
            'bio' => $vendor->bio,
            'pricing' => $vendor->Pricing,
            'services' => $vendor->services,
            'service_areas' => $vendor->service_areas,
            'business_email' => $vendor->BusinessEmail,
            'business_address' => $vendor->BusinessAddress,
            'logo' => $vendor->avatar,
            'hero_image' => $vendor->HeroImageUrl,
            'gallery' => $gallery
        ];

        return $this->json($response, true, "Vendor found", 200, [
            'vendor' => $vendorData
        ]);
    }

    /* ===========================================================
     *  UPDATE USER PROFILE PICTURE - ✅ OPTIMIZED
     * =========================================================== */
    public function updateProfile(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        $files = $request->getUploadedFiles();
        if (!isset($files['avatar'])) {
            return $this->json($response, false, "No avatar file uploaded", 400);
        }

        $avatar = $files['avatar'];
        if ($avatar->getError() !== UPLOAD_ERR_OK) {
            return $this->json($response, false, "Upload error", 400);
        }

        try {
            $tmpPath = $avatar->getStream()->getMetadata('uri');

            $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                "folder" => "solennia/users/{$userId}",
                "resource_type" => "image",
                "public_id" => "profile_" . time(),
                "transformation" => [
                    [
                        "width" => 400,
                        "height" => 400,
                        "crop" => "fill",
                        "quality" => "auto:good",
                        "fetch_format" => "auto"
                    ]
                ],
                "timeout" => 30
            ]);

            $url = $upload['secure_url'];

            DB::table('credential')->where('id', $userId)->update([
                'avatar' => $url
            ]);

            return $this->json($response, true, "Profile updated", 200, [
                "avatar" => $url
            ]);

        } catch (\Exception $e) {
            error_log("AVATAR_UPLOAD_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to upload avatar", 500);
        }
    }

    /* ===========================================================
     *  UPDATE VENDOR LOGO - ✅ OPTIMIZED
     * =========================================================== */
    public function updateVendorLogo(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        $logo = $request->getUploadedFiles()['logo'] ?? null;
        if (!$logo || $logo->getError() !== UPLOAD_ERR_OK) {
            return $this->json($response, false, "Invalid logo upload", 400);
        }

        try {
            $tmp = $logo->getStream()->getMetadata('uri');

            $upload = $this->cloud->uploadApi()->upload($tmp, [
                "folder" => "solennia/vendors/logo/{$userId}",
                "resource_type" => "image",
                "public_id" => "logo_" . time(),
                "transformation" => [
                    [
                        "width" => 300,
                        "height" => 300,
                        "crop" => "fit",
                        "quality" => "auto:good"
                    ]
                ],
                "timeout" => 30
            ]);

            $url = $upload['secure_url'];

            DB::table("eventserviceprovider")
                ->where("UserID", $userId)
                ->update(["avatar" => $url]);

            return $this->json($response, true, "Vendor logo updated", 200, [
                "logo" => $url
            ]);

        } catch (\Exception $e) {
            error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to upload logo", 500);
        }
    }

    /* ===========================================================
     *  UPDATE HERO IMAGE - ✅ OPTIMIZED
     * =========================================================== */
    public function updateHero(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        $hero = $request->getUploadedFiles()['hero'] ?? null;
        if (!$hero || $hero->getError() !== UPLOAD_ERR_OK) {
            return $this->json($response, false, "Invalid hero image", 400);
        }

        try {
            $tmp = $hero->getStream()->getMetadata('uri');

            $upload = $this->cloud->uploadApi()->upload($tmp, [
                "folder" => "solennia/vendors/hero/{$userId}",
                "resource_type" => "image",
                "public_id" => "hero_{$userId}_" . time(),
                "transformation" => [
                    [
                        "width" => 1920,
                        "height" => 1080,
                        "crop" => "limit",
                        "quality" => "auto:good"
                    ]
                ],
                "timeout" => 30
            ]);

            $url = $upload['secure_url'];

            DB::table("eventserviceprovider")
                ->where("UserID", $userId)
                ->update(["HeroImageUrl" => $url]);

            return $this->json($response, true, "Hero image updated", 200, [
                "hero_image" => $url
            ]);

        } catch (\Exception $e) {
            error_log("HERO_UPLOAD_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to upload hero image", 500);
        }
    }

    /* ===========================================================
     *  UPLOAD GALLERY - ✅ OPTIMIZED
     * =========================================================== */
    public function uploadGallery(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        $files = $request->getUploadedFiles()['gallery'] ?? [];
        if (empty($files)) {
            return $this->json($response, false, "No gallery images uploaded", 400);
        }

        if (count($files) > 10) {
            return $this->json($response, false, "Maximum 10 images per upload", 400);
        }

        $urls = [];
        $errors = [];

        foreach ($files as $index => $file) {
            if ($file->getError() !== UPLOAD_ERR_OK) {
                $errors[] = "Image " . ($index + 1) . " upload failed";
                continue;
            }

            try {
                $tmp = $file->getStream()->getMetadata('uri');

                $upload = $this->cloud->uploadApi()->upload($tmp, [
                    "folder" => "solennia/vendors/gallery/{$userId}",
                    "resource_type" => "image",
                    "public_id" => "gallery_" . time() . "_" . bin2hex(random_bytes(2)),
                    "transformation" => [
                        [
                            "width" => 1200,
                            "crop" => "limit",
                            "quality" => "auto:good"
                        ]
                    ],
                    "timeout" => 30
                ]);

                $url = $upload['secure_url'];
                $urls[] = $url;

                DB::table("vendor_gallery")->insert([
                    "user_id" => $userId,
                    "image_url" => $url,
                    "created_at" => date('Y-m-d H:i:s')
                ]);

            } catch (\Exception $e) {
                error_log("GALLERY_UPLOAD_ERROR: " . $e->getMessage());
                $errors[] = "Image " . ($index + 1) . " failed";
            }
        }

        if (empty($urls) && !empty($errors)) {
            return $this->json($response, false, "All uploads failed", 500, ['errors' => $errors]);
        }

        return $this->json($response, true, "Gallery updated", 200, [
            "images" => $urls,
            "errors" => $errors
        ]);
    }

    /* ===========================================================
     *  UPDATE VENDOR INFO - ✅ OPTIMIZED
     * =========================================================== */
    public function updateVendorInfo(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        $data = (array)$request->getParsedBody();

        $updateData = [];
        $allowedFields = ['bio', 'services', 'service_areas', 'Description', 'Pricing'];

        foreach ($allowedFields as $field) {
            if (isset($data[strtolower($field)]) || isset($data[$field])) {
                $updateData[$field] = $data[strtolower($field)] ?? $data[$field];
            }
        }

        if (empty($updateData)) {
            return $this->json($response, false, "No data to update", 400);
        }

        try {
            DB::table("eventserviceprovider")
                ->where("UserID", $userId)
                ->update($updateData);

            return $this->json($response, true, "Vendor info updated", 200);

        } catch (\Exception $e) {
            error_log("UPDATE_VENDOR_INFO_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to update info", 500);
        }
    }

    /* ===========================================================
     *  JSON Helper
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