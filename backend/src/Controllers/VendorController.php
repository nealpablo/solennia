<?php
namespace Src\Controllers;

use Src\Models\EventServiceProvider;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class VendorController
{
    public function apply(Request $req, Response $res): Response
    {
        $user = $req->getAttribute('user'); // from JWT
        $userId = (int)($user->sub ?? 0);

        $data = (array) $req->getParsedBody();

        $esp = EventServiceProvider::create([
            'UserID'          => $userId,
            'BusinessName'    => trim($data['business_name'] ?? 'My Business'),
            'BusinessEmail'   => trim($data['business_email'] ?? ($user->email ?? '')),
            'BusinessAddress' => trim($data['business_address'] ?? ''),
            'ApplicationStatus' => 'Pending',
        ]);

        $res->getBody()->write(json_encode(['message' => 'Vendor application received', 'application' => $esp]));
        return $res->withHeader('Content-Type', 'application/json')->withStatus(201);
    }
}
