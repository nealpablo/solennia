<?php
// ============================================================
// SUPPRESS ALL PHP ERRORS FROM DISPLAYING TO USER
// ============================================================
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

use Slim\Factory\AppFactory;
use Dotenv\Dotenv;
use Psr\Http\Message\ServerRequestInterface;

// -------------------------------------------------------------
// Base path
// -------------------------------------------------------------
define('BASE_PATH', realpath(__DIR__ . '/..'));

require BASE_PATH . '/vendor/autoload.php';

// -------------------------------------------------------------
// Environment loading (ONCE, Railway-safe)
// -------------------------------------------------------------
$env = getenv('APP_ENV') ?: 'production';

if ($env !== 'production' && file_exists(BASE_PATH . '/.env')) {
    Dotenv::createImmutable(BASE_PATH)->load();
}
else {
    Dotenv::createImmutable(BASE_PATH)->safeLoad();
}

// -------------------------------------------------------------
// Slim app
// -------------------------------------------------------------
$app = AppFactory::create();

// -------------------------------------------------------------
// ✅ CORS MIDDLEWARE (MUST BE FIRST)
// -------------------------------------------------------------
$app->add(function ($request, $handler) {
    $method = strtoupper($request->getMethod());
    $origin = $request->getHeaderLine('Origin');
    $origin = rtrim($origin, '/');

    // Get allowed origins from env, standardizing format
    $allowedOriginsEnv = getenv('CORS_ALLOWED_ORIGINS') ?: '*';

    // Remove quotes if present (common env var issue)
    $allowedOriginsEnv = trim($allowedOriginsEnv, '"\'');

    // Determine allowed origin
    $allowOrigin = '';

    if ($allowedOriginsEnv === '*') {
        // If wildcard is allowed, we can just echo the origin for credential support
        // Or strictly use '*' (but '*' + credentials = error)
        // Safer to echo origin if it's there, or '*' if no origin
        $allowOrigin = $origin ?: '*';
    }
    else {
        $allowedList = array_map('trim', explode(',', $allowedOriginsEnv));
        // Normalize list (remove quotes/trailing slashes)
        $allowedList = array_map(function ($url) {
                    return rtrim(trim($url, '"\''), '/');
                }
                    , $allowedList);

                if (in_array($origin, $allowedList, true)) {
                    $allowOrigin = $origin;
                }
                else {
                    // Origin not allowed. 
                    // We return empty string or null, effectively blocking CORS.
                    // Some browsers prefer not sending the header at all.
                    $allowOrigin = '';
                }
            }

            // Common headers
            $headers = [
                'Access-Control-Allow-Origin' => $allowOrigin,
                'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept',
                'Access-Control-Allow-Credentials' => 'true',
                'Vary' => 'Origin'
            ];

            // ✅ OPTION PREFLIGHT HANDLING
            if ($method === 'OPTIONS') {
                $response = new \Slim\Psr7\Response();
                $response = $response->withStatus(204); // No Content
        
                foreach ($headers as $key => $val) {
                    $response = $response->withHeader($key, $val);
                }
                return $response->withHeader('Access-Control-Max-Age', '86400');
            }

            // ✅ NORMAL REQUEST HANDLING
            $response = $handler->handle($request);

            foreach ($headers as $key => $val) {
                $response = $response->withHeader($key, $val);
            }

            return $response;
        });

// -------------------------------------------------------------
// ✅ MIDDLEWARE STACK
// -------------------------------------------------------------
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// -------------------------------------------------------------
// ✅ PERFORMANCE & LOGGING MIDDLEWARE
// -------------------------------------------------------------
$app->add(function ($request, $handler) {
    $start = microtime(true);
    $response = $handler->handle($request);
    $time = round((microtime(true) - $start) * 1000, 2);

    // Log slow requests (> 2s)
    if ($time > 2000) {
        error_log("SLOW_REQUEST: {$request->getMethod()} {$request->getUri()->getPath()} took {$time}ms");
    }

    return $response->withHeader('X-Response-Time', "{$time}ms");
});

// -------------------------------------------------------------
// ✅ DB BOOTSTRAP (SAFE)
// -------------------------------------------------------------
try {
    require BASE_PATH . '/src/bootstrap.php';
}
catch (\Throwable $e) {
    error_log("BOOTSTRAP_ERROR: " . $e->getMessage());
// We continue execution. Routes that need DB will fail, but health checks/CORS will pass.
}

// -------------------------------------------------------------
// ✅ ROUTE LOADING
// -------------------------------------------------------------
$loadRoutes = function (string $rel) use ($app) {
    $file = BASE_PATH . $rel;
    if (!is_file($file))
        return;
    try {
        $ret = require $file;
        if (is_callable($ret)) {
            $ret($app);
        }
    }
    catch (\Throwable $e) {
        error_log("ROUTE_LOAD_ERROR ({$rel}): " . $e->getMessage());
    }
};

$loadRoutes('/src/Routes/authRoutes.php');
$loadRoutes('/src/Routes/userRoutes.php');
$loadRoutes('/src/Routes/vendorRoutes.php');
$loadRoutes('/src/Routes/venueRoutes.php');
$loadRoutes('/src/Routes/feedbackRoutes.php');
$loadRoutes('/src/Routes/adminRoutes.php');
$loadRoutes('/src/Routes/notificationRoutes.php');
$loadRoutes('/src/Routes/chatRoutes.php');
$loadRoutes('/src/Routes/usernameResolverRoutes.php');
$loadRoutes('/src/Routes/bookingRoutes.php');
$loadRoutes('/src/Routes/availabilityRoutes.php');
$loadRoutes('/src/Routes/aiRoutes.php');

// -------------------------------------------------------------
// ✅ ERROR HANDLING
// -------------------------------------------------------------
$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler(function (ServerRequestInterface $request, \Throwable $exception, bool $displayErrorDetails, bool $logErrors, bool $logErrorDetails
) use ($app) {
    $statusCode = 500;

    if ($exception instanceof \Slim\Exception\HttpNotFoundException) {
        $statusCode = 404;
    }
    elseif ($exception instanceof \Slim\Exception\HttpMethodNotAllowedException) {
        $statusCode = 405;
    }
    elseif ($exception instanceof \Slim\Exception\HttpUnauthorizedException) {
        $statusCode = 401;
    }

    error_log("ERROR: {$exception->getMessage()} in {$exception->getFile()}:{$exception->getLine()}");

    $payload = [
        'success' => false,
        'error' => $displayErrorDetails ? $exception->getMessage() : 'An unexpected error occurred.',
        'code' => $statusCode
    ];

    if ($displayErrorDetails) {
        $payload['file'] = $exception->getFile();
        $payload['line'] = $exception->getLine();
    }

    $response = $app->getResponseFactory()->createResponse($statusCode);
    $response->getBody()->write(json_encode($payload));

    return $response->withHeader('Content-Type', 'application/json');
});

// -------------------------------------------------------------
// ✅ HEALTH & DEBUG ENDPOINTS
// -------------------------------------------------------------
$app->get('/', function ($req, $res) {
    $res->getBody()->write('Solennia backend is running ⚡');
    return $res->withHeader('Content-Type', 'text/plain');
});

$app->get('/api/health', function ($req, $res) {
    $dbStatus = 'unknown';
    $dbMessage = '';

    try {
        \Illuminate\Database\Capsule\Manager::connection()->getPdo();
        $dbStatus = 'connected';
    }
    catch (\Throwable $e) {
        $dbStatus = 'error';
        $dbMessage = $e->getMessage();
    }

    $res->getBody()->write(json_encode([
        'status' => 'ok',
        'database' => $dbStatus,
        'db_message' => $dbMessage,
        'timestamp' => date('Y-m-d H:i:s'),
        'php_version' => phpversion()
    ]));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->get('/api/debug/env', function ($req, $res) {
    $secret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET') ?? 'fallback';

    $res->getBody()->write(json_encode([
        'DB_HOST' => getenv('DB_HOST'),
        'DB_DATABASE' => getenv('DB_DATABASE'),
        'DB_USERNAME' => getenv('DB_USERNAME'),
        'DB_PASSWORD' => getenv('DB_PASSWORD') ? 'SET' : 'NOT SET',
        'env_file_exists' => file_exists(BASE_PATH . '/.env'),
        'cors_origins' => getenv('CORS_ALLOWED_ORIGINS'),
        'jwt_secret_start' => substr($secret, 0, 5) . '...' // SAFE to show first 5 chars
    ], JSON_PRETTY_PRINT));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->get('/api/debug/routes', function ($req, $res) use ($app) {
    $routes = [];
    foreach ($app->getRouteCollector()->getRoutes() as $route) {
        $routes[] = [
            'methods' => implode('|', $route->getMethods()),
            'pattern' => $route->getPattern(),
            'name' => $route->getName()
        ];
    }
    $res->getBody()->write(json_encode([
        'total' => count($routes),
        'routes' => $routes
    ], JSON_PRETTY_PRINT));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->run();