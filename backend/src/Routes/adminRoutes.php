<?php
use Slim\App;
use Illuminate\Database\Capsule\Manager as DB;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    /** ---------------------------------------------------------
     *  ADMIN: Vendor Applications
     *  --------------------------------------------------------- */

    // List vendor applications (Pending by default; add ?all=1 to see all)
    $app->get('/api/admin/vendor-applications', function (Request $req, Response $res) {
        try {
            $all = ($req->getQueryParams()['all'] ?? '') === '1';

            $q = DB::table('vendor_application as va')
                ->select(
                    'va.id',
                    'va.user_id',
                    'va.business_name',
                    'va.category',
                    'va.address',
                    'va.description',
                    'va.pricing',
                    'va.created_at',
                    DB::raw('COALESCE(va.status, "Pending") as status'),
                    'c.first_name',
                    'c.last_name',
                    'c.email',
                    'c.username'
                )
                ->leftJoin('credential as c', 'va.user_id', '=', 'c.id')
                ->orderBy('va.created_at', 'desc');

            if (!$all) {
                $q->where(function($w){
                    $w->whereNull('va.status')->orWhere('va.status','Pending');
                });
            }

            $rows = $q->get();

            $res->getBody()->write(json_encode([
                'success' => true,
                'applications' => $rows
            ]));
            return $res->withHeader('Content-Type', 'application/json');
        } catch (\Throwable $e) {
            error_log('ADMIN_LIST_ERROR: ' . $e->getMessage());
            $res->getBody()->write(json_encode(['success' => false, 'error' => 'Server error fetching vendor applications']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());

    // Approve / Deny vendor application
    $app->post('/api/admin/vendor-application/decision', function (Request $req, Response $res) {
        try {
            $data = (array)$req->getParsedBody();
            $appId  = (int)($data['id'] ?? 0);
            $action = strtolower(trim($data['action'] ?? ''));

            if (!$appId || !in_array($action, ['approve','deny'], true)) {
                $res->getBody()->write(json_encode(['success'=>false,'error'=>'Invalid request']));
                return $res->withHeader('Content-Type','application/json')->withStatus(400);
            }

            // fetch application + user
            $appRow = DB::table('vendor_application')->where('id',$appId)->first();
            if (!$appRow) {
                $res->getBody()->write(json_encode(['success'=>false,'error'=>'Application not found']));
                return $res->withHeader('Content-Type','application/json')->withStatus(404);
            }

            if ($action === 'deny') {
                // remove from queue entirely
                DB::table('vendor_application')->where('id',$appId)->delete();
                $res->getBody()->write(json_encode(['success'=>true,'message'=>'Application denied and removed.']));
                return $res->withHeader('Content-Type','application/json');
            }

            // APPROVE
            DB::transaction(function () use ($appRow, $appId) {
                // get applicant email (from credential)
                $email = DB::table('credential')->where('id', $appRow->user_id)->value('email') ?: '';

                // insert approved provider (FK now points to credential.id per migration above)
                DB::table('eventserviceprovider')->insert([
                    'UserID'            => $appRow->user_id,             // credential.id
                    'BusinessName'      => $appRow->business_name,
                    'BusinessEmail'     => substr($email, 0, 50),       // column is VARCHAR(50)
                    'BusinessAddress'   => $appRow->address,
                    'ApplicationStatus' => 'Approved',
                    'DateApplied'       => date('Y-m-d H:i:s'),
                    'DateApproved'      => date('Y-m-d H:i:s'),
                ]);

                // promote role to supplier (1)
                DB::table('credential')->where('id', $appRow->user_id)->update(['role' => 1]);

                // mark approved or remove from queue (choose one)
                // A) Keep history:
                DB::table('vendor_application')->where('id',$appId)->update(['status'=>'Approved']);
                // B) Or delete to keep the list clean:
                // DB::table('vendor_application')->where('id',$appId)->delete();
            });

            $res->getBody()->write(json_encode(['success'=>true,'message'=>'Vendor approved and promoted to supplier.']));
            return $res->withHeader('Content-Type','application/json');
        } catch (\Throwable $e) {
            error_log('ADMIN_DECISION_ERROR: '.$e->getMessage());
            $res->getBody()->write(json_encode(['success'=>false,'error'=>'Server error making decision']));
            return $res->withHeader('Content-Type','application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());

    /** ---------------------------------------------------------
     *  ADMIN: Feedback Viewer
     *  --------------------------------------------------------- */
    $app->get('/api/admin/feedbacks', function (Request $req, Response $res) {
        try {
            $rows = DB::table('feedback as f')
                ->select(
                    'f.id',
                    'f.user_id',
                    'f.message',
                    'f.created_at',
                    'c.first_name',
                    'c.last_name',
                    'c.email',
                    'c.username'
                )
                ->leftJoin('credential as c', 'f.user_id', '=', 'c.id')
                ->orderBy('f.created_at','desc')
                ->get();

            $res->getBody()->write(json_encode(['success'=>true,'feedbacks'=>$rows]));
            return $res->withHeader('Content-Type','application/json');
        } catch (\Throwable $e) {
            error_log('ADMIN_FEEDBACK_LIST_ERROR: '.$e->getMessage());
            $res->getBody()->write(json_encode(['success'=>false,'error'=>'Server error fetching feedback']));
            return $res->withHeader('Content-Type','application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());

    /** ---------------------------------------------------------
     *  ADMIN: Users — list & promote/demote roles
     *  --------------------------------------------------------- */
    $app->get('/api/admin/users', function (Request $req, Response $res) {
        try {
            $rows = DB::table('credential')
                ->select('id','first_name','last_name','email','username','role','created_at')
                ->orderBy('created_at','desc')
                ->get();

            $res->getBody()->write(json_encode(['success'=>true,'users'=>$rows]));
            return $res->withHeader('Content-Type','application/json');
        } catch (\Throwable $e) {
            error_log('ADMIN_USERS_LIST_ERROR: '.$e->getMessage());
            $res->getBody()->write(json_encode(['success'=>false,'error'=>'Server error fetching users']));
            return $res->withHeader('Content-Type','application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());

    $app->post('/api/admin/users/role', function (Request $req, Response $res) {
        try {
            $data = (array)$req->getParsedBody();
            $userId = (int)($data['user_id'] ?? 0);
            $role   = (int)($data['role'] ?? -1);
            if (!$userId || !in_array($role, [0,1,2], true)) {
                $res->getBody()->write(json_encode(['success'=>false,'error'=>'Invalid payload']));
                return $res->withHeader('Content-Type','application/json')->withStatus(400);
            }

            $exists = DB::table('credential')->where('id',$userId)->exists();
            if (!$exists) {
                $res->getBody()->write(json_encode(['success'=>false,'error'=>'User not found']));
                return $res->withHeader('Content-Type','application/json')->withStatus(404);
            }

            DB::table('credential')->where('id',$userId)->update(['role'=>$role]);

            $res->getBody()->write(json_encode(['success'=>true,'message'=>'User role updated']));
            return $res->withHeader('Content-Type','application/json');
        } catch (\Throwable $e) {
            error_log('ADMIN_USER_ROLE_ERROR: '.$e->getMessage());
            $res->getBody()->write(json_encode(['success'=>false,'error'=>'Server error updating role']));
            return $res->withHeader('Content-Type','application/json')->withStatus(500);
        }
    })->add(new AuthMiddleware());
};
