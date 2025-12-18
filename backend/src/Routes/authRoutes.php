<?php

use Slim\App;
use Src\Controllers\AuthController;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    // ✅ REGISTER: Firebase creates → MySQL mirrors
    $app->post('/api/auth/register', [AuthController::class, 'register']);

    // ✅ LOGIN: Only after Firebase email verification
    $app->post('/api/auth/login', [AuthController::class, 'login']);

    // ✅ GET CURRENT USER (✅ NOW PROTECTED BY JWT)
    $app->get('/api/auth/me', [AuthController::class, 'me'])
        ->add(new AuthMiddleware());
};
