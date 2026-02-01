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
    $group->get('/faqs', [AIController::class, 'getFAQs']); // Public FAQ list
    
    // Protected routes (require login)
    $group->post('/chat', [AIController::class, 'chat'])->add(new AuthMiddleware());
    $group->post('/recommendations', [AIController::class, 'recommendations'])->add(new AuthMiddleware());
    $group->post('/booking/create', [AIController::class, 'createBookingFromAI'])->add(new AuthMiddleware()); // AI-assisted booking
    
    // Admin FAQ management routes (UC18)
    $group->post('/faqs/generate', [AIController::class, 'generateFAQs'])->add(new AuthMiddleware());
    $group->post('/faqs', [AIController::class, 'saveFAQ'])->add(new AuthMiddleware());
    $group->put('/faqs/{id}', [AIController::class, 'updateFAQ'])->add(new AuthMiddleware());
    $group->delete('/faqs/{id}', [AIController::class, 'deleteFAQ'])->add(new AuthMiddleware());
});
