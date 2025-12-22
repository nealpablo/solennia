<?php
// backend/src/Routes/venueRoutes.php

use Src\Controllers\VenueController;
use Src\Middleware\AuthMiddleware;

return function ($app) {
    $venueController = new VenueController();

    // Public routes - No authentication required
    
    // GET /api/venues - Get all approved venues
    $app->get('/api/venues', function ($request, $response, $args) use ($venueController) {
        return $venueController->getAllVenues($request, $response);
    });

    // GET /api/venues/{id} - Get single venue by ID
    $app->get('/api/venues/{id}', function ($request, $response, $args) use ($venueController) {
        return $venueController->getVenueById($request, $response, $args);
    });

    // Protected routes - Authentication required

    // POST /api/venue/inquiry - Send inquiry to venue
    $app->post('/api/venue/inquiry', function ($request, $response, $args) use ($venueController) {
        return $venueController->sendInquiry($request, $response);
    })->add(AuthMiddleware::class);

    // POST /api/venue/schedule-visit - Schedule venue visit
    $app->post('/api/venue/schedule-visit', function ($request, $response, $args) use ($venueController) {
        return $venueController->scheduleVisit($request, $response);
    })->add(AuthMiddleware::class);

    // Listing Management Routes (for venue vendors only)
    
    // GET /api/venue/my-listings - Get my listings
    $app->get('/api/venue/my-listings', function ($request, $response, $args) use ($venueController) {
        return $venueController->getMyListings($request, $response);
    })->add(AuthMiddleware::class);

    // POST /api/venue/listings - Create new listing
    $app->post('/api/venue/listings', function ($request, $response, $args) use ($venueController) {
        return $venueController->createListing($request, $response);
    })->add(AuthMiddleware::class);

    // PUT /api/venue/listings/{id} - Update listing
    $app->put('/api/venue/listings/{id}', function ($request, $response, $args) use ($venueController) {
        return $venueController->updateListing($request, $response, $args);
    })->add(AuthMiddleware::class);

    // DELETE /api/venue/listings/{id} - Delete listing
    $app->delete('/api/venue/listings/{id}', function ($request, $response, $args) use ($venueController) {
        return $venueController->deleteListing($request, $response, $args);
    })->add(AuthMiddleware::class);
};