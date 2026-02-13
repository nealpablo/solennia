<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VenueController
{
    private function json(Response $res, bool $success, string $message, int $status = 200, array $extra = [])
    {
        $payload = array_merge([
            'success' => $success,
            $success ? 'message' : 'error' => $message,
        ], $extra);

        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    public function getMyListings(Request $req, Response $res)
    {
        // Ensure no stray output from notices/warnings
        ini_set('display_errors', '0');
        if (ob_get_length())
            ob_clean();

        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            $venues = DB::table('venue_listings')
                ->where('user_id', $user->mysql_id)
                ->where('status', 'Active')
                ->get()
                ->map(function ($v) {
                if (isset($v->gallery)) {
                    $v->gallery = json_decode($v->gallery, true) ?: [];
                }
                return $v;
            });

            return $this->json($res, true, "Listings retrieved", 200, [
                'venues' => $venues,
                'listings' => $venues // Backward compatibility
            ]);
        }
        catch (\Exception $e) {
            error_log("GET_MY_LISTINGS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to load listings", 500);
        }
    }

    public function createListing(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            $data = (array)$req->getParsedBody();

            if (empty($data['venue_name'])) {
                return $this->json($res, false, "Venue name is required", 422);
            }

            $insertData = [
                'user_id' => $user->mysql_id,
                'venue_name' => $data['venue_name'],
                'address' => $data['address'] ?? '',
                'venue_capacity' => $data['venue_capacity'] ?? 0,
                'pricing' => $data['pricing'] ?? 0,
                'description' => $data['description'] ?? '',
                'logo' => $data['logo'] ?? null,
                'HeroImageUrl' => $data['hero_image'] ?? $data['HeroImageUrl'] ?? null,
                'gallery' => json_encode($data['gallery'] ?? []),
                'status' => 'Active',
                'created_at' => date('Y-m-d H:i:s')
            ];

            $id = DB::table('venue_listings')->insertGetId($insertData);

            return $this->json($res, true, "Venue created successfully", 201, ['id' => $id]);
        }
        catch (\Exception $e) {
            error_log("CREATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to create listing", 500);
        }
    }

    public function updateListing(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            $id = (int)$args['id'];
            $data = (array)$req->getParsedBody();

            $venue = DB::table('venue_listings')
                ->where('id', $id)
                ->where('user_id', $user->mysql_id)
                ->first();

            if (!$venue) {
                return $this->json($res, false, "Venue not found or unauthorized", 404);
            }

            $updateData = [];
            if (isset($data['venue_name']))
                $updateData['venue_name'] = $data['venue_name'];
            if (isset($data['address']))
                $updateData['address'] = $data['address'];
            if (isset($data['venue_capacity']))
                $updateData['venue_capacity'] = $data['venue_capacity'];
            if (isset($data['pricing']))
                $updateData['pricing'] = $data['pricing'];
            if (isset($data['description']))
                $updateData['description'] = $data['description'];
            if (isset($data['logo']))
                $updateData['logo'] = $data['logo'];
            if (isset($data['hero_image']))
                $updateData['HeroImageUrl'] = $data['hero_image'];
            if (isset($data['HeroImageUrl']))
                $updateData['HeroImageUrl'] = $data['HeroImageUrl'];
            if (isset($data['gallery']))
                $updateData['gallery'] = json_encode($data['gallery']);

            DB::table('venue_listings')->where('id', $id)->update($updateData);

            return $this->json($res, true, "Venue updated successfully", 200);
        }
        catch (\Exception $e) {
            error_log("UPDATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to update listing", 500);
        }
    }

    public function deleteListing(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            $id = (int)$args['id'];

            $venue = DB::table('venue_listings')
                ->where('id', $id)
                ->where('user_id', $user->mysql_id)
                ->first();

            if (!$venue) {
                return $this->json($res, false, "Venue not found or unauthorized", 404);
            }

            // Soft delete
            DB::table('venue_listings')->where('id', $id)->update(['status' => 'Deleted']);

            return $this->json($res, true, "Venue deleted successfully", 200);
        }
        catch (\Exception $e) {
            error_log("DELETE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to delete listing", 500);
        }
    }
}