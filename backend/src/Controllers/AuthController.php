<?php
namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Src\CloudinaryService;

class AuthController
{
    private string $secret;

    public function __construct()
    {
        $this->secret = $_ENV['JWT_SECRET'] ?? 'solennia_super_secret_key_2025';
    }

    /* =========================================================
       ✅ REGISTER (FIREBASE → MYSQL MIRROR)
       MySQL no longer stores password. Firebase handles login.
    ========================================================= */
    public function register(Request $request, Response $response): Response
    {
        try {
            $data = (array)$request->getParsedBody();

            $first    = trim($data['first_name'] ?? '');
            $last     = trim($data['last_name'] ?? '');
            $email    = strtolower(trim($data['email'] ?? ''));
            $username = strtolower(trim($data['username'] ?? ''));
            $firebase = trim($data['firebase_uid'] ?? '');

            if (!$first || !$last || !$email || !$username || !$firebase) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'All fields including firebase_uid are required.'
                ], 400);
            }

            if (DB::table('credential')->where('email', $email)->exists()) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Email already registered.'
                ], 409);
            }

            if (DB::table('credential')->where('username', $username)->exists()) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Username already taken.'
                ], 409);
            }

            DB::table('credential')->insert([
                'first_name'   => $first,
                'last_name'    => $last,
                'email'        => $email,
                'username'     => $username,
                'firebase_uid' => $firebase,
                'role'         => 0,
                'avatar'       => null,
                'is_verified'  => 1 // Firebase already verifies email
            ]);

            return $this->json($response, [
                'success' => true,
                'message' => 'User mirrored in database.'
            ]);

        } catch (\Throwable $e) {
            error_log('REGISTER_ERROR: ' . $e->getMessage());
            return $this->json($response, [
                'success' => false,
                'message' => 'Server error during registration.'
            ], 500);
        }
    }

    /* =========================================================
       ✅ LOGIN (FIREBASE UID → MYSQL LOOKUP)
       No password verification ever happens in backend.
    ========================================================= */
    public function login(Request $request, Response $response): Response
    {
        try {
            $data = (array)$request->getParsedBody();

            $firebaseUid = trim($data['firebase_uid'] ?? '');
            $email       = strtolower(trim($data['email'] ?? ''));

            if (!$firebaseUid || !$email) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'firebase_uid and email are required.'
                ], 400);
            }

            // Find MySQL user by firebase_uid or email
            $user = DB::table('credential')
                ->where('firebase_uid', $firebaseUid)
                ->orWhere('email', $email)
                ->first();

            if (!$user) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Account not found. Register first.'
                ], 404);
            }

            // If firebase_uid was not stored before, update now
            if (!$user->firebase_uid) {
                DB::table('credential')
                    ->where('id', $user->id)
                    ->update(['firebase_uid' => $firebaseUid]);
            }

            $role = (int)($user->role ?? 0);

            // Create JWT using firebase_uid as identity
            $token = $this->makeToken($firebaseUid, $user->id, $role);

            return $this->json($response, [
                'success' => true,
                'message' => 'Login successful.',
                'token'   => $token,
                'role'    => $role,
                'user'    => $user
            ]);

        } catch (\Throwable $e) {
            error_log('LOGIN_ERROR: ' . $e->getMessage());
            return $this->json($response, [
                'success' => false,
                'message' => 'Server error during login.'
            ], 500);
        }
    }

    /* =========================================================
       ✅ GET CURRENT USER (JWT → firebase_uid → MySQL)
    ========================================================= */
    public function me(Request $request, Response $response): Response
    {
        $jwt = $request->getAttribute('user');

        if (!$jwt || !isset($jwt->sub)) {
            return $this->json($response, [
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }

        // sub contains firebase_uid now
        $firebaseUid = $jwt->sub;

        $row = DB::table('credential')
            ->where('firebase_uid', $firebaseUid)
            ->first();

        if ($row && !empty($row->avatar) && !str_starts_with($row->avatar, 'http')) {
            $uri = $request->getUri();
            $base = $uri->getScheme() . '://' . $uri->getHost();
            if ($uri->getPort()) {
                $base .= ':' . $uri->getPort();
            }
            $row->avatar = $base . $row->avatar;
        }

        return $this->json($response, [
            'success' => true,
            'user'    => $row
        ]);
    }

    /* =========================================================
       ✅ UPDATE AVATAR (Cloudinary)
    ========================================================= */
    public function updateAvatar(Request $request, Response $response): Response
    {
        try {
            $jwt = $request->getAttribute('user');
            if (!$jwt || !isset($jwt->sub)) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            $firebaseUid = $jwt->sub;

            $files = $request->getUploadedFiles();
            if (!isset($files['avatar']) || $files['avatar']->getError() !== UPLOAD_ERR_OK) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Invalid upload.'
                ], 400);
            }

            $uploader = new CloudinaryService();
            $url = $uploader->uploadAvatar($files['avatar']);

            DB::table('credential')
                ->where('firebase_uid', $firebaseUid)
                ->update(['avatar' => $url]);

            return $this->json($response, [
                'success' => true,
                'avatar'  => $url
            ]);

        } catch (\Throwable $e) {
            error_log("AVATAR_UPLOAD_ERROR: " . $e->getMessage());
            return $this->json($response, [
                'success' => false,
                'message' => 'Server error uploading avatar.'
            ], 500);
        }
    }

    /* ======================= HELPERS ======================= */

    private function makeToken(string $firebaseUid, int $mysqlId, int $role = 0): string
    {
        $payload = [
            'sub'      => $firebaseUid, // 🔥 identity = Firebase UID
            'mysql_id' => $mysqlId,     // still available
            'role'     => $role,
            'iat'      => time(),
            'exp'      => time() + (60 * 60 * 24 * 7), // 7 days
        ];
        return JWT::encode($payload, $this->secret, 'HS256');
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')
                        ->withStatus($status);
    }
}
