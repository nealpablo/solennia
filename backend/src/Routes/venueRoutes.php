<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;
use Src\Controllers\VenueController;
use Illuminate\Database\Capsule\Manager as DB;

return function (App $app) {

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

    //  Added firebase_uid join for chat functionality
    $app->get('/api/venues', function (Request $r, Response $s) {
        $venues = DB::table('venue_listings as v')
            ->leftJoin('credential as c', 'v.user_id', '=', 'c.id')
            ->select(
                'v.*', 
                'c.firebase_uid',  // ← ADDED THIS
                DB::raw('CONCAT(c.first_name," ",c.last_name) as owner_name')  // ← ADDED THIS
            )
            ->where('v.status', 'Active')
            ->orderByDesc('v.created_at')
            ->get()
            ->map(fn($v) => ($v->gallery = json_decode($v->gallery ?? '[]', true)) ? $v : $v);

        $s->getBody()->write(json_encode(['success' => true, 'venues' => $venues]));
        return $s->withHeader('Content-Type', 'application/json');
    });

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
};