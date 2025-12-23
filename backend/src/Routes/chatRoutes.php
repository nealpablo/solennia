<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    /* ===========================================================
     *  GET USER BY FIREBASE UID (for Firebase chat)
     * =========================================================== */
    $app->get('/api/users/{uid}', function (Request $req, Response $res, array $args) {
        
        $uid = $args['uid'];
        
        try {
            $user = DB::table('credential')
                ->where('firebase_uid', $uid)
                ->first();
            
            if (!$user) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error' => 'User not found'
                ]));
                return $res->withHeader('Content-Type', 'application/json')
                          ->withStatus(404);
            }
            
            $res->getBody()->write(json_encode([
                'success' => true,
                'user' => $user
            ]));
            
            return $res->withHeader('Content-Type', 'application/json');
            
        } catch (\Throwable $e) {
            error_log('USER_FETCH_ERROR: ' . $e->getMessage());
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Server error'
            ]));
            return $res->withHeader('Content-Type', 'application/json')
                      ->withStatus(500);
        }
    });

    /* Get user by MySQL ID (returns firebase_uid) */
    $app->get('/api/users/by-id/{id}', function (Request $req, Response $res, array $args) {
        
        $id = (int)$args['id'];
        
        try {
            $user = DB::table('credential')
                ->where('id', $id)
                ->first();
            
            if (!$user) {
                $res->getBody()->write(json_encode([
                    'success' => false,
                    'error' => 'User not found'
                ]));
                return $res->withHeader('Content-Type', 'application/json')
                          ->withStatus(404);
            }
            
            $res->getBody()->write(json_encode([
                'success' => true,
                'user' => $user
            ]));
            
            return $res->withHeader('Content-Type', 'application/json');
            
        } catch (\Throwable $e) {
            error_log('USER_FETCH_ERROR: ' . $e->getMessage());
            $res->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Server error'
            ]));
            return $res->withHeader('Content-Type', 'application/json')
                      ->withStatus(500);
        }
    });

    /**
     * GET /api/chat/contacts - ✅ FIXED WITH PROPER CONTACT LOGIC
     * 
     * Contact Rules:
     * - Clients (role 0): Only see admin by default
     * - Vendors (role 1): Only see admin by default
     * - Admin (role 2): Only see people who messaged them
     * - Everyone can see admin
     * - Contacts are added when conversation starts
     */
    $app->get('/api/chat/contacts', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        
        $meId = isset($jwt->mysql_id) ? (int)$jwt->mysql_id : 0;
        $myRole = isset($jwt->role) ? (int)$jwt->role : 0;
        
        error_log("CHAT_CONTACTS: User ID={$meId}, Role={$myRole}");

        $contacts = [];

        if ($myRole === 2) {
            // ✅ ADMIN: Only see people who have messaged them
            $userIdsWhoMessaged = DB::table('message')
                ->where('ReceiverID', $meId)
                ->distinct()
                ->pluck('SenderID')
                ->toArray();

            if (count($userIdsWhoMessaged) > 0) {
                $contacts = DB::table('credential')
                    ->select('id', 'first_name', 'last_name', 'username', 'role', 'firebase_uid', 'avatar')
                    ->whereIn('id', $userIdsWhoMessaged)
                    ->orderBy('first_name')
                    ->get()
                    ->toArray();
            }
        } else {
            // ✅ CLIENT (role 0) or VENDOR (role 1): Admin + people they've talked to
            
            // 1. Always include admin(s)
            $admins = DB::table('credential')
                ->select('id', 'first_name', 'last_name', 'username', 'role', 'firebase_uid', 'avatar')
                ->where('role', 2)
                ->get()
                ->toArray();

            // 2. Get people current user has messaged or received messages from
            $conversationPartnerIds = DB::table('message')
                ->where(function ($q) use ($meId) {
                    $q->where('SenderID', $meId)
                      ->orWhere('ReceiverID', $meId);
                })
                ->get()
                ->map(function ($msg) use ($meId) {
                    return $msg->SenderID == $meId ? $msg->ReceiverID : $msg->SenderID;
                })
                ->unique()
                ->filter(function ($id) use ($meId) {
                    return $id != $meId; // Exclude self
                })
                ->toArray();

            $conversationPartners = [];
            if (count($conversationPartnerIds) > 0) {
                $conversationPartners = DB::table('credential')
                    ->select('id', 'first_name', 'last_name', 'username', 'role', 'firebase_uid', 'avatar')
                    ->whereIn('id', $conversationPartnerIds)
                    ->where('role', '!=', 2) // Exclude admins (already added)
                    ->orderBy('first_name')
                    ->get()
                    ->toArray();
            }

            // Combine admins + conversation partners
            $contacts = array_merge($admins, $conversationPartners);
        }

        error_log("CHAT_CONTACTS: Returning " . count($contacts) . " contacts");

        $res->getBody()->write(json_encode([
            'success' => true,
            'contacts' => $contacts
        ]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    /**
     * GET /api/chat/vendors - Get vendor list for browsing
     * This is separate from contacts - used when user wants to find vendors to message
     */
    $app->get('/api/chat/vendors', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        $meId = isset($jwt->mysql_id) ? (int)$jwt->mysql_id : 0;

        $vendors = DB::table('credential')
            ->select('id', 'first_name', 'last_name', 'username', 'role', 'firebase_uid', 'avatar')
            ->where('role', 1) // Only vendors
            ->where('id', '!=', $meId) // Exclude self
            ->orderBy('first_name')
            ->get();

        $res->getBody()->write(json_encode([
            'success' => true,
            'vendors' => $vendors
        ]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    /**
     * GET /api/chat/conversation/{id}
     * Returns all messages between logged-in user and {id}.
     */
    $app->get('/api/chat/conversation/{id}', function (Request $req, Response $res, array $args) {
        $jwt = $req->getAttribute('user');
        $meId = (int)($jwt->mysql_id ?? 0);
        
        if (!$meId) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $otherId = (int)$args['id'];

        $messages = DB::table('message')
            ->where(function ($q) use ($meId, $otherId) {
                $q->where('SenderID', $meId)->where('ReceiverID', $otherId);
            })
            ->orWhere(function ($q) use ($meId, $otherId) {
                $q->where('SenderID', $otherId)->where('ReceiverID', $meId);
            })
            ->orderBy('SentAt', 'asc')
            ->orderBy('ID', 'asc')
            ->get();

        $res->getBody()->write(json_encode(['messages' => $messages]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    /**
     * POST /api/chat/send
     * Body: { receiver_id, message }
     */
    $app->post('/api/chat/send', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        $meId = (int)($jwt->mysql_id ?? 0);
        
        if (!$meId) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $data = (array)$req->getParsedBody();
        $receiverId = (int)($data['receiver_id'] ?? 0);
        $message    = trim((string)($data['message'] ?? ''));

        if (!$receiverId || $message === '') {
            $res->getBody()->write(json_encode(['error' => 'receiver_id and message are required']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $id = DB::table('message')->insertGetId([
            'SenderID'       => $meId,
            'ReceiverID'     => $receiverId,
            'MessageContent' => $message,
        ]);

        $created = DB::table('message')->where('ID', $id)->first();

        $res->getBody()->write(json_encode([
            'message'  => 'sent',
            'record'   => $created,
        ]));
        return $res->withHeader('Content-Type', 'application/json')->withStatus(201);
    })->add(new AuthMiddleware());
};