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
use Src\Middleware\AuthMiddleware;
use Src\Controllers\BookingController;

return function (App $app) {
    
    $bookingController = new BookingController();

    /**
     * CREATE BOOKING (UC05)
     * POST /api/bookings/create
     */
    $app->post('/api/bookings/create', [$bookingController, 'createBooking'])
        ->add(new AuthMiddleware());

    /**
     * GET USER'S BOOKINGS
     * GET /api/bookings/user
     * Optional: ?status=Pending
     */
    $app->get('/api/bookings/user', [$bookingController, 'getUserBookings'])
        ->add(new AuthMiddleware());

    /**
     * GET VENDOR'S BOOKINGS
     * GET /api/bookings/vendor
     * Optional: ?status=Pending
     */
    $app->get('/api/bookings/vendor', [$bookingController, 'getVendorBookings'])
        ->add(new AuthMiddleware());

    /**
     * GET BOOKING DETAILS
     * GET /api/bookings/{id}
     */
    $app->get('/api/bookings/{id}', [$bookingController, 'getBookingDetails'])
        ->add(new AuthMiddleware());
};