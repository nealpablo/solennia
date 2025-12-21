<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

return function (App $app) {

    // Resolve username OR email → email
    $app->get('/api/auth/resolve-username', function (Request $req, Response $res) {

        $params = $req->getQueryParams();
        $identifier = trim($params['u'] ?? '');

        if ($identifier === '') {
            $res->getBody()->write(json_encode([
                "success" => false,
                "message" => "Email or username required"
            ]));
            return $res->withHeader("Content-Type", "application/json")->withStatus(400);
        }

        // 🔥 FIX: Check BOTH username AND email
        $row = DB::table('credential')
            ->where(function($query) use ($identifier) {
                $query->where('username', $identifier)
                      ->orWhere('email', $identifier);
            })
            ->first();

        if (!$row) {
            $res->getBody()->write(json_encode([
                "success" => false,
                "message" => "Account not found"
            ]));
            return $res->withHeader("Content-Type", "application/json")->withStatus(404);
        }

        $res->getBody()->write(json_encode([
            "success" => true,
            "email"   => $row->email
        ]));

        return $res->withHeader("Content-Type", "application/json")->withStatus(200);
    });
};