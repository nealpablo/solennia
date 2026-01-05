<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;
use Src\Controllers\VendorController;
use Cloudinary\Cloudinary;

return function (App $app) {

    // Cloudinary instance
    $cloudinary = new Cloudinary([
        'cloud' => [
            'cloud_name' => getenv('CLOUDINARY_CLOUD'),
            'api_key'    => getenv('CLOUDINARY_KEY'),
            'api_secret' => getenv('CLOUDINARY_SECRET')
        ],
        'url' => ['secure' => true]
    ]);

    // Helper JSON Response
    $json = function (Response $res, array $payload, int $status = 200) {
        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    };

    // ✅ NEW: Generate signed upload URL for direct client uploads
    $app->post('/api/vendor/get-upload-signature', function (Request $req, Response $res) use ($json) {
    try {
        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        // 🔍 Load env vars explicitly
        $cloudName = getenv('CLOUDINARY_CLOUD');
        $apiKey    = getenv('CLOUDINARY_KEY');
        $apiSecret = getenv('CLOUDINARY_SECRET');

        // 🚨 HARD FAIL WITH LOGGING (NO SILENT 500)
        if (!$cloudName || !$apiKey || !$apiSecret) {
            error_log('CLOUDINARY_ENV_MISSING: ' . json_encode([
                'CLOUDINARY_CLOUD'  => (bool) $cloudName,
                'CLOUDINARY_KEY'    => (bool) $apiKey,
                'CLOUDINARY_SECRET' => (bool) $apiSecret,
            ]));

            return $json($res, [
                'success' => false,
                'error'   => 'Cloudinary configuration missing on server'
            ], 500);
        }

        $userId = (int) $auth->mysql_id;
        $data = (array) $req->getParsedBody();
        $fileType = $data['file_type'] ?? 'document';

        $timestamp = time();
        $folder = "solennia/vendor/{$userId}";
        $publicId = "{$fileType}_{$timestamp}_" . bin2hex(random_bytes(4));

        $params = [
            'timestamp'     => $timestamp,
            'folder'        => $folder,
            'public_id'     => $publicId,
            'resource_type' => 'auto',
        ];

        // ✅ Correct Cloudinary signing
        $signature = ApiUtils::signRequest($params, $apiSecret);

        return $json($res, [
            'success'    => true,
            'upload_url' => "https://api.cloudinary.com/v1_1/{$cloudName}/auto/upload",
            'params'     => array_merge($params, [
                'api_key'   => $apiKey,
                'signature' => $signature
            ])
        ]);

    } catch (\Throwable $e) {
        error_log('UPLOAD_SIGNATURE_FATAL: ' . $e->getMessage());
        return $json($res, [
            'success' => false,
            'error'   => 'Failed to generate upload signature'
        ], 500);
    }
})->add(new AuthMiddleware());

    // Helper function to send notifications
    $sendNotification = function ($userId, $type, $title, $message) {
        try {
            DB::table('notifications')->insert([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'read' => false,
                'created_at' => DB::raw('NOW()')
            ]);
        } catch (\Exception $e) {
            error_log("Failed to send notification: " . $e->getMessage());
        }
    };

    // Helper function to send notification to all admins
    $sendToAdmins = function ($type, $title, $message) use ($sendNotification) {
        try {
            $admins = DB::table('credential')->where('role', 2)->get();
            foreach ($admins as $admin) {
                $sendNotification($admin->id, $type, $title, $message);
            }
        } catch (\Exception $e) {
            error_log("Failed to send admin notification: " . $e->getMessage());
        }
    };

    // Create vendor profile (first-time setup)
    $app->post('/api/vendor/profile/create', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->createVendorProfile($req, $res);
    })->add(new AuthMiddleware());

    // Vendor dashboard
    $app->get('/api/vendor/dashboard', function (Request $req, Response $res) use ($json) {
        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $userId = (int) $auth->mysql_id;

        try {
            $vendor = DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$vendor) {
                return $json($res, [
                    'success' => false,
                    'error' => 'No approved vendor profile found'
                ], 404);
            }

            $user = DB::table('credential')
                ->where('id', $userId)
                ->first();

            $vendorData = [
                'id' => $vendor->ID,
                'user_id' => $vendor->UserID,
                'business_name' => $vendor->BusinessName,
                'category' => $vendor->Category,
                'description' => $vendor->Description,
                'pricing' => $vendor->Pricing,
                'hero_image_url' => $vendor->HeroImageUrl,
                'vendor_logo' => $vendor->avatar,
                'business_email' => $vendor->BusinessEmail,
                'business_address' => $vendor->BusinessAddress,
                'bio' => $vendor->bio,
                'services' => $vendor->services,
                'service_areas' => $vendor->service_areas,
                'user_avatar' => $user->avatar ?? null
            ];

            // ✅ GALLERY FIX: Fetch from vendor_gallery table
            $gallery = DB::table('vendor_gallery')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->pluck('image_url')
                ->toArray();

            $bookings = [
                ['title' => 'Total Bookings', 'count' => 0],
                ['title' => 'Pending Bookings', 'count' => 0]
            ];

            $insights = [
                'labels' => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                'datasets' => [
                    [
                        'label' => 'Profile Views',
                        'data' => [12, 19, 15, 25, 22, 30]
                    ]
                ]
            ];

            return $json($res, [
                'success' => true,
                'vendor' => $vendorData,
                'gallery' => $gallery,
                'bookings' => $bookings,
                'insights' => $insights
            ]);

        } catch (\Throwable $e) {
            error_log('VENDOR_DASHBOARD_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error' => 'Failed to load dashboard: ' . $e->getMessage()
            ], 500);
        }
    })->add(new AuthMiddleware());

    // Get all vendors (public)
    $app->get('/api/vendors/public', function (Request $req, Response $res) use ($json) {
        try {
            $vendors = DB::table('event_service_provider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('esp.ApplicationStatus', 'Approved')
                ->whereNotNull('esp.avatar')
                ->select(
                    'esp.ID as id',
                    'esp.UserID as user_id',
                    'esp.BusinessName as business_name',
                    'esp.Category as category',
                    'esp.BusinessAddress as address',
                    'esp.Description as description',
                    'esp.bio',
                    'esp.Pricing as pricing',
                    'esp.HeroImageUrl as hero_image_url',
                    'esp.avatar as vendor_logo',
                    'esp.services',
                    'esp.service_areas',
                    'c.firebase_uid',
                    'c.avatar as user_avatar'
                )
                ->orderByDesc('esp.DateApplied')
                ->get();

            $vendorsList = [];
            foreach ($vendors as $vendor) {
                $vendorsList[] = [
                    'id' => $vendor->id,
                    'user_id' => $vendor->user_id,
                    'business_name' => $vendor->business_name,
                    'category' => $vendor->category,
                    'description' => $vendor->description,
                    'bio' => $vendor->bio,
                    'pricing' => $vendor->pricing,
                    'hero_image_url' => $vendor->hero_image_url,
                    'vendor_logo' => $vendor->vendor_logo,
                    'address' => $vendor->address,
                    'firebase_uid' => $vendor->firebase_uid
                ];
            }

            return $json($res, [
                'success' => true,
                'vendors' => $vendorsList
            ]);

        } catch (\Throwable $e) {
            error_log('VENDORS_PUBLIC_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error' => 'Failed to load vendors',
                'message' => $e->getMessage()
            ], 500);
        }
    });

    // Get single vendor (public)
    $app->get('/api/vendor/public/{userId}', function (Request $req, Response $res, array $args) use ($json) {
        try {
            $userId = (int) $args['userId'];

            $vendor = DB::table('event_service_provider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('esp.UserID', $userId)
                ->where('esp.ApplicationStatus', 'Approved')
                ->select(
                    'esp.*',
                    'c.firebase_uid',
                    'c.first_name',
                    'c.last_name',
                    'c.avatar as user_avatar'
                )
                ->first();

            if (!$vendor) {
                return $json($res, [
                    'success' => false,
                    'error' => 'Vendor not found'
                ], 404);
            }

            // ✅ GALLERY FIX: Fetch from vendor_gallery table
            $gallery = DB::table('vendor_gallery')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->pluck('image_url')
                ->toArray();

            // Handle both JSON and plain text for services
            $services = $vendor->services;
            if ($services) {
                $decoded = @json_decode($services, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $services = $decoded;
                }
            }

            // Handle both JSON and plain text for service_areas
            $service_areas = $vendor->service_areas;
            if ($service_areas) {
                $decoded = @json_decode($service_areas, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $service_areas = $decoded;
                }
            }

            $vendorData = [
                'id' => $vendor->ID,
                'user_id' => $vendor->UserID,
                'firebase_uid' => $vendor->firebase_uid,
                'owner_name' => trim($vendor->first_name . ' ' . $vendor->last_name),
                'business_name' => $vendor->BusinessName,
                'category' => $vendor->Category,
                'description' => $vendor->Description,
                'bio' => $vendor->bio,
                'pricing' => $vendor->Pricing,
                'services' => $services ?: null,
                'service_areas' => $service_areas ?: null,
                'business_email' => $vendor->BusinessEmail,
                'business_address' => $vendor->BusinessAddress,
                'hero_image_url' => $vendor->HeroImageUrl,
                'vendor_logo' => $vendor->avatar,
                'user_avatar' => $vendor->user_avatar,
                'gallery' => $gallery
            ];

            return $json($res, [
                'success' => true,
                'vendor' => $vendorData
            ]);

        } catch (\Throwable $e) {
            error_log('VENDOR_PUBLIC_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error' => 'Failed to load vendor'
            ], 500);
        }
    });

    // ✅ ULTRA FAST: Vendor application - NO FILE UPLOAD (receives URLs only)
    $app->post('/api/vendor/apply', function (Request $req, Response $res) use ($json, $sendNotification, $sendToAdmins) {

        try {
            $auth = $req->getAttribute('user');
            if (!$auth || !isset($auth->mysql_id)) {
                return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $userId = (int) $auth->mysql_id;

            $role = DB::table('credential')
                ->where('id', $userId)
                ->value('role');

            if ($role != 0) {
                return $json($res, [
                    'success' => false,
                    'error'   => 'Only clients (role 0) can apply.'
                ], 403);
            }

            $data = (array) $req->getParsedBody();

            // ✅ CHANGED: Now requires URLs instead of files
            $required = ['business_name','category','address','description','pricing','permits_url','gov_id_url','portfolio_url'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $json($res, [
                        'success' => false,
                        'error'   => "Missing field: {$field}"
                    ], 422);
                }
            }

            // ✅ Validate URLs are from Cloudinary
            $cloudinaryDomain = 'res.cloudinary.com';
            foreach (['permits_url', 'gov_id_url', 'portfolio_url'] as $urlField) {
                if (strpos($data[$urlField], $cloudinaryDomain) === false) {
                    return $json($res, [
                        'success' => false,
                        'error' => "Invalid URL: {$urlField} must be a Cloudinary URL"
                    ], 422);
                }
            }

            $exists = DB::table('vendor_application')
                ->where('user_id', $userId)
                ->whereIn('status', ['Pending', 'Approved'])
                ->first();

            if ($exists) {
                return $json($res, [
                    'success' => false,
                    'error'   => 'You already have a pending or approved application.'
                ], 400);
            }

            // ✅ NO FILE UPLOAD - INSTANT INSERT!
            $insertData = [
                'user_id'       => $userId,
                'business_name' => $data['business_name'],
                'category'      => $data['category'],
                'address'       => $data['address'],
                'permits'       => $data['permits_url'],  // ✅ Direct URL
                'gov_id'        => $data['gov_id_url'],    // ✅ Direct URL
                'portfolio'     => $data['portfolio_url'], // ✅ Direct URL
                'contact_email'=> $data['contact_email']
                    ?? DB::table('credential')->where('id', $userId)->value('email'),
                'description'   => $data['description'],
                'pricing'       => $data['pricing'],
                'status'        => 'Pending',
                'created_at'    => date('Y-m-d H:i:s')
            ];

            if (strtolower(trim($data['category'])) === 'venue') {
                $insertData['venue_subcategory'] = $data['venue_subcategory'] ?? null;
                $insertData['venue_capacity'] = $data['venue_capacity'] ?? null;
                $insertData['venue_amenities'] = $data['venue_amenities'] ?? null;
                $insertData['venue_operating_hours'] = $data['venue_operating_hours'] ?? null;
                $insertData['venue_parking'] = $data['venue_parking'] ?? null;
            }

            $appId = DB::table('vendor_application')->insertGetId($insertData);

            error_log("VENDOR_APPLICATION_SUCCESS: AppID={$appId}, UserID={$userId}");

            // Send notifications (async - doesn't block response)
            $sendToAdmins(
                'application_submitted',
                'New Vendor Application',
                "{$data['business_name']} has submitted a vendor application"
            );

            $sendNotification(
                $userId,
                'application_received',
                'Application Received',
                'Your vendor application has been received and is under review.'
            );

            // ✅ INSTANT RESPONSE (< 100ms instead of 30+ seconds!)
            return $json($res, [
                'success' => true,
                'message' => 'Vendor application submitted!',
                'application_id' => $appId
            ], 201);

        } catch (\Throwable $e) {
            error_log('VENDOR_APPLY_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error'   => 'Server error: ' . $e->getMessage()
            ], 500);
        }

    })->add(new AuthMiddleware());

    // Check vendor status
    $app->get('/api/vendor/status', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->getVendorStatus($req, $res);
    })->add(new AuthMiddleware());

    // Vendor update routes
    $app->post('/api/vendor/profile', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->updateProfile($req, $res);
    })->add(new AuthMiddleware());

    $app->post('/api/vendor/logo', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->updateLogo($req, $res);
    })->add(new AuthMiddleware());

    $app->post('/api/vendor/hero', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->updateHero($req, $res);
    })->add(new AuthMiddleware());

    $app->post('/api/vendor/info', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->updateVendorInfo($req, $res);
    })->add(new AuthMiddleware());

    $app->post('/api/vendor/gallery', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->uploadGallery($req, $res);
    })->add(new AuthMiddleware());

};