<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {
    
    /* ===========================================================
     * GET USER NOTIFICATIONS
     * =========================================================== */
    $app->get('/api/notifications', function (Request $req, Response $res) {
        $auth = $req->getAttribute('user');
        
        if (!$auth || !isset($auth->mysql_id)) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Unauthorized'
            ]));
            return $res->withStatus(401)->withHeader('Content-Type', 'application/json');
        }

        $userId = (int)$auth->mysql_id;

        try {
            $notifications = DB::table('notifications')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get();

            $res->getBody()->write(json_encode([
                'success' => true,
                'notifications' => $notifications
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('NOTIFICATIONS_ERROR: ' . $e->getMessage());
            
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Failed to fetch notifications'
            ]));

            return $res->withStatus(500)->withHeader('Content-Type', 'application/json');
        }

    })->add(new AuthMiddleware());

    /* ===========================================================
     * MARK NOTIFICATION AS READ
     * =========================================================== */
    /* ===========================================================
 * MARK NOTIFICATION AS READ
 * =========================================================== */

// Allow PATCH
$app->patch('/api/notifications/{id}/read', function (Request $req, Response $res, array $args) {
    $auth = $req->getAttribute('user');
    
    if (!$auth || !isset($auth->mysql_id)) {
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Unauthorized'
        ]));
        return $res->withStatus(401)->withHeader('Content-Type', 'application/json');
    }

    $userId = (int)$auth->mysql_id;
    $notificationId = (int)($args['id'] ?? 0);

    if (!$notificationId) {
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Invalid notification ID'
        ]));
        return $res->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    try {
        DB::table('notifications')
            ->where('id', $notificationId)
            ->where('user_id', $userId)
            ->update(['read' => true]);

        $res->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Notification marked as read'
        ]));

        return $res->withHeader('Content-Type', 'application/json');

    } catch (\Throwable $e) {
        error_log('NOTIFICATION_READ_ERROR: ' . $e->getMessage());
        
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Failed to update notification'
        ]));

        return $res->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());


// Allow POST (duplicate route handler)
$app->post('/api/notifications/{id}/read', function (Request $req, Response $res, array $args) {
    $auth = $req->getAttribute('user');
    
    if (!$auth || !isset($auth->mysql_id)) {
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Unauthorized'
        ]));
        return $res->withStatus(401)->withHeader('Content-Type', 'application/json');
    }

    $userId = (int)$auth->mysql_id;
    $notificationId = (int)($args['id'] ?? 0);

    if (!$notificationId) {
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Invalid notification ID'
        ]));
        return $res->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    try {
        DB::table('notifications')
            ->where('id', $notificationId)
            ->where('user_id', $userId)
            ->update(['read' => true]);

        $res->getBody()->write(json_encode([
            'success' => true,
            'message' => 'Notification marked as read'
        ]));

        return $res->withHeader('Content-Type', 'application/json');

    } catch (\Throwable $e) {
        error_log('NOTIFICATION_READ_ERROR: ' . $e->getMessage());
        
        $res->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Failed to update notification'
        ]));

        return $res->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());


    /* ===========================================================
     * DELETE NOTIFICATION
     * =========================================================== */
    $app->delete('/api/notifications/{id}', function (Request $req, Response $res, array $args) {
        $auth = $req->getAttribute('user');
        
        if (!$auth || !isset($auth->mysql_id)) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Unauthorized'
            ]));
            return $res->withStatus(401)->withHeader('Content-Type', 'application/json');
        }

        $userId = (int)$auth->mysql_id;
        $notificationId = (int)($args['id'] ?? 0);

        if (!$notificationId) {
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Invalid notification ID'
            ]));
            return $res->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            $deleted = DB::table('notifications')
                ->where('id', $notificationId)
                ->where('user_id', $userId)
                ->delete();

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'Notification deleted'
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('NOTIFICATION_DELETE_ERROR: ' . $e->getMessage());
            
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Failed to delete notification'
            ]));

            return $res->withStatus(500)->withHeader('Content-Type', 'application/json');
        }

    })->add(new AuthMiddleware());

};