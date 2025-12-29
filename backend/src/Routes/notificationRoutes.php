<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    // Get user notifications
    $app->get('/api/notifications', function (Request $request, Response $response) {
        $auth = $request->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
        
        $userId = (int) $auth->mysql_id;
        
        try {
            $notifications = DB::table('notifications')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get()
                ->toArray();
            
            $response->getBody()->write(json_encode([
                'notifications' => $notifications
            ]));
            return $response->withHeader('Content-Type', 'application/json');
            
        } catch (Exception $e) {
            $response->getBody()->write(json_encode([
                'error' => 'Failed to load notifications'
            ]));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    })->add(new AuthMiddleware());

    // Mark notification as read
    $app->post('/api/notifications/{id}/read', function (Request $request, Response $response, array $args) {
        $auth = $request->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
        
        $userId = (int) $auth->mysql_id;
        $notificationId = (int) $args['id'];
        
        try {
            DB::table('notifications')
                ->where('id', $notificationId)
                ->where('user_id', $userId)
                ->update(['read' => true]);
            
            $response->getBody()->write(json_encode(['success' => true]));
            return $response->withHeader('Content-Type', 'application/json');
            
        } catch (Exception $e) {
            $response->getBody()->write(json_encode([
                'error' => 'Failed to mark as read'
            ]));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    })->add(new AuthMiddleware());

    // Mark all as read
    $app->post('/api/notifications/mark-all-read', function (Request $request, Response $response) {
        $auth = $request->getAttribute('user');
        if (!$auth || !isset($auth->mysql_id)) {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
        
        $userId = (int) $auth->mysql_id;
        
        try {
            DB::table('notifications')
                ->where('user_id', $userId)
                ->update(['read' => true]);
            
            $response->getBody()->write(json_encode(['success' => true]));
            return $response->withHeader('Content-Type', 'application/json');
            
        } catch (Exception $e) {
            $response->getBody()->write(json_encode([
                'error' => 'Failed to mark all as read'
            ]));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    })->add(new AuthMiddleware());
};