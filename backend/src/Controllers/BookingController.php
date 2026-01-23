<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

/**
 * ============================================
 * BOOKING CONTROLLER WITH RESCHEDULE SUPPORT
 * ============================================
 * FIXED VERSION - Vendors now see reschedule fields
 * ============================================
 */
class BookingController
{
    private function json(Response $res, array $data, int $status = 200): Response
    {
        $res->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return $res
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withStatus($status);
    }

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

    public function createBooking(Request $req, Response $res): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Unauthorized. Please log in.'
                ], 401);
            }

            $userId = $user->mysql_id;
            $data = (array) $req->getParsedBody();

            error_log("CREATE_BOOKING: User ID: {$userId}");

            $required = ['vendor_id', 'service_name', 'event_date', 'event_location'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $this->json($res, [
                        'success' => false,
                        'error' => "Missing required field: {$field}"
                    ], 400);
                }
            }

            $eventDate = $data['event_date'];
            if (strtotime($eventDate) <= time()) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Event date must be in the future'
                ], 400);
            }

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

            $existingBooking = DB::table('booking')
                ->where('EventServiceProviderID', $eventServiceProvider->ID)
                ->where('EventDate', $eventDate)
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($existingBooking) {
                $formattedDate = date('F j, Y \a\t g:i A', strtotime($eventDate));
                
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Schedule Unavailable',
                    'message' => "Unfortunately, this vendor is already booked for {$formattedDate}.",
                    'conflict' => true
                ], 409);
            }

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

            $client = DB::table('credential')->where('id', $userId)->first();
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'A client';

            $this->sendNotification(
                $vendorUserId,
                'booking_request',
                'New Booking Request',
                "{$clientName} has requested to book {$data['service_name']}"
            );

            return $this->json($res, [
                'success' => true,
                'message' => 'Booking request sent successfully!',
                'booking_id' => $bookingId
            ], 201);

        } catch (\Throwable $e) {
            error_log("CREATE_BOOKING_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to create booking'
            ], 500);
        }
    }

    /**
     * ============================================
     * ✅ GET USER BOOKINGS + RESCHEDULE HISTORY
     * ============================================
     */
    public function getUserBookings(Request $req, Response $res): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $userId = $user->mysql_id;
            $params = $req->getQueryParams();
            $status = $params['status'] ?? null;

            $query = DB::table('booking as b')
                ->select([
                    'b.*',
                    'esp.BusinessName as vendor_business_name',
                    'esp.BusinessEmail as vendor_email',
                    'esp.avatar as vendor_avatar',
                    'c.first_name as vendor_first_name',
                    'c.last_name as vendor_last_name',
                    'br_pending.ID as reschedule_id',
                    'br_pending.OriginalEventDate as original_date',
                    'br_pending.RequestedEventDate as requested_date',
                    'br_pending.Status as reschedule_status'
                ])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as c', 'esp.UserID', '=', 'c.id')
                ->leftJoin('booking_reschedule as br_pending', function($join) {
                    $join->on('b.ID', '=', 'br_pending.BookingID')
                         ->where('br_pending.Status', '=', 'Pending');
                })
                ->where('b.UserID', $userId)
                ->orderBy('b.CreatedAt', 'DESC');

            if ($status) {
                $query->where('b.BookingStatus', $status);
            }

            $bookings = $query->get();

            foreach ($bookings as $booking) {
                $booking->vendor_name = $booking->vendor_business_name ?? 
                    trim(($booking->vendor_first_name ?? '') . ' ' . ($booking->vendor_last_name ?? ''));
                
                $booking->has_pending_reschedule = !empty($booking->reschedule_id);
                $booking->is_rescheduled = $booking->has_pending_reschedule;

                // ✅ Get ALL reschedule history
                $rescheduleHistory = DB::table('booking_reschedule')
                    ->where('BookingID', $booking->ID)
                    ->orderBy('RequestedAt', 'DESC')
                    ->get();

                $booking->reschedule_history = $rescheduleHistory;
            }

            return $this->json($res, ['success' => true, 'bookings' => $bookings]);

        } catch (\Throwable $e) {
            error_log("GET_USER_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to load bookings'], 500);
        }
    }

    /**
     * ============================================
     * ✅ FIXED: GET VENDOR BOOKINGS + RESCHEDULE FIELDS
     * ============================================
     * NOW includes LEFT JOIN for pending reschedule data
     * ============================================
     */
    public function getVendorBookings(Request $req, Response $res): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $vendorUserId = $user->mysql_id;

            $esp = DB::table('event_service_provider')->where('UserID', $vendorUserId)->first();
            if (!$esp) {
                return $this->json($res, ['success' => false, 'error' => 'Vendor not found'], 404);
            }

            // ✅ FIXED: Added LEFT JOIN for pending reschedule
            $bookings = DB::table('booking as b')
                ->select([
                    'b.*',
                    'c.first_name as client_first_name',
                    'c.last_name as client_last_name',
                    'c.email as client_email',
                    'br_pending.ID as reschedule_id',
                    'br_pending.OriginalEventDate as original_date',
                    'br_pending.RequestedEventDate as requested_date',
                    'br_pending.Status as reschedule_status'
                ])
                ->leftJoin('credential as c', 'b.UserID', '=', 'c.id')
                ->leftJoin('booking_reschedule as br_pending', function($join) {
                    $join->on('b.ID', '=', 'br_pending.BookingID')
                         ->where('br_pending.Status', '=', 'Pending');
                })
                ->where('b.EventServiceProviderID', $esp->ID)
                ->orderBy('b.CreatedAt', 'DESC')
                ->get();

            foreach ($bookings as $booking) {
                $booking->client_name = trim(($booking->client_first_name ?? '') . ' ' . ($booking->client_last_name ?? ''));

                // ✅ Set flags
                $booking->has_pending_reschedule = !empty($booking->reschedule_id);
                $booking->is_rescheduled = $booking->has_pending_reschedule;

                // ✅ Get reschedule history
                $rescheduleHistory = DB::table('booking_reschedule')
                    ->where('BookingID', $booking->ID)
                    ->orderBy('RequestedAt', 'DESC')
                    ->get();

                $booking->reschedule_history = $rescheduleHistory;
            }

            return $this->json($res, ['success' => true, 'bookings' => $bookings]);

        } catch (\Throwable $e) {
            error_log("GET_VENDOR_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to load bookings'], 500);
        }
    }

    /**
     * ============================================
     * ✅ GET BOOKING DETAILS + RESCHEDULE HISTORY
     * ============================================
     */
    public function getBookingDetails(Request $req, Response $res, array $args): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $bookingId = $args['id'] ?? null;
            if (!$bookingId) {
                return $this->json($res, ['success' => false, 'error' => 'Booking ID required'], 400);
            }

            $booking = DB::table('booking as b')
                ->select(['b.*', 'esp.BusinessName as vendor_name'])
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->first();

            if (!$booking) {
                return $this->json($res, ['success' => false, 'error' => 'Booking not found'], 404);
            }

            // ✅ Get reschedule history
            $rescheduleHistory = DB::table('booking_reschedule')
                ->where('BookingID', $bookingId)
                ->orderBy('RequestedAt', 'DESC')
                ->get();

            $booking->reschedule_history = $rescheduleHistory;

            return $this->json($res, ['success' => true, 'booking' => $booking]);

        } catch (\Throwable $e) {
            error_log("GET_BOOKING_DETAILS_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to load details'], 500);
        }
    }

    /**
     * ============================================
     * ✅ RESCHEDULE BOOKING
     * ============================================
     */
    public function rescheduleBooking(Request $req, Response $res, array $args): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $userId = $user->mysql_id;
            $bookingId = $args['id'] ?? null;
            $data = (array) $req->getParsedBody();

            if (empty($data['new_event_date'])) {
                return $this->json($res, ['success' => false, 'error' => 'New date required'], 400);
            }

            $newEventDate = $data['new_event_date'];

            if (strtotime($newEventDate) <= time()) {
                return $this->json($res, ['success' => false, 'error' => 'Date must be in future'], 400);
            }

            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->select('b.*', 'esp.UserID as vendor_user_id')
                ->first();

            if (!$booking || $booking->UserID != $userId) {
                return $this->json($res, ['success' => false, 'error' => 'Access denied'], 403);
            }

            if ($booking->BookingStatus !== 'Confirmed') {
                return $this->json($res, ['success' => false, 'error' => 'Only confirmed bookings can be rescheduled'], 400);
            }

            $existingReschedule = DB::table('booking_reschedule')
                ->where('BookingID', $bookingId)
                ->where('Status', 'Pending')
                ->first();

            if ($existingReschedule) {
                return $this->json($res, ['success' => false, 'error' => 'Reschedule already pending'], 400);
            }

            $conflictingBooking = DB::table('booking')
                ->where('EventServiceProviderID', $booking->EventServiceProviderID)
                ->where('EventDate', $newEventDate)
                ->where('ID', '!=', $bookingId)
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($conflictingBooking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Vendor unavailable',
                    'conflict' => true
                ], 409);
            }

            DB::beginTransaction();

            try {
                // ✅ Create reschedule request
                $rescheduleId = DB::table('booking_reschedule')->insertGetId([
                    'BookingID' => $bookingId,
                    'OriginalEventDate' => $booking->EventDate,
                    'RequestedEventDate' => $newEventDate,
                    'Status' => 'Pending',
                    'RequestedBy' => $userId,
                    'RequestedAt' => DB::raw('NOW()'),
                    'CreatedAt' => DB::raw('NOW()')
                ]);

                // ✅ Update status to Pending (EventDate stays unchanged!)
                DB::table('booking')->where('ID', $bookingId)->update([
                    'BookingStatus' => 'Pending',
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

                DB::commit();

                $this->sendNotification(
                    $booking->vendor_user_id,
                    'reschedule_request',
                    'Reschedule Request',
                    "Client requested to reschedule {$booking->ServiceName}"
                );

                return $this->json($res, [
                    'success' => true,
                    'message' => 'Reschedule request sent',
                    'reschedule_id' => $rescheduleId
                ]);

            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Throwable $e) {
            error_log("RESCHEDULE_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to reschedule'], 500);
        }
    }

    /**
     * ============================================
     * ✅ UPDATE BOOKING STATUS
     * ============================================
     */
    public function updateBookingStatus(Request $req, Response $res, array $args): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $vendorUserId = $user->mysql_id;
            $bookingId = $args['id'] ?? null;
            $data = (array) $req->getParsedBody();
            $newStatus = $data['status'] ?? null;

            if (!in_array($newStatus, ['Confirmed', 'Rejected'])) {
                return $this->json($res, ['success' => false, 'error' => 'Invalid status'], 400);
            }

            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->select('b.*', 'esp.UserID as vendor_user_id')
                ->first();

            if (!$booking || $booking->vendor_user_id != $vendorUserId) {
                return $this->json($res, ['success' => false, 'error' => 'Access denied'], 403);
            }

            // ✅ Check for pending reschedule
            $rescheduleRequest = DB::table('booking_reschedule')
                ->where('BookingID', $bookingId)
                ->where('Status', 'Pending')
                ->first();

            DB::beginTransaction();

            try {
                if ($rescheduleRequest) {
                    // ✅ RESCHEDULE APPROVAL/REJECTION
                    if ($newStatus === 'Confirmed') {
                        // APPROVE: Update EventDate
                        DB::table('booking')->where('ID', $bookingId)->update([
                            'EventDate' => $rescheduleRequest->RequestedEventDate,
                            'BookingStatus' => 'Confirmed',
                            'Remarks' => "Rescheduled to " . date('F j, Y', strtotime($rescheduleRequest->RequestedEventDate)),
                            'UpdatedAt' => DB::raw('NOW()')
                        ]);

                        DB::table('booking_reschedule')->where('ID', $rescheduleRequest->ID)->update([
                            'Status' => 'Approved',
                            'ProcessedAt' => DB::raw('NOW()'),
                            'ProcessedBy' => $vendorUserId
                        ]);

                        $message = "Reschedule approved!";
                    } else {
                        // REJECT: Keep original EventDate
                        DB::table('booking')->where('ID', $bookingId)->update([
                            'BookingStatus' => 'Confirmed',
                            'UpdatedAt' => DB::raw('NOW()')
                        ]);

                        DB::table('booking_reschedule')->where('ID', $rescheduleRequest->ID)->update([
                            'Status' => 'Rejected',
                            'ProcessedAt' => DB::raw('NOW()'),
                            'ProcessedBy' => $vendorUserId
                        ]);

                        $message = "Reschedule rejected";
                    }

                    $this->sendNotification($booking->UserID, 'reschedule_response', 'Reschedule Response', $message);
                } else {
                    // ✅ REGULAR BOOKING
                    DB::table('booking')->where('ID', $bookingId)->update([
                        'BookingStatus' => $newStatus,
                        'UpdatedAt' => DB::raw('NOW()')
                    ]);

                    $this->sendNotification($booking->UserID, 'booking_update', 'Booking Updated', "Booking {$newStatus}");
                }

                DB::commit();

                return $this->json($res, ['success' => true, 'message' => 'Updated successfully']);

            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Throwable $e) {
            error_log("UPDATE_STATUS_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to update'], 500);
        }
    }

    /**
     * ============================================
     * CANCEL BOOKING
     * ============================================
     */
    public function cancelBooking(Request $req, Response $res, array $args): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $userId = $user->mysql_id;
            $bookingId = $args['id'] ?? null;

            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->select('b.*', 'esp.UserID as vendor_user_id')
                ->first();

            if (!$booking || $booking->UserID != $userId) {
                return $this->json($res, ['success' => false, 'error' => 'Access denied'], 403);
            }

            DB::table('booking')->where('ID', $bookingId)->update([
                'BookingStatus' => 'Cancelled',
                'UpdatedAt' => DB::raw('NOW()')
            ]);

            $this->sendNotification($booking->vendor_user_id, 'booking_cancelled', 'Booking Cancelled', 'Booking cancelled');

            return $this->json($res, ['success' => true, 'message' => 'Cancelled successfully']);

        } catch (\Throwable $e) {
            error_log("CANCEL_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to cancel'], 500);
        }
    }
}