<?php

use Src\Controllers\AIController;
use Src\Middleware\AuthMiddleware;
use Slim\Routing\RouteCollectorProxy;

$app->group('/api/ai', function (RouteCollectorProxy $group) {
    // Public routes
    $group->get('/status', [AIController::class, 'status']);
    $group->get('/categories', [AIController::class, 'categories']);
    $group->get('/stats', [AIController::class, 'stats']); // Show database stats
    $group->get('/vendor/availability', [AIController::class, 'checkVendorAvailability']); // Check vendor availability
    
    // Protected routes (require login)
    $group->post('/chat', [AIController::class, 'chat'])->add(new AuthMiddleware());
    $group->post('/recommendations', [AIController::class, 'recommendations'])->add(new AuthMiddleware());
    $group->post('/booking/create', [AIController::class, 'createBookingFromAI'])->add(new AuthMiddleware()); // NEW: AI-assisted booking
});