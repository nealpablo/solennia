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

    //  Public venue listing
    $app->get('/api/venues', function (Request $r, Response $s) {
        try {
            $venues = DB::table('venue_listings as v')
                ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
                ->select(
                    'v.id',
                    'v.user_id',
                    'v.venue_name as venue_name',
                    'v.venue_name as business_name',
                    'v.venue_subcategory',
                    'v.description',
                    'v.address',
                    'v.venue_capacity',
                    'v.venue_amenities',
                    'v.venue_operating_hours',
                    'v.venue_parking',
                    'v.portfolio as avatar',
                    'v.portfolio as business_logo_url',
                    'v.portfolio',
                    'v.portfolio_image',
                    'v.HeroImageUrl',
                    'v.gallery',
                    'v.pricing',
                    'v.status',
                    'v.created_at',
                    'c.firebase_uid',
                    DB::raw('CONCAT(c.first_name," ",c.last_name) as owner_name')
                )
                ->orderByDesc('v.created_at')
                ->get()
                ->map(function($v) {
                    $v->gallery = json_decode($v->gallery ?? '[]', true);
                    $v->unique_key = 'vl_' . $v->id;
                    return $v;
                });
            
            $s->getBody()->write(json_encode(['success' => true, 'venues' => $venues]));
            return $s->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            error_log('VENUES_API_ERROR: ' . $e->getMessage());
            $s->getBody()->write(json_encode(['success' => false, 'error' => $e->getMessage()]));
            return $s->withHeader('Content-Type', 'application/json')->withStatus(500);
        }
    });

    //  Public venue detail - checks venue_listings first, then falls back to event_service_provider
    $app->get('/api/venues/{id}', function (Request $r, Response $s, $a) {
        $venueId = (int) $a['id'];

        // First try to get from venue_listings
        $venue = DB::table('venue_listings as v')
            ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
            ->select('v.*', 'c.firebase_uid', DB::raw('CONCAT(c.first_name," ",c.last_name) as owner_name'))
            ->where('v.id', $venueId)
            ->first();

        if ($venue) {
            $venue->gallery = json_decode($venue->gallery ?? '[]', true);
            $venue->source = 'venue_listings';
            $s->getBody()->write(json_encode(['success' => true, 'venue' => $venue]));
            return $s->withHeader('Content-Type', 'application/json');
        }

        // Fallback: check event_service_provider (legacy venue data)
        $legacyVenue = DB::table('event_service_provider as esp')
            ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
            ->select(
                'esp.ID as id',
                'esp.UserID as user_id',
                'esp.BusinessName as venue_name',
                'esp.BusinessName as business_name',
                'esp.venue_subcategory',
                'esp.Description as description',
                'esp.BusinessAddress as address',
                'esp.venue_capacity',
                'esp.venue_amenities',
                'esp.venue_operating_hours',
                'esp.venue_parking',
                'esp.avatar as logo',
                'esp.portfolio',
                'esp.portfolio_image',
                'esp.HeroImageUrl',
                'esp.gallery',
                'esp.Pricing as pricing',
                'esp.ApplicationStatus as status',
                'c.firebase_uid',
                DB::raw('CONCAT(c.first_name," ",c.last_name) as owner_name')
            )
            ->where('esp.ID', $venueId)
            ->where('esp.Category', 'Venue')
            ->where('esp.ApplicationStatus', 'Approved')
            ->first();

        if ($legacyVenue) {
            $legacyVenue->gallery = json_decode($legacyVenue->gallery ?? '[]', true);
            $legacyVenue->source = 'event_service_provider';
            $s->getBody()->write(json_encode(['success' => true, 'venue' => $legacyVenue]));
            return $s->withHeader('Content-Type', 'application/json');
        }

        return $s->withStatus(404);
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
