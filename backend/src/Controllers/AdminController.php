<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class AdminController
{
    private function json(Response $response, bool $success, string $message, int $status = 200, array $extra = [])
    {
        $payload = array_merge([
            'success' => $success,
            $success ? 'message' : 'error' => $message,
        ], $extra);

        $response->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    /**
     * Get Admin Dashboard Analytics
     * Returns system-wide statistics
     */
    public function getAdminAnalytics(Request $request, Response $response)
    {
        try {
            $user = $request->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }

            // Check if user is admin (role = 2)
            $userRole = DB::table('credential')
                ->where('id', $user->mysql_id)
                ->value('role');

            if ($userRole != 2) {
                return $this->json($response, false, "Forbidden: Admin access required", 403);
            }

            // Get analytics data
            $analytics = [
                // Total users (all roles)
                'total_users' => DB::table('credential')->count(),

                // Total clients (role = 0)
                'total_clients' => DB::table('credential')->where('role', 0)->count(),

                // Total event service providers (role = 1)
                'total_providers' => DB::table('credential')->where('role', 1)->count(),

                // Total approved vendors/venues
                'total_approved_providers' => DB::table('event_service_provider')
                    ->where('ApplicationStatus', 'Approved')
                    ->count(),

                // Pending vendor applications
                'pending_applications' => DB::table('vendor_application')
                    ->where('status', 'Pending')
                    ->count(),

                // Total active venue listings
                'total_venue_listings' => DB::table('venue_listings')
                    ->where('status', 'Active')
                    ->count(),

                // Total bookings
                'total_bookings' => DB::table('booking')->count(),

                // Pending bookings
                'pending_bookings' => DB::table('booking')
                    ->where('BookingStatus', 'Pending')
                    ->count(),

                // Confirmed bookings
                'confirmed_bookings' => DB::table('booking')
                    ->where('BookingStatus', 'Confirmed')
                    ->count(),

                // Completed bookings
                'completed_bookings' => DB::table('booking')
                    ->where('BookingStatus', 'Completed')
                    ->count(),

                // Total reviews
                'total_reviews' => DB::table('booking_feedback')->count(),

                // Average system rating
                'average_rating' => round(DB::table('booking_feedback')->avg('Rating') ?: 0, 2),
            ];

            return $this->json($response, true, "Admin analytics retrieved", 200, [
                'analytics' => $analytics
            ]);

        } catch (\Exception $e) {
            error_log("ADMIN_ANALYTICS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to load admin analytics", 500);
        }
    }
}
