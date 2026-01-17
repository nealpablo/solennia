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

// NOW add body parsing middleware AFTER CORS
$app->addBodyParsingMiddleware();

// -------------------------------------------------------------
// ✅ PERFORMANCE MIDDLEWARE - Response Time Tracking
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
// Routes
// -------------------------------------------------------------
$loadRoutes = function (string $rel) use ($app) {
    $file = BASE_PATH . $rel;
    if (!is_file($file)) {
        throw new RuntimeException("Route file not found: {$file}");
    }
    $ret = require $file;
    if (is_callable($ret)) {
        $ret($app);
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

$app->get('/api/dbdiag', function ($req, $res) {
    $seen = [
        'APP_ENV'       => getenv('APP_ENV'),
        'MYSQLHOST'     => getenv('MYSQLHOST'),
        'MYSQLDATABASE' => getenv('MYSQLDATABASE'),
        'MYSQLPORT'     => getenv('MYSQLPORT'),
        'DATABASE_URL'  => getenv('DATABASE_URL'),
    ];

    try {
        \Illuminate\Database\Capsule\Manager::connection()->getPdo();
        $result = 'connected';
    } catch (Throwable $e) {
        $result = 'error: ' . $e->getMessage();
    }

    $res->getBody()->write(json_encode([
        'seen'   => $seen,
        'result' => $result
    ]));

    return $res->withHeader('Content-Type', 'application/json');
});

$app->get('/routes', function ($request, $response) use ($app) {
    $routes = [];
    foreach ($app->getRouteCollector()->getRoutes() as $route) {
        $routes[] = [
            'pattern' => $route->getPattern(),
            'methods' => $route->getMethods()
        ];
    }
    $response->getBody()->write(json_encode($routes, JSON_PRETTY_PRINT));
    return $response->withHeader('Content-Type', 'application/json');
});

// Add CORS test endpoint
$app->get('/api/cors-test', function ($req, $res) {
    $res->getBody()->write(json_encode([
        'success' => true,
        'message' => 'CORS is working!',
        'origin' => $req->getHeaderLine('Origin')
    ]));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->run();