<?php
namespace Src\Controllers;

use Src\Models\User;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class UserController {

    // Get all users
    public function index(Request $request, Response $response) {
        $users = User::all();
        $response->getBody()->write($users->toJson());
        return $response->withHeader('Content-Type', 'application/json');
    }

    // Get single user by ID
    public function show(Request $request, Response $response, $args) {
        $user = User::find($args['id']);
        if (!$user) {
            $response->getBody()->write(json_encode(['message' => 'User not found']));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }
        $response->getBody()->write($user->toJson());
        return $response->withHeader('Content-Type', 'application/json');
    }

    // Create new user
    public function store(Request $request, Response $response) {
        $data = $request->getParsedBody();
        $user = User::create($data);
        $response->getBody()->write($user->toJson());
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
    }

    // Update user
    public function update(Request $request, Response $response, $args) {
        $user = User::find($args['id']);
        if (!$user) {
            $response->getBody()->write(json_encode(['message' => 'User not found']));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }
        $data = $request->getParsedBody();
        $user->update($data);
        $response->getBody()->write($user->toJson());
        return $response->withHeader('Content-Type', 'application/json');
    }

    // Delete user
    public function destroy(Request $request, Response $response, $args) {
        $user = User::find($args['id']);
        if (!$user) {
            $response->getBody()->write(json_encode(['message' => 'User not found']));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }
        $user->delete();
        $response->getBody()->write(json_encode(['message' => 'User deleted']));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
