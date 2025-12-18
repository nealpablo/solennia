<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

return function (App $app) {

    // Resolve username → email
    $app->get('/api/auth/resolve-username', function (Request $req, Response $res) {

        $params = $req->getQueryParams();
        $username = trim($params['u'] ?? '');

        if ($username === '') {
            $res->getBody()->write(json_encode([
                "success" => false,
                "message" => "Username required"
            ]));
            return $res->withHeader("Content-Type", "application/json")->withStatus(400);
        }

        $row = DB::table('credential')
            ->where('username', $username)
            ->first();

        if (!$row) {
            $res->getBody()->write(json_encode([
                "success" => false,
                "message" => "Username not found"
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
