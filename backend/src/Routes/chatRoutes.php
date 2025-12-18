<?php

use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;
use Src\Middleware\AuthMiddleware;

return function (App $app) {

    /**
     * GET /api/chat/contacts
     * Returns all vendors/admins as possible contacts.
     */
    $app->get('/api/chat/contacts', function (Request $req, Response $res) {
        $jwt = $req->getAttribute('user');
        $meId = (int)($jwt->sub ?? 0);
        if (!$meId) {
            $res->getBody()->write(json_encode(['error' => 'Unauthorized']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $contacts = DB::table('credential')
            ->select('id', 'first_name', 'last_name', 'username', 'role')
            ->whereIn('role', [1, 2]) // 1 = Supplier, 2 = Admin
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get();

        $res->getBody()->write(json_encode(['contacts' => $contacts]));
        return $res->withHeader('Content-Type', 'application/json');
    })->add(new AuthMiddleware());

    /**
     * GET /api/chat/conversation/{id}
     * Returns all messages between logged-in user and {id}.
     */
    $app->get('/api/chat/conversation/{id}', function (Request $req, Response $res, array $args) {
        $jwt = $req->getAttribute('user');
        $meId = (int)($jwt->sub ?? 0);
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
        $meId = (int)($jwt->sub ?? 0);
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
