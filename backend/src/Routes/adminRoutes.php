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
                    'va.contact_number',
                    'va.region',
                    'va.city',
                    'va.selfie_with_id',
                    'va.social_links',
                    'va.sample_photos',
                    'va.menu_list',
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
                DB::table('vendor_application')
                    ->where('id', $appId)
                    ->update([
                        'status' => 'Denied',
                        'rejection_reason' => $reason
                    ]);

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

                // Update user role to supplier (role 1), clear any previous suspension
                DB::table('credential')
                    ->where('id', $appRow->user_id)
                    ->update([
                        'role'         => 1,
                        'suspended_at' => null,
                        'suspended_by' => null,
                    ]);

                DB::table('vendor_application')
                    ->where('id', $appRow->id)
                    ->update(['status' => 'Approved']);

                $existingProfile = DB::table('event_service_provider')
                    ->where('UserID', $appRow->user_id)
                    ->first();

                if (!$existingProfile) {
                    DB::table('event_service_provider')->insert([
                        'UserID'            => $appRow->user_id,
                        'BusinessName'      => $appRow->business_name,
                        'Category'          => $appRow->category,
                        'BusinessEmail'     => $appRow->contact_email ?? $businessEmail,
                        'BusinessAddress'   => $appRow->address,
                        'Description'       => $appRow->description,
                        'Pricing'           => $appRow->pricing,
                        'ApplicationStatus' => 'Approved',
                        'region'            => $appRow->region,
                        'city'              => $appRow->city,
                        'contact_number'    => $appRow->contact_number,
                        'bio'               => $appRow->description ?? 'Welcome to my business!',
                        'services'          => $appRow->category ?? 'General Services',
                        'verification_score'=> 50,
                        'DateApproved'      => date('Y-m-d H:i:s')
                    ]);
                }

                $sendNotification(
                    $appRow->user_id,
                    'application_approved',
                    'Application Approved! 🎉',
                    'Congratulations! Your vendor application has been approved. You can now access your vendor dashboard and complete your profile setup.'
                );

                error_log("VENDOR_APPROVED: UserID={$appRow->user_id}, Category={$appRow->category}.");
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
                ->select(
                    'id', 'first_name', 'last_name', 'username', 'email',
                    'role', 'is_verified', 'created_at',
                    'warning_count', 'suspended_at', 'suspended_by'
                )
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
    // FIX: Now also deactivates/reactivates listings and tracks suspended_at
    $app->post('/api/admin/users/role', function (Request $req, Response $res) use ($sendNotification) {

        try {
            $user    = $req->getAttribute('user');
            $adminId = $user->mysql_id ?? null;

            $data    = (array) $req->getParsedBody();
            $userId  = (int) ($data['user_id'] ?? 0);
            $newRole = (int) ($data['role'] ?? -1);

            if (!$userId || $newRole < 0 || $newRole > 2) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'Invalid user or role'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
            }

            $targetUser = DB::table('credential')->where('id', $userId)->first();

            if (!$targetUser) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error'   => 'User not found'
                ]));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }

            DB::transaction(function () use ($userId, $newRole, $adminId, $targetUser, $sendNotification) {

                $credentialUpdate = ['role' => $newRole];

                // --- SUSPENDING (demoting to client role 0) ---
                if ($newRole === 0 && $targetUser->role === 1) {
                    // Track when suspension happened and who did it
                    $credentialUpdate['suspended_at'] = date('Y-m-d H:i:s');
                    $credentialUpdate['suspended_by'] = $adminId;

                    // Deactivate all vendor listings
                    DB::table('vendor_listings')
                        ->where('user_id', $userId)
                        ->update(['status' => 'Inactive', 'updated_at' => date('Y-m-d H:i:s')]);

                    // Deactivate all venue listings
                    DB::table('venue_listings')
                        ->where('user_id', $userId)
                        ->update(['status' => 'Inactive', 'updated_at' => date('Y-m-d H:i:s')]);

                    // Notify the supplier
                    $sendNotification(
                        $userId,
                        'account_suspended',
                        '⚠️ Account Suspended',
                        'Your supplier account has been suspended by an administrator. Your listings have been deactivated. If you believe this is a mistake, please contact support.'
                    );

                    error_log("SUPPLIER_SUSPENDED: UserID={$userId} suspended by AdminID={$adminId}");
                }

                // --- REINSTATING (promoting back to supplier role 1) ---
                if ($newRole === 1 && $targetUser->role === 0) {
                    // Clear suspension timestamps
                    $credentialUpdate['suspended_at'] = null;
                    $credentialUpdate['suspended_by'] = null;

                    // Reactivate their listings
                    DB::table('vendor_listings')
                        ->where('user_id', $userId)
                        ->update(['status' => 'Active', 'updated_at' => date('Y-m-d H:i:s')]);

                    DB::table('venue_listings')
                        ->where('user_id', $userId)
                        ->update(['status' => 'Active', 'updated_at' => date('Y-m-d H:i:s')]);

                    // Notify the supplier they've been reinstated
                    $sendNotification(
                        $userId,
                        'account_reinstated',
                        '✅ Account Reinstated',
                        'Your supplier account has been reinstated. Your listings are now active again. Please ensure you follow platform guidelines going forward.'
                    );

                    error_log("SUPPLIER_REINSTATED: UserID={$userId} reinstated by AdminID={$adminId}");
                }

                DB::table('credential')
                    ->where('id', $userId)
                    ->update($credentialUpdate);
            });

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

    // Admin: Issue a warning to a supplier
    // POST /api/admin/suppliers/{userId}/warn
    // Increments warning_count. At 3 warnings, auto-suspends.
    $app->post('/api/admin/suppliers/{userId}/warn', function (Request $req, Response $res, array $args) use ($sendNotification) {

        try {
            $adminUser = $req->getAttribute('user');
            $adminId   = $adminUser->mysql_id ?? null;

            // Verify admin
            $adminProfile = DB::table('credential')->where('id', $adminId)->first();
            if (!$adminProfile || (int)($adminProfile->role ?? 0) !== 2) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'Access denied - Admin only']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(403);
            }

            $userId   = (int) ($args['userId'] ?? 0);
            $data     = (array) $req->getParsedBody();
            $reportId = (int) ($data['report_id'] ?? 0);
            $reason   = trim($data['reason'] ?? '');

            $supplier = DB::table('credential')->where('id', $userId)->first();

            if (!$supplier || $supplier->role !== 1) {
                $res->getBody()->write(json_encode(['success' => false, 'error' => 'Supplier not found']));
                return $res->withHeader('Content-Type', 'application/json')->withStatus(404);
            }

            $autoSuspended = false;

            DB::transaction(function () use ($userId, $adminId, $reportId, $reason, $supplier, $sendNotification, &$autoSuspended) {

                $newWarningCount = ($supplier->warning_count ?? 0) + 1;

                DB::table('credential')
                    ->where('id', $userId)
                    ->update(['warning_count' => $newWarningCount]);

                // Update the linked report if provided
                if ($reportId) {
                    DB::table('supplier_reports')
                        ->where('ID', $reportId)
                        ->update([
                            'Status'     => 'Resolved',
                            'AdminNotes' => ($reason ? $reason . "\n" : '') . "[System] Warning #{$newWarningCount} issued.",
                            'ReviewedBy' => $adminId,
                            'ReviewedAt' => DB::raw('NOW()'),
                            'UpdatedAt'  => DB::raw('NOW()')
                        ]);
                }

                // Notify supplier of warning
                $warningMsg = $newWarningCount < 3
                    ? "You have received warning #{$newWarningCount} on your account." .
                      ($reason ? " Reason: {$reason}." : '') .
                      " Please note: 3 warnings will result in automatic suspension."
                    : "You have received warning #{$newWarningCount}.";

                $sendNotification($userId, 'account_warning', "⚠️ Account Warning #{$newWarningCount}", $warningMsg);

                // AUTO-SUSPEND at 3 warnings
                if ($newWarningCount >= 3) {
                    $autoSuspended = true;

                    DB::table('credential')
                        ->where('id', $userId)
                        ->update([
                            'role'         => 0,
                            'suspended_at' => date('Y-m-d H:i:s'),
                            'suspended_by' => $adminId,
                        ]);

                    DB::table('vendor_listings')
                        ->where('user_id', $userId)
                        ->update(['status' => 'Inactive', 'updated_at' => date('Y-m-d H:i:s')]);

                    DB::table('venue_listings')
                        ->where('user_id', $userId)
                        ->update(['status' => 'Inactive', 'updated_at' => date('Y-m-d H:i:s')]);

                    $sendNotification(
                        $userId,
                        'account_suspended',
                        '🚫 Account Suspended',
                        'Your account has been automatically suspended after receiving 3 warnings. All your listings have been deactivated. Contact support if you wish to appeal.'
                    );

                    error_log("AUTO_SUSPENDED: UserID={$userId} suspended after 3 warnings by AdminID={$adminId}");
                }
            });

            $newCount = ($supplier->warning_count ?? 0) + 1;

            $res->getBody()->write(json_encode([
                'success'        => true,
                'message'        => $autoSuspended
                    ? "Warning issued. Supplier has been automatically suspended after reaching 3 warnings."
                    : "Warning #{$newCount} issued to supplier.",
                'warning_count'  => $newCount,
                'auto_suspended' => $autoSuspended,
            ]));

            return $res->withHeader('Content-Type', 'application/json');

        } catch (\Throwable $e) {
            error_log('ISSUE_WARNING_ERROR: ' . $e->getMessage());

            $res->getBody()->write(json_encode([
                'success' => false,
                'error'   => 'Failed to issue warning: ' . $e->getMessage()
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

            $userExists = DB::table('credential')->where('id', $userId)->exists();

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

    // Admin: Get all reports
    $app->get('/api/admin/reports', function (Request $req, Response $res) {
        $controller = new \Src\Controllers\FeedbackController();
        return $controller->getAllReports($req, $res);
    })->add(new AuthMiddleware());

    // Admin: Update report status
    $app->patch('/api/admin/reports/{id}', function (Request $req, Response $res, array $args) {
        $controller = new \Src\Controllers\FeedbackController();
        return $controller->updateReportStatus($req, $res, $args);
    })->add(new AuthMiddleware());

    // Admin: Get dashboard analytics
    $app->get('/api/admin/analytics', function (Request $req, Response $res) {
        $controller = new \Src\Controllers\AdminController();
        return $controller->getAdminAnalytics($req, $res);
    })->add(new AuthMiddleware());

    // Admin: Migrate legacy vendors
    $app->post('/api/admin/migrate-vendors', function (Request $req, Response $res) {
        $controller = new \Src\Controllers\AdminController();
        return $controller->migrateLegacyVendors($req, $res);
    })->add(new AuthMiddleware());

};