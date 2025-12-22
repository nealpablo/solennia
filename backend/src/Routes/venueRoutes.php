<?php
// backend/src/Routes/venueRoutes.php - COMPLETE FIXED VERSION

use Src\Controllers\VenueController;
use Src\Middleware\AuthMiddleware;

return function ($app) {
    $venueController = new VenueController();

    // ============================================================
    // PUBLIC ROUTES - No authentication required
    // ============================================================
    
    // GET /api/venues - Get all approved venues
    $app->get('/api/venues', function ($request, $response, $args) use ($venueController) {
        return $venueController->getAllVenues($request, $response);
    });

    // GET /api/venues/{id} - Get single venue by ID
    $app->get('/api/venues/{id}', function ($request, $response, $args) use ($venueController) {
        return $venueController->getVenueById($request, $response, $args);
    });

    // ============================================================
    // PROTECTED ROUTES - Authentication required
    // ============================================================

    // POST /api/venue/listings - Create new venue listing (FIXED!)
    $app->post('/api/venue/listings', function ($request, $response, $args) use ($venueController) {
        return $venueController->createListing($request, $response);
    })->add(AuthMiddleware::class);

    // POST /api/venue/inquiry - Send inquiry to venue
    $app->post('/api/venue/inquiry', function ($request, $response, $args) use ($venueController) {
        return $venueController->sendInquiry($request, $response);
    })->add(AuthMiddleware::class);

    // POST /api/venue/schedule-visit - Schedule venue visit
    $app->post('/api/venue/schedule-visit', function ($request, $response, $args) use ($venueController) {
        return $venueController->scheduleVisit($request, $response);
    })->add(AuthMiddleware::class);
};