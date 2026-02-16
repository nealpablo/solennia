<?php
// ============================================================
// SUPPRESS ALL PHP ERRORS FROM DISPLAYING
// ============================================================
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(0);

use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

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
// ✅ CORS MIDDLEWARE - MUST BE FIRST, BEFORE BODY PARSING
// -------------------------------------------------------------
$app->add(function ($request, $handler) {
    $method = strtoupper($request->getMethod());

    // ✅ Get origin from request
    $origin = $request->getHeaderLine('Origin');
    $origin = rtrim($origin, '/');

    $allowedOrigins = getenv('CORS_ALLOWED_ORIGINS') ?: '*';
    $allowedOrigins = rtrim($allowedOrigins, '/');

    // ✅ Determine allowed origin
    $allowOrigin = '*';
    if ($allowedOrigins !== '*') {
        $allowedList = array_map('trim', explode(',', $allowedOrigins));
        $allowedList = array_map(function ($url) {
                    return rtrim($url, '/'); }
                , $allowedList);

                if (in_array($origin, $allowedList, true)) {
                    $allowOrigin = $origin;
                }
            }
            else {
                $allowOrigin = $origin ?: '*';
            }

            // ✅ Fast path for OPTIONS - respond immediately without processing
            if ($method === 'OPTIONS') {
                $response = new \Slim\Psr7\Response();
                return $response
                ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
                ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
                ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->withHeader('Access-Control-Allow-Credentials', 'true')
                ->withHeader('Access-Control-Max-Age', '86400') // Cache for 24 hours
                ->withHeader('Vary', 'Origin') // Prevent cache issues
                ->withStatus(204); // 204 No Content is faster than 200
            }

            // ✅ Process actual request
            $response = $handler->handle($request);

            return $response
            ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withHeader('Vary', 'Origin');        });

// -------------------------------------------------------------
// ✅ BODY PARSING MIDDLEWARE (MUST BE AFTER CORS, BEFORE ROUTES)
// -------------------------------------------------------------
$app->add(function ($request, $handler) {
    $start = microtime(true);
    $response = $handler->handle($request);
    $time = round((microtime(true) - $start) * 1000, 2);

    // Log slow requests
    if ($time > 2000) { // > 2 seconds
        error_log("SLOW_REQUEST: {$request->getMethod()} {$request->getUri()->getPath()} took {$time}ms");
    }

    return $response->withHeader('X-Response-Time', "{$time}ms");
});

// -------------------------------------------------------------
// ✅ REQUEST TIMEOUT MIDDLEWARE
// -------------------------------------------------------------
$app->add(function ($request, $handler) {
    // Set a timeout for the request
    set_time_limit(25); // 25 seconds max per request

    return $handler->handle($request);
});

// -------------------------------------------------------------
// DB bootstrap (use optimized version)
// -------------------------------------------------------------
require BASE_PATH . '/src/bootstrap.php';

// -------------------------------------------------------------
// Routes Loader
// -------------------------------------------------------------
$loadRoutes = function (string $rel) use ($app) {
    $file = BASE_PATH . $rel;

    if (!is_file($file)) {
        return;
    }

    try {
        $ret = require $file;
        if (is_callable($ret)) {
            $ret($app);
        }
    }
    catch (Throwable $e) {
    }
};


// Load all routes (don't let one fail all others)
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

error_log("All route files loaded");

$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler(function (\Psr\Http\Message\ServerRequestInterface $request, \Throwable $exception, bool $displayErrorDetails, bool $logErrors, bool $logErrorDetails
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

    $response = $app->getResponseFactory()->createResponse($statusCode);
    $response->getBody()->write(json_encode([
        'success' => false,
        'error' => $displayErrorDetails ? $exception->getMessage() : 'Internal server error',
        'code' => $statusCode,
        'file' => $displayErrorDetails ? $exception->getFile() : null,
        'line' => $displayErrorDetails ? $exception->getLine() : null
    ]));

    return $response->withHeader('Content-Type', 'application/json');
});

// -------------------------------------------------------------
// Health & debug
// -------------------------------------------------------------
$app->get('/', function ($req, $res) {
    $res->getBody()->write('Solennia backend is running ⚡');
    return $res->withHeader('Content-Type', 'text/plain');
});

$app->get('/api/health', function ($req, $res) {
    try {
        $pdo = \Illuminate\Database\Capsule\Manager::connection()->getPdo();
        $dbStatus = 'connected';
    }
    catch (Throwable $e) {
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

$app->get('/api/dbtest', function ($req, $res) {
    try {
        \Illuminate\Database\Capsule\Manager::connection()->getPdo();
        $res->getBody()->write(json_encode(['ok' => true]));
    }
    catch (Throwable $e) {
        $res->getBody()->write(json_encode(['error' => $e->getMessage()]));
    }
    return $res->withHeader('Content-Type', 'application/json');
});

$app->get('/api/dbdiag', function ($req, $res) {
    $seen = [
        'APP_ENV' => getenv('APP_ENV'),
        'MYSQLHOST' => getenv('MYSQLHOST'),
        'MYSQLDATABASE' => getenv('MYSQLDATABASE'),
        'MYSQLPORT' => getenv('MYSQLPORT'),
        'DATABASE_URL' => getenv('DATABASE_URL'),
    ];

    try {
        \Illuminate\Database\Capsule\Manager::connection()->getPdo();
        $result = 'connected';
    }
    catch (Throwable $e) {
        $result = 'error: ' . $e->getMessage();
    }

    $res->getBody()->write(json_encode([
        'seen' => $seen,
        'result' => $result
    ]));

    return $res->withHeader('Content-Type', 'application/json');
});

$app->get('/routes', function ($request, $response) use ($app) {
    $routes = [];
    $routeCollector = $app->getRouteCollector();
    foreach ($routeCollector->getRoutes() as $route) {
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

// ✅ DEBUG: Environment check
$app->get('/api/debug/env', function ($req, $res) {
    $res->getBody()->write(json_encode([
        'DB_HOST' => getenv('DB_HOST'),
        'DB_DATABASE' => getenv('DB_DATABASE'),
        'DB_USERNAME' => getenv('DB_USERNAME'),
        'DB_PASSWORD' => getenv('DB_PASSWORD') ? 'SET' : 'NOT SET',
        'env_file_exists' => file_exists(BASE_PATH . '/.env'),
        'base_path' => BASE_PATH
    ], JSON_PRETTY_PRINT));
    return $res->withHeader('Content-Type', 'application/json');
});

// ✅ DEBUG: Check if booking routes file exists
$app->get('/api/debug/files', function ($req, $res) {
    $basePath = realpath(__DIR__ . '/..');
    $routesPath = $basePath . '/src/Routes';

    $files = is_dir($routesPath) ? scandir($routesPath) : [];

    $res->getBody()->write(json_encode([
        'base_path' => $basePath,
        'routes_path' => $routesPath,
        'routes_dir_exists' => is_dir($routesPath),
        'booking_file_exists' => is_file($routesPath . '/bookingRoutes.php'),
        'files_in_routes' => $files
    ], JSON_PRETTY_PRINT));
    return $res->withHeader('Content-Type', 'application/json');
});

// Run app
$app->run();