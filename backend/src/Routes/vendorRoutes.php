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

    // ✅ OPTIMIZED FOR RAILWAY: 10s timeout, aggressive compression
    $uploadFileOptimized = function ($file, $userId, $tag) use ($cloudinary) {
        try {
            $tmp = $file->getStream()->getMetadata('uri');
            
            $uploadOptions = [
                'folder' => "solennia/vendor/{$userId}",
                'resource_type' => 'auto',
                'public_id' => "{$tag}_" . time(),
                'timeout' => 10  // ✅ 10 seconds - perfect for 1MB files
            ];

            $mimeType = $file->getClientMediaType();
            if (strpos($mimeType, 'image/') === 0) {
                // ✅ Aggressive compression for fast uploads
                $uploadOptions['transformation'] = [
                    [
                        'quality' => 'auto:low',  // Lower quality = faster
                        'fetch_format' => 'auto',
                        'width' => 800,  // Smaller size = faster
                        'crop' => 'limit'
                    ]
                ];
            }

            $upload = $cloudinary->uploadApi()->upload($tmp, $uploadOptions);
            return ['success' => true, 'url' => $upload['secure_url']];

        } catch (\Exception $e) {
            error_log("UPLOAD_ERROR ({$tag}): " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    };

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

            $gallery = [];
            if ($vendor->gallery) {
                $gallery = json_decode($vendor->gallery, true) ?: [];
            }

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

    // 🔧 FIXED: Get single vendor (public)
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

            $gallery = [];
            if ($vendor->gallery) {
                $gallery = json_decode($vendor->gallery, true) ?: [];
            }

            // 🔧 FIX: Handle both JSON and plain text for services
            $services = $vendor->services;
            if ($services) {
                // Try to decode as JSON
                $decoded = @json_decode($services, true);
                // If it's valid JSON and returns an array, use it
                // Otherwise, keep it as plain text string
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $services = $decoded;
                }
                // else: $services remains as the plain text string
            }

            // 🔧 FIX: Handle both JSON and plain text for service_areas
            $service_areas = $vendor->service_areas;
            if ($service_areas) {
                // Try to decode as JSON
                $decoded = @json_decode($service_areas, true);
                // If it's valid JSON and returns an array, use it
                // Otherwise, keep it as plain text string
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $service_areas = $decoded;
                }
                // else: $service_areas remains as the plain text string
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
                'services' => $services ?: null,  // 🔧 Now handles both string and array
                'service_areas' => $service_areas ?: null,  // 🔧 Now handles both string and array
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

    // ✅ OPTIMIZED FOR RAILWAY: 1MB limit, 10s timeout per file
    $app->post('/api/vendor/apply', function (Request $req, Response $res) use ($json, $uploadFileOptimized, $sendNotification, $sendToAdmins) {

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

            $required = ['business_name','category','address','description','pricing'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $json($res, [
                        'success' => false,
                        'error'   => "Missing field: {$field}"
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

            $files = $req->getUploadedFiles();
            
            // ✅ STRICT 1MB LIMIT FOR RAILWAY
            foreach (['permits','gov_id','portfolio'] as $fileKey) {
                if (!isset($files[$fileKey]) || $files[$fileKey]->getError() !== UPLOAD_ERR_OK) {
                    return $json($res, [
                        'success' => false, 
                        'error' => "Invalid upload: {$fileKey}"
                    ], 422);
                }
                
                $fileSize = $files[$fileKey]->getSize();
                if ($fileSize > 1 * 1024 * 1024) { // 1MB
                    $fileSizeMB = round($fileSize / (1024 * 1024), 2);
                    return $json($res, [
                        'success' => false, 
                        'error' => "{$fileKey} is too large ({$fileSizeMB}MB). Maximum 1MB. Compress at TinyPNG.com before uploading."
                    ], 422);
                }
            }

            // ✅ Upload files (fast with 1MB files and 10s timeout!)
            error_log("UPLOAD_START: UserID={$userId}");
            $uploadResults = [
                'permits' => $uploadFileOptimized($files['permits'], $userId, 'permits'),
                'gov_id' => $uploadFileOptimized($files['gov_id'], $userId, 'govid'),
                'portfolio' => $uploadFileOptimized($files['portfolio'], $userId, 'portfolio')
            ];
            error_log("UPLOAD_COMPLETE: UserID={$userId}");

            foreach ($uploadResults as $key => $result) {
                if (!$result['success']) {
                    return $json($res, [
                        'success' => false,
                        'error' => "Failed to upload {$key}: " . $result['error']
                    ], 500);
                }
            }

            $insertData = [
                'user_id'       => $userId,
                'business_name' => $data['business_name'],
                'category'      => $data['category'],
                'address'       => $data['address'],
                'permits'       => $uploadResults['permits']['url'],
                'gov_id'        => $uploadResults['gov_id']['url'],
                'portfolio'     => $uploadResults['portfolio']['url'],
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

            // Send notifications
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
        return $controller->updateVendorLogo($req, $res);
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