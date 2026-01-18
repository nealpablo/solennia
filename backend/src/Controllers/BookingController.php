<?php
/**
 * ============================================
 * BOOKING CONTROLLER - CORRECTED VERSION
 * ============================================
 * Fixed to use event_service_provider table (not vendor_application)
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
     * CREATE BOOKING (UC05) - CORRECTED
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

            // Log incoming request for debugging
            error_log("CREATE_BOOKING: User ID: {$userId}");
            error_log("CREATE_BOOKING: Request data: " . json_encode($data));

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

            // ✅ FIX: Get the event_service_provider record for this vendor
            $vendorUserId = $data['vendor_id'];
            
            error_log("CREATE_BOOKING: Looking for event_service_provider with UserID: {$vendorUserId}");
            
            // ✅ FIX: Use event_service_provider table (this is what the FK points to!)
            $eventServiceProvider = DB::table('event_service_provider')
                ->where('UserID', $vendorUserId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$eventServiceProvider) {
                error_log("CREATE_BOOKING: Event Service Provider not found or not approved for UserID: {$vendorUserId}");
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Vendor not found or not verified'
                ], 404);
            }

            error_log("CREATE_BOOKING: Found Event Service Provider ID: {$eventServiceProvider->ID}");

            // ✅ FIX: Create booking with correct EventServiceProviderID
            $bookingId = DB::table('booking')->insertGetId([
                'UserID' => $userId,
                'EventServiceProviderID' => $eventServiceProvider->ID, // ✅ This matches the FK constraint
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

            error_log("CREATE_BOOKING: Created booking ID: {$bookingId}");

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

            // ✅ FIX: Get the created booking with vendor details from event_service_provider
            $booking = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.BusinessEmail as vendor_email',
                    'c.first_name as vendor_first_name',
                    'c.last_name as vendor_last_name'
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
     * GET USER'S BOOKINGS - CORRECTED
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

            // ✅ FIX: Build query with event_service_provider
            $query = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.avatar as vendor_avatar',
                    'c.first_name as vendor_first_name',
                    'c.last_name as vendor_last_name',
                    'c.email as vendor_email',
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('b.UserID', $userId);

            // Apply status filter if provided
            if ($status) {
                $query->where('b.BookingStatus', $status);
            }

            $bookings = $query->orderBy('b.CreatedAt', 'desc')->get();

            // Add computed vendor name
            foreach ($bookings as $booking) {
                $booking->vendor_name = $booking->vendor_business_name ?? 
                    (($booking->vendor_first_name ?? '') . ' ' . ($booking->vendor_last_name ?? ''));
            }

            return $this->json($res, [
                'success' => true,
                'bookings' => $bookings
            ]);

        } catch (\Throwable $e) {
            error_log("GET_USER_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to load your bookings'
            ], 500);
        }
    }

    /**
     * ============================================
     * GET VENDOR'S BOOKING REQUESTS - CORRECTED
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

            // ✅ FIX: Get vendor's event_service_provider ID
            $esp = DB::table('event_service_provider')
                ->where('UserID', $vendorUserId)
                ->where('ApplicationStatus', 'Approved')
                ->first();

            if (!$esp) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'You are not a registered vendor'
                ], 403);
            }

            // Get query parameters for filtering
            $params = $req->getQueryParams();
            $status = $params['status'] ?? null;

            // ✅ FIX: Build query with event_service_provider
            $query = DB::table('booking as b')
                ->select([
                    'b.ID as id',
                    'b.ServiceName as service_name',
                    'b.EventDate as event_date',
                    'b.EventLocation as event_location',
                    'b.EventType as event_type',
                    'b.PackageSelected as package_selected',
                    'b.AdditionalNotes as additional_notes',
                    'b.TotalAmount as total_amount',
                    'b.BookingStatus as status',
                    'b.CreatedAt as created_at',
                    'c.first_name as client_first_name',
                    'c.last_name as client_last_name',
                    'c.email as client_email',
                ])
                ->leftJoin('credential as c', 'b.UserID', '=', 'c.id')
                ->where('b.EventServiceProviderID', $esp->ID);

            // Apply status filter if provided
            if ($status) {
                $query->where('b.BookingStatus', $status);
            }

            $bookings = $query->orderBy('b.CreatedAt', 'desc')->get();

            // Add computed client name
            foreach ($bookings as $booking) {
                $booking->client_name = ($booking->client_first_name ?? '') . ' ' . ($booking->client_last_name ?? '');
            }

            return $this->json($res, [
                'success' => true,
                'bookings' => $bookings
            ]);

        } catch (\Throwable $e) {
            error_log("GET_VENDOR_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to load booking requests'
            ], 500);
        }
    }

    /**
     * ============================================
     * GET BOOKING DETAILS - CORRECTED
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

            // ✅ FIX: Get booking with event_service_provider
            $booking = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.BusinessEmail as vendor_contact_email',
                    'vendor_cred.first_name as vendor_first_name',
                    'vendor_cred.last_name as vendor_last_name',
                    'vendor_cred.email as vendor_email',
                    'client_cred.first_name as client_first_name',
                    'client_cred.last_name as client_last_name',
                    'client_cred.email as client_email',
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as vendor_cred', 'esp.UserID', '=', 'vendor_cred.id')
                ->leftJoin('credential as client_cred', 'b.UserID', '=', 'client_cred.id')
                ->where('b.ID', $bookingId)
                ->first();

            if (!$booking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking not found'
                ], 404);
            }

            // Check if user has permission to view this booking
            $isClient = $booking->UserID == $userId;
            
            // ✅ FIX: Check vendor permission using event_service_provider
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

    /**
     * ============================================
     * UPDATE BOOKING STATUS (VENDOR) - CORRECTED
     * ============================================
     * PATCH /api/bookings/{id}/status
     * ============================================
     */
    public function updateBookingStatus(Request $req, Response $res, array $args): Response
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
            $bookingId = $args['id'] ?? null;
            $data = (array) $req->getParsedBody();

            if (!$bookingId) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking ID is required'
                ], 400);
            }

            if (empty($data['status'])) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Status is required'
                ], 400);
            }

            $newStatus = $data['status'];

            // ✅ Validate status matches enum
            if (!in_array($newStatus, ['Confirmed', 'Rejected'])) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Invalid status. Must be Confirmed or Rejected'
                ], 400);
            }

            // ✅ FIX: Get booking with event_service_provider
            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->select('b.*', 'esp.UserID as vendor_user_id')
                ->first();

            if (!$booking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking not found'
                ], 404);
            }

            // Check if vendor owns this booking
            if ($booking->vendor_user_id != $vendorUserId) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'You do not have permission to update this booking'
                ], 403);
            }

            // Update status
            DB::table('booking')
                ->where('ID', $bookingId)
                ->update([
                    'BookingStatus' => $newStatus,
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

            // Send notification to client
            $statusText = $newStatus === 'Confirmed' ? 'accepted' : 'rejected';
            $this->sendNotification(
                $booking->UserID,
                'booking_update',
                'Booking ' . ucfirst($statusText),
                "Your booking request for {$booking->ServiceName} has been {$statusText} by the vendor."
            );

            return $this->json($res, [
                'success' => true,
                'message' => 'Booking status updated successfully'
            ]);

        } catch (\Throwable $e) {
            error_log("UPDATE_BOOKING_STATUS_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to update booking status'
            ], 500);
        }
    }

    /**
     * ============================================
     * CANCEL BOOKING (CLIENT) - CORRECTED
     * ============================================
     * PATCH /api/bookings/{id}/cancel
     * ============================================
     */
    public function cancelBooking(Request $req, Response $res, array $args): Response
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

            // ✅ FIX: Get booking with event_service_provider
            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->select('b.*', 'esp.UserID as vendor_user_id')
                ->first();

            if (!$booking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking not found'
                ], 404);
            }

            // Check if user owns this booking
            if ($booking->UserID != $userId) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'You do not have permission to cancel this booking'
                ], 403);
            }

            // Update status to Cancelled
            DB::table('booking')
                ->where('ID', $bookingId)
                ->update([
                    'BookingStatus' => 'Cancelled',
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

            // Send notification to vendor
            $this->sendNotification(
                $booking->vendor_user_id,
                'booking_cancelled',
                'Booking Cancelled',
                "A client has cancelled their booking for {$booking->ServiceName}."
            );

            return $this->json($res, [
                'success' => true,
                'message' => 'Booking cancelled successfully'
            ]);

        } catch (\Throwable $e) {
            error_log("CANCEL_BOOKING_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to cancel booking'
            ], 500);
        }
    }
}