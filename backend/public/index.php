<?php
use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

// --- Find project root based on the web server's docroot ---
$DOCROOT = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__, '/'); // fallback for CLI
$PROJECT_ROOT = dirname(__DIR__);

// Autoload (always resolve from project root)
require $PROJECT_ROOT . '/vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Environment Configuration (safe if .env is missing)
|--------------------------------------------------------------------------
*/
if (file_exists($PROJECT_ROOT . '/.env')) {
    Dotenv::createImmutable($PROJECT_ROOT)->load();
} else {
    Dotenv::createImmutable($PROJECT_ROOT)->safeLoad();
}

/*
|--------------------------------------------------------------------------
| Slim App
|--------------------------------------------------------------------------
*/
$app = AppFactory::create();
$app->addBodyParsingMiddleware();

// CORS
$app->add(function ($req, $handler) {
    $allowed = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*';
    $res = $handler->handle($req);
    return $res
        ->withHeader('Access-Control-Allow-Origin', $allowed)
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});
$app->options('/{routes:.+}', function ($req, $res) {
    $allowed = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*';
    return $res
        ->withHeader('Access-Control-Allow-Origin', $allowed)
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
});

/*
|--------------------------------------------------------------------------
| Bootstrap DB (resolve from project root)
|--------------------------------------------------------------------------
*/
require $PROJECT_ROOT . '/src/bootstrap.php';

/*
|--------------------------------------------------------------------------
| Routes (resolve from project root)
|--------------------------------------------------------------------------
*/
$loadRoutes = function (string $relPath) use ($app, $PROJECT_ROOT) {
    $file = $PROJECT_ROOT . $relPath;
    if (!is_file($file)) {
        throw new RuntimeException("Route file not found: {$file}");
    }
    $ret = require $file;
    if (is_callable($ret)) { $ret($app); }
};

$loadRoutes(__DIR__ . '/../src/Routes/authRoutes.php');
$loadRoutes(__DIR__ . '/../src/Routes/userRoutes.php');
$loadRoutes(__DIR__ . '/../src/Routes/vendorRoutes.php');
$loadRoutes(__DIR__ . '/../src/Routes/feedbackRoutes.php');
$loadRoutes(__DIR__ . '/../src/Routes/adminRoutes.php');


/*
|--------------------------------------------------------------------------
| Health / Debug
|--------------------------------------------------------------------------
*/
$app->get('/', function ($req, $res) {
    $res->getBody()->write('Solennia backend is running');
    return $res->withHeader('Content-Type', 'text/plain');
});
$app->get('/routes', function ($req, $res) use ($app) {
    $routes = [];
    foreach ($app->getRouteCollector()->getRoutes() as $route) {
        $routes[] = ['pattern' => $route->getPattern(), 'methods' => $route->getMethods()];
    }
    $res->getBody()->write(json_encode($routes, JSON_PRETTY_PRINT));
    return $res->withHeader('Content-Type', 'application/json');
});

$app->run();
