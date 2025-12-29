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
            'cloud_name' => getenv('CLOUDINARY_CLOUD'),
            'api_key'    => getenv('CLOUDINARY_KEY'),
            'api_secret' => getenv('CLOUDINARY_SECRET')
        ]
    ]);

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

        // ✅ FIX: Use mysql_id instead of sub (Firebase UID)
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
     *  UPDATE USER PROFILE + CLOUDINARY AVATAR (✅ FIXED)
     * =========================================================== */
    $app->post('/api/user/update', function (Request $req, Response $res) use ($cloudinary) {

        $auth = $req->getAttribute('user');

        if (!$auth) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type','application/json')->withStatus(401);
        }

        // ✅ CRITICAL FIX: Use mysql_id (integer) instead of sub (Firebase UID string)
        $userId = $auth->mysql_id ?? null;
        
        if (!$userId) {
            $res->getBody()->write(json_encode(['error' => 'Invalid user token - missing mysql_id']));
            return $res->withHeader('Content-Type','application/json')->withStatus(401);
        }

        $data   = $req->getParsedBody();
        $files  = $req->getUploadedFiles();

        /* Update fields if provided */
        if (!empty($data)) {
            DB::table('credential')->where('id', $userId)->update([
                'first_name' => $data['first_name'] ?? DB::raw('first_name'),
                'last_name'  => $data['last_name']  ?? DB::raw('last_name'),
                'email'      => $data['email']      ?? DB::raw('email'),
                'username'   => $data['username']   ?? DB::raw('username')
            ]);
        }

        /* ✅ FIX: Avatar Upload - Store URL and return it */
        $avatarUrl = null;
        if (isset($files['avatar']) && $files['avatar']->getError() === UPLOAD_ERR_OK) {

            try {
                $tmp = $files['avatar']->getStream()->getMetadata('uri');

                $upload = $cloudinary->uploadApi()->upload($tmp, [
                    "folder"        => "solennia/user_avatars/{$userId}",
                    "resource_type" => "image",
                    "public_id"     => "avatar_" . time(),
                    "transformation" => [
                        ["width" => 400, "height" => 400, "crop" => "fill"]
                    ]
                ]);

                $avatarUrl = $upload['secure_url'];
                
                // ✅ UPDATE USING MYSQL ID
                $updated = DB::table('credential')
                    ->where('id', $userId)
                    ->update(['avatar' => $avatarUrl]);
                
                // Log for debugging
                error_log("Avatar update - UserID: {$userId}, URL: {$avatarUrl}, Rows affected: {$updated}");

            } catch (\Throwable $e) {
                error_log("Avatar upload error: " . $e->getMessage());
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Avatar upload failed: ' . $e->getMessage()
                ]));
                return $res->withHeader('Content-Type','application/json')->withStatus(500);
            }
        }

        /* ✅ FIX: Get updated user data and return avatar URL */
        $updatedUser = DB::table('credential')
            ->where('id', $userId)
            ->first();

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

        // Check if username is already taken by another user
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

        // Update username
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

        // Phone can be empty (user removing their phone number)
        // But if provided, do basic validation
        if ($phone && !preg_match('/^\+?[0-9]{10,15}$/', $phone)) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'message' => 'Invalid phone number format'
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        // Update phone
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