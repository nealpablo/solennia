<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;
use Cloudinary\Cloudinary;

return function (App $app) {

    /* ===========================================================
     *  CLOUDINARY INSTANCE
     * =========================================================== */
    $cloudinary = new Cloudinary([
        'cloud' => [
            'cloud_name' => $_ENV['CLOUDINARY_CLOUD'],
            'api_key'    => $_ENV['CLOUDINARY_KEY'],
            'api_secret' => $_ENV['CLOUDINARY_SECRET']
        ]
    ]);

    /* ===========================================================
     *  Helper JSON Response
     * =========================================================== */
    $json = function (Response $res, array $payload, int $status = 200) {
        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    };

    /* ===========================================================
     *  GET ALL VENDORS (PUBLIC)
     * =========================================================== */
    $app->get('/api/vendors/public', function (Request $req, Response $res) use ($json) {
        try {
            $vendors = DB::table('eventserviceprovider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('esp.ApplicationStatus', 'Approved')
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
                    'address' => $vendor->address,
                    'description' => $vendor->description,
                    'bio' => $vendor->bio,
                    'pricing' => $vendor->pricing,
                    'hero_image_url' => $vendor->hero_image_url,
                    'vendor_logo' => $vendor->vendor_logo,
                    'services' => $vendor->services ? json_decode($vendor->services, true) : [],
                    'service_areas' => $vendor->service_areas ? json_decode($vendor->service_areas, true) : [],
                    'firebase_uid' => $vendor->firebase_uid,
                    'user_avatar' => $vendor->user_avatar,
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

    /* ===========================================================
     *  GET SINGLE VENDOR (PUBLIC)
     * =========================================================== */
    $app->get('/api/vendor/public/{userId}', function (Request $req, Response $res, array $args) use ($json) {
        try {
            $userId = (int) $args['userId'];

            $vendor = DB::table('eventserviceprovider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('esp.UserID', $userId)
                ->where('esp.ApplicationStatus', 'Approved')
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
                    'esp.gallery',
                    'c.firebase_uid',
                    'c.avatar as user_avatar'
                )
                ->first();

            if (!$vendor) {
                return $json($res, ['success' => false, 'error' => 'Vendor not found'], 404);
            }

            return $json($res, [
                'success' => true,
                'vendor' => [
                    'id' => $vendor->id,
                    'user_id' => $vendor->user_id,
                    'business_name' => $vendor->business_name,
                    'category' => $vendor->category,
                    'address' => $vendor->address,
                    'description' => $vendor->description,
                    'bio' => $vendor->bio,
                    'pricing' => $vendor->pricing,
                    'hero_image_url' => $vendor->hero_image_url,
                    'vendor_logo' => $vendor->vendor_logo,
                    'services' => $vendor->services ? json_decode($vendor->services, true) : [],
                    'service_areas' => $vendor->service_areas ? json_decode($vendor->service_areas, true) : [],
                    'gallery' => $vendor->gallery ? json_decode($vendor->gallery, true) : [],
                    'firebase_uid' => $vendor->firebase_uid,
                    'user_avatar' => $vendor->user_avatar,
                ]
            ]);

        } catch (\Throwable $e) {
            error_log('VENDOR_PUBLIC_ERROR: ' . $e->getMessage());
            return $json($res, ['success' => false, 'error' => 'Failed to load vendor'], 500);
        }
    });

    /* ===========================================================
     *  APPLY AS VENDOR
     * =========================================================== */
    $app->post('/api/vendor/apply', function (Request $req, Response $res) use ($json, $cloudinary) {

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
            foreach (['permits','gov_id','portfolio'] as $fileKey) {
                if (!isset($files[$fileKey]) || $files[$fileKey]->getError() !== UPLOAD_ERR_OK) {
                    return $json($res, [
                        'success' => false,
                        'error'   => "Invalid upload: {$fileKey}"
                    ], 422);
                }
            }

            $cloudUpload = function ($file, $tag) use ($cloudinary, $userId) {
                $tmp = $file->getStream()->getMetadata('uri');
                $upload = $cloudinary->uploadApi()->upload($tmp, [
                    'folder'        => "solennia/vendor/{$userId}",
                    'resource_type' => 'auto',
                    'public_id'     => "{$tag}_" . time()
                ]);
                return $upload['secure_url'];
            };

            $permitsURL   = $cloudUpload($files['permits'], 'permits');
            $govIdURL     = $cloudUpload($files['gov_id'], 'govid');
            $portfolioURL = $cloudUpload($files['portfolio'], 'portfolio');

            DB::table('vendor_application')->insert([
                'user_id'       => $userId,
                'business_name' => $data['business_name'],
                'category'      => $data['category'],
                'address'       => $data['address'],
                'permits'       => $permitsURL,
                'gov_id'        => $govIdURL,
                'portfolio'     => $portfolioURL,
                'contact_email'=> $data['contact_email']
                    ?? DB::table('credential')->where('id', $userId)->value('email'),
                'description'   => $data['description'],
                'pricing'       => $data['pricing'],
                'status'        => 'Pending',
                'created_at'    => date('Y-m-d H:i:s')
            ]);

            return $json($res, [
                'success' => true,
                'message' => 'Vendor application submitted!'
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
     *  CHECK VENDOR STATUS  ✅ FIXED FOR VENUE CATEGORY
     * =========================================================== */
    $app->get('/api/vendor/status', function (Request $req, Response $res) use ($json) {

        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $userId = (int) $auth->mysql_id;

        $application = DB::table('vendor_application')
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();

        $vendor = DB::table('eventserviceprovider')
            ->where('UserID', $userId)
            ->where('ApplicationStatus', 'Approved')
            ->first();

        return $json($res, [
            'success' => true,
            'status' => strtolower($application->status ?? 'none'),
            'vendor' => $vendor ? [
                'ServiceType' => $vendor->Category,
                'VerificationStatus' => 'approved'
            ] : null
        ]);

    })->add(new AuthMiddleware());

    /* ============================================================
     * ❌ REMOVED DUPLICATE VENUE LISTING ROUTE
     * Now handled in venueRoutes.php via VenueController
     * ========================================================== */

};