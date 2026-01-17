<?php
/**
 * ============================================
 * BOOKING ROUTES
 * ============================================
 * API routes for booking management
 * Developer: Ryan (01-17_Ryan_Manual-Booking)
 * ============================================
 */

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;
use Src\Controllers\BookingController;

return function (App $app) {
    
    $bookingController = new BookingController();

    /* ===========================================================
     * JSON RESPONSE HELPER (WITH CORS HEADERS)
     * =========================================================== */
    $json = function (Response $res, array $payload, int $status = 200) {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';

        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));

        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withStatus($status);
    };

    /* ===========================================================
     * OPTIONS HANDLERS FOR PREFLIGHT REQUESTS
     * =========================================================== */
    $app->options('/api/bookings/create', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/bookings/user', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/bookings/vendor', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/bookings/{id}', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/bookings/{id}/status', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    $app->options('/api/bookings/{id}/cancel', function (Request $req, Response $res) use ($json) {
        return $json($res, ['success' => true]);
    });

    /* ===========================================================
     * BOOKING ENDPOINTS
     * =========================================================== */

    /**
     * CREATE BOOKING (UC05)
     * POST /api/bookings/create
     * Client creates a booking request
     */
    $app->post('/api/bookings/create', [$bookingController, 'createBooking'])
        ->add(new AuthMiddleware());

    /**
     * GET USER'S BOOKINGS (CLIENT VIEW)
     * GET /api/bookings/user
     * Optional: ?status=Pending
     */
    $app->get('/api/bookings/user', [$bookingController, 'getUserBookings'])
        ->add(new AuthMiddleware());

    /**
     * GET VENDOR'S BOOKING REQUESTS (VENDOR VIEW)
     * GET /api/bookings/vendor
     * Optional: ?status=Pending
     * Shows all bookings where the vendor is the service provider
     */
    $app->get('/api/bookings/vendor', [$bookingController, 'getVendorBookings'])
        ->add(new AuthMiddleware());

    /**
     * GET BOOKING DETAILS
     * GET /api/bookings/{id}
     */
    $app->get('/api/bookings/{id}', [$bookingController, 'getBookingDetails'])
        ->add(new AuthMiddleware());

    /**
     * UPDATE BOOKING STATUS (VENDOR ACTION)
     * PATCH /api/bookings/{id}/status
     * Body: { "status": "Confirmed" | "Declined" }
     * Vendor accepts or declines the booking request
     */
    $app->patch('/api/bookings/{id}/status', [$bookingController, 'updateBookingStatus'])
        ->add(new AuthMiddleware());

    /**
     * CANCEL BOOKING (CLIENT ACTION)
     * PATCH /api/bookings/{id}/cancel
     * Client cancels their own booking
     */
    $app->patch('/api/bookings/{id}/cancel', [$bookingController, 'cancelBooking'])
        ->add(new AuthMiddleware());
};