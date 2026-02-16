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
     *  GET ALL USERS (ADMIN PANEL)
     * =========================================================== */
    $app->get('/api/users', function (Request $req, Response $res) {

        $users = DB::table('credential')
            ->select('id','first_name','last_name','email','username','role','avatar')
            ->orderBy('id','ASC')
            ->get();

        $res->getBody()->write(json_encode([
            'success' => true,
            'users'   => $users
        ], JSON_UNESCAPED_UNICODE));

        return $res->withHeader('Content-Type', 'application/json');
    });

    /* ===========================================================
     *  GET CURRENT LOGGED-IN USER
     * =========================================================== */
    $app->get('/api/user/me', function (Request $req, Response $res) {

        $auth = $req->getAttribute('user');

        if (!$auth) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type','application/json')->withStatus(401);
        }

        $userId = $auth->mysql_id ?? null;

        if (!$userId) {
            $res->getBody()->write(json_encode(['error' => 'Invalid user token']));
            return $res->withHeader('Content-Type','application/json')->withStatus(401);
        }

        $user = DB::table('credential')->where('id', $userId)->first();

        $res->getBody()->write(json_encode([
            'success' => true,
            'user'    => $user
        ]));

        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPDATE USER PROFILE + CLOUDINARY AVATAR
     * =========================================================== */
    $app->post('/api/user/update', function (Request $req, Response $res) use ($cloudinary) {

        if (!$cloudinary) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Cloudinary is not configured'
            ]));
            return $res->withHeader('Content-Type','application/json')->withStatus(500);
        }

        $auth = $req->getAttribute('user');

        if (!$auth || !isset($auth->mysql_id)) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type','application/json')->withStatus(401);
        }

        $userId = $auth->mysql_id;
        $data   = $req->getParsedBody();
        $files  = $req->getUploadedFiles();

        if (!empty($data)) {
            DB::table('credential')->where('id', $userId)->update([
                'first_name' => $data['first_name'] ?? DB::raw('first_name'),
                'last_name'  => $data['last_name']  ?? DB::raw('last_name'),
                'email'      => $data['email']      ?? DB::raw('email'),
                'username'   => $data['username']   ?? DB::raw('username')
            ]);
        }

        $avatarUrl = null;

        if (isset($files['avatar']) && $files['avatar']->getError() === UPLOAD_ERR_OK) {
            try {
                $tmp = $files['avatar']->getStream()->getMetadata('uri');

                $upload = $cloudinary->uploadApi()->upload($tmp, [
                    'folder' => "solennia/user_avatars/{$userId}",
                    'resource_type' => 'image',
                    'public_id' => 'avatar_' . time(),
                    'transformation' => [
                        ['width' => 400, 'height' => 400, 'crop' => 'fill']
                    ]
                ]);

                $avatarUrl = $upload['secure_url'];

                DB::table('credential')
                    ->where('id', $userId)
                    ->update(['avatar' => $avatarUrl]);

            } catch (\Throwable $e) {
                error_log("Avatar upload error: " . $e->getMessage());
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Avatar upload failed'
                ]));
                return $res->withHeader('Content-Type','application/json')->withStatus(500);
            }
        }

        $updatedUser = DB::table('credential')->where('id', $userId)->first();

        $res->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'avatar'  => $avatarUrl ?: ($updatedUser->avatar ?? null),
            'user'    => $updatedUser
        ]));

        return $res->withHeader('Content-Type','application/json');
    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPDATE USERNAME
     * =========================================================== */
    $app->post('/api/user/update-username', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');

        if (!$jwt || !isset($jwt->mysql_id)) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $userId = (int)$jwt->mysql_id;
        $data = (array)$req->getParsedBody();
        $username = trim($data['username'] ?? '');

        if (!$username) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'message' => 'Username is required'
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $existing = DB::table('credential')
            ->where('username', $username)
            ->where('id', '!=', $userId)
            ->first();

        if ($existing) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'message' => 'Username is already taken'
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(409);
        }

        DB::table('credential')
            ->where('id', $userId)
            ->update(['username' => $username]);

        $res->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Username updated successfully',
            'username' => $username
        ]));

        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    /* ===========================================================
     *  UPDATE PHONE NUMBER
     * =========================================================== */
    $app->post('/api/user/update-phone', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');

        if (!$jwt || !isset($jwt->mysql_id)) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $userId = (int)$jwt->mysql_id;
        $data = (array)$req->getParsedBody();
        $phone = trim($data['phone'] ?? '');

        if ($phone && !preg_match('/^\+?[0-9]{10,15}$/', $phone)) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'message' => 'Invalid phone number format'
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        DB::table('credential')
            ->where('id', $userId)
            ->update(['phone' => $phone]);

        $res->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Phone number updated successfully',
            'phone' => $phone
        ]));

        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

};