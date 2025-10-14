<?php
use Slim\App;
use Src\Controllers\AuthController;

return function (App $app) {
    // Register: expects first_name, last_name, email, password
    $app->post('/api/auth/register', [AuthController::class, 'register']);

    // Login: expects username, password
    $app->post('/api/auth/login', [AuthController::class, 'login']);

    // ✅ NEW: get current user (uses Authorization: Bearer <token>)
    $app->get('/api/auth/me', [AuthController::class, 'me']);
};
