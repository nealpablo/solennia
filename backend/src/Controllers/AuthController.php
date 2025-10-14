<?php
namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthController
{
    private string $secret;

    public function __construct()
    {
        $this->secret = $_ENV['JWT_SECRET'] ?? 'solennia_super_secret_key_2025';
    }

    /**
     * POST /api/auth/register
     * Body: { first_name, last_name, email, username?, password }
     * - If username provided, validate; otherwise generate from email local-part.
     * - New users default to role 0 (client).
     */
    public function register(Request $request, Response $response): Response
    {
        try {
            $data = (array)$request->getParsedBody();

            $first    = trim((string)($data['first_name'] ?? ''));
            $last     = trim((string)($data['last_name'] ?? ''));
            $email    = strtolower(trim((string)($data['email'] ?? '')));
            $password = (string)($data['password'] ?? '');
            $rawUser  = trim((string)($data['username'] ?? ''));

            if ($first === '' || $last === '' || $email === '' || $password === '') {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'All fields are required.'
                ], 400);
            }

            if (DB::table('credential')->where('email', $email)->exists()) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Email already exists.'
                ], 400);
            }

            // Username: validate or generate from email local-part
            if ($rawUser !== '') {
                $sanitized = strtolower(preg_replace('/[^a-z0-9._-]/i', '', $rawUser));
                if ($sanitized === '' || strlen($sanitized) < 3 || strlen($sanitized) > 30) {
                    return $this->json($response, [
                        'success' => false,
                        'message' => 'Invalid username. Use 3–30 characters: letters, numbers, dot, underscore, or dash.'
                    ], 400);
                }
                $username = $sanitized;
            } else {
                $base = preg_replace('/[^a-z0-9_]+/i', '', explode('@', $email)[0]);
                $username = strtolower($base ?: 'user');
            }

            // Ensure username unique (auto-suffix if needed)
            $finalUsername = $username;
            $suffix = 1;
            while (DB::table('credential')->where('username', $finalUsername)->exists()) {
                $finalUsername = $username . $suffix;
                $suffix++;
            }

            $hashed = password_hash($password, PASSWORD_BCRYPT);

            // Default role = 0 (client)
            $role = 0;

            $id = DB::table('credential')->insertGetId([
                'first_name' => $first,
                'last_name'  => $last,
                'email'      => $email,
                'username'   => $finalUsername,
                'password'   => $hashed,
                'role'       => $role,
            ]);

            $token = $this->makeToken($id, $finalUsername, $role);

            return $this->json($response, [
                'success'  => true,
                'message'  => 'Registration successful.',
                'username' => $finalUsername,
                'token'    => $token,
                'role'     => $role,
            ]);
        } catch (\Throwable $e) {
            error_log('REGISTER_ERROR: ' . $e->getMessage());
            return $this->json($response, [
                'success' => false,
                'message' => 'Server error during registration.'
            ], 500);
        }
    }

    /**
     * POST /api/auth/login
     * Accepts { username, password } OR { email, password }.
     */
    public function login(Request $request, Response $response): Response
    {
        try {
            $data = (array)$request->getParsedBody();

            $userOrEmail = trim((string)($data['username'] ?? $data['email'] ?? ''));
            $password    = (string)($data['password'] ?? '');

            if ($userOrEmail === '' || $password === '') {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Username (or email) and password are required.'
                ], 400);
            }

            // Lookup by email if it looks like an email, else username
            if (strpos($userOrEmail, '@') !== false) {
                $user = DB::table('credential')->where('email', strtolower($userOrEmail))->first();
            } else {
                $user = DB::table('credential')->where('username', $userOrEmail)->first();
            }

            if (!$user || !isset($user->password) || !password_verify($password, $user->password)) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Invalid credentials.'
                ], 401);
            }

            $role = (int)($user->role ?? 0);
            $token = $this->makeToken((int)$user->id, (string)$user->username, $role);

            return $this->json($response, [
                'success' => true,
                'message' => 'Login successful.',
                'token'   => $token,
                'role'    => $role,
            ]);
        } catch (\Throwable $e) {
            error_log('LOGIN_ERROR: ' . $e->getMessage());
            return $this->json($response, [
                'success' => false,
                'message' => 'Server error during login.'
            ], 500);
        }
    }

    /**
     * GET /api/auth/me
     * Returns current user profile (including role).
     */
    public function me(Request $request, Response $response): Response
    {
        try {
            $auth = $request->getHeaderLine('Authorization');
            if (!$auth || !str_starts_with($auth, 'Bearer ')) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Missing token'
                ], 401);
            }

            $token = trim(substr($auth, 7));
            $decoded = JWT::decode($token, new Key($this->secret, 'HS256'));
            $userId = (int)($decoded->sub ?? 0);

            if (!$userId) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'Invalid token'
                ], 401);
            }

            $user = DB::table('credential')
                ->select('id', 'first_name', 'last_name', 'username', 'email', 'role') // ✅ includes role
                ->where('id', $userId)
                ->first();

            if (!$user) {
                return $this->json($response, [
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            return $this->json($response, [
                'success' => true,
                'user' => $user
            ]);
        } catch (\Throwable $e) {
            error_log('ME_ERROR: ' . $e->getMessage());
            return $this->json($response, [
                'success' => false,
                'message' => 'Invalid or expired token'
            ], 401);
        }
    }

    // -------------------- helpers --------------------

    private function makeToken(int $userId, string $username, int $role = 0): string
    {
        $payload = [
            'sub'      => $userId,
            'username' => $username,
            'role'     => $role,             // ✅ embed role for quick checks client-side
            'iat'      => time(),
            'exp'      => time() + 60 * 60 * 24, // 24h
        ];
        return JWT::encode($payload, $this->secret, 'HS256');
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
    }
}
