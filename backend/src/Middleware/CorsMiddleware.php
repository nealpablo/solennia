<?php
/**
 * CORS Middleware
 * Handles Cross-Origin Resource Sharing
 */

namespace Src\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class CorsMiddleware
{
    public function __invoke(Request $request, RequestHandler $handler): Response
    {
        // ✅ FIX: Get actual origin from request, fallback to localhost
        $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';
        
        // Get allowed origins from environment (comma-separated list)
        $allowedOrigins = $_ENV['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:5173,http://localhost:3000';
        $allowedOriginsArray = array_map('trim', explode(',', $allowedOrigins));
        
        // ✅ FIX: Check if origin is allowed
        if (!in_array($origin, $allowedOriginsArray)) {
            $origin = $allowedOriginsArray[0]; // Default to first allowed origin
        }
        
        // Handle preflight OPTIONS request
        if ($request->getMethod() === 'OPTIONS') {
            $response = new \Slim\Psr7\Response();
        } else {
            $response = $handler->handle($request);
        }
        
        // ✅ FIX: Add CORS headers with the actual request origin
        return $response
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withHeader('Access-Control-Max-Age', '3600'); // ✅ Cache preflight for 1 hour
    }
}