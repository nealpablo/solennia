<?php
use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Environment Configuration (safe for Railway)
|--------------------------------------------------------------------------
*/
$envPath = __DIR__ . '/../';

if (file_exists($envPath . '.env')) {
    // Local dev: load .env normally
    $dotenv = Dotenv::createImmutable($envPath);
    $dotenv->load();
} else {
    // Production (Railway): load injected env vars without crashing
    if (class_exists(Dotenv::class)) {
        $dotenv = Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
    }
}

/*
|--------------------------------------------------------------------------
| Slim Application Instance
|--------------------------------------------------------------------------
*/
$app = AppFactory::create();

/*
|--------------------------------------------------------------------------
| Middleware (Body parsing, CORS, OPTIONS)
|--------------------------------------------------------------------------
*/
$app->addBodyParsingMiddleware();

// CORS + headers
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);

    // Allow specific origins from env or fallback to *
    $allowedOrigin = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*';

    return $response
        ->withHeader('Access-Control-Allow-Origin', $allowedOrigin)
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

// Respond to all OPTIONS preflight requests
$app->options('/{routes:.+}', function ($req, $res) {
    $res = $res
        ->withHeader('Access-Control-Allow-Origin', $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    return $res;
});

/*
|--------------------------------------------------------------------------
| Database Bootstrap
|--------------------------------------------------------------------------
*/
require __DIR__ . '/../src/bootstrap.php';

/*
|--------------------------------------------------------------------------
| Routes from files
|--------------------------------------------------------------------------
*/
// ---- Safe route loader ----
$loadRoutes = function (string $path) use ($app) {
    $ret = require $path;
    if (is_callable($ret)) {
        $ret($app);
    }
};

// Include all route files
$loadRoutes(__DIR__ . '/../src/routes/authRoutes.php');
$loadRoutes(__DIR__ . '/../src/routes/userRoutes.php');
$loadRoutes(__DIR__ . '/../src/routes/vendorRoutes.php');
$loadRoutes(__DIR__ . '/../src/routes/feedbackRoutes.php');
$loadRoutes(__DIR__ . '/../src/routes/adminRoutes.php');

/*
|--------------------------------------------------------------------------
| Health / Debug
|--------------------------------------------------------------------------
*/
$app->get('/', function ($req, $res) {
    $res->getBody()->write('Solennia backend is running');
    return $res->withHeader('Content-Type', 'text/plain');
});

$app->get('/routes', function ($request, $response) use ($app) {
    $routes = [];
    foreach ($app->getRouteCollector()->getRoutes() as $route) {
        $routes[] = [
            'pattern' => $route->getPattern(),
            'methods' => $route->getMethods(),
        ];
    }
    $response->getBody()->write(json_encode($routes, JSON_PRETTY_PRINT));
    return $response->withHeader('Content-Type', 'application/json');
});

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/
$app->run();
