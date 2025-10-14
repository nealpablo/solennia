<?php
namespace Src\Controllers;

use Src\Models\Feedback;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class FeedbackController
{
    public function store(Request $req, Response $res): Response
    {
        $user = $req->getAttribute('user'); // from JWT
        $userId = (int)($user->sub ?? 0);

        $data = (array)$req->getParsedBody();
        $msg = trim($data['message'] ?? '');
        $rating = trim($data['rating'] ?? '5star'); // default if not provided
        $bookingId = isset($data['booking_id']) ? (int)$data['booking_id'] : null;

        if ($msg === '') {
            $res->getBody()->write(json_encode(['error' => 'Empty feedback']));
            return $res->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $fb = Feedback::create([
            'BookingID' => $bookingId,
            'UserID'    => $userId,
            'Rating'    => in_array($rating, ['1star','2star','3star','4star','5star']) ? $rating : '5star',
            'Comment'   => $msg,
        ]);

        $res->getBody()->write(json_encode(['message' => 'Feedback received', 'feedback' => $fb]));
        return $res->withHeader('Content-Type', 'application/json')->withStatus(201);
    }
}
