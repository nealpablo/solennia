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

            // Get all user's venue listings, ensuring ownership via user_id
            $venues = DB::table('venue_listings')
                ->where('user_id', $user->mysql_id)
                ->where('status', 'Active')
                ->orderByDesc('created_at')
                ->get()
                ->map(function ($v) {
                if (isset($v->gallery)) {
                    $v->gallery = json_decode($v->gallery, true) ?: [];
                }
                if (isset($v->amenities)) {
                    $v->amenities = json_decode($v->amenities, true) ?: [];
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
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->json($res, false, "Failed to load listings: " . $e->getMessage(), 500);
        }
    }

    public function createListing(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            if ($req->getMethod() !== 'POST') {
                return $this->json($res, false, "Method Not Allowed", 405);
            }

            $data = (array)$req->getParsedBody();

            if (empty($data['venue_name'])) {
                return $this->json($res, false, "Venue name is required", 422);
            }

            // Prevent duplicate listing for same user and venue_name
            $duplicate = DB::table('venue_listings')
                ->where('user_id', $user->mysql_id)
                ->where('venue_name', $data['venue_name'])
                ->where('status', '!=', 'Deleted')
                ->first();
            if ($duplicate) {
                return $this->json($res, false, "Duplicate listing", 409);
            }

            // STRICT CATEGORY VALIDATION
            // Must match exactly: Church, Garden, Resort, Conference, Other
            $validCategories = ['Church', 'Garden', 'Resort', 'Conference', 'Other'];
            if (!empty($data['venue_subcategory']) && !in_array($data['venue_subcategory'], $validCategories)) {
                return $this->json($res, false, "Invalid venue category. Must be: " . implode(', ', $validCategories), 422);
            }

            // Build address from region + city + specific_address if provided
            $address = $data['address'] ?? '';
            if (!empty($data['specific_address']) || !empty($data['city']) || !empty($data['region'])) {
                $parts = array_filter([$data['specific_address'] ?? '', $data['city'] ?? '', $data['region'] ?? '']);
                $address = implode(', ', $parts);
            }
            if (empty($address)) {
                $address = $data['venue_name']; // Fallback to venue name
            }

            // Handle gallery and amenities as JSON
            $gallery = $data['gallery'] ?? [];
            if (is_string($gallery)) {
                $gallery = json_decode($gallery, true) ?: [];
            }

            $amenities = $data['amenities'] ?? [];
            if (is_string($amenities)) {
                $amenities = json_decode($amenities, true) ?: [];
            }

            $insertData = [
                'user_id' => $user->mysql_id,
                'venue_name' => $data['venue_name'],
                'address' => $address,
                'region' => $data['region'] ?? null,
                'city' => $data['city'] ?? null,
                'specific_address' => $data['specific_address'] ?? null,
                'venue_subcategory' => $data['venue_subcategory'] ?? 'Other',
                'other_category_type' => $data['other_category_type'] ?? null,
                'venue_capacity' => $data['venue_capacity'] ?? null,
                'pricing' => $data['pricing'] ?? null,
                'description' => $data['description'] ?? '',
                'venue_amenities' => json_encode($amenities),
                'venue_operating_hours' => $data['operating_hours'] ?? $data['venue_operating_hours'] ?? '9:00 AM - 10:00 PM',
                'venue_parking' => $data['venue_parking'] ?? 'Available',
                'portfolio' => $data['logo'] ?? $data['icon_url'] ?? null,
                'HeroImageUrl' => $data['hero_image'] ?? $data['HeroImageUrl'] ?? null,
                'gallery' => json_encode($gallery),
                'status' => 'Active',
                'created_at' => date('Y-m-d H:i:s')
            ];

            $id = DB::table('venue_listings')->insertGetId($insertData);

            return $this->json($res, true, "Venue listing created successfully", 201, ['id' => $id]);
        }
        catch (\Exception $e) {
            error_log("CREATE_VENUE_LISTING_ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            error_log("Data received: " . json_encode($data ?? []));
            return $this->json($res, false, "Failed to create listing: " . $e->getMessage(), 500);
        }
    }

    public function updateListing(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            if ($req->getMethod() !== 'PUT') {
                return $this->json($res, false, "Method Not Allowed", 405);
            }

            $id = (int)$args['id'];
            $data = (array)$req->getParsedBody();

            // CRITICAL: Ensure user owns this listing
            $venue = DB::table('venue_listings')
                ->where('id', $id)
                ->where('user_id', $user->mysql_id)
                ->first();

            if (!$venue) {
                return $this->json($res, false, "Venue not found or you don't have permission to edit it", 404);
            }

            // Prevent changing to a duplicate venue_name for this user
            if (isset($data['venue_name'])) {
                $duplicate = DB::table('venue_listings')
                    ->where('user_id', $user->mysql_id)
                    ->where('venue_name', $data['venue_name'])
                    ->where('id', '!=', $id)
                    ->where('status', '!=', 'Deleted')
                    ->first();
                if ($duplicate) {
                    return $this->json($res, false, "Duplicate listing name", 409);
                }
            }

            // STRICT CATEGORY VALIDATION
            $validCategories = ['Church', 'Garden', 'Resort', 'Conference', 'Other'];
            if (isset($data['venue_subcategory']) && !in_array($data['venue_subcategory'], $validCategories)) {
                return $this->json($res, false, "Invalid venue category. Must be: " . implode(', ', $validCategories), 422);
            }

            $updateData = ['updated_at' => date('Y-m-d H:i:s')];

            // Basic fields
            if (isset($data['venue_name']) && !empty($data['venue_name'])) {
                $updateData['venue_name'] = $data['venue_name'];
            }

            // Build address if location fields provided
            if (isset($data['specific_address']) || isset($data['city']) || isset($data['region'])) {
                $parts = array_filter([
                    $data['specific_address'] ?? $venue->specific_address ?? '',
                    $data['city'] ?? $venue->city ?? '',
                    $data['region'] ?? $venue->region ?? ''
                ]);
                if (!empty($parts)) {
                    $updateData['address'] = implode(', ', $parts);
                }
            }

            if (array_key_exists('region', $data)) $updateData['region'] = $data['region'];
            if (array_key_exists('city', $data)) $updateData['city'] = $data['city'];
            if (array_key_exists('specific_address', $data)) $updateData['specific_address'] = $data['specific_address'];

            // CRITICAL: Category update - must be exact match
            if (isset($data['venue_subcategory'])) {
                $updateData['venue_subcategory'] = $data['venue_subcategory'];
            }

            if (isset($data['other_category_type'])) {
                $updateData['other_category_type'] = $data['other_category_type'];
            }

            if (isset($data['venue_capacity'])) {
                $updateData['venue_capacity'] = $data['venue_capacity'];
            }

            if (isset($data['pricing'])) {
                $updateData['pricing'] = $data['pricing'];
            }

            if (isset($data['description'])) {
                $updateData['description'] = $data['description'];
            }

            // Handle amenities array/JSON
            if (isset($data['amenities'])) {
                $amenities = $data['amenities'];
                if (is_string($amenities)) {
                    $amenities = json_decode($amenities, true) ?: [];
                }
                $updateData['venue_amenities'] = json_encode($amenities);
            }

            if (isset($data['operating_hours'])) {
                $updateData['venue_operating_hours'] = $data['operating_hours'];
            }

            if (isset($data['venue_operating_hours'])) {
                $updateData['venue_operating_hours'] = $data['venue_operating_hours'];
            }

            if (isset($data['venue_parking'])) {
                $updateData['venue_parking'] = $data['venue_parking'];
            }

            // Images
            if (isset($data['logo'])) {
                $updateData['portfolio'] = $data['logo'];
            }

            if (isset($data['icon_url'])) {
                $updateData['portfolio'] = $data['icon_url'];
            }

            if (isset($data['hero_image'])) {
                $updateData['HeroImageUrl'] = $data['hero_image'];
            }

            if (isset($data['HeroImageUrl'])) {
                $updateData['HeroImageUrl'] = $data['HeroImageUrl'];
            }

            // Handle gallery array/JSON
            if (isset($data['gallery'])) {
                $gallery = $data['gallery'];
                if (is_string($gallery)) {
                    $gallery = json_decode($gallery, true) ?: [];
                }
                $updateData['gallery'] = json_encode($gallery);
            }

            // Only update if there are changes
            if (count($updateData) > 1) { // More than just updated_at
                DB::table('venue_listings')
                    ->where('id', $id)
                    ->where('user_id', $user->mysql_id) // Double-check ownership
                    ->update($updateData);
            }

            return $this->json($res, true, "Venue listing updated successfully", 200);
        }
        catch (\Exception $e) {
            error_log("UPDATE_VENUE_LISTING_ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            error_log("Update data: " . json_encode($updateData ?? []));
            return $this->json($res, false, "Failed to update listing: " . $e->getMessage(), 500);
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

            // CRITICAL: Verify ownership before deletion
            $venue = DB::table('venue_listings')
                ->where('id', $id)
                ->where('user_id', $user->mysql_id)
                ->first();

            if (!$venue) {
                return $this->json($res, false, "Venue not found or you don't have permission to delete it", 404);
            }

            // Soft delete - set status to 'Deleted'
            DB::table('venue_listings')
                ->where('id', $id)
                ->where('user_id', $user->mysql_id) // Double-check ownership
                ->update(['status' => 'Deleted', 'updated_at' => date('Y-m-d H:i:s')]);

            return $this->json($res, true, "Venue listing deleted successfully", 200);
        }
        catch (\Exception $e) {
            error_log("DELETE_VENUE_LISTING_ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->json($res, false, "Failed to delete listing: " . $e->getMessage(), 500);
        }
    }
}
