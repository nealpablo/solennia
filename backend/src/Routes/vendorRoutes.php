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
     * CLOUDINARY INITIALIZATION
     * =========================================================== */
    $cloudinary = null;
    $cloudName = envx('CLOUDINARY_CLOUD');
    $apiKey = envx('CLOUDINARY_KEY');
    $apiSecret = envx('CLOUDINARY_SECRET');

    if ($cloudName && $apiKey && $apiSecret) {
        $cloudinary = new Cloudinary([
            'cloud' => [
                'cloud_name' => $cloudName,
                'api_key' => $apiKey,
                'api_secret' => $apiSecret
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* ===========================================================
     * JSON RESPONSE HELPER
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
     * NOTIFICATION HELPERS
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

    $sendToAdmins = function ($type, $title, $message) use ($sendNotification) {
        try {
            $admins = DB::table('credential')->where('role', 2)->pluck('id');
            foreach ($admins as $adminId) {
                $sendNotification($adminId, $type, $title, $message);
            }
        } catch (\Throwable $e) {
            error_log("SEND_TO_ADMINS_ERROR: " . $e->getMessage());
        }
    };

    /* ===========================================================
     * NEW: GET PHILIPPINE REGIONS (PUBLIC)
     * =========================================================== */
    $app->get('/api/regions', function (Request $req, Response $res) use ($json) {
        try {
            $controller = new VendorController();
            return $controller->getRegions($req, $res);
        } catch (\Throwable $e) {
            error_log('GET_REGIONS_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error' => 'Failed to fetch regions'
            ], 500);
        }
    });

    /* ===========================================================
     * NEW: GET CITIES BY REGION (PUBLIC)
     * =========================================================== */
    $app->get('/api/cities/{regionCode}', function (Request $req, Response $res, array $args) use ($json) {
        try {
            $controller = new VendorController();
            return $controller->getCitiesByRegion($req, $res, $args);
        } catch (\Throwable $e) {
            error_log('GET_CITIES_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error' => 'Failed to fetch cities'
            ], 500);
        }
    });

    /* ===========================================================
     * OPTIONS HANDLERS (CORS PREFLIGHT)
     * =========================================================== */
    $app->options('/api/regions', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/cities/{regionCode}', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendors/public', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/public/{userId}', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/{userId}/bookings', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/get-upload-signature', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/vendor/apply', function (Request $req, Response $res) use ($json) {
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
     * GET PUBLIC VENDORS LIST
     * =========================================================== */
    $app->get('/api/vendors/public', function (Request $req, Response $res) use ($json) {
    try {
        $vendors = DB::table('vendor_listings as vl')
            ->join('credential as c', 'vl.user_id', '=', 'c.id')
            ->where('vl.status', 'Active')
            ->select(
                'vl.id',
                'c.id as UserID',
                'vl.business_name as BusinessName',
                'vl.service_category as Category',
                'vl.description as Description',
                'vl.description as bio',
                'vl.logo as avatar',
                'vl.logo as business_logo_url',
                'vl.hero_image as HeroImageUrl',
                'vl.gallery',
                'vl.address as BusinessAddress',
                'vl.region',
                'vl.city',
                DB::raw('0 as verification_score'),
                'vl.pricing as Pricing',
                'c.firebase_uid',
                'c.firebase_uid as user_firebase_uid',
                'c.first_name',
                'c.last_name',
                'c.email',
                'c.username',
                'c.avatar as user_avatar',
                'c.role',
                'vl.created_at'
            )
            ->orderByDesc('vl.created_at')
            ->get()
            ->map(function ($v) {
                $v->source = 'vendor_listings';
                $v->unique_key = 'user_' . $v->UserID . '_vl_' . $v->id;

                // Parse gallery
                if (isset($v->gallery)) {
                    $v->gallery = is_string($v->gallery)
                        ? json_decode($v->gallery, true) ?: []
                        : $v->gallery;
                }

                // Fallback avatar
                if (empty($v->avatar)) {
                    $v->avatar = $v->user_avatar;
                }

                // Fallback business name
                if (empty($v->BusinessName)) {
                    $v->BusinessName = trim(($v->first_name ?? '') . ' ' . ($v->last_name ?? ''))
                        ?: ($v->username ?? 'Vendor');
                }

                return $v;
            });

        return $json($res, [
            'success' => true,
            'vendors' => $vendors
        ]);

    } catch (\Throwable $e) {
        error_log('GET_VENDORS_ERROR: ' . $e->getMessage());
        return $json($res, [
            'success' => false,
            'error' => $e->getMessage()
        ], 500);
    }
});

    /* ===========================================================
     * GET PUBLIC VENDOR DETAILS
     * =========================================================== */
    $app->get('/api/vendor/public/{userId}', function (Request $req, Response $res, array $args) use ($json) {
        $controller = new VendorController();
        return $controller->getPublicVendorData($req, $res, $args);
    });

    /* ===========================================================
     * GET PUBLIC VENDOR BOOKINGS (for profile calendar - no auth)
     * =========================================================== */
    $app->get('/api/vendor/{userId}/bookings', function (Request $req, Response $res, array $args) use ($json) {
        try {
            $controller = new VendorController();
            return $controller->getPublicVendorBookings($req, $res, $args);
        } catch (\Throwable $e) {
            error_log('VENDOR_BOOKINGS_ERROR: ' . $e->getMessage());
            return $json($res, ['success' => false, 'error' => 'Failed to fetch bookings'], 500);
        }
    });

    /* ===========================================================
     * GET UPLOAD SIGNATURE (AUTHENTICATED)
     * =========================================================== */
    $app->post('/api/vendor/get-upload-signature', function (Request $req, Response $res) use ($json) {
        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $cloudName = envx('CLOUDINARY_CLOUD');
        $apiKey = envx('CLOUDINARY_KEY');
        $apiSecret = envx('CLOUDINARY_SECRET');

        if (!$cloudName || !$apiKey || !$apiSecret) {
            return $json($res, ['success' => false, 'error' => 'Cloudinary config missing'], 500);
        }

        $data = (array)$req->getParsedBody();
        $fileType = $data['file_type'] ?? 'document';
        $isRaw = in_array($fileType, ['permits', 'gov_id', 'portfolio'], true);
        $uploadType = $isRaw ? 'raw' : 'image';

        $timestamp = time();
        $folder = "solennia/vendor/{$auth->mysql_id}";
        $publicId = "{$fileType}_{$timestamp}_" . bin2hex(random_bytes(4));

        $params = [
            'folder' => $folder,
            'public_id' => $publicId,
            'timestamp' => $timestamp
        ];

        ksort($params);
        $signature = sha1(implode('&', array_map(fn($k, $v) => "$k=$v", array_keys($params), $params)) . $apiSecret);

        return $json($res, [
            'success' => true,
            'upload_url' => "https://api.cloudinary.com/v1_1/{$cloudName}/{$uploadType}/upload",
            'params' => array_merge($params, [
                'api_key' => $apiKey,
                'signature' => $signature
            ])
        ]);
    })->add(new AuthMiddleware());

    /* ===========================================================
     * ENHANCED: VENDOR APPLICATION SUBMISSION
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
                    'error' => 'Only clients (role 0) can apply.'
                ], 403);
            }

            $data = (array) $req->getParsedBody();

            // ENHANCED: Required fields now include region and city
            $validCategories = ['Supplier', 'Venue'];
            if (!in_array($data['category'], $validCategories)) {
                return $json($res, [
                    'success' => false,
                    'error' => 'Invalid category. Must be "Supplier" or "Venue".'
                ], 400);
            }

            $required = [
                'business_name',
                'category',
                'address',
                'description',
                'pricing',
                'permits_url',
                'gov_id_url',
                'portfolio_url',
                'region',  // NEW
                'city'     // NEW
            ];

            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $json($res, [
                        'success' => false,
                        'error' => "Missing field: {$field}"
                    ], 422);
                }
            }

            // Validate Cloudinary URLs
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
                    'error' => 'You already have a pending or approved application.'
                ], 400);
            }

            // ENHANCED: Insert data with new fields
            $insertData = [
                'user_id' => $userId,
                'business_name' => $data['business_name'],
                'category' => $data['category'],
                'address' => $data['address'],
                'permits' => $data['permits_url'],
                'gov_id' => $data['gov_id_url'],
                'portfolio' => $data['portfolio_url'],
                'contact_email' => $data['contact_email']
                    ?? DB::table('credential')->where('id', $userId)->value('email'),
                'description' => $data['description'],
                'pricing' => $data['pricing'],
                'status' => 'Pending',
                'created_at' => date('Y-m-d H:i:s'),

                // NEW FIELDS
                'region' => $data['region'],
                'city' => $data['city'],
                'contact_number' => $data['contact_number'] ?? null,
                'selfie_with_id' => $data['selfie_with_id_url'] ?? null,
                'sample_photos' => $data['sample_photos'] ?? null,
                'past_event_photos' => $data['past_event_photos'] ?? null,
            ];

            // Social links
            if (!empty($data['facebook_page']) || !empty($data['instagram_page'])) {
                $socialLinks = [
                    'facebook' => $data['facebook_page'] ?? '',
                    'instagram' => $data['instagram_page'] ?? ''
                ];
                $insertData['social_links'] = json_encode($socialLinks);
            }

            // Venue-specific
            if (strtolower(trim($data['category'])) === 'venue') {
                $insertData['venue_subcategory'] = $data['venue_subcategory'] ?? null;
                $insertData['venue_capacity'] = $data['venue_capacity'] ?? null;
                $insertData['venue_amenities'] = $data['venue_amenities'] ?? null;
                $insertData['venue_operating_hours'] = $data['venue_operating_hours'] ?? null;
                $insertData['venue_parking'] = $data['venue_parking'] ?? null;
            }

            // Catering-specific
            if (stripos($data['category'], 'Catering') !== false) {
                $insertData['menu_list'] = $data['menu_list_url'] ?? null;
            }

            $appId = DB::table('vendor_application')->insertGetId($insertData);

            error_log("VENDOR_APPLICATION_SUCCESS: AppID={$appId}, UserID={$userId}, Region={$data['region']}, City={$data['city']}");

            // Send notifications
            $sendToAdmins(
                'application_submitted',
                'New Vendor Application',
                "{$data['business_name']} has submitted a vendor application for {$data['city']}, {$data['region']}"
            );

            $sendNotification(
                $userId,
                'application_received',
                'Application Received',
                'Your vendor application has been received and is under review.'
            );

            return $json($res, [
                'success' => true,
                'message' => 'Vendor application submitted successfully!',
                'application_id' => $appId,
                'region' => $data['region'],
                'city' => $data['city']
            ], 201);

        } catch (\Throwable $e) {
            error_log('VENDOR_APPLY_ERROR: ' . $e->getMessage());
            return $json($res, [
                'success' => false,
                'error' => 'Server error: ' . $e->getMessage()
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

    $app->get('/api/vendor/dashboard', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->getDashboard($req, $res);
    })->add(new AuthMiddleware());

    /* ===========================================================
     * CREATE/UPDATE VENDOR PROFILE
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

    // Profile Analytics Endpoint
    $app->get('/api/vendor/analytics', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->getProfileAnalytics($req, $res);
    })->add(new AuthMiddleware());

    /* ===========================================================
     * VENDOR LISTINGS ROUTES (Multiple Listings Support)
     * =========================================================== */

    $app->get('/api/vendor/my-listings', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->getMyVendorListings($req, $res);
    })->add(new AuthMiddleware());

    $app->post('/api/vendor/listings', function (Request $req, Response $res) {
        $controller = new VendorController();
        return $controller->createVendorListing($req, $res);
    })->add(new AuthMiddleware());

    $app->put('/api/vendor/listings/{id}', function (Request $req, Response $res, array $args) {
        $controller = new VendorController();
        return $controller->updateVendorListing($req, $res, $args);
    })->add(new AuthMiddleware());

    $app->delete('/api/vendor/listings/{id}', function (Request $req, Response $res, array $args) {
        $controller = new VendorController();
        return $controller->deleteVendorListing($req, $res, $args);
    })->add(new AuthMiddleware());
};