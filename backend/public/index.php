<?php
use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Environment Configuration
|--------------------------------------------------------------------------
*/
$dotenv = Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

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
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
});

// Respond to all OPTIONS preflight requests
$app->options('/{routes:.+}', function ($req, $res) {
    return $res
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
// ---- Safe route loader: calls the returned closure only if present ----
$loadRoutes = function (string $path) use ($app) {
    $ret = require $path;   // returns 1 if file defines routes directly
    if (is_callable($ret)) {
        $ret($app);         // older files that "return function(App $app) { ... }"
    }
};

// Include all your route files via the safe loader
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
