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

                // Cancelled bookings
                'cancelled_bookings' => DB::table('booking')
                    ->where('BookingStatus', 'Cancelled')
                    ->count(),

                // Rejected bookings
                'rejected_bookings' => DB::table('booking')
                    ->where('BookingStatus', 'Rejected')
                    ->count(),

                // Total reviews
                'total_reviews' => DB::table('booking_feedback')->count(),

                // Average system rating
                'average_rating' => round(DB::table('booking_feedback')->avg('Rating') ?: 0, 2),

                // Timestamp for "As of" display
                'as_of' => date('c'),

                // Upcoming bookings (Pending + Confirmed)
                'upcoming_bookings' => DB::table('booking')
                    ->whereIn('BookingStatus', ['Pending', 'Confirmed'])
                    ->where(function ($q) {
                        $q->where('EventDate', '>=', date('Y-m-d'))
                          ->orWhere('start_date', '>=', date('Y-m-d'));
                    })
                    ->count(),
            ];

            // Weekly / Monthly / Last 4 Weeks metrics (for BookingAnalyticsChart)
            $weekAgo = date('Y-m-d', strtotime('-7 days'));
            $monthAgo = date('Y-m-d', strtotime('-1 month'));

            // Status counts for doughnut chart
            $analytics['completed_bookings'] = DB::table('booking')->where('BookingStatus', 'Completed')->count();
            $analytics['cancelled_bookings'] = DB::table('booking')->where('BookingStatus', 'Cancelled')->count();
            $analytics['rejected_bookings']  = DB::table('booking')->where('BookingStatus', 'Rejected')->count();

            // Total Vendors and Venues
            $analytics['total_vendors'] = DB::table('event_service_provider')->count();
            $analytics['total_venues'] = DB::table('venue_listings')->count();

            $analytics['bookings_this_week'] = DB::table('booking')
                ->where(function ($q) use ($weekAgo) {
                    $q->where('CreatedAt', '>=', $weekAgo)
                      ->orWhere('EventDate', '>=', $weekAgo);
                })
                ->count();

            $analytics['bookings_this_month'] = DB::table('booking')
                ->where(function ($q) use ($monthAgo) {
                    $q->where('CreatedAt', '>=', $monthAgo)
                      ->orWhere('EventDate', '>=', $monthAgo);
                })
                ->count();

            $last4Weeks = [];
            for ($i = 3; $i >= 0; $i--) {
                $weekEnd = date('Y-m-d', strtotime("-" . ($i * 7) . " days"));
                $weekStart = date('Y-m-d', strtotime("-" . (($i + 1) * 7) . " days"));
                $last4Weeks[] = DB::table('booking')
                    ->where(function ($q) use ($weekStart, $weekEnd) {
                        $q->where(function ($q2) use ($weekStart, $weekEnd) {
                            $q2->where('CreatedAt', '>=', $weekStart)
                               ->where('CreatedAt', '<', $weekEnd);
                        })->orWhere(function ($q2) use ($weekStart, $weekEnd) {
                            $q2->where('EventDate', '>=', $weekStart)
                               ->where('EventDate', '<', $weekEnd);
                        });
                    })
                    ->count();
            }
            $analytics['last_4_weeks'] = $last4Weeks;
            
            // Recent system-wide bookings
            $recentBookings = DB::table('booking')
                ->leftJoin('credential', 'booking.UserID', '=', 'credential.id')
                ->select(
                    'booking.ID', 
                    'booking.EventDate', 
                    'booking.BookingStatus', 
                    'booking.CreatedAt',
                    'booking.TotalAmount',
                    'booking.ServiceName',
                    'credential.username',
                    'credential.first_name',
                    'credential.last_name'
                )
                ->orderBy('booking.CreatedAt', 'DESC')
                ->limit(5)
                ->get()
                ->map(function ($b) {
                    $b->client_name = trim(($b->first_name ?? '') . ' ' . ($b->last_name ?? '')) ?: ($b->username ?? 'User');
                    return $b;
                });

            return $this->json($response, true, "Admin analytics retrieved", 200, [
                'analytics' => $analytics,
                'recent_bookings' => $recentBookings
            ]);

        } catch (\Exception $e) {
            error_log("ADMIN_ANALYTICS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to load admin analytics", 500);
        }
    }

    /**
     * Migrate legacy Event Service Providers to Vendor Listings
     */
    public function migrateLegacyVendors(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            // Check if user is admin (role = 2)
            $userRole = DB::table('credential')
                ->where('id', $user->mysql_id)
                ->value('role');

            if ($userRole != 2) {
                return $this->json($res, false, "Forbidden: Admin access required", 403);
            }

            $migratedCount = 0;
            $errors = [];

            // Get all approved ESPs
            $esps = DB::table('event_service_provider')
                ->where('ApplicationStatus', 'Approved')
                ->get();

            foreach ($esps as $esp) {
                try {
                    // Check if a listing already exists for this user
                    $exists = DB::table('vendor_listings')
                        ->where('user_id', $esp->UserID)
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    // Prepare data migration
                    $gallery = [];
                    if (!empty($esp->gallery)) {
                        $gallery = is_string($esp->gallery) 
                            ? json_decode($esp->gallery, true) ?: []
                            : $esp->gallery;
                    } elseif (!empty($esp->portfolio)) {
                         // Some legacy data might have portfolio url which isn't exactly gallery but better than nothing
                         // Actually let's assume portfolio is a single image url or doc, maybe not gallery array.
                    }

                    // Construct address
                    $address = $esp->BusinessAddress ?? $esp->service_areas ?? '';
                    
                    $insertData = [
                        'user_id' => $esp->UserID,
                        'business_name' => $esp->BusinessName ?? 'My Business',
                        'address' => $address,
                        'region' => $esp->region ?? null,
                        'city' => $esp->city ?? null,
                        'specific_address' => $esp->BusinessAddress ?? null,
                        'service_category' => $esp->Category ?? $esp->service_category ?? null,
                        'other_category_type' => null, // Legacy didn't have this
                        'services' => $esp->services ?? null,
                        'pricing' => $esp->Pricing ?? null,
                        'description' => $esp->Description ?? $esp->bio ?? null,
                        'hero_image' => $esp->HeroImageUrl ?? null,
                        'logo' => $esp->business_logo_url ?? $esp->avatar ?? null,
                        'gallery' => json_encode($gallery),
                        'event_type' => $esp->service_type_tag ?? null,
                        'budget_range' => $esp->budget_tier ?? null,
                        'base_price' => $esp->base_price ?? null,
                        'package_price' => $esp->package_price ?? null,
                        'ai_description' => $esp->ai_description ?? null,
                        'status' => 'Active',
                        'created_at' => $esp->DateApproved ?? date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s')
                    ];

                    DB::table('vendor_listings')->insert($insertData);
                    $migratedCount++;

                } catch (\Exception $e) {
                    $errors[] = "Failed to migrate UserID {$esp->UserID}: " . $e->getMessage();
                }
            }

            return $this->json($res, true, "Migration completed", 200, [
                'migrated_count' => $migratedCount,
                'errors' => $errors
            ]);

        } catch (\Exception $e) {
            error_log("MIGRATE_VENDORS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Migration failed: " . $e->getMessage(), 500);
        }
    }
}
