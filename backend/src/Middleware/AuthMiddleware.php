<?php
namespace Src\Middleware;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Server\MiddlewareInterface as Middleware;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthMiddleware implements Middleware
{
    private string $secret;

    public function __construct()
    {
        // MUST MATCH AuthController
        $this->secret = getenv('JWT_SECRET') ?: 'solennia_super_secret_key_2025';
    }

    public function process(Request $request, Handler $handler): Response
    {
        // Handle preflight OPTIONS request
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            $response = new \Slim\Psr7\Response(200);
            return $this->cors($response);
        }

        /**
         * =====================================================
         *  AUTH HEADER RESOLUTION (XAMPP / APACHE SAFE)
         * =====================================================
         */
        $auth = $request->getHeaderLine('Authorization');

        if (!$auth && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth = $_SERVER['HTTP_AUTHORIZATION'];
        }

        if (!$auth && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (isset($headers['Authorization'])) {
                $auth = $headers['Authorization'];
            }
        }

        if (!$auth) {
            error_log("AUTH_MW_DEBUG: Missing Authorization. SERVER_HEADERS=" . json_encode(array_intersect_key($_SERVER, array_flip(['HTTP_AUTHORIZATION','REDIRECT_HTTP_AUTHORIZATION','REMOTE_ADDR','REQUEST_URI']))));
            return $this->unauthorized("Missing Authorization header");
        }

        error_log("AUTH_MW_DEBUG: Authorization header received: " . $auth);

        if (!preg_match('/Bearer\s+(.*)$/i', $auth, $m)) {
            error_log("AUTH_MW_DEBUG: Invalid Authorization format. AuthorizationHeader=" . substr($auth,0,50));
            return $this->unauthorized("Invalid Authorization format");
        }

        $token = trim($m[1] ?? '');
        error_log("AUTH_MW_DEBUG: Token extracted: " . substr($token,0,50));
        if ($token === '') {
            error_log("AUTH_MW_DEBUG: Empty token extracted from Authorization header");
            return $this->unauthorized("Empty token");
        }

        try {
            $decoded = JWT::decode($token, new Key($this->secret, 'HS256'));
            error_log("AUTH_MW_DEBUG: Token decoded successfully: " . json_encode($decoded));

            /**
             * =====================================================
             *  FIX: SUPPORT mysql_id OR sub
             * =====================================================
             */
            if (!isset($decoded->mysql_id) && !isset($decoded->sub)) {
                return $this->unauthorized("Malformed token: missing user identifier");
            }

            // Normalize user id (keep backward compatibility)
            if (!isset($decoded->mysql_id) && isset($decoded->sub)) {
                $decoded->mysql_id = $decoded->sub;
            }

            // Attach user to request
            $request = $request->withAttribute('user', $decoded);

            return $handler->handle($request);

        } catch (\Throwable $e) {
            error_log("AUTH_MIDDLEWARE_ERROR: " . $e->getMessage());
            return $this->unauthorized("Invalid or expired token");
        }
    }

    private function unauthorized(string $msg): Response
    {
        $response = new \Slim\Psr7\Response(401);
        $response->getBody()->write(json_encode([
            'success' => false,
            'error'   => $msg
        ]));

        return $this->cors($response)
            ->withHeader('Content-Type', 'application/json');
    }

    private function cors(Response $res): Response
    {
        return $res
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true');
    }
}
