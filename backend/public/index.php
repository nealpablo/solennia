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
$app->addBodyParsingMiddleware();

// -------------------------------------------------------------
// GLOBAL OPTIONS handler (CRITICAL)
// -------------------------------------------------------------
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});

// -------------------------------------------------------------
// CORS middleware
// -------------------------------------------------------------
$app->add(function ($request, $handler) {
    $allowed = getenv('CORS_ALLOWED_ORIGINS') ?: '*';

    $response = $handler->handle($request);

    return $response
        ->withHeader('Access-Control-Allow-Origin', $allowed)
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

// -------------------------------------------------------------
// DB bootstrap
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
// Error middleware
// -------------------------------------------------------------
$errorMiddleware = $app->addErrorMiddleware(true, true, true);

// -------------------------------------------------------------
// Health & debug
// -------------------------------------------------------------
$app->get('/', function ($req, $res) {
    $res->getBody()->write('Solennia backend is running');
    return $res->withHeader('Content-Type', 'text/plain');
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

$app->run();
