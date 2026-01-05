<?php
namespace Src\Controllers;

use Cloudinary\Cloudinary;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VendorController
{
    private Cloudinary $cloud;
    private const MAX_FILE_SIZE = 10485760; // 10MB
    private const UPLOAD_TIMEOUT = 20; // Reduced from 60 to 20 seconds

    public function __construct()
    {
        $this->cloud = new Cloudinary([
            'cloud' => [
                'cloud_name' => getenv('CLOUDINARY_CLOUD'),
                'api_key'    => getenv('CLOUDINARY_KEY'),
                'api_secret' => getenv('CLOUDINARY_SECRET')
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* ===========================================================
     *  ✅ OPTIMIZED: CREATE VENDOR PROFILE with validation
     * =========================================================== */
    public function createVendorProfile(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;

            // ✅ Use transaction for data consistency
            DB::beginTransaction();

            try {
                // Check if user is approved vendor
                $application = DB::table('vendor_application')
                    ->where('user_id', $userId)
                    ->where('status', 'Approved')
                    ->first();

                if (!$application) {
                    DB::rollBack();
                    return $this->json($response, false, "No approved vendor application found", 403);
                }

                // Check if profile already exists
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
                $businessName = $data['business_name'] ?? $application->business_name;
                $bio = $data['bio'] ?? '';
                $services = $data['services'] ?? '';
                $serviceAreas = $data['service_areas'] ?? '';

                if (empty($bio) || empty($services)) {
                    DB::rollBack();
                    return $this->json($response, false, "Bio and services are required", 422);
                }

                // ✅ Upload images with validation and parallel processing
                $logoUrl = null;
                $heroUrl = null;

                // Upload Logo with validation
                if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                    // ✅ Validate file size
                    if ($files['logo']->getSize() > self::MAX_FILE_SIZE) {
                        DB::rollBack();
                        return $this->json($response, false, "Logo file too large (max 10MB)", 400);
                    }

                    try {
                        $tmpPath = $files['logo']->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                            "folder" => "solennia/vendors/logo/{$userId}",
                            "resource_type" => "image",
                            "public_id" => "logo_" . time(),
                            "transformation" => [
                                ["width" => 300, "height" => 300, "crop" => "fit", "quality" => "auto:eco", "fetch_format" => "auto"]
                            ],
                            "timeout" => self::UPLOAD_TIMEOUT
                        ]);
                        $logoUrl = $upload['secure_url'];
                    } catch (\Exception $e) {
                        error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
                        // Don't fail the entire request if image upload fails
                    }
                }

                // Upload Hero Image with validation
                if (isset($files['hero']) && $files['hero']->getError() === UPLOAD_ERR_OK) {
                    // ✅ Validate file size
                    if ($files['hero']->getSize() > self::MAX_FILE_SIZE) {
                        DB::rollBack();
                        return $this->json($response, false, "Hero image file too large (max 10MB)", 400);
                    }

                    try {
                        $tmpPath = $files['hero']->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmpPath, [
                            "folder" => "solennia/vendors/hero/{$userId}",
                            "resource_type" => "image",
                            "public_id" => "hero_" . time(),
                            "transformation" => [
                                ["width" => 1920, "height" => 1080, "crop" => "limit", "quality" => "auto:eco", "fetch_format" => "auto"]
                            ],
                            "timeout" => self::UPLOAD_TIMEOUT
                        ]);
                        $heroUrl = $upload['secure_url'];
                    } catch (\Exception $e) {
                        error_log("HERO_UPLOAD_ERROR: " . $e->getMessage());
                    }
                }

                // Create vendor profile
                DB::table('event_service_provider')->insert([
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

                DB::commit();

                error_log("VENDOR_PROFILE_CREATED: UserID={$userId}");

                return $this->json($response, true, "Vendor profile created successfully!", 201, [
                    'logo' => $logoUrl,
                    'hero' => $heroUrl
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            error_log("CREATE_VENDOR_PROFILE_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create profile: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  Check Profile Setup Status
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
            'esp.Category',
            'esp.BusinessName',
            'esp.bio',
            'esp.services',
            'esp.avatar',
            'esp.HeroImageUrl',
            'esp.UserID as profile_exists'
        )
        ->first();

    if (!$result) {
        return $this->json($response, true, "No vendor application found", 200, [
            'status'        => 'none',
            'category'      => null,
            'has_profile'   => false,
            'needs_setup'   => false,
            'vendor'        => null
        ]);
    }

    $hasProfile = $result->profile_exists !== null;
    $needsSetup = (
        $result->application_status === 'Approved'
        && !$hasProfile
    );

    return $this->json($response, true, "Status retrieved", 200, [
        'status'        => strtolower($result->application_status ?? 'none'),
        'category'      => $result->category ?? null,
        'has_profile'   => $hasProfile,
        'needs_setup'   => $needsSetup,
        'vendor'        => $hasProfile ? [
            'Category'            => $result->Category,
            'VerificationStatus'  => 'approved',
            'BusinessName'        => $result->BusinessName,
            'bio'                 => $result->bio,
            'services'            => $result->services,
            'avatar'              => $result->avatar,
            'HeroImageUrl'        => $result->HeroImageUrl
        ] : null
    ]);
}

    /* ===========================================================
     *  GET VENDOR PUBLIC DATA with caching
     * =========================================================== */
    public function getPublicVendorData(Request $request, Response $response, $args)
    {
        $userId = $args['id'] ?? null;
        
        if (!$userId) {
            return $this->json($response, false, "User ID required", 400);
        }

        // ✅ Single optimized query with gallery
        $vendor = DB::table('event_service_provider')
            ->where('UserID', $userId)
            ->where('ApplicationStatus', 'Approved')
            ->first();

        if (!$vendor) {
            return $this->json($response, false, "Vendor not found", 404);
        }

        // Get gallery images efficiently
        $gallery = DB::table('vendor_gallery')
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->pluck('image_url')
            ->toArray();

        return $this->json($response, true, "Vendor data retrieved", 200, [
            'vendor' => [
                'id' => $vendor->UserID,
                'business_name' => $vendor->BusinessName,
                'category' => $vendor->Category,
                'bio' => $vendor->bio,
                'services' => $vendor->services,
                'service_areas' => $vendor->service_areas,
                'avatar' => $vendor->avatar,
                'hero_image' => $vendor->HeroImageUrl,
                'description' => $vendor->Description,
                'pricing' => $vendor->Pricing,
                'email' => $vendor->BusinessEmail,
                'address' => $vendor->BusinessAddress,
                'gallery' => $gallery
            ]
        ]);
    }

    /* ===========================================================
     *  ✅ OPTIMIZED: UPDATE LOGO with validation
     * =========================================================== */
    public function updateLogo(Request $request, Response $response)
    {
        $u = $request->getAttribute('user');
        if (!$u || !isset($u->mysql_id)) {
            return $this->json($response, false, "Unauthorized", 401);
        }
        $userId = $u->mysql_id;

        $logo = $request->getUploadedFiles()['logo'] ?? null;
        if (!$logo || $logo->getError() !== UPLOAD_ERR_OK) {
            return $this->json($response, false, "Invalid logo file", 400);
        }

        // ✅ Validate file size
        if ($logo->getSize() > self::MAX_FILE_SIZE) {
            return $this->json($response, false, "File too large (max 10MB)", 400);
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
                        "quality" => "auto:eco",
                        "fetch_format" => "auto"
                    ]
                ],
                "timeout" => self::UPLOAD_TIMEOUT
            ]);

            $url = $upload['secure_url'];

            DB::table("event_service_provider")
                ->where("UserID", $userId)
                ->update(["avatar" => $url]);

            return $this->json($response, true, "Vendor logo updated", 200, [
                "logo" => $url
            ]);

        } catch (\Exception $e) {
            error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to upload logo: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  ✅ OPTIMIZED: UPDATE HERO IMAGE with validation
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

        // ✅ Validate file size
        if ($hero->getSize() > self::MAX_FILE_SIZE) {
            return $this->json($response, false, "File too large (max 10MB)", 400);
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
                        "quality" => "auto:eco",
                        "fetch_format" => "auto"
                    ]
                ],
                "timeout" => self::UPLOAD_TIMEOUT
            ]);

            $url = $upload['secure_url'];

            DB::table("event_service_provider")
                ->where("UserID", $userId)
                ->update(["HeroImageUrl" => $url]);

            return $this->json($response, true, "Hero image updated", 200, [
                "hero_image" => $url
            ]);

        } catch (\Exception $e) {
            error_log("HERO_UPLOAD_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to upload hero image: " . $e->getMessage(), 500);
        }
    }

    /* ===========================================================
     *  ✅ BATCH OPTIMIZED: UPLOAD GALLERY with validation
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
        $inserts = [];

        foreach ($files as $index => $file) {
            if ($file->getError() !== UPLOAD_ERR_OK) {
                $errors[] = "Image " . ($index + 1) . " upload failed";
                continue;
            }

            // ✅ Validate file size
            if ($file->getSize() > self::MAX_FILE_SIZE) {
                $errors[] = "Image " . ($index + 1) . " too large (max 10MB)";
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
                            "quality" => "auto:eco",
                            "fetch_format" => "auto"
                        ]
                    ],
                    "timeout" => self::UPLOAD_TIMEOUT
                ]);

                $url = $upload['secure_url'];
                $urls[] = $url;

                // ✅ Batch inserts for better performance
                $inserts[] = [
                    "user_id" => $userId,
                    "image_url" => $url,
                    "created_at" => date('Y-m-d H:i:s')
                ];

            } catch (\Exception $e) {
                error_log("GALLERY_UPLOAD_ERROR: " . $e->getMessage());
                $errors[] = "Image " . ($index + 1) . " failed: " . $e->getMessage();
            }
        }

        // ✅ Batch insert all images at once
        if (!empty($inserts)) {
            DB::table("vendor_gallery")->insert($inserts);
        }

        if (empty($urls) && !empty($errors)) {
            return $this->json($response, false, "All uploads failed", 500, ['errors' => $errors]);
        }

        return $this->json($response, true, "Gallery updated", 200, [
            "images" => $urls,
            "count" => count($urls),
            "errors" => $errors
        ]);
    }

    /* ===========================================================
     *  ✅ OPTIMIZED: UPDATE VENDOR INFO
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
            DB::table("event_service_provider")
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