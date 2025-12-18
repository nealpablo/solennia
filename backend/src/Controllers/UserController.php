<?php
namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\CloudinaryService;

class UserController
{
    /* ============================================================
       ✅ Return all users (from credential table)
    ============================================================ */
    public function index(Request $request, Response $response)
    {
        $users = DB::table('credential')->get();

        $response->getBody()->write(json_encode($users, JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type','application/json');
    }

    /* ============================================================
       ✅ Return single user
    ============================================================ */
    public function show(Request $request, Response $response, $args)
    {
        $user = DB::table('credential')->where('id', $args['id'])->first();

        if (!$user) {
            $response->getBody()->write(json_encode(['message'=>'User not found']));
            return $response->withStatus(404)->withHeader('Content-Type','application/json');
        }

        $response->getBody()->write(json_encode($user, JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type','application/json');
    }

    /* ============================================================
       ⚠️ Create new user (Admins only)
       * Left here to preserve original CRUD structure
       * BUT Solennia normally uses AuthController for creation.
    ============================================================ */
    public function store(Request $request, Response $response)
    {
        $data = (array)$request->getParsedBody();

        $id = DB::table('credential')->insertGetId($data);

        $created = DB::table('credential')->where('id', $id)->first();
        $response->getBody()->write(json_encode($created));

        return $response->withStatus(201)->withHeader('Content-Type','application/json');
    }

    /* ============================================================
       ✅ Update user fields (Admin panel)
    ============================================================ */
    public function update(Request $request, Response $response, $args)
    {
        $user = DB::table('credential')->where('id', $args['id'])->first();

        if (!$user) {
            $response->getBody()->write(json_encode(['message'=>'User not found']));
            return $response->withStatus(404)->withHeader('Content-Type','application/json');
        }

        $data = (array)$request->getParsedBody();
        unset($data['id']);

        DB::table('credential')->where('id', $args['id'])->update($data);

        $updated = DB::table('credential')->where('id', $args['id'])->first();
        $response->getBody()->write(json_encode($updated));

        return $response->withHeader('Content-Type','application/json');
    }

    /* ============================================================
       ❌ Delete user (Admin panel)
    ============================================================ */
    public function destroy(Request $request, Response $response, $args)
    {
        $user = DB::table('credential')->where('id', $args['id'])->first();

        if (!$user) {
            $response->getBody()->write(json_encode(['message'=>'User not found']));
            return $response->withStatus(404)->withHeader('Content-Type','application/json');
        }

        DB::table('credential')->where('id', $args['id'])->delete();

        $response->getBody()->write(json_encode(['message'=>'User deleted']));
        return $response->withHeader('Content-Type','application/json');
    }

    /* ============================================================
       ⭐ NEW: UPDATE AVATAR (Cloudinary)
       Works for:
       🟢 Profile.html
       🟢 Header.html
       🟢 Vendor dashboard (user avatar)
       🔥 THIS DOES NOT MODIFY vendor logos (separate)
    ============================================================ */
    public function updateAvatar(Request $request, Response $response)
    {
        try {
            $auth = $request->getAttribute('user');

            if (!$auth || !isset($auth->sub)) {
                $response->getBody()->write(json_encode(['error'=>'Unauthorized']));
                return $response->withStatus(401)->withHeader('Content-Type','application/json');
            }

            $userId = (int)$auth->sub;

            $files = $request->getUploadedFiles();

            if (!isset($files['avatar']) || $files['avatar']->getError() !== UPLOAD_ERR_OK) {
                return $response->withStatus(400)
                    ->withHeader('Content-Type','application/json')
                    ->write(json_encode(['error'=>'Invalid avatar upload']));
            }

            // Upload to Cloudinary
            $cloud = new CloudinaryService();
            $url   = $cloud->uploadAvatar($files['avatar']);

            // Save new avatar
            DB::table('credential')
                ->where('id', $userId)
                ->update(['avatar' => $url]);

            return $response->withHeader('Content-Type','application/json')
                ->write(json_encode([
                    'success' => true,
                    'avatar'  => $url
                ]));

        } catch (\Throwable $e) {
            error_log("USER_AVATAR_ERROR:" . $e->getMessage());
            return $response->withStatus(500)
                ->withHeader('Content-Type','application/json')
                ->write(json_encode(['error'=>'Server error uploading avatar']));
        }
    }
}
