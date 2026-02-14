<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;


class FeedbackController
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

    /**
     * ============================================
     * For users to provide feedback about the platform itself
     */
    public function submitGeneralFeedback(Request $req, Response $res): Response
    {
        try {
            $user = $req->getAttribute('user');
            $userId = isset($user->mysql_id) ? (int)$user->mysql_id : 0;

            if ($userId <= 0) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Unauthorized'
                ], 401);
            }

            $data = (array) $req->getParsedBody();
            $message = trim($data['message'] ?? '');

            if ($message === '') {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Message is required'
                ], 400);
            }

            DB::table('feedback')->insert([
                'user_id' => $userId,
                'message' => $message,
                'created_at' => DB::raw('NOW()')
            ]);

            return $this->json($res, [
                'success' => true,
                'message' => 'Feedback submitted successfully'
            ], 201);

        } catch (\Throwable $e) {
            error_log('GENERAL_FEEDBACK_ERROR: ' . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => 'Failed to submit feedback'
            ], 500);
        }
    }

    /**
     * For clients to rate vendors after completed bookings
     */
    public function submitBookingFeedback(Request $req, Response $res, array $args): Response
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
            $bookingId = $args['id'] ?? null;
            $data = (array) $req->getParsedBody();

            // Validate required fields
            if (!isset($data['rating']) || $data['rating'] < 1 || $data['rating'] > 5) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Rating must be between 1 and 5 stars'
                ], 400);
            }

            // Get booking details
            $booking = DB::table('booking as b')
                ->leftJoin('event_service_provider as esp', 'b.EventServiceProviderID', '=', 'esp.ID')
                ->where('b.ID', $bookingId)
                ->where('b.UserID', $userId)
                ->select('b.*', 'esp.UserID as vendor_user_id', 'esp.BusinessName as vendor_name')
                ->first();

            if (!$booking) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Booking not found or access denied'
                ], 404);
            }

            // Check if booking is completed
            if ($booking->BookingStatus !== 'Completed') {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'You can only leave feedback for completed bookings'
                ], 400);
            }

            // Check if feedback already exists
            $existingFeedback = DB::table('booking_feedback')
                ->where('BookingID', $bookingId)
                ->first();

            if ($existingFeedback) {
                return $this->json($res, [
                    'success' => false,
                    'error' => 'Feedback already submitted for this booking'
                ], 409);
            }

            DB::beginTransaction();

            try {
                // Insert feedback
                $feedbackId = DB::table('booking_feedback')->insertGetId([
                    'BookingID' => $bookingId,
                    'UserID' => $userId,
                    'EventServiceProviderID' => $booking->EventServiceProviderID,
                    'Rating' => (int) $data['rating'],
                    'Comment' => $data['comment'] ?? null,
                    'IsReported' => isset($data['report']) && $data['report'] ? 1 : 0,
                    'CreatedAt' => DB::raw('NOW()')
                ]);

                // If this includes a report, create the report entry
                if (isset($data['report']) && $data['report']) {
                    if (empty($data['report_reason']) || empty($data['report_details'])) {
                        throw new \Exception('Report reason and details are required');
                    }

                    $validReasons = ['violated_agreement', 'no_response', 'poor_service', 'unprofessional', 'safety_concern', 'other'];
                    if (!in_array($data['report_reason'], $validReasons)) {
                        throw new \Exception('Invalid report reason');
                    }

                    DB::table('supplier_reports')->insert([
                        'FeedbackID' => $feedbackId,
                        'BookingID' => $bookingId,
                        'ReportedBy' => $userId,
                        'EventServiceProviderID' => $booking->EventServiceProviderID,
                        'ReportReason' => $data['report_reason'],
                        'ReportDetails' => $data['report_details'],
                        'Status' => 'Pending',
                        'CreatedAt' => DB::raw('NOW()')
                    ]);

                    // Notify admins about the report
                    $admins = DB::table('credential')
                        ->where('user_role', 'admin')
                        ->get();

                    foreach ($admins as $admin) {
                        $this->sendNotification(
                            $admin->id,
                            'supplier_report',
                            'New Supplier Report',
                            "A client has reported {$booking->vendor_name} for review"
                        );
                    }
                }

                // Notify vendor/venue owner about the feedback
                // Determine who should receive the notification
                $notificationRecipientId = null;
                $recipientType = 'vendor';
                
                // For venue bookings, get the venue owner's user ID
                if (!empty($booking->venue_id)) {
                    $venue = DB::table('venue_listings')
                        ->where('id', $booking->venue_id)
                        ->first();
                    
                    if ($venue && !empty($venue->firebase_uid)) {
                        // Get user ID from credential table using firebase_uid
                        $venueOwner = DB::table('credential')
                            ->where('firebase_uid', $venue->firebase_uid)
                            ->first();
                        
                        if ($venueOwner) {
                            $notificationRecipientId = $venueOwner->id;
                            $recipientType = 'venue';
                        }
                    }
                }
                
                // For vendor service bookings, use vendor_user_id
                if (!$notificationRecipientId && !empty($booking->vendor_user_id)) {
                    $notificationRecipientId = $booking->vendor_user_id;
                    $recipientType = 'vendor';
                }
                
                // Send notification if we have a valid recipient
                if ($notificationRecipientId) {
                    $this->sendNotification(
                        $notificationRecipientId,
                        'feedback_received',
                        'New Feedback Received',
                        "You received a {$data['rating']}-star review"
                    );
                }

                DB::commit();

                return $this->json($res, [
                    'success' => true,
                    'message' => 'Feedback submitted successfully',
                    'feedback_id' => $feedbackId
                ], 201);

            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Throwable $e) {
            error_log("BOOKING_FEEDBACK_ERROR: " . $e->getMessage());
            return $this->json($res, [
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get feedback for a specific booking
     * GET /api/bookings/{id}/feedback
     */
    public function getBookingFeedback(Request $req, Response $res, array $args): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            $userId = $user->mysql_id;
            $bookingId = $args['id'] ?? null;

            // Get booking to verify access
            $booking = DB::table('booking')
                ->where('ID', $bookingId)
                ->where('UserID', $userId)
                ->first();

            if (!$booking) {
                return $this->json($res, ['success' => false, 'error' => 'Access denied'], 403);
            }

            // Get feedback if exists
            $feedback = DB::table('booking_feedback as bf')
                ->leftJoin('supplier_reports as sr', 'bf.ID', '=', 'sr.FeedbackID')
                ->where('bf.BookingID', $bookingId)
                ->select('bf.*', 'sr.ID as report_id', 'sr.ReportReason', 'sr.ReportDetails', 'sr.Status as report_status')
                ->first();

            return $this->json($res, [
                'success' => true,
                'feedback' => $feedback
            ]);

        } catch (\Throwable $e) {
            error_log("GET_FEEDBACK_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to get feedback'], 500);
        }
    }

    /**
     * Get all feedback for a vendor
     * GET /api/vendors/{id}/feedback
     */
    public function getVendorFeedback(Request $req, Response $res, array $args): Response
    {
        try {
            $vendorId = $args['id'] ?? null;

            // Get vendor ESP ID
            $vendor = DB::table('event_service_provider')
                ->where('UserID', $vendorId)
                ->first();

            if (!$vendor) {
                return $this->json($res, ['success' => false, 'error' => 'Vendor not found'], 404);
            }

            // Get all feedback for this vendor (EXCLUDING venue-only bookings)
            // Only show reviews where the booking does NOT have a venue_id (vendor services only)
            $feedback = DB::table('booking_feedback as bf')
                ->leftJoin('credential as c', 'bf.UserID', '=', 'c.id')
                ->leftJoin('booking as b', 'bf.BookingID', '=', 'b.ID')
                ->where('bf.EventServiceProviderID', $vendor->ID)
                ->whereNull('b.venue_id')  // Exclude venue bookings
                ->select([
                    'bf.*',
                    'c.first_name',
                    'c.last_name',
                    'c.avatar',
                    'b.ServiceName',
                    'b.EventType',
                    'b.EventDate'
                ])
                ->orderBy('bf.CreatedAt', 'DESC')
                ->get();

            // Calculate average rating and total reviews for vendor-only bookings
            $avgRating = DB::table('booking_feedback as bf')
                ->join('booking as b', 'bf.BookingID', '=', 'b.ID')
                ->where('bf.EventServiceProviderID', $vendor->ID)
                ->whereNull('b.venue_id')
                ->avg('bf.Rating');

            $totalReviews = DB::table('booking_feedback as bf')
                ->join('booking as b', 'bf.BookingID', '=', 'b.ID')
                ->where('bf.EventServiceProviderID', $vendor->ID)
                ->whereNull('b.venue_id')
                ->count();

            return $this->json($res, [
                'success' => true,
                'feedback' => $feedback,
                'average_rating' => $avgRating ? round($avgRating, 1) : null,
                'total_reviews' => $totalReviews
            ]);

        } catch (\Throwable $e) {
            error_log("GET_VENDOR_FEEDBACK_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to get feedback'], 500);
        }
    }

    /**
     * Get all reports (Admin only)
     * GET /api/admin/reports
     */
    public function getAllReports(Request $req, Response $res): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            // Check if user is admin
            $userProfile = DB::table('credential')->where('id', $user->mysql_id)->first();
            if (!$userProfile || $userProfile->user_role !== 'admin') {
                return $this->json($res, ['success' => false, 'error' => 'Access denied - Admin only'], 403);
            }

            $params = $req->getQueryParams();
            $status = $params['status'] ?? null;

            $query = DB::table('supplier_reports as sr')
                ->leftJoin('booking_feedback as bf', 'sr.FeedbackID', '=', 'bf.ID')
                ->leftJoin('booking as b', 'sr.BookingID', '=', 'b.ID')
                ->leftJoin('credential as c', 'sr.ReportedBy', '=', 'c.id')
                ->leftJoin('event_service_provider as esp', 'sr.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as vc', 'esp.UserID', '=', 'vc.id')
                ->select([
                    'sr.*',
                    'bf.Rating',
                    'bf.Comment as feedback_comment',
                    'b.ServiceName',
                    'b.EventDate',
                    'c.first_name as reporter_first_name',
                    'c.last_name as reporter_last_name',
                    'c.email as reporter_email',
                    'esp.BusinessName as vendor_name',
                    'vc.email as vendor_email'
                ])
                ->orderBy('sr.CreatedAt', 'DESC');

            if ($status) {
                $query->where('sr.Status', $status);
            }

            $reports = $query->get();

            return $this->json($res, [
                'success' => true,
                'reports' => $reports
            ]);

        } catch (\Throwable $e) {
            error_log("GET_REPORTS_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to get reports'], 500);
        }
    }

    /**
     * Update report status (Admin only)
     * PATCH /api/admin/reports/{id}
     */
    public function updateReportStatus(Request $req, Response $res, array $args): Response
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, ['success' => false, 'error' => 'Unauthorized'], 401);
            }

            // Check if user is admin
            $userProfile = DB::table('credential')->where('id', $user->mysql_id)->first();
            if (!$userProfile || $userProfile->user_role !== 'admin') {
                return $this->json($res, ['success' => false, 'error' => 'Access denied - Admin only'], 403);
            }

            $reportId = $args['id'] ?? null;
            $data = (array) $req->getParsedBody();
            $newStatus = $data['status'] ?? null;

            $validStatuses = ['Pending', 'Under_Review', 'Resolved', 'Dismissed'];
            if (!in_array($newStatus, $validStatuses)) {
                return $this->json($res, ['success' => false, 'error' => 'Invalid status'], 400);
            }

            DB::table('supplier_reports')
                ->where('ID', $reportId)
                ->update([
                    'Status' => $newStatus,
                    'AdminNotes' => $data['admin_notes'] ?? null,
                    'ReviewedBy' => $user->mysql_id,
                    'ReviewedAt' => DB::raw('NOW()'),
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

            return $this->json($res, [
                'success' => true,
                'message' => 'Report status updated successfully'
            ]);

        } catch (\Throwable $e) {
            error_log("UPDATE_REPORT_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to update report'], 500);
        }
    }

    /**
     * Get all feedback for a venue
     * GET /api/venues/{id}/feedback
     */
    public function getVenueFeedback(Request $req, Response $res, array $args): Response
    {
        try {
            $venueId = $args['id'] ?? null;

            // Get venue details
            $venue = DB::table('venue_listings')
                ->where('id', $venueId)
                ->first();

            if (!$venue) {
                return $this->json($res, ['success' => false, 'error' => 'Venue not found'], 404);
            }

            // Get all feedback for this venue from bookings
            $feedback = DB::table('booking_feedback as bf')
                ->leftJoin('credential as c', 'bf.UserID', '=', 'c.id')
                ->leftJoin('booking as b', 'bf.BookingID', '=', 'b.ID')
                ->where('b.venue_id', $venueId)
                ->select([
                    'bf.*',
                    'c.first_name',
                    'c.last_name',
                    'c.avatar',
                    'b.ServiceName',
                    'b.EventType',
                    'b.EventDate',
                    'b.start_date',
                    'b.end_date'
                ])
                ->orderBy('bf.CreatedAt', 'DESC')
                ->get();

            // Calculate average rating and total reviews for this venue
            $avgRating = DB::table('booking_feedback as bf')
                ->join('booking as b', 'bf.BookingID', '=', 'b.ID')
                ->where('b.venue_id', $venueId)
                ->avg('bf.Rating');

            $totalReviews = DB::table('booking_feedback as bf')
                ->join('booking as b', 'bf.BookingID', '=', 'b.ID')
                ->where('b.venue_id', $venueId)
                ->count();

            return $this->json($res, [
                'success' => true,
                'feedback' => $feedback,
                'average_rating' => $avgRating ? round($avgRating, 1) : null,
                'total_reviews' => $totalReviews
            ]);

        } catch (\Throwable $e) {
            error_log("GET_VENUE_FEEDBACK_ERROR: " . $e->getMessage());
            return $this->json($res, ['success' => false, 'error' => 'Failed to get feedback'], 500);
        }
    }
}