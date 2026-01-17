<?php
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
} else {
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
    $method = $request->getMethod();
    $origin = $request->getHeaderLine('Origin');
    
    // Get allowed origins from env
    $allowedOriginsEnv = getenv('CORS_ALLOWED_ORIGINS');
    
    // Determine which origin to allow
    $allowOrigin = '*';
    
    if ($allowedOriginsEnv && $allowedOriginsEnv !== '*') {
        // Parse allowed origins
        $allowedOrigins = array_map('trim', explode(',', $allowedOriginsEnv));
        
        // Check if request origin is in allowed list
        if ($origin && in_array($origin, $allowedOrigins)) {
            $allowOrigin = $origin;
        } elseif ($origin) {
            // Origin not allowed, but we need to set something
            $allowOrigin = $allowedOrigins[0]; // Use first allowed origin
        }
    } elseif ($origin) {
        // If no specific origins configured, reflect the request origin
        $allowOrigin = $origin;
    }
    
    // Handle preflight OPTIONS requests immediately
    if (strtoupper($method) === 'OPTIONS') {
        $response = new \Slim\Psr7\Response();
        return $response
            ->withStatus(200)
            ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withHeader('Access-Control-Max-Age', '86400')
            ->withHeader('Content-Length', '0');
    }
    
    // Process the request
    $response = $handler->handle($request);
    
    // Add CORS headers to response
    return $response
        ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

// -------------------------------------------------------------
// ✅ BODY PARSING MIDDLEWARE (MUST BE AFTER CORS, BEFORE ROUTES)
// -------------------------------------------------------------
$app->addBodyParsingMiddleware();

// -------------------------------------------------------------
// ✅ ROUTING MIDDLEWARE
// -------------------------------------------------------------
$app->addRoutingMiddleware();

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
// Routes with Enhanced Logging
// -------------------------------------------------------------
$loadRoutes = function (string $rel) use ($app) {
    $file = BASE_PATH . $rel;
    
    // Log the attempt
    error_log("Attempting to load route file: {$file}");
    
    if (!is_file($file)) {
        error_log("ERROR: Route file not found: {$file}");
        error_log("Base path is: " . BASE_PATH);
        error_log("Current directory contents: " . print_r(scandir(BASE_PATH . '/src/Routes'), true));
        throw new RuntimeException("Route file not found: {$file}");
    }
    
    error_log("Successfully found route file: {$file}");
    
    $ret = require $file;
    if (is_callable($ret)) {
        $ret($app);
        error_log("Route file loaded successfully: {$file}");
    } else {
        error_log("WARNING: Route file did not return a callable: {$file}");
    }
};

try {
    $loadRoutes('/src/Routes/authRoutes.php');
    $loadRoutes('/src/Routes/userRoutes.php');
    $loadRoutes('/src/Routes/vendorRoutes.php');
    $loadRoutes('/src/Routes/venueRoutes.php');
    $loadRoutes('/src/Routes/feedbackRoutes.php');
    $loadRoutes('/src/Routes/adminRoutes.php');
    $loadRoutes('/src/Routes/notificationRoutes.php');
    $loadRoutes('/src/Routes/chatRoutes.php');
    $loadRoutes('/src/Routes/usernameResolverRoutes.php');
    
    // ✅ BOOKING ROUTES - ADDED FOR UC05
    $loadRoutes('/src/Routes/bookingRoutes.php');
    
    error_log("All route files loaded successfully");
} catch (Throwable $e) {
    error_log("FATAL ERROR loading routes: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    throw $e;
}

// -------------------------------------------------------------
// ✅ IMPROVED Error middleware with better logging
// -------------------------------------------------------------
$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler(function (
    \Psr\Http\Message\ServerRequestInterface $request,
    \Throwable $exception,
    bool $displayErrorDetails,
    bool $logErrors,
    bool $logErrorDetails
) use ($app) {
    $statusCode = 500;
    
    if ($exception instanceof \Slim\Exception\HttpNotFoundException) {
        $statusCode = 404;
    } elseif ($exception instanceof \Slim\Exception\HttpMethodNotAllowedException) {
        $statusCode = 405;
    } elseif ($exception instanceof \Slim\Exception\HttpUnauthorizedException) {
        $statusCode = 401;
    }
    
    error_log("ERROR: {$exception->getMessage()} in {$exception->getFile()}:{$exception->getLine()}");
    
    $response = $app->getResponseFactory()->createResponse($statusCode);
    $response->getBody()->write(json_encode([
        'success' => false,
        'error' => $displayErrorDetails ? $exception->getMessage() : 'Internal server error',
        'code' => $statusCode
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
    } catch (Throwable $e) {
        $dbStatus = 'error';
    }
    
    $res->getBody()->write(json_encode([
        'status' => 'ok',
        'database' => $dbStatus,
        'timestamp' => date('Y-m-d H:i:s')
    ]));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->get('/api/dbtest', function ($req, $res) {
    try {
        \Illuminate\Database\Capsule\Manager::connection()->getPdo();
        $res->getBody()->write(json_encode(['ok' => true]));
    } catch (Throwable $e) {
        $res->getBody()->write(json_encode(['error' => $e->getMessage()]));
    }
    return $res->withHeader('Content-Type', 'application/json');
});

// ✅ DEBUG: List all registered routes
$app->get('/api/debug/routes', function ($req, $res) use ($app) {
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