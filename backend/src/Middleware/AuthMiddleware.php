<?php
namespace Src\Middleware;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Psr\Http\Server\MiddlewareInterface as Middleware;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthMiddleware implements Middleware
{
    private string $secret;

    public function __construct()
    {
        // ✅ must match your AuthController
        $this->secret = $_ENV['JWT_SECRET'] ?? 'solennia_super_secret_key_2025';
    }

    public function process(Request $request, Handler $handler): Response
    {
        // Allow OPTIONS for preflight
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            $response = new \Slim\Psr7\Response();
            return $response->withHeader('Access-Control-Allow-Origin', '*')
                            ->withHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
                            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                            ->withStatus(200);
        }

        $auth = $request->getHeaderLine('Authorization');
        if (!$auth || stripos($auth, 'Bearer ') !== 0) {
            return $this->unauthorized('Missing or invalid Authorization header');
        }

        $token = trim(substr($auth, 7));
        if ($token === '') {
            return $this->unauthorized('Empty Bearer token');
        }

        try {
            $decoded = JWT::decode($token, new Key($this->secret, 'HS256'));

            if (!isset($decoded->sub)) {
                return $this->unauthorized('Malformed token');
            }

            $request = $request->withAttribute('user', $decoded);
            return $handler->handle($request);
        } catch (\Throwable $e) {
            error_log('AUTH_MIDDLEWARE_ERROR: ' . $e->getMessage());
            return $this->unauthorized('Invalid or expired token');
        }
    }

    private function unauthorized(string $message): Response
    {
        $res = new \Slim\Psr7\Response(401);
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => $message
        ]));
        return $res->withHeader('Content-Type', 'application/json');
    }
}
