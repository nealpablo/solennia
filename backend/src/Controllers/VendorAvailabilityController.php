<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VendorAvailabilityController
{
 
    public function index(Request $request, Response $response, array $args)
    {
        $vendorId = $args['vendor_id'] ?? null;
        
        if (!$vendorId) {
            return $this->json($response, [
                'success' => false,
                'error' => 'vendor_id is required'
            ], 400);
        }
        
        // Verify vendor exists (Check for Active Listing or Approved ESP)
        $hasActiveListing = DB::table('vendor_listings')
            ->where('user_id', $vendorId)
            ->where('status', 'Active')
            ->exists();
            
        $hasApprovedEsp = DB::table('event_service_provider')
            ->where('UserID', $vendorId)
            ->where('ApplicationStatus', 'Approved')
            ->exists();
            
        if (!$hasActiveListing && !$hasApprovedEsp) {
            // Fallback: check if role is 1 (Vendor) just in case
             $isVendorRole = DB::table('credential')
                ->where('id', $vendorId)
                ->where('role', 1)
                ->exists();
                
            if (!$isVendorRole) {
                return $this->json($response, [
                    'success' => false,
                    'error' => 'Vendor not found'
                ], 404);
            }
        }
        
        $queryParams = $request->getQueryParams();
        $year = $queryParams['year'] ?? null;
        $month = $queryParams['month'] ?? null;
        
        $availability = [];
        
        // 1. Fetch from vendor_availability table (if exists)
        $hasTable = $this->tableExists('vendor_availability');
        if ($hasTable) {
            $query = DB::table('vendor_availability')->where('vendor_user_id', $vendorId);
            if ($year && $month) {
                $query->whereYear('date', $year)->whereMonth('date', $month);
            }
            $availRows = $query->orderBy('date', 'asc')->get();
            foreach ($availRows as $row) {
                $availability[] = [
                    'id' => $row->id,
                    'date' => date('Y-m-d', strtotime($row->date)),
                    'start_time' => $row->start_time ?? '09:00:00',
                    'end_time' => $row->end_time ?? '17:00:00',
                    'is_available' => (bool) $row->is_available,
                    'notes' => $row->notes,
                    'source' => 'availability'
                ];
            }
        }
        
        // 2. Fetch bookings for this vendor (treat as unavailable)
        // Get the event service provider ID for this vendor
        $eventServiceProvider = DB::table('event_service_provider')
            ->where('UserID', $vendorId)
            ->where('ApplicationStatus', 'Approved')
            ->first();
        
        if ($eventServiceProvider) {
            $bookingQuery = DB::table('booking')
                ->where('EventServiceProviderID', $eventServiceProvider->ID)
                ->where('venue_id', null) // Only vendor bookings (not venue bookings)
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected']);
            
            if ($year && $month) {
                $startDate = sprintf('%04d-%02d-01', $year, $month);
                $lastDay = date('t', strtotime($startDate));
                $endDate = sprintf('%04d-%02d-%02d', $year, $month, $lastDay);
                $bookingQuery->where(function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('EventDate', [$startDate, $endDate])
                      ->orWhereBetween('start_date', [$startDate, $endDate])
                      ->orWhereBetween('end_date', [$startDate, $endDate])
                      ->orWhere(function ($q2) use ($startDate, $endDate) {
                          $q2->where('start_date', '<=', $startDate)->where('end_date', '>=', $endDate);
                      });
                });
            }
            
            $bookings = $bookingQuery->get();
            
            $bookedDates = [];
            foreach ($bookings as $b) {
                try {
                    // Handle both EventDate (single day) and start_date/end_date (multi-day)
                    if (!empty($b->start_date) && !empty($b->end_date)) {
                        $start = new \DateTime($b->start_date);
                        $end = new \DateTime($b->end_date);
                        
                        // FIX: Handle inverted dates
                        if ($start > $end) {
                            $temp = $start;
                            $start = $end;
                            $end = $temp;
                        }

                        $end->modify('+1 day');
                        $interval = new \DateInterval('P1D');
                        $period = new \DatePeriod($start, $interval, $end);
                        foreach ($period as $d) {
                            $ds = $d->format('Y-m-d');
                            $bookedDates[$ds] = true;
                        }
                    } else if (!empty($b->EventDate)) {
                        $bookedDates[date('Y-m-d', strtotime($b->EventDate))] = true;
                    }
                } catch (\Exception $e) {
                    error_log("Date parsing error for vendor booking ID {$b->ID}: " . $e->getMessage());
                    continue;
                }
            }
            
            // Merge: for each booked date, add/override as unavailable
            foreach (array_keys($bookedDates) as $date) {
                $exists = false;
                foreach ($availability as &$a) {
                    if ($a['date'] === $date) {
                        $a['is_available'] = false;
                        $a['source'] = 'booking';
                        $exists = true;
                        break;
                    }
                }
                if (!$exists) {
                    $availability[] = [
                        'id' => null,
                        'date' => $date,
                        'start_time' => '00:00:00',
                        'end_time' => '23:59:59',
                        'is_available' => false,
                        'notes' => 'Booked',
                        'source' => 'booking'
                    ];
                }
            }
        }
        
        usort($availability, fn($a, $b) => strcmp($a['date'], $b['date']));
        
        return $this->json($response, [
            'success' => true,
            'availability' => $availability
        ]);
    }
    
    /**
     * Create new availability (VENDOR ONLY)
     * POST /api/vendor/availability
     */
    public function store(Request $request, Response $response)
    {
        // Get authenticated user from middleware
        $user = $request->getAttribute('user');
        
        if (!$user) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Authentication required'
            ], 401);
        }
        
        // Check if user is vendor (role = 1)
        // Refetch user from DB to ensure we have the latest role (handling stale tokens after approval)
        $userId = $user->mysql_id ?? $user->sub ?? null;
        $dbUser = DB::table('credential')->find($userId);

        if (!$dbUser || $dbUser->role != 1) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Only vendors can manage availability'
            ], 403);
        }
        
        // Get JSON body
        $body = $request->getParsedBody();
        
        if (!$body) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Invalid JSON input'
            ], 400);
        }
        
        // Validate required fields
        if (empty($body['date']) || empty($body['start_time']) || empty($body['end_time'])) {
            return $this->json($response, [
                'success' => false,
                'error' => 'date, start_time, and end_time are required'
            ], 400);
        }
        
        $date = $body['date'];
        $startTime = $body['start_time'];
        $endTime = $body['end_time'];
        
        // Add seconds if not present
        if (strlen($startTime) === 5) $startTime .= ':00';
        if (strlen($endTime) === 5) $endTime .= ':00';
        
        $isAvailable = isset($body['is_available']) ? ($body['is_available'] ? 1 : 0) : 1;
        $notes = $body['notes'] ?? null;
        
        // Get user ID (support both mysql_id and sub)
        $userId = $user->mysql_id ?? $user->sub ?? null;
        
        if (!$userId) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Invalid user token'
            ], 401);
        }
        
        // Check if this date is already booked (prevent editing booked dates)
        if ($this->dateIsBooked($userId, $date)) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Cannot set availability: date is already booked'
            ], 400);
        }
        
        // Check if exists
        $exists = DB::table('vendor_availability')
            ->where('vendor_user_id', $userId)
            ->where('date', $date)
            ->exists();
        
        if ($exists) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Availability already exists for this date. Use update instead.'
            ], 400);
        }
        
        // Insert
        $id = DB::table('vendor_availability')->insertGetId([
            'vendor_user_id' => $userId,
            'date' => $date,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'is_available' => $isAvailable,
            'notes' => $notes,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
        
        $availability = DB::table('vendor_availability')->find($id);
        $availability->is_available = (bool)$availability->is_available;
        
        return $this->json($response, [
            'success' => true,
            'message' => 'Availability created',
            'availability' => $availability
        ], 201);
    }
    
    /**
     * Update availability (VENDOR ONLY - own records)
     * PATCH /api/vendor/availability/{id}
     */
    public function update(Request $request, Response $response, array $args)
    {
        $user = $request->getAttribute('user');
        
        if (!$user) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Authentication required'
            ], 401);
        }
        
        // Refetch user from DB
        $userId = $user->mysql_id ?? $user->sub ?? null;
        $dbUser = DB::table('credential')->find($userId);

        if (!$dbUser || $dbUser->role != 1) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Only vendors can manage availability'
            ], 403);
        }
        
        $id = $args['id'] ?? null;
        
        if (!$id) {
            return $this->json($response, [
                'success' => false,
                'error' => 'id is required'
            ], 400);
        }
        
        $existing = DB::table('vendor_availability')->find($id);
        
        if (!$existing) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Availability not found'
            ], 404);
        }
        
        $userId = $user->mysql_id ?? $user->sub ?? null;
        
        if ($existing->vendor_user_id != $userId) {
            return $this->json($response, [
                'success' => false,
                'error' => 'You can only update your own availability'
            ], 403);
        }
        
        // Check if this date is already booked (prevent editing booked dates)
        if ($this->dateIsBooked($userId, $existing->date)) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Cannot edit: this date is booked'
            ], 400);
        }
        
        $body = $request->getParsedBody();
        
        if (!$body) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Invalid JSON input'
            ], 400);
        }
        
        $updates = [];
        
        if (isset($body['date'])) $updates['date'] = $body['date'];
        if (isset($body['start_time'])) {
            $startTime = $body['start_time'];
            if (strlen($startTime) === 5) $startTime .= ':00';
            $updates['start_time'] = $startTime;
        }
        if (isset($body['end_time'])) {
            $endTime = $body['end_time'];
            if (strlen($endTime) === 5) $endTime .= ':00';
            $updates['end_time'] = $endTime;
        }
        if (isset($body['is_available'])) {
            $updates['is_available'] = $body['is_available'] ? 1 : 0;
        }
        if (isset($body['notes'])) $updates['notes'] = $body['notes'];
        
        if (empty($updates)) {
            return $this->json($response, [
                'success' => false,
                'error' => 'No fields to update'
            ], 400);
        }
        
        $updates['updated_at'] = date('Y-m-d H:i:s');
        
        DB::table('vendor_availability')
            ->where('id', $id)
            ->update($updates);
        
        $availability = DB::table('vendor_availability')->find($id);
        $availability->is_available = (bool)$availability->is_available;
        
        return $this->json($response, [
            'success' => true,
            'message' => 'Availability updated',
            'availability' => $availability
        ]);
    }
    
    /**
     * Delete availability (VENDOR ONLY - own records)
     * DELETE /api/vendor/availability/{id}
     */
    public function destroy(Request $request, Response $response, array $args)
    {
        $user = $request->getAttribute('user');
        
        if (!$user) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Authentication required'
            ], 401);
        }
        
        // Refetch user from DB
        $userId = $user->mysql_id ?? $user->sub ?? null;
        $dbUser = DB::table('credential')->find($userId);

        if (!$dbUser || $dbUser->role != 1) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Only vendors can manage availability'
            ], 403);
        }
        
        $id = $args['id'] ?? null;
        
        if (!$id) {
            return $this->json($response, [
                'success' => false,
                'error' => 'id is required'
            ], 400);
        }
        
        $existing = DB::table('vendor_availability')->find($id);
        
        if (!$existing) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Availability not found'
            ], 404);
        }
        
        $userId = $user->mysql_id ?? $user->sub ?? null;
        
        if ($existing->vendor_user_id != $userId) {
            return $this->json($response, [
                'success' => false,
                'error' => 'You can only delete your own availability'
            ], 403);
        }
        
        // Check if this date is already booked (prevent deleting booked dates)
        if ($this->dateIsBooked($userId, $existing->date)) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Cannot delete: this date is booked'
            ], 400);
        }
        
        DB::table('vendor_availability')->where('id', $id)->delete();
        
        return $this->json($response, [
            'success' => true,
            'message' => 'Availability deleted'
        ]);
    }
    
    /**
     * Check if a date is already booked for the vendor
     */
    private function dateIsBooked(int $vendorUserId, string $date): bool
    {
        // Get the event service provider ID for this vendor
        $eventServiceProvider = DB::table('event_service_provider')
            ->where('UserID', $vendorUserId)
            ->where('ApplicationStatus', 'Approved')
            ->first();
        
        if (!$eventServiceProvider) {
            return false;
        }
        
        // Check if there's a booking for this date
        return DB::table('booking')
            ->where('EventServiceProviderID', $eventServiceProvider->ID)
            ->where('venue_id', null) // Only vendor bookings (not venue bookings)
            ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
            ->where(function($query) use ($date) {
                $query->where('EventDate', $date)
                      ->orWhere(function($q) use ($date) {
                          $q->where('start_date', '<=', $date)
                            ->where('end_date', '>=', $date);
                      });
            })
            ->exists();
    }
    
    /**
     * Check if a table exists in the database
     */
    private function tableExists(string $table): bool
    {
        try {
            return DB::schema()->hasTable($table);
        } catch (\Throwable $e) {
            return false;
        }
    }
    
    /**
     * Helper to return JSON response with CORS
     */
    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}