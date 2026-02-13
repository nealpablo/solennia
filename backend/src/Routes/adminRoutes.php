<?php

use Slim\App;
use Illuminate\Database\Capsule\Manager as DB;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    // Helper function to send notifications
    $sendNotification = function ($userId, $type, $title, $message) {
        try {
            DB::table('notifications')->insert([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'read' => false,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            error_log("Failed to send notification: " . $e->getMessage());
        }
    };

    // Admin: Get vendor applications
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
                    'va.permits',
                    'va.gov_id',
                    'va.portfolio',
                    'va.venue_subcategory',
                    'va.venue_capacity',
                    'va.venue_amenities',
                    'va.venue_operating_hours',
                    'va.venue_parking',
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

    // Admin: Approve/deny vendor application
    $app->post('/api/admin/vendor-application/decision', function (Request $req, Response $res) use ($sendNotification) {

        try {
            $data   = (array) $req->getParsedBody();
            $appId  = (int) ($data['id'] ?? 0);
            $action = strtolower(trim($data['action'] ?? ''));
            $reason = trim($data['reason'] ?? '');

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
                // Update application status
                DB::table('vendor_application')
                    ->where('id', $appId)
                    ->update([
                        'status' => 'Denied',
                        'rejection_reason' => $reason
                    ]);

                // Send detailed denial notification with reason
                $notificationMessage = $reason 
                    ? "Your vendor application has been denied.\n\nReason: {$reason}\n\nYou may reapply after addressing the concerns mentioned above."
                    : "Your vendor application has been denied. Please contact support for more information.";

                $sendNotification(
                    $appRow->user_id,
                    'application_denied',
                    '❌ Application Denied',
                    $notificationMessage
                );

                $res->getBody()->write(json_encode([
                    'success' => true,
                    'message' => 'Application denied and notification sent to applicant.'
                ]));

                return $res->withHeader('Content-Type', 'application/json');
            }

            // Approve application
            DB::transaction(function () use ($appRow, $sendNotification) {

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

                // Update user role to supplier (role 1)
                DB::table('credential')
                    ->where('id', $appRow->user_id)
                    ->update(['role' => 1]);

                // Mark application as approved
                DB::table('vendor_application')
                    ->where('id', $appRow->id)
                    ->update(['status' => 'Approved']);

                // Send approval notification
                $sendNotification(
                    $appRow->user_id,
                    'application_approved',
                    'Application Approved! 🎉',
                    'Congratulations! Your vendor application has been approved. You can now access your vendor dashboard and complete your profile setup.'
                );

                error_log("VENDOR_APPROVED: UserID={$appRow->user_id}, Category={$appRow->category}. User will complete profile setup.");
            });

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'Vendor approved. They can now complete their profile setup.'
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_DECISION_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Failed to process application: ' . $e->getMessage()
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());

    // Admin: Get feedbacks
    $app->get('/api/admin/feedbacks', function (Request $req, Response $res) {

        try {
            $rows = DB::table('feedback as f')
                ->leftJoin('credential as c', 'f.user_id', '=', 'c.id')
                ->select(
                    'f.id',
                    'f.message',
                    'f.created_at',
                    'c.first_name',
                    'c.last_name',
                    'c.username'
                )
                ->orderBy('f.created_at', 'desc')
                ->get();

            $res->getBody()->write(json_encode([
                'success'   => true,
                'feedbacks' => $rows
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_FEEDBACKS_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Failed to fetch feedbacks'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());

    // Admin: Get all users
    $app->get('/api/admin/users', function (Request $req, Response $res) {

        try {
            $users = DB::table('credential')
                ->select('id', 'first_name', 'last_name', 'username', 'email', 'role', 'is_verified', 'created_at')
                ->orderByDesc('created_at')
                ->get();

            $res->getBody()->write(json_encode([
                'success' => true,
                'users'   => $users
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_USERS_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Failed to fetch users'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());

    // Admin: Update user role
    $app->post('/api/admin/users/role', function (Request $req, Response $res) {

        try {
            $data = (array) $req->getParsedBody();
            $userId = (int) ($data['user_id'] ?? 0);
            $newRole = (int) ($data['role'] ?? -1);

            if (!$userId || $newRole < 0 || $newRole > 2) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Invalid user or role'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
            }

            $userExists = DB::table('credential')
                ->where('id', $userId)
                ->exists();

            if (!$userExists) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'User not found'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }

            DB::table('credential')
                ->where('id', $userId)
                ->update(['role' => $newRole]);

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'User role updated'
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_UPDATE_ROLE_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Failed to update role'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());

    // Admin: Delete user
    $app->delete('/api/admin/users/{userId}', function (Request $req, Response $res, array $args) {

        try {
            $userId = (int) ($args['userId'] ?? 0);

            if (!$userId) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Invalid user ID'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
            }

            $userExists = DB::table('credential')
                ->where('id', $userId)
                ->exists();

            if (!$userExists) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'User not found'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }

            DB::table('credential')->where('id', $userId)->delete();

            $res->getBody()->write(json_encode([
                'success' => true,
                'message' => 'User deleted'
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ADMIN_DELETE_USER_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Failed to delete user'
            ]));

            return $res
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }

    })->add(new AuthMiddleware());

};