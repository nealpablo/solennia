<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

/**
 * Venue Availability Controller
 * Mirrors VendorAvailabilityController for venues.
 * - GET: Public, returns availability + merged booking dates (booked = unavailable)
 * - POST/PATCH/DELETE: Venue owner only, cannot edit booked dates
 */
class VenueAvailabilityController
{
    /**
     * Get availability for a venue (PUBLIC)
     * Merges venue_availability with booking table - booked dates shown as unavailable
     * GET /api/venue/availability/{venue_id}?year=2025&month=2
     */
    public function index(Request $request, Response $response, array $args)
    {
        $venueId = (int) ($args['venue_id'] ?? 0);

        if (!$venueId) {
            return $this->json($response, ['success' => false, 'error' => 'venue_id is required'], 400);
        }

        $venue = DB::table('venue_listings')
            ->where('id', $venueId)
            ->where('status', 'Active')
            ->first();

        if (!$venue) {
            return $this->json($response, ['success' => false, 'error' => 'Venue not found'], 404);
        }

        $queryParams = $request->getQueryParams();
        $year = $queryParams['year'] ?? null;
        $month = $queryParams['month'] ?? null;

        $availability = [];

        // 1. Fetch from venue_availability table (if exists)
        $hasTable = $this->tableExists('venue_availability');
        if ($hasTable) {
            $query = DB::table('venue_availability')->where('venue_id', $venueId);
            if ($year && $month) {
                $query->whereYear('date', $year)->whereMonth('date', $month);
            }
            $availRows = $query->orderBy('date', 'asc')->get();
            foreach ($availRows as $row) {
                $availability[] = [
                    'id' => $row->id,
                    'date' => $row->date,
                    'start_time' => $row->start_time ?? '09:00:00',
                    'end_time' => $row->end_time ?? '17:00:00',
                    'is_available' => (bool) $row->is_available,
                    'notes' => $row->notes,
                    'source' => 'availability'
                ];
            }
        }

        // 2. Fetch bookings for this venue (treat as unavailable)
        $bookingQuery = DB::table('booking')
            ->where('venue_id', $venueId)
            ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected']);

        if ($year && $month) {
            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $lastDay = date('t', strtotime($startDate));
            $endDate = sprintf('%04d-%02d-%02d', $year, $month, $lastDay);
            $bookingQuery->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($q2) use ($startDate, $endDate) {
                        $q2->where('start_date', '<=', $startDate)->where('end_date', '>=', $endDate);
                    });
            });
        }

        $bookings = $bookingQuery->get();

        $bookedDates = [];
        foreach ($bookings as $b) {
            $start = new \DateTime($b->start_date);
            $end = new \DateTime($b->end_date);
            $end->modify('+1 day');
            $interval = new \DateInterval('P1D');
            $period = new \DatePeriod($start, $interval, $end);
            foreach ($period as $d) {
                $ds = $d->format('Y-m-d');
                $bookedDates[$ds] = true;
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

        usort($availability, fn($a, $b) => strcmp($a['date'], $b['date']));

        return $this->json($response, ['success' => true, 'availability' => $availability]);
    }

    /**
     * Create availability (VENUE OWNER ONLY)
     * POST /api/venue/availability
     */
    public function store(Request $request, Response $response)
    {
        $user = $request->getAttribute('user');
        if (!$user || !isset($user->mysql_id)) {
            return $this->json($response, ['success' => false, 'error' => 'Authentication required'], 401);
        }
        $userId = $user->mysql_id;

        $body = $request->getParsedBody();
        if (!$body || empty($body['venue_id']) || empty($body['date'])) {
            return $this->json($response, ['success' => false, 'error' => 'venue_id and date are required'], 400);
        }

        $venueId = (int) $body['venue_id'];
        if (!$this->userOwnsVenue($userId, $venueId)) {
            return $this->json($response, ['success' => false, 'error' => 'Venue not found or access denied'], 403);
        }

        if ($this->dateIsBooked($venueId, $body['date'])) {
            return $this->json($response, ['success' => false, 'error' => 'Cannot set availability: date is already booked'], 400);
        }

        if (!$this->tableExists('venue_availability')) {
            return $this->json($response, ['success' => false, 'error' => 'Venue availability not configured'], 500);
        }

        $startTime = ($body['start_time'] ?? '09:00');
        $endTime = ($body['end_time'] ?? '17:00');
        if (strlen($startTime) === 5) $startTime .= ':00';
        if (strlen($endTime) === 5) $endTime .= ':00';
        $isAvailable = isset($body['is_available']) ? ($body['is_available'] ? 1 : 0) : 1;
        $notes = $body['notes'] ?? null;

        $exists = DB::table('venue_availability')
            ->where('venue_id', $venueId)
            ->where('date', $body['date'])
            ->exists();

        if ($exists) {
            return $this->json($response, ['success' => false, 'error' => 'Availability already exists for this date. Use update instead.'], 400);
        }

        $id = DB::table('venue_availability')->insertGetId([
            'venue_id' => $venueId,
            'date' => $body['date'],
            'start_time' => $startTime,
            'end_time' => $endTime,
            'is_available' => $isAvailable,
            'notes' => $notes,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        $row = DB::table('venue_availability')->find($id);
        $row->is_available = (bool) $row->is_available;

        return $this->json($response, ['success' => true, 'message' => 'Availability created', 'availability' => $row], 201);
    }

    /**
     * Update availability (VENUE OWNER ONLY)
     * PATCH /api/venue/availability/{id}
     */
    public function update(Request $request, Response $response, array $args)
    {
        $user = $request->getAttribute('user');
        if (!$user || !isset($user->mysql_id)) {
            return $this->json($response, ['success' => false, 'error' => 'Authentication required'], 401);
        }
        $userId = $user->mysql_id;
        $id = (int) ($args['id'] ?? 0);

        if (!$this->tableExists('venue_availability')) {
            return $this->json($response, ['success' => false, 'error' => 'Venue availability not configured'], 500);
        }

        $existing = DB::table('venue_availability')->find($id);
        if (!$existing || !$this->userOwnsVenue($userId, $existing->venue_id)) {
            return $this->json($response, ['success' => false, 'error' => 'Availability not found or access denied'], 404);
        }

        if ($this->dateIsBooked($existing->venue_id, $existing->date)) {
            return $this->json($response, ['success' => false, 'error' => 'Cannot edit: this date is booked'], 400);
        }

        $body = $request->getParsedBody();
        if (!$body) {
            return $this->json($response, ['success' => false, 'error' => 'Invalid input'], 400);
        }

        $updates = [];
        if (isset($body['start_time'])) {
            $t = $body['start_time'];
            if (strlen($t) === 5) $t .= ':00';
            $updates['start_time'] = $t;
        }
        if (isset($body['end_time'])) {
            $t = $body['end_time'];
            if (strlen($t) === 5) $t .= ':00';
            $updates['end_time'] = $t;
        }
        if (isset($body['is_available'])) {
            $updates['is_available'] = $body['is_available'] ? 1 : 0;
        }
        if (isset($body['notes'])) {
            $updates['notes'] = $body['notes'];
        }

        if (empty($updates)) {
            return $this->json($response, ['success' => false, 'error' => 'No fields to update'], 400);
        }

        $updates['updated_at'] = date('Y-m-d H:i:s');
        DB::table('venue_availability')->where('id', $id)->update($updates);
        $row = DB::table('venue_availability')->find($id);
        $row->is_available = (bool) $row->is_available;

        return $this->json($response, ['success' => true, 'message' => 'Availability updated', 'availability' => $row]);
    }

    /**
     * Delete availability (VENUE OWNER ONLY)
     * DELETE /api/venue/availability/{id}
     */
    public function destroy(Request $request, Response $response, array $args)
    {
        $user = $request->getAttribute('user');
        if (!$user || !isset($user->mysql_id)) {
            return $this->json($response, ['success' => false, 'error' => 'Authentication required'], 401);
        }
        $userId = $user->mysql_id;
        $id = (int) ($args['id'] ?? 0);

        if (!$this->tableExists('venue_availability')) {
            return $this->json($response, ['success' => false, 'error' => 'Venue availability not configured'], 500);
        }

        $existing = DB::table('venue_availability')->find($id);
        if (!$existing || !$this->userOwnsVenue($userId, $existing->venue_id)) {
            return $this->json($response, ['success' => false, 'error' => 'Availability not found or access denied'], 404);
        }

        if ($this->dateIsBooked($existing->venue_id, $existing->date)) {
            return $this->json($response, ['success' => false, 'error' => 'Cannot delete: this date is booked'], 400);
        }

        DB::table('venue_availability')->where('id', $id)->delete();
        return $this->json($response, ['success' => true, 'message' => 'Availability deleted']);
    }

    private function userOwnsVenue(int $userId, int $venueId): bool
    {
        $v = DB::table('venue_listings')
            ->where('id', $venueId)
            ->where('user_id', $userId)
            ->first();
        return $v !== null;
    }

    private function dateIsBooked(int $venueId, string $date): bool
    {
        return DB::table('booking')
            ->where('venue_id', $venueId)
            ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
            ->where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->exists();
    }

    private function tableExists(string $table): bool
    {
        try {
            return DB::schema()->hasTable($table);
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
    }
}
