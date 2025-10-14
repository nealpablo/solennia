<?php
use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {
    /**
     * POST /api/feedback
     * Body: { message }
     * 🔒 Requires Authorization: Bearer <JWT>
     */
    $app->post('/api/feedback', function (Request $req, Response $res) {
        try {
            // body
            $data = (array)$req->getParsedBody();
            if (!is_array($data)) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'Invalid JSON body']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
            }

            $message = trim((string)($data['message'] ?? ''));
            if ($message === '') {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'Feedback message is required']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
            }

            // user from JWT (set by middleware)
            $jwt = $req->getAttribute('user');
            $userId = isset($jwt->sub) ? (int)$jwt->sub : null;
            if (!$userId) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'Unauthorized']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
            }

            // ensure table exists (safe no-op if it does)
            try {
                DB::statement('CREATE TABLE IF NOT EXISTS `feedback` (
                    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    `user_id` INT UNSIGNED NULL,
                    `message` TEXT NOT NULL,
                    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
            } catch (\Throwable $e) {
                // just log; continue (table might already exist with FK)
                error_log('FEEDBACK_TABLE_CHECK: ' . $e->getMessage());
            }

            // insert
            $id = DB::table('feedback')->insertGetId([
                'user_id' => $userId,
                'message' => $message,
            ]);

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'Feedback received',
                'id'      => $id,
            ]));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(201);

        } catch (\Throwable $e) {
            if (($_ENV['APP_DEBUG'] ?? 'false') === 'true') {
                error_log('FEEDBACK_ERROR: ' . $e->getMessage());
            }
            $res->getBody()->write(json_encode(['success' => false, 'error' => 'Server error submitting feedback']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());

    // Optional: quick auth check to debug tokens
    $app->get('/api/feedback/ping', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        $res->getBody()->write(json_encode([
            'ok' => true,
            'user' => $jwt ?? null
        ]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());
};
