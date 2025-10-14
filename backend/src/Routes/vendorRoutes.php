<?php
use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    // Quick diagnostics: open http://localhost:8080/api/vendor/test
    $app->get('/api/vendor/test', function (Request $req, Response $res) {
        $res->getBody()->write(json_encode(['ok' => true, 'file' => 'vendorRoutes.php']));
        return $res->withHeader('Content-Type', 'application/json');
    });

    // POST /api/vendor/apply  (🔒 requires JWT)
    $app->post('/api/vendor/apply', function (Request $req, Response $res) {
        try {
            $data = (array)$req->getParsedBody();

            $jwt = $req->getAttribute('user');
            $userId = isset($jwt->sub) ? (int)$jwt->sub : null;
            if (!$userId) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'Unauthorized']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
            }

            // Ensure table exists (safe no-op if already there)
            DB::statement('CREATE TABLE IF NOT EXISTS `vendor_application` (
                `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `user_id`       INT UNSIGNED NULL,
                `business_name` VARCHAR(255) NOT NULL,
                `category`      VARCHAR(100) NULL,
                `address`       TEXT NULL,
                `permits`       TEXT NULL,
                `gov_id`        TEXT NULL,
                `portfolio`     TEXT NULL,
                `description`   TEXT NULL,
                `pricing`       TEXT NULL,
                `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');

            // Insert application
            $id = DB::table('vendor_application')->insertGetId([
                'user_id'       => $userId,
                'business_name' => trim((string)($data['business_name'] ?? '')),
                'category'      => trim((string)($data['category'] ?? '')),
                'address'       => (string)($data['address'] ?? ''),
                'permits'       => (string)($data['permits'] ?? ''),
                'gov_id'        => (string)($data['gov_id'] ?? ''),
                'portfolio'     => (string)($data['portfolio'] ?? ''),
                'description'   => (string)($data['description'] ?? ''),
                'pricing'       => (string)($data['pricing'] ?? ''),
            ]);

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'Vendor application saved',
                'id'      => $id
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(201);

        } catch (\Throwable $e) {
            error_log('VENDOR_ROUTE_ERROR: ' . $e->getMessage());
            $res->getBody()->write(json_encode(['success' => false, 'error' => 'Server error']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());
};
