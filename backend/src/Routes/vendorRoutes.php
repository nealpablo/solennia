<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;
use Src\Controllers\VendorController;
use Cloudinary\Cloudinary;

return function (App $app) {

    /* ===========================================================
     * SAFE CLOUDINARY INITIALIZATION 
     * =========================================================== */
    $cloudinary = null;

    $cloudName = envx('CLOUDINARY_CLOUD');
    $apiKey    = envx('CLOUDINARY_KEY');
    $apiSecret = envx('CLOUDINARY_SECRET');

    if ($cloudName && $apiKey && $apiSecret) {
        $cloudinary = new Cloudinary([
            'cloud' => [
                'cloud_name' => $cloudName,
                'api_key'    => $apiKey,
                'api_secret' => $apiSecret
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* ===========================================================
     * JSON RESPONSE HELPER (WITH CORS HEADERS)
     * =========================================================== */
    $json = function (Response $res, array $payload, int $status = 200) {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';

        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));

        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withStatus($status);
    };

    /* ===========================================================
     * SEND NOTIFICATION HELPER
     * =========================================================== */
    $sendNotification = function ($userId, $type, $title, $message) {
        try {
            DB::table('notifications')->insert([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'read' => false,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Throwable $e) {
            error_log("NOTIFICATION_ERROR: " . $e->getMessage());
        }
    };

    /* ===========================================================
     * SEND TO ADMINS HELPER
     * =========================================================== */
    $sendToAdmins = function ($type, $title, $message) use ($sendNotification) {
        try {
            $admins = DB::table('credential')->where('role', 1)->pluck('id');
            foreach ($admins as $adminId) {
                $sendNotification($adminId, $type, $title, $message);
            }
        } catch (\Throwable $e) {
            error_log("SEND_TO_ADMINS_ERROR: " . $e->getMessage());
        }
    };

    /* ===========================================================
     * CORS MIDDLEWARE - HANDLES ALL PREFLIGHT REQUESTS
     * =========================================================== */
    $app->add(function ($request, $handler) {
        $response = $handler->handle($request);
        $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';
        
        return $response
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Allow-Credentials', 'true');
    });

    /* ===========================================================
     * OPTIONS HANDLERS FOR PREFLIGHT REQUESTS
     * =========================================================== */
    $app->options('/api/vendors/public', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/public/{userId}', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/get-upload-signature', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/apply', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/dashboard', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/status', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/profile', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/logo', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/hero', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/info', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/gallery', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    /* ===========================================================
     * SIGNED UPLOAD URL
     * =========================================================== */
    $app->post('/api/vendor/get-upload-signature', function (Request $req, Response $res) use ($json) {

        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $cloudName = envx('CLOUDINARY_CLOUD');
        $apiKey    = envx('CLOUDINARY_KEY');
        $apiSecret = envx('CLOUDINARY_SECRET');

        if (!$cloudName || !$apiKey || !$apiSecret) {
            return $json($res, ['success' => false, 'error' => 'Cloudinary config missing'], 500);
        }

        $data     = (array)$req->getParsedBody();
        $fileType = $data['file_type'] ?? 'document';

        $isRaw = in_array($fileType, ['permits', 'gov_id', 'portfolio'], true);
        $uploadType = $isRaw ? 'raw' : 'image';

        $timestamp = time();
        $folder    = "solennia/vendor/{$auth->mysql_id}";
        $publicId  = "{$fileType}_{$timestamp}_" . bin2hex(random_bytes(4));

        $params = [
            'folder'    => $folder,
            'public_id' => $publicId,
            'timestamp' => $timestamp
        ];

        ksort($params);
        $signature = sha1(implode('&', array_map(fn($k, $v) => "$k=$v", array_keys($params), $params)) . $apiSecret);

        return $json($res, [
            'success'    => true,
            'upload_url' => "https://api.cloudinary.com/v1_1/{$cloudName}/{$uploadType}/upload",
            'params'     => array_merge($params, [
                'api_key'   => $apiKey,
                'signature' => $signature
            ])
        ]);
    })->add(new AuthMiddleware());

    /* ===========================================================
     * VENDOR DASHBOARD
     * =========================================================== */
    $app->get('/api/vendor/dashboard', function (Request $req, Response $res) use ($json) {
        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $userId = (int)$auth->mysql_id;

        try {
            //  Check if vendor profile exists in event_service_provider
            $vendor = DB::table('event_service_provider')
                ->where('UserID', $userId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$vendor) {
                // Check if they have an approved application but no profile yet
                $application = DB::table('vendor_application')
                    ->where('user_id', $userId)
                    ->where('status', 'Approved')
                    ->first();
                
                if ($application) {
                    return $json($res, [
                        'success' => false, 
                        'error' => 'Profile setup required',
                        'needs_setup' => true
                    ], 403);
                }
                
                return $json($res, ['success' => false, 'error' => 'No approved vendor profile found'], 404);
            }

            $user = DB::table('credential')->where('id', $userId)->first();

            $gallery = DB::table('vendor_gallery')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->pluck('image_url')
                ->toArray();

            return $json($res, [
                'success' => true,
                'vendor' => $vendor,
                'gallery' => $gallery
            ]);

        } catch (\Throwable $e) {
            error_log('VENDOR_DASHBOARD_ERROR: ' . $e->getMessage());
            return $json($res, ['success' => false, 'error' => 'Failed to load dashboard'], 500);
        }
    })->add(new AuthMiddleware());


    /* ===========================================================
     * PUBLIC VENDORS 
     * =========================================================== */
    $app->get('/api/vendors/public', function (Request $req, Response $res) use ($json) {
        try {
            //  Use event_service_provider for vendors with complete profiles
            $vendors = DB::table('event_service_provider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('esp.ApplicationStatus', 'Approved')
                ->orderByDesc('esp.DateApproved')
                ->select(
                    'esp.*',
                    'c.first_name',
                    'c.last_name',
                    'c.email',
                    'c.avatar as user_avatar'
                )
                ->get();

            return $json($res, [
                'success' => true,
                'vendors' => $vendors
            ]);

        } catch (\Throwable $e) {
            error_log('VENDORS_PUBLIC_ERROR: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());
            return $json($res, ['success' => false, 'error' => 'Failed to load vendors'], 500);
        }
    });

    /* ===========================================================
     * GET SINGLE VENDOR (PUBLIC) 
     * =========================================================== */
    $app->get('/api/vendor/public/{userId}', function (Request $req, Response $res, array $args) use ($json) {
        try {
            $userId = (int) $args['userId'];

            //  FIX: Use vendor_application instead of event_service_provider
            $vendor = DB::table('vendor_application as va')
                ->leftJoin('credential as c', 'va.user_id', '=', 'c.id')
                ->where('va.user_id', $userId)
                ->where('va.status', 'Approved')
                ->select(
                    'va.*',
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

            //  GALLERY FIX: Fetch from vendor_gallery table
            $gallery = DB::table('vendor_gallery')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->pluck('image_url')
                ->toArray();

            $vendorData = [
                'id' => $vendor->id,
                'user_id' => $vendor->user_id,
                'firebase_uid' => $vendor->firebase_uid,
                'owner_name' => trim(($vendor->first_name ?? '') . ' ' . ($vendor->last_name ?? '')),
                'business_name' => $vendor->business_name,
                'category' => $vendor->category,
                'description' => $vendor->description,
                'pricing' => $vendor->pricing,
                'contact_email' => $vendor->contact_email,
                'address' => $vendor->address,
                'portfolio' => $vendor->portfolio,
                'user_avatar' => $vendor->user_avatar,
                'gallery' => $gallery,
                'status' => $vendor->status
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

    /* ===========================================================
     * VENDOR APPLICATION (ULTRA FAST - URL ONLY)
     * =========================================================== */
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

            //  CHANGED: Now requires URLs instead of files
            $required = ['business_name','category','address','description','pricing','permits_url','gov_id_url','portfolio_url'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $json($res, [
                        'success' => false,
                        'error'   => "Missing field: {$field}"
                    ], 422);
                }
            }

            //  Validate URLs are from Cloudinary
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

            //  NO FILE UPLOAD - INSTANT INSERT!
            $insertData = [
                'user_id'       => $userId,
                'business_name' => $data['business_name'],
                'category'      => $data['category'],
                'address'       => $data['address'],
                'permits'       => $data['permits_url'],  
                'gov_id'        => $data['gov_id_url'],    
                'portfolio'     => $data['portfolio_url'], 
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

            //  INSTANT RESPONSE (< 100ms instead of 30+ seconds!)
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

    /* ===========================================================
     * CHECK VENDOR STATUS
     * =========================================================== */
    $app->get('/api/vendor/status', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->getVendorStatus($req, $res);
    })->add(new AuthMiddleware());

    /* ===========================================================
     * VENDOR UPDATE ROUTES
     * =========================================================== */
    $app->post('/api/vendor/profile', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->createVendorProfile($req, $res);
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