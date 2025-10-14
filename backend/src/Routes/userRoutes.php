<?php
use Slim\App;
use Illuminate\Database\Capsule\Manager as DB;

return function (App $app) {
    $app->get('/api/users', function ($req, $res) {
        $users = DB::table('credential')->select('id', 'username')->get();
        $res->getBody()->write(json_encode($users));
        return $res->withHeader('Content-Type', 'application/json');
    });
};
