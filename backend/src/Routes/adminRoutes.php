<?php

use Slim\App;
use Illuminate\Database\Capsule\Manager as DB;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    /* =========================================================
     * ADMIN: VENDOR APPLICATIONS
     * ========================================================= */
    $app->get('/api/admin/vendor-applications', function (Request $req, Response $res) {

        try {
            $all = ($req->getQueryParams()['all'] ?? '') === '1';

            $query = DB::table('vendor_application as va')
                ->leftJoin('credential as c', 'va.user_id', '=', 'c.id')
                ->select(
                    'va.id',
                    'va.user_id',
                    'va.business_name',
                    'va.category',
                    'va.contact_email',
                    'va.address',
                    'va.description',
                    'va.pricing',
                    'va.created_at',
                    DB::raw('COALESCE(va.status, "Pending") as status'),

                    // Document URLs
                    'va.permits',
                    'va.gov_id',
                    'va.portfolio',

                    // ✅ NEW: Venue-specific fields
                    'va.venue_subcategory',
                    'va.venue_capacity',
                    'va.venue_amenities',
                    'va.venue_operating_hours',
                    'va.venue_parking',

                    // User info
                    'c.first_name',
                    'c.last_name',
                    'c.username',
                    'c.email'
                )
                ->orderBy('va.created_at', 'desc');

            if (!$all) {
                $query->where(function ($w) {
                    $w->whereNull('va.status')
                      ->orWhere('va.status', 'Pending');
                });
            }

            $rows = $query->get();

            $res->getBody()->write(json_encode([
                'success'      => true,
                'applications' => $rows
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_LIST_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Server error fetching vendor applications'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());

    /* =========================================================
     * ADMIN: APPROVE / DENY VENDOR - ✅ FIXED FOR VENUES
     * ========================================================= */
    $app->post('/api/admin/vendor-application/decision', function (Request $req, Response $res) {

        try {
            $data   = (array) $req->getParsedBody();
            $appId  = (int) ($data['id'] ?? 0);
            $action = strtolower(trim($data['action'] ?? ''));

            if (!$appId || !in_array($action, ['approve', 'deny'], true)) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Invalid request'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
            }

            $appRow = DB::table('vendor_application')->where('id', $appId)->first();

            if (!$appRow) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Application not found'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }

            if ($action === 'deny') {
                DB::table('vendor_application')->where('id', $appId)->delete();

                $res->getBody()->write(json_encode([
                    'success' => true,
                    'message' => 'Application denied and removed.'
                ]));

                return $res->withHeader('Content-Type', 'application/json');
            }

            // ✅ APPROVE ACTION - FIXED TO HANDLE VENUE FIELDS
            DB::transaction(function () use ($appRow) {

                $businessEmail = $appRow->contact_email;

                if (!$businessEmail) {
                    $businessEmail = DB::table('credential')
                        ->where('id', $appRow->user_id)
                        ->value('email');

                    if ($businessEmail) {
                        DB::table('vendor_application')
                            ->where('id', $appRow->id)
                            ->update(['contact_email' => $businessEmail]);
                    }
                }

                if (!$businessEmail) {
                    throw new \Exception('Business email missing');
                }

                // ✅ NEW: Prepare insert data with venue fields if category is Venue
                $insertData = [
                    'UserID'            => $appRow->user_id,
                    'BusinessName'      => $appRow->business_name,
                    'Category'          => $appRow->category,
                    'BusinessEmail'     => $businessEmail,
                    'BusinessAddress'   => $appRow->address,
                    'Description'       => $appRow->description,
                    'Pricing'           => $appRow->pricing,
                    'ApplicationStatus' => 'Approved',
                    'DateApplied'       => $appRow->created_at,
                    'DateApproved'      => date('Y-m-d H:i:s'),
                ];

                // ✅ NEW: Add venue-specific fields if this is a venue application
                if (strtolower(trim($appRow->category)) === 'venue') {
                    $insertData['venue_subcategory'] = $appRow->venue_subcategory ?? null;
                    $insertData['venue_capacity'] = $appRow->venue_capacity ?? null;
                    $insertData['venue_amenities'] = $appRow->venue_amenities ?? null;
                    $insertData['venue_operating_hours'] = $appRow->venue_operating_hours ?? null;
                    $insertData['venue_parking'] = $appRow->venue_parking ?? null;
                }

                // ✅ NEW: Add document URLs (permits, gov_id, portfolio)
                if (!empty($appRow->permits)) {
                    $insertData['Permits'] = $appRow->permits;
                }
                if (!empty($appRow->gov_id)) {
                    $insertData['GovID'] = $appRow->gov_id;
                }
                if (!empty($appRow->portfolio)) {
                    $insertData['HeroImageUrl'] = $appRow->portfolio; // Use portfolio as hero image
                }

                DB::table('eventserviceprovider')->insert($insertData);

                // Update user role to supplier (role 1)
                DB::table('credential')
                    ->where('id', $appRow->user_id)
                    ->update(['role' => 1]);

                // Mark application as approved
                DB::table('vendor_application')
                    ->where('id', $appRow->id)
                    ->update(['status' => 'Approved']);
            });

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'Vendor approved and promoted to supplier.'
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_DECISION_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => $e->getMessage()
            ]));

            return $res->withHeader('Content-Type', 'application/json')->withStatus(500);
        }

    })->add(new AuthMiddleware());

    /* =========================================================
     * ADMIN: FEEDBACKS
     * ========================================================= */
    $app->get('/api/admin/feedbacks', function (Request $req, Response $res) {

        $rows = DB::table('feedback as f')
            ->leftJoin('credential as c', 'f.user_id', '=', 'c.id')
            ->select('f.id','f.message','f.created_at','c.first_name','c.last_name','c.username')
            ->orderBy('f.created_at', 'desc')
            ->get();

        $res->getBody()->write(json_encode([
            'success'   => true,
            'feedbacks'=> $rows
        ]));

        return $res->withHeader('Content-Type', 'application/json');

    })->add(new AuthMiddleware());

    /* =========================================================
     * ADMIN: USERS
     * ========================================================= */
    $app->get('/api/admin/users', function (Request $req, Response $res) {

        $rows = DB::table('credential')
            ->select('id','first_name','last_name','email','username','role','created_at')
            ->orderBy('created_at', 'desc')
            ->get();

        $res->getBody()->write(json_encode([
            'success' => true,
            'users'   => $rows
        ]));

        return $res->withHeader('Content-Type', 'application/json');

    })->add(new AuthMiddleware());

    /* =========================================================
     * ADMIN: UPDATE USER ROLE
     * ========================================================= */
    $app->post('/api/admin/users/role', function (Request $req, Response $res) {

        $data = (array) $req->getParsedBody();

        DB::table('credential')
            ->where('id', (int) $data['user_id'])
            ->update(['role' => (int) $data['role']]);

        $res->getBody()->write(json_encode(['success' => true]));
        return $res->withHeader('Content-Type', 'application/json');

    })->add(new AuthMiddleware());

};