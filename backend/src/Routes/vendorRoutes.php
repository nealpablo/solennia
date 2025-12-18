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
     *  Helper JSON Response (Slim 4 compatible)
     * =========================================================== */
    $json = function (Response $res, array $payload, int $status = 200) {
        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    };

    /* ===========================================================
     *  APPLY AS VENDOR
     * =========================================================== */
    $app->post('/api/vendor/apply', function (Request $req, Response $res) use ($json, $cloudinary) {

        try {
            $auth = $req->getAttribute('user');
            if (!$auth || !isset($auth->mysql_id)) {
                return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            // ✅ FIX: ALWAYS USE mysql_id
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
     *  CHECK VENDOR STATUS
     * =========================================================== */
    $app->get('/api/vendor/status', function (Request $req, Response $res) use ($json) {

        $auth = $req->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $row = DB::table('vendor_application')
            ->where('user_id', $auth->mysql_id)
            ->orderByDesc('id')
            ->first();

        return $json($res, [
            'success' => true,
            'status'  => strtolower($row->status ?? 'none')
        ]);

    })->add(new AuthMiddleware());

    /* ===========================================================
     *  PUBLIC VENDOR LIST
     * =========================================================== */
    $app->get('/api/vendors/public', function (Request $req, Response $res) use ($json) {

        try {
            $vendors = DB::table('eventserviceprovider as esp')
                ->join('credential as c', 'esp.UserID', '=', 'c.id')
                ->select(
                    'esp.ID as id',
                    'esp.UserID as user_id',
                    'esp.BusinessName as business_name',
                    'esp.Category as category',
                    'esp.Description as description',
                    'esp.Pricing as pricing',
                    'esp.HeroImageUrl as hero_image_url',
                    'esp.BusinessAddress as address',
                    'esp.avatar as vendor_logo',
                    'c.avatar as user_avatar',
                    'esp.bio',
                    'esp.services',
                    'esp.service_areas',
                    'esp.gallery',
                    'c.first_name',
                    'c.last_name',
                    'c.firebase_uid',
                    'esp.ApplicationStatus'
                )
                ->where('esp.ApplicationStatus', 'Approved')
                ->get();

            return $json($res, ['success' => true, 'vendors' => $vendors]);

        } catch (\Throwable $e) {
            error_log('PUBLIC_VENDOR_ERROR: ' . $e->getMessage());
            return $json($res, ['success' => false, 'error' => 'Failed loading vendors'], 500);
        }

    });

    /* ===========================================================
     *  PUBLIC SINGLE VENDOR PROFILE
     * =========================================================== */
    $app->get('/api/vendor/public/{id}', function (Request $req, Response $res, array $args) use ($json) {

        try {
            $id = (int) $args['id'];

            $vendor = DB::table('eventserviceprovider as esp')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->select(
                    'esp.UserID as user_id',
                    'esp.BusinessName as business_name',
                    'esp.Category as category',
                    'esp.BusinessAddress as address',
                    'esp.Description as description',
                    'esp.Pricing as pricing',
                    'esp.HeroImageUrl as hero_image_url',
                    'esp.avatar as vendor_logo',
                    'esp.bio',
                    'esp.services',
                    'esp.service_areas',
                    'esp.gallery',
                    'c.first_name',
                    'c.last_name',
                    'c.username',
                    'c.firebase_uid'
                )
                ->where('esp.UserID', $id)
                ->where('esp.ApplicationStatus', 'Approved')
                ->first();

            if (!$vendor) {
                return $json($res, ['success' => false, 'error' => 'Vendor not found'], 404);
            }

            $vendor->gallery = json_decode($vendor->gallery ?? '[]', true);

            return $json($res, ['success' => true, 'vendor' => $vendor]);

        } catch (\Throwable $e) {
            error_log('PUBLIC_VENDOR_FETCH_ERROR: ' . $e->getMessage());
            return $json($res, ['success' => false, 'error' => 'Server error fetching vendor'], 500);
        }

    });

    /* ===========================================================
     *  VENDOR DASHBOARD FETCH
     * =========================================================== */
    $app->get('/api/vendor/dashboard', function (Request $req, Response $res) use ($json) {

        $auth = $req->getAttribute('user');
        if (!$auth) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $vendor = DB::table('eventserviceprovider')
            ->where('UserID', $auth->sub)
            ->first();

        if (!$vendor) {
            return $json($res, ['success' => false, 'error' => 'Not an approved vendor'], 403);
        }

        return $json($res, [
            'success' => true,
            'vendor'  => [
                'business_name' => $vendor->BusinessName,
                'address'       => $vendor->BusinessAddress,
                'bio'           => $vendor->bio,
                'avatar'        => $vendor->avatar,
                'hero_image'    => $vendor->HeroImageUrl,
                'services'      => $vendor->services,
                'service_areas' => $vendor->service_areas,
                'description'   => $vendor->Description,
                'pricing'       => $vendor->Pricing,
                'gallery'       => json_decode($vendor->gallery ?? '[]', true)
            ]
        ]);

    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPDATE VENDOR TEXT FIELDS
     * =========================================================== */
    $app->post('/api/vendor/update', function (Request $req, Response $res) use ($json) {

        $auth = $req->getAttribute('user');
        if (!$auth) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $data = (array) $req->getParsedBody();

        DB::table('eventserviceprovider')
            ->where('UserID', $auth->sub)
            ->update([
                'bio'           => $data['bio'] ?? null,
                'services'      => $data['services'] ?? null,
                'service_areas' => $data['service_areas'] ?? null,
                'Description'   => $data['description'] ?? null,
                'Pricing'       => $data['pricing'] ?? null,
                'BusinessName'  => $data['business_name'] ?? null
            ]);

        return $json($res, ['success' => true, 'message' => 'Vendor profile updated']);

    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPLOAD HERO IMAGE
     * =========================================================== */
    $app->post('/api/vendor/upload-hero', function (Request $req, Response $res) use ($json, $cloudinary) {

        $auth = $req->getAttribute('user');
        if (!$auth) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $file = $req->getUploadedFiles()['hero'] ?? null;
        if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
            return $json($res, ['success' => false, 'error' => 'Invalid hero image'], 422);
        }

        $tmp = $file->getStream()->getMetadata('uri');

        $upload = $cloudinary->uploadApi()->upload($tmp, [
            'folder'        => 'solennia/vendors/hero',
            'resource_type' => 'image',
            'public_id'     => "hero_{$auth->sub}_" . time()
        ]);

        DB::table('eventserviceprovider')
            ->where('UserID', $auth->sub)
            ->update(['HeroImageUrl' => $upload['secure_url']]);

        return $json($res, ['success' => true, 'url' => $upload['secure_url']]);

    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPLOAD GALLERY IMAGES
     * =========================================================== */
    $app->post('/api/vendor/upload-gallery', function (Request $req, Response $res) use ($json, $cloudinary) {

        $auth = $req->getAttribute('user');
        if (!$auth) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $files = $req->getUploadedFiles()['images'] ?? [];
        $urls  = [];

        foreach ($files as $file) {
            if ($file->getError() !== UPLOAD_ERR_OK) continue;

            $tmp = $file->getStream()->getMetadata('uri');

            $upload = $cloudinary->uploadApi()->upload($tmp, [
                'folder'        => "solennia/vendors/gallery/{$auth->sub}",
                'resource_type' => 'image',
                'public_id'     => 'gallery_' . time() . '_' . bin2hex(random_bytes(2))
            ]);

            $urls[] = $upload['secure_url'];
        }

        $existing = DB::table('eventserviceprovider')
            ->where('UserID', $auth->sub)
            ->value('gallery');

        $merged = array_merge(json_decode($existing ?? '[]', true), $urls);

        DB::table('eventserviceprovider')
            ->where('UserID', $auth->sub)
            ->update(['gallery' => json_encode($merged)]);

        return $json($res, ['success' => true, 'gallery' => $merged]);

    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPLOAD VENDOR LOGO
     * =========================================================== */
    $app->post('/api/vendor/upload-logo', function (Request $req, Response $res) use ($json, $cloudinary) {

        $auth = $req->getAttribute('user');
        if (!$auth) {
            return $json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $file = $req->getUploadedFiles()['logo'] ?? null;
        if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
            return $json($res, ['success' => false, 'error' => 'Invalid logo image'], 422);
        }

        $tmp = $file->getStream()->getMetadata('uri');

        $upload = $cloudinary->uploadApi()->upload($tmp, [
            'folder'        => "solennia/vendors/logo/{$auth->sub}",
            'resource_type' => 'image',
            'public_id'     => 'logo_' . time()
        ]);

        DB::table('eventserviceprovider')
            ->where('UserID', $auth->sub)
            ->update(['avatar' => $upload['secure_url']]);

        return $json($res, ['success' => true, 'url' => $upload['secure_url']]);

    })->add(new AuthMiddleware());

};
