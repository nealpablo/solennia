<?php
use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

// -------------------------------------------------------------
// Absolute base path (works locally and on Railway)
// /app/public  -> BASE_PATH = /app
// -------------------------------------------------------------
define('BASE_PATH', realpath(__DIR__ . '/..'));

// Autoload
require BASE_PATH . '/vendor/autoload.php';

// -------------------------------------------------------------
// Environment (.env optional in production)
// -------------------------------------------------------------
if (file_exists(BASE_PATH . '/.env')) {
    Dotenv::createImmutable(BASE_PATH)->load();
} else {
    Dotenv::createImmutable(BASE_PATH)->safeLoad();
}

// -------------------------------------------------------------
// Slim app & middleware
// -------------------------------------------------------------
$app = AppFactory::create();
$app->addBodyParsingMiddleware();

// CORS (use env or fallback to *)
$app->add(function ($request, $handler) {
    $allowed = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*';

    if ($request->getMethod() === 'OPTIONS') {
        $response = new \Slim\Psr7\Response(200);
        return $response
            ->withHeader('Access-Control-Allow-Origin', $allowed)
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true');
    }

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
// Routes (case-sensitive: folder is "Routes")
// -------------------------------------------------------------
$loadRoutes = function (string $rel) use ($app) {
    $file = BASE_PATH . $rel;
    if (!is_file($file)) {
        throw new RuntimeException("Route file not found: {$file}");
    }
    $ret = require $file;
    if (is_callable($ret)) { $ret($app); }
};

$loadRoutes('/src/Routes/authRoutes.php');
$loadRoutes('/src/Routes/userRoutes.php');
$loadRoutes('/src/Routes/vendorRoutes.php');
$loadRoutes('/src/Routes/feedbackRoutes.php');
$loadRoutes('/src/Routes/adminRoutes.php');

// -------------------------------------------------------------
// Health / debug
// -------------------------------------------------------------

$displayErrorDetails = true; // change to false later in production
$errorMiddleware = $app->addErrorMiddleware($displayErrorDetails, true, true);

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


$app->get('/routes', function ($request, $response) use ($app) {
    $routes = [];
    foreach ($app->getRouteCollector()->getRoutes() as $route) {
        $routes[] = ['pattern' => $route->getPattern(), 'methods' => $route->getMethods()];
    }
    $response->getBody()->write(json_encode($routes, JSON_PRETTY_PRINT));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->run();
