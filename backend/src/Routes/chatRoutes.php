<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    $app->get('/api/users/{uid}', function (Request $req, Response $res, array $args) {
        $uid = $args['uid'];
        try {
            $user = DB::table('credential')->where('firebase_uid', $uid)->first();
            if (!$user) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'User not found']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }
            $res->getBody()->write(json_encode(['success' => true, 'user' => $user]));
            return $res->withHeader('Content-Type', 'application/json');
        } catch (\Throwable $e) {
            $res->getBody()->write(json_encode(['success' => false, 'error' => 'Server error']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(500);
        }
    });

    $app->get('/api/users/by-id/{id}', function (Request $req, Response $res, array $args) {
        $id = (int)$args['id'];
        try {
            $user = DB::table('credential')->where('id', $id)->first();
            if (!$user) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'User not found']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }
            $res->getBody()->write(json_encode(['success' => true, 'user' => $user]));
            return $res->withHeader('Content-Type', 'application/json');
        } catch (\Throwable $e) {
            $res->getBody()->write(json_encode(['success' => false, 'error' => 'Server error']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(500);
        }
    });

    // ✅ FIX: Everyone sees admin (but not themselves), Firebase threads add conversations
    $app->get('/api/chat/contacts', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        $myId = isset($jwt->mysql_id) ? (int)$jwt->mysql_id : 0;

        // Get admin(s) but exclude self
        $contacts = DB::table('credential')
            ->select('id', 'first_name', 'last_name', 'username', 'role', 'firebase_uid', 'avatar')
            ->where('role', 2)
            ->where('id', '!=', $myId)  // ✅ Don't show yourself
            ->get()
            ->toArray();

        $res->getBody()->write(json_encode(['success' => true, 'contacts' => $contacts]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    $app->get('/api/chat/vendors', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        $meId = isset($jwt->mysql_id) ? (int)$jwt->mysql_id : 0;

        $vendors = DB::table('credential as c')
            ->join('vendor_application as v', 'c.id', '=', 'v.user_id')
            ->select('c.id', 'c.first_name', 'c.last_name', 'c.username', 'c.role', 'c.firebase_uid', 'c.avatar',
                'v.business_name', 'v.category', 'v.portfolio')
            ->where('c.role', 1)
            ->where('v.status', 'Approved')
            ->where('c.id', '!=', $meId)
            ->distinct()
            ->orderBy('v.business_name')
            ->get();

        $res->getBody()->write(json_encode(['success' => true, 'vendors' => $vendors]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());
};