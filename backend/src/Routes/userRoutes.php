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

        $user = DB::table('credential')->where('id', $auth->sub)->first();

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

        $auth = $req->getAttribute('user');

        if (!$auth) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type','application/json')->withStatus(401);
        }

        $userId = $auth->sub;
        $data   = $req->getParsedBody();
        $files  = $req->getUploadedFiles();

        /* Update fields if provided */
        DB::table('credential')->where('id', $userId)->update([
            'first_name' => $data['first_name'] ?? DB::raw('first_name'),
            'last_name'  => $data['last_name']  ?? DB::raw('last_name'),
            'email'      => $data['email']      ?? DB::raw('email'),
            'username'   => $data['username']   ?? DB::raw('username')
        ]);

        /* Avatar Upload */
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

                DB::table('credential')
                    ->where('id', $userId)
                    ->update(['avatar' => $upload['secure_url']]);

            } catch (\Throwable $e) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Avatar upload failed: ' . $e->getMessage()
                ]));
                return $res->withHeader('Content-Type','application/json')->withStatus(500);
            }
        }

        $res->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Profile updated successfully.'
        ]));

        return $res->withHeader('Content-Type','application/json');
    })->add(new AuthMiddleware());

};
