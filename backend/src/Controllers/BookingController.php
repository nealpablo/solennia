<?php
/**
 * ============================================
 * BOOKING CONTROLLER
 * ============================================
 * Handles all booking-related operations
 * Developer: Ryan (01-17_Ryan_Manual-Booking)
 * Date: January 2026
 * ============================================
 */

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class BookingController
{
    /**
     * Helper function to send JSON response
     */
    private function json(Response $res, array $data, int $status = 200): Response
    {
        $res->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return $res
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withStatus($status);
    }

    /**
     * Helper function to send notification
     */
    private function sendNotification($userId, $type, $title, $message)
    {
        try {
            DB::table('notifications')->insert([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'read' => false,
                'created_at' => DB::raw('NOW()')
            ]);
        } catch (\Throwable $e) {
            error_log("NOTIFICATION_ERROR: " . $e->getMessage());
        }
    }

    /**
     * ============================================
     * CREATE BOOKING (UC05)
     * ============================================
     * POST /api/bookings/create
     * ============================================
     */
    public function createBooking(Request $req, Response $res): Response
    {
        try {
            // Get authenticated user
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Unauthorized. Please log in.'
                ], 401);
            }

            $userId = $user->mysql_id;
            $data = (array) $req->getParsedBody();

            // Validate required fields
            $required = ['vendor_id', 'service_name', 'event_date', 'event_location'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $this->json($res, [
                        'success' => false,
                        'error' => "Missing required field: {$field}"
                    ], 400);
                }
            }

            // Validate event date is in the future
            $eventDate = $data['event_date'];
            if (strtotime($eventDate) <= time()) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Event date must be in the future'
                ], 400);
            }

            // Get the event_service_provider record for this vendor
            $vendorUserId = $data['vendor_id'];
            
            $eventServiceProvider = DB::table('event_service_provider')
                ->where('UserID', $vendorUserId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$eventServiceProvider) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Vendor not found or not verified'
                ], 404);
            }

            // Create booking
            $bookingId = DB::table('booking')->insertGetId([
                'UserID' => $userId,
                'EventServiceProviderID' => $eventServiceProvider->ID,
                'ServiceName' => $data['service_name'],
                'EventDate' => $eventDate,
                'EventLocation' => $data['event_location'],
                'EventType' => $data['event_type'] ?? null,
                'PackageSelected' => $data['package_selected'] ?? null,
                'AdditionalNotes' => $data['additional_notes'] ?? null,
                'TotalAmount' => $data['total_amount'] ?? 0.00,
                'BookingStatus' => 'Pending',
                'Remarks' => null,
                'BookingDate' => DB::raw('NOW()'),
                'CreatedAt' => DB::raw('NOW()'),
                'CreatedBy' => $userId
            ]);

            // Get client name for notification
            $client = DB::table('credential')
                ->where('id', $userId)
                ->first();
            
            $clientName = ($client->first_name ?? '') . ' ' . ($client->last_name ?? '');
            $clientName = trim($clientName) ?: 'A client';

            // Send notification to vendor
            $this->sendNotification(
                $vendorUserId,
                'booking_request',
                'New Booking Request',
                "{$clientName} has requested to book {$data['service_name']} for {$eventDate}"
            );

            // Get the created booking with vendor details
            $booking = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'c.first_name as vendor_first_name',
                    'c.last_name as vendor_last_name',
                    'c.email as vendor_email'
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('b.ID', $bookingId)
                ->first();

            return $this->json($res, [
                'success' => true,
                'message' => 'Booking request sent successfully! The vendor will review and respond.',
                'booking' => $booking
            ], 201);

        } catch (\Throwable $e) {
            error_log("CREATE_BOOKING_ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to create booking. Please try again.'
            ], 500);
        }
    }

    /**
     * ============================================
     * GET USER'S BOOKINGS
     * ============================================
     * GET /api/bookings/user
     * ============================================
     */
    public function getUserBookings(Request $req, Response $res): Response
    {
        try {
            // Get authenticated user
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Unauthorized'
                ], 401);
            }

            $userId = $user->mysql_id;

            // Get query parameters for filtering
            $params = $req->getQueryParams();
            $status = $params['status'] ?? null;

            // Build query
            $query = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.avatar as vendor_avatar',
                    'c.first_name as vendor_first_name',
                    'c.last_name as vendor_last_name',
                    'c.email as vendor_email',
                    'c.phone as vendor_phone',
                    'c.firebase_uid as vendor_firebase_uid'
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('b.UserID', $userId);

            // Filter by status if provided
            if ($status && in_array($status, ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'Rejected'])) {
                $query->where('b.BookingStatus', $status);
            }

            // Order by most recent first
            $bookings = $query->orderBy('b.CreatedAt', 'desc')->get();

            // Add computed fields
            $bookings = $bookings->map(function($booking) {
                $booking->vendor_name = $booking->vendor_business_name ?? 
                    (($booking->vendor_first_name ?? '') . ' ' . ($booking->vendor_last_name ?? ''));
                $booking->vendor_name = trim($booking->vendor_name) ?: 'Unknown Vendor';
                
                return $booking;
            });

            return $this->json($res, [
                'success' => true,
                'bookings' => $bookings
            ]);

        } catch (\Throwable $e) {
            error_log("GET_USER_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to load bookings'
            ], 500);
        }
    }

    /**
     * ============================================
     * GET VENDOR'S BOOKINGS
     * ============================================
     * GET /api/bookings/vendor
     * ============================================
     */
    public function getVendorBookings(Request $req, Response $res): Response
    {
        try {
            // Get authenticated user
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Unauthorized'
                ], 401);
            }

            $vendorUserId = $user->mysql_id;

            // Check if user is a vendor (role = 1)
            $isVendor = DB::table('credential')
                ->where('id', $vendorUserId)
                ->where('role', 1)
                ->exists();

            if (!$isVendor) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Only vendors can access this endpoint'
                ], 403);
            }

            // Get vendor's event_service_provider record
            $esp = DB::table('event_service_provider')
                ->where('UserID', $vendorUserId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$esp) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Vendor profile not found'
                ], 404);
            }

            // Get query parameters
            $params = $req->getQueryParams();
            $status = $params['status'] ?? null;

            // Build query
            $query = DB::table('booking as b')
                ->select([
                    'b.*',
                    'c.first_name as client_first_name',
                    'c.last_name as client_last_name',
                    'c.email as client_email',
                    'c.phone as client_phone'
                ])
                ->leftJoin('credential as c', 'b.UserID', '=', 'c.id')
                ->where('b.EventServiceProviderID', $esp->ID);

            // Filter by status if provided
            if ($status) {
                $query->where('b.BookingStatus', $status);
            }

            // Order by most recent first
            $bookings = $query->orderBy('b.CreatedAt', 'desc')->get();

            // Add computed field
            $bookings = $bookings->map(function($booking) {
                $booking->client_name = (($booking->client_first_name ?? '') . ' ' . ($booking->client_last_name ?? ''));
                $booking->client_name = trim($booking->client_name) ?: 'Unknown Client';
                return $booking;
            });

            return $this->json($res, [
                'success' => true,
                'bookings' => $bookings
            ]);

        } catch (\Throwable $e) {
            error_log("GET_VENDOR_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to load bookings'
            ], 500);
        }
    }

    /**
     * ============================================
     * GET SINGLE BOOKING DETAILS
     * ============================================
     * GET /api/bookings/{id}
     * ============================================
     */
    public function getBookingDetails(Request $req, Response $res, array $args): Response
    {
        try {
            // Get authenticated user
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Unauthorized'
                ], 401);
            }

            $userId = $user->mysql_id;
            $bookingId = $args['id'] ?? null;

            if (!$bookingId) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking ID is required'
                ], 400);
            }

            // Get booking with complete details
            $booking = DB::table('booking as b')
                ->select([
                    'b.*',
                    'client.first_name as client_first_name',
                    'client.last_name as client_last_name',
                    'client.email as client_email',
                    'client.phone as client_phone',
                    'esp.BusinessName as vendor_business_name',
                    'esp.avatar as vendor_avatar',
                    'vendor.first_name as vendor_first_name',
                    'vendor.last_name as vendor_last_name',
                    'vendor.email as vendor_email',
                    'vendor.phone as vendor_phone',
                    'vendor.firebase_uid as vendor_firebase_uid'
                ])
                ->leftJoin('credential as client', 'b.UserID', '=', 'client.id')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as vendor', 'esp.UserID', '=', 'vendor.id')
                ->where('b.ID', $bookingId)
                ->first();

            if (!$booking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking not found'
                ], 404);
            }

            // Check if user has access
            $isClient = ($booking->UserID == $userId);
            
            $isVendor = DB::table('event_service_provider')
                ->where('ID', $booking->EventServiceProviderID)
                ->where('UserID', $userId)
                ->exists();

            if (!$isClient && !$isVendor) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Access denied'
                ], 403);
            }

            // Add computed fields
            $booking->client_name = (($booking->client_first_name ?? '') . ' ' . ($booking->client_last_name ?? ''));
            $booking->vendor_name = $booking->vendor_business_name ?? 
                (($booking->vendor_first_name ?? '') . ' ' . ($booking->vendor_last_name ?? ''));

            return $this->json($res, [
                'success' => true,
                'booking' => $booking
            ]);

        } catch (\Throwable $e) {
            error_log("GET_BOOKING_DETAILS_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to load booking details'
            ], 500);
        }
    }
}