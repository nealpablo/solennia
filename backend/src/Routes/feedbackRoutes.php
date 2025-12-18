<?php
use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    /**
     * POST /api/feedback
     */
    $app->post('/api/feedback', function (Request $req, Response $res) {

        try {
            $data = json_decode((string)$req->getBody(), true) ?? [];
            $message = trim($data['message'] ?? '');

            if ($message === '') {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error' => 'Message is required'
                ]));
                return $res
                    ->withHeader('Content-Type', 'application/json')
                    ->withStatus(400);
            }

            $jwt = $req->getAttribute('user');
            $userId = (int)($jwt->mysql_id ?? 0); // ✅ CORRECT FIELD

            if ($userId <= 0) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error' => 'Unauthorized'
                ]));
                return $res
                    ->withHeader('Content-Type', 'application/json')
                    ->withStatus(401);
            }

            DB::table('feedback')->insert([
                'user_id'    => $userId,
                'message'    => $message,
                'created_at' => date('Y-m-d H:i:s')
            ]);

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'Feedback submitted'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(201);

        } catch (\Throwable $e) {
            error_log('FEEDBACK_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Server error'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());
};
