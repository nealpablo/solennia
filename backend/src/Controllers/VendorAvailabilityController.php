<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VendorAvailabilityController
{
    /**
     * Get availability for a vendor (PUBLIC - no auth)
     * GET /api/vendor/availability/{vendor_id}
     */
    public function index(Request $request, Response $response, array $args)
    {
        $vendorId = $args['vendor_id'] ?? null;
        
        if (!$vendorId) {
            return $this->json($response, [
                'success' => false,
                'error' => 'vendor_id is required'
            ], 400);
        }
        
        // Verify vendor exists
        $vendor = DB::table('credential')
            ->where('UserID', $vendorId)
            ->where('role', 1)
            ->first();
        
        if (!$vendor) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Vendor not found'
            ], 404);
        }
        
        // Build query
        $query = DB::table('vendor_availability')
            ->where('vendor_user_id', $vendorId);
        
        // Get query params
        $queryParams = $request->getQueryParams();
        
        // Filter by year and month
        if (isset($queryParams['year']) && isset($queryParams['month'])) {
            $query->whereYear('date', $queryParams['year'])
                  ->whereMonth('date', $queryParams['month']);
        }
        // Filter by date range
        elseif (isset($queryParams['start_date']) && isset($queryParams['end_date'])) {
            $query->whereBetween('date', [$queryParams['start_date'], $queryParams['end_date']]);
        }
        
        $availability = $query->orderBy('date', 'asc')->get();
        
        // Convert is_available to boolean
        $availability = $availability->map(function($item) {
            $item->is_available = (bool)$item->is_available;
            return $item;
        });
        
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
        if (!isset($user->role) || $user->role != 1) {
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
        
        // Check if exists
        $exists = DB::table('vendor_availability')
            ->where('vendor_user_id', $userId)
            ->where('date', $date)
            ->exists();
        
        if ($exists) {
            return $this->json($response, [
                'success' => false,
                'error' => 'Availability already exists for this date'
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
        
        if (!isset($user->role) || $user->role != 1) {
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
        
        if (!isset($user->role) || $user->role != 1) {
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
        
        DB::table('vendor_availability')->where('id', $id)->delete();
        
        return $this->json($response, [
            'success' => true,
            'message' => 'Availability deleted'
        ]);
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