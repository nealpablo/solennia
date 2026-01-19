<?php

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
     * UPDATED: Added vendor availability check
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

            // Get the event_service_provider record for this vendor
            $vendorUserId = $data['vendor_id'];
            
            error_log("CREATE_BOOKING: Looking for event_service_provider with UserID: {$vendorUserId}");
            
            // Use event_service_provider table (this is what the FK points to!)
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

            /* ============================================
             * ✅ UC05 - MAIN FLOW STEP 5 & ALTERNATE FLOW 5a-5c
             * ============================================
             * CHECK VENDOR AVAILABILITY FOR THE SELECTED DATE/TIME
             * 
             * According to UC05:
             * - Main Flow Step 5: "The system validates the supplier's availability for the selected date and time."
             * - Alternate Flow 5a: "The system determines that the selected date or time is not available."
             * - Alternate Flow 5b: "The system displays a message informing the client that the selected schedule is unavailable."
             * - Alternate Flow 5c: "The system prompts the client to choose a different date or time."
             * ============================================
             */
            
            $existingBooking = DB::table('booking')
                ->where('EventServiceProviderID', $eventServiceProvider->ID)
                ->where('EventDate', $eventDate)
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($existingBooking) {
                error_log("CREATE_BOOKING: Vendor already has a booking at this date/time");
                
                // Format the date for better readability in the error message
                $formattedDate = date('F j, Y \a\t g:i A', strtotime($eventDate));
                
                // UC05 Alternate Flow 5b: Display message informing client
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Schedule Unavailable',
                    'message' => "Unfortunately, this vendor is already booked for {$formattedDate}. Please choose a different date or time.",
                    'conflict' => true,
                    'conflicting_date' => $eventDate
                ], 409); // 409 Conflict status code
            }

            // ✅ Vendor is available - proceed with booking creation

            /* ============================================
             * ✅ FIXED: Removed NumberOfGuests field
             * ============================================
             * The NumberOfGuests field was causing errors because
             * the frontend form doesn't collect this data.
             * Only insert fields that are actually being sent.
             * ============================================
             */
            
            // Create booking with correct EventServiceProviderID
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
                // ✅ REMOVED: 'NumberOfGuests' => $data['number_of_guests'] ?? null,
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

            // Get the created booking with vendor details from event_service_provider
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
                'error' => 'Failed to create booking. Please try again.',
                'details' => $e->getMessage() // ✅ Added for debugging
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

            // Build query with event_service_provider
            $query = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.BusinessEmail as vendor_email',
                    'esp.avatar as vendor_avatar',
                    'c.first_name as vendor_first_name',
                    'c.last_name as vendor_last_name',
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->where('b.UserID', $userId)
                ->orderBy('b.CreatedAt', 'DESC');

            // Apply status filter if provided
            if ($status) {
                $query->where('b.BookingStatus', $status);
            }

            $bookings = $query->get();

            // Add computed fields
            foreach ($bookings as $booking) {
                $booking->vendor_name = $booking->vendor_business_name ?? 
                    trim(($booking->vendor_first_name ?? '') . ' ' . ($booking->vendor_last_name ?? ''));
            }

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
     * GET VENDOR'S BOOKING REQUESTS
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

            // Get query parameters for filtering
            $params = $req->getQueryParams();
            $status = $params['status'] ?? null;

            // Get event service provider ID
            $esp = DB::table('event_service_provider')
                ->where('UserID', $vendorUserId)
                ->first();

            if (!$esp) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Vendor profile not found'
                ], 404);
            }

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
                ->where('b.EventServiceProviderID', $esp->ID)
                ->orderBy('b.CreatedAt', 'DESC');

            // Apply status filter if provided
            if ($status) {
                $query->where('b.BookingStatus', $status);
            }

            $bookings = $query->get();

            // Add computed fields
            foreach ($bookings as $booking) {
                $booking->client_name = trim(($booking->client_first_name ?? '') . ' ' . ($booking->client_last_name ?? ''));
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
     * GET BOOKING DETAILS
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

            // Get booking with all related information
            $booking = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.BusinessEmail as vendor_email',
                    'vc.first_name as vendor_first_name',
                    'vc.last_name as vendor_last_name',
                    'cc.first_name as client_first_name',
                    'cc.last_name as client_last_name',
                    'cc.email as client_email',
                    'cc.phone as client_phone'
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as vc', 'esp.UserID', '=', 'vc.id')
                ->leftJoin('credential as cc', 'b.UserID', '=', 'cc.id')
                ->where('b.ID', $bookingId)
                ->first();

            if (!$booking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking not found'
                ], 404);
            }

            // Check authorization
            $isClient = DB::table('booking')
                ->where('ID', $bookingId)
                ->where('UserID', $userId)
                ->exists();

            $isVendor = DB::table('booking as b')
                ->join('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->where('esp.UserID', $userId)
                ->exists();

            if (!$isClient && !$isVendor) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Access denied'
                ], 403);
            }

            // Add computed fields
            $booking->client_name = trim(($booking->client_first_name ?? '') . ' ' . ($booking->client_last_name ?? ''));
            $booking->vendor_name = $booking->vendor_business_name ?? 
                trim(($booking->vendor_first_name ?? '') . ' ' . ($booking->vendor_last_name ?? ''));

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
     * UPDATE BOOKING STATUS (VENDOR)
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

            // Validate status matches enum
            if (!in_array($newStatus, ['Confirmed', 'Rejected'])) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Invalid status. Must be Confirmed or Rejected'
                ], 400);
            }

            // Get booking with event_service_provider
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
     * CANCEL BOOKING (CLIENT)
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

            // Get booking with event_service_provider
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