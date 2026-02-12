<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;
use Src\Controllers\VenueController;
use Src\Controllers\VenueBookingController;
use Src\Controllers\VenueAvailabilityController;
use Illuminate\Database\Capsule\Manager as DB;

return function (App $app) {

    // =========================================================
    // VENUE LISTING MANAGEMENT ROUTES
    // =========================================================

    $app->get('/api/venue/my-listings', fn($r, $s) =>
        (new VenueController)->getMyListings($r, $s)
    )->add(new AuthMiddleware());

    $app->post('/api/venue/listings', fn($r, $s) =>
        (new VenueController)->createListing($r, $s)
    )->add(new AuthMiddleware());

    $app->put('/api/venue/listings/{id}', fn($r, $s, $a) =>
        (new VenueController)->updateListing($r, $s, $a)
    )->add(new AuthMiddleware());

    $app->delete('/api/venue/listings/{id}', fn($r, $s, $a) =>
        (new VenueController)->deleteListing($r, $s, $a)
    )->add(new AuthMiddleware());

    // =========================================================
    // PUBLIC VENUE ROUTES
    // =========================================================

    //  Public venue listing with firebase_uid join for chat functionality
    $app->get('/api/venues', function (Request $r, Response $s) {
        $venues = DB::table('venue_listings as v')
            ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
            ->select(
                'v.*', 
                'c.firebase_uid',
                DB::raw('CONCAT(c.first_name," ",c.last_name) as owner_name')
            )
            ->where('v.status', 'Active')
            ->orderByDesc('v.created_at')
            ->get()
            ->map(fn($v) => ($v->gallery = json_decode($v->gallery ?? '[]', true)) ? $v : $v);

        $s->getBody()->write(json_encode(['success' => true, 'venues' => $venues]));
        return $s->withHeader('Content-Type', 'application/json');
    });

    //  Public venue detail
    $app->get('/api/venues/{id}', function (Request $r, Response $s, $a) {
        $venue = DB::table('venue_listings as v')
            ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
            ->select('v.*', 'c.firebase_uid', DB::raw('CONCAT(c.first_name," ",c.last_name) as owner_name'))
            ->where('v.id', (int)$a['id'])
            ->first();

        if (!$venue) {
            return $s->withStatus(404);
        }

        $venue->gallery = json_decode($venue->gallery ?? '[]', true);

        $s->getBody()->write(json_encode(['success' => true, 'venue' => $venue]));
        return $s->withHeader('Content-Type', 'application/json');
    });

    // =========================================================
    // VENUE BOOKING ROUTES
    // =========================================================

    $venueBookingController = new VenueBookingController();

    // Create venue booking
    $app->post('/api/venue-bookings/create', [$venueBookingController, 'createBooking'])
        ->add(new AuthMiddleware());

    // Get user's venue bookings
    $app->get('/api/venue-bookings/user', [$venueBookingController, 'getUserVenueBookings'])
        ->add(new AuthMiddleware());

    // Get venue owner's bookings
    $app->get('/api/venue-bookings/owner', [$venueBookingController, 'getVenueOwnerBookings'])
        ->add(new AuthMiddleware());

    // Get specific venue booking details
    $app->get('/api/venue-bookings/{id}', [$venueBookingController, 'getVenueBookingDetails'])
        ->add(new AuthMiddleware());

    // Update booking status (venue owner)
    $app->patch('/api/venue-bookings/{id}/status', [$venueBookingController, 'updateBookingStatus'])
        ->add(new AuthMiddleware());

    // Cancel booking (client)
    $app->patch('/api/venue-bookings/{id}/cancel', [$venueBookingController, 'cancelBooking'])
        ->add(new AuthMiddleware());

    // Reschedule booking (client)
    $app->patch('/api/venue-bookings/{id}/reschedule', [$venueBookingController, 'rescheduleBooking'])
        ->add(new AuthMiddleware());

    // Check venue availability (public)
    $app->get('/api/venues/{id}/availability', [$venueBookingController, 'checkVenueAvailability']);

    // =========================================================
    // VENUE AVAILABILITY CALENDAR ROUTES
    // =========================================================

    $venueAvailabilityController = new VenueAvailabilityController();

    // PUBLIC: Get availability for a venue (read-only calendar)
    $app->get('/api/venue/availability/{venue_id}', function (Request $r, Response $s, $a) use ($venueAvailabilityController) {
        return $venueAvailabilityController->index($r, $s, $a);
    });

    // PROTECTED: Create availability (venue owner only)
    $app->post('/api/venue/availability', [$venueAvailabilityController, 'store'])
        ->add(new AuthMiddleware());

    // PROTECTED: Update availability (venue owner only)
    $app->patch('/api/venue/availability/{id}', function (Request $r, Response $s, $a) use ($venueAvailabilityController) {
        return $venueAvailabilityController->update($r, $s, $a);
    })->add(new AuthMiddleware());

    // PROTECTED: Delete availability (venue owner only)
    $app->delete('/api/venue/availability/{id}', function (Request $r, Response $s, $a) use ($venueAvailabilityController) {
        return $venueAvailabilityController->destroy($r, $s, $a);
    })->add(new AuthMiddleware());
};
