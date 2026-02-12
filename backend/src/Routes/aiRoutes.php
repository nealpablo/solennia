<?php

use Src\Controllers\AIController;
use Src\Middleware\AuthMiddleware;
use Slim\Routing\RouteCollectorProxy;

/**
 * AI Routes
 * - Regular AI Chat (existing Q&A feature)
 * - Conversational Booking (NEW feature)
 */
$app->group('/api/ai', function (RouteCollectorProxy $group) {
    // Regular AI Chat for Q&A
    $group->post('/chat', [AIController::class, 'chat'])
        ->add(new AuthMiddleware());
    
    // NEW: Conversational Booking
    $group->post('/conversational-booking', [AIController::class, 'conversationalBooking'])
        ->add(new AuthMiddleware());
});