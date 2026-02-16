<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;
use Src\Controllers\VendorAvailabilityController;

return function (App $app) {
    
    $controller = new VendorAvailabilityController();
    
    /**
     * ========================================
     * VENDOR AVAILABILITY ROUTES
     * ========================================
     */
    
    // PUBLIC: Get availability for a vendor
    // GET /api/vendor/availability/{vendor_id}?year=2025&month=2
    $app->get('/api/vendor/availability/{vendor_id}', function (Request $request, Response $response, array $args) use ($controller) {
        return $controller->index($request, $response, $args);
    });
    
    // PROTECTED: Create new availability (vendor only)
    // POST /api/vendor/availability
    $app->post('/api/vendor/availability', function (Request $request, Response $response, array $args) use ($controller) {
        return $controller->store($request, $response);
    })->add(new AuthMiddleware());
    
    // PROTECTED: Update availability (vendor only, own records)
    // PATCH /api/vendor/availability/{id}
    $app->patch('/api/vendor/availability/{id}', function (Request $request, Response $response, array $args) use ($controller) {
        return $controller->update($request, $response, $args);
    })->add(new AuthMiddleware());
    
    // PROTECTED: Delete availability (vendor only, own records)
    // DELETE /api/vendor/availability/{id}
    $app->delete('/api/vendor/availability/{id}', function (Request $request, Response $response, array $args) use ($controller) {
        return $controller->destroy($request, $response, $args);
    })->add(new AuthMiddleware());
    
};