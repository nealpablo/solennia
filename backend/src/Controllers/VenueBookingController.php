<?php

namespace Src\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

/**
 * ============================================
 * VENUE BOOKING CONTROLLER
 * ============================================
 * Handles venue booking operations including:
 * - Creating venue bookings with capacity validation
 * - Managing booking status
 * - Checking venue availability
 * - Handling multi-day bookings
 * ============================================
 */
class VenueBookingController
{
    private function json(Response $res, bool $success, string $message, int $status = 200, array $extra = [])
    {
        $payload = array_merge([
            'success' => $success,
            $success ? 'message' : 'error' => $message,
        ], $extra);

        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res->withHeader('Content-Type', 'application/json')
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
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Throwable $e) {
            error_log("Notification Error: " . $e->getMessage());
        }
    }

    /**
     * Get EventServiceProviderID for a venue owner
     * Returns NULL if venue owner is not in event_service_provider table
     * 
     * CRITICAL FIX: Venue owners are not always event service providers!
     * This function checks if the venue owner exists in event_service_provider
     * and returns NULL if they don't, allowing the booking to proceed.
     */
    private function getEventServiceProviderID($venueOwnerId)
    {
        $provider = DB::table('event_service_provider')
            ->where('UserID', $venueOwnerId)
            ->first();
        
        if (!$provider) {
            error_log("INFO: Venue owner (user_id: {$venueOwnerId}) is not in event_service_provider table. Using NULL for EventServiceProviderID.");
        }
        
        return $provider ? $provider->ID : null;
    }

    /* =========================================================
     * CREATE VENUE BOOKING
     * ========================================================= */
    public function createBooking(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;

            $data = (array) $req->getParsedBody();

            // Validate required fields
            $required = ['venue_id', 'event_type', 'start_date', 'guest_count', 'event_location'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $this->json($res, false, "Missing required field: {$field}", 422);
                }
            }

            $venueId = (int) $data['venue_id'];
            $startDate = $data['start_date'];
            $endDate = $data['end_date'] ?? $startDate; // Default to single day
            $guestCount = (int) $data['guest_count'];

            // Get venue details
            $venue = DB::table('venue_listings')
                ->where('id', $venueId)
                ->where('status', 'Active')
                ->first();

            if (!$venue) {
                return $this->json($res, false, "Venue not found or inactive", 404);
            }

            // Check capacity (soft warning - allow booking with note)
            $capacityWarning = null;
            if (!empty($venue->venue_capacity) && $guestCount > (int)$venue->venue_capacity) {
                $capacityWarning = "Guest count ({$guestCount}) exceeds venue capacity ({$venue->venue_capacity})";
            }

            // Check availability
            $conflictingBooking = DB::table('booking')
                ->where('venue_id', $venueId)
                ->where(function($query) use ($startDate, $endDate) {
                    $query->whereBetween('start_date', [$startDate, $endDate])
                          ->orWhereBetween('end_date', [$startDate, $endDate])
                          ->orWhere(function($q) use ($startDate, $endDate) {
                              $q->where('start_date', '<=', $startDate)
                                ->where('end_date', '>=', $endDate);
                          });
                })
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->first();

            if ($conflictingBooking) {
                return $this->json($res, false, "Venue is already booked for the selected dates", 409, [
                    'conflict' => true
                ]);
            }

            // Build booking notes
            $notes = "🏛️ Venue Booking\n\n";
            $notes .= "Guest Count: {$guestCount}\n";
            
            if ($data['event_time'] ?? null) {
                $notes .= "Event Time: {$data['event_time']}\n";
            }
            
            if (!empty($data['selected_amenities'])) {
                $amenities = is_array($data['selected_amenities']) 
                    ? implode(', ', $data['selected_amenities'])
                    : $data['selected_amenities'];
                $notes .= "Selected Amenities: {$amenities}\n";
            }
            
            if ($capacityWarning) {
                $notes .= "\n⚠️ {$capacityWarning}\n";
            }
            
            if (!empty($data['additional_notes'])) {
                $notes .= "\nAdditional Notes:\n{$data['additional_notes']}\n";
            }

            // CRITICAL FIX: EventServiceProviderID is NOT NULL in database
            // Check if venue owner also has an event service provider account
            $eventServiceProviderId = DB::table('event_service_provider')
                ->where('UserID', $venue->user_id)
                ->where('ApplicationStatus', 'Approved')
                ->value('ID');
            
            // If venue owner doesn't have ESP account, use a default placeholder
            // (required because EventServiceProviderID is NOT NULL in schema)
            if (!$eventServiceProviderId) {
                // Use the first available approved ESP as placeholder
                $eventServiceProviderId = DB::table('event_service_provider')
                    ->where('ApplicationStatus', 'Approved')
                    ->value('ID');
                    
                // If still no ESP exists (shouldn't happen), throw error
                if (!$eventServiceProviderId) {
                    throw new \Exception('No event service providers available in system');
                }
            }

            // Create booking with FIXED EventServiceProviderID handling
            $bookingId = DB::table('booking')->insertGetId([
                'UserID' => $userId,
                'venue_id' => $venueId,
                'EventServiceProviderID' => $eventServiceProviderId,
                'ServiceName' => $venue->venue_name,
                'EventDate' => $startDate,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'EventLocation' => $data['event_location'],
                'EventType' => $data['event_type'],
                'guest_count' => $guestCount,
                'PackageSelected' => $data['package_selected'] ?? 'Standard',
                'AdditionalNotes' => $notes,
                'TotalAmount' => floatval($data['total_amount'] ?? 0),
                'BookingStatus' => 'Pending',
                'BookingDate' => DB::raw('NOW()'),
                'CreatedAt' => DB::raw('NOW()'),
                'CreatedBy' => $userId
            ]);

            // Send notification to venue owner
            $client = DB::table('credential')->where('id', $userId)->first();
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));
            
            $this->sendNotification(
                $venue->user_id,
                'venue_booking_request',
                '🏛️ New Venue Booking Request',
                "{$clientName} requested to book {$venue->venue_name} for {$data['event_type']}"
            );

            return $this->json($res, true, "Venue booking request created successfully!", 201, [
                'booking_id' => $bookingId,
                'capacity_warning' => $capacityWarning
            ]);

        } catch (\Exception $e) {
            error_log("CREATE_VENUE_BOOKING_ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->json($res, false, "Booking creation failed: " . $e->getMessage(), 500);
        }
    }

    /* =========================================================
     * GET USER'S VENUE BOOKINGS
     * ========================================================= */
    public function getUserVenueBookings(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;

            // Start with minimal query
            $bookings = DB::table('booking as b')
                ->where('b.UserID', $userId)
                ->whereNotNull('b.venue_id')
                ->select('b.*')
                ->get();

            // If no bookings, return empty array
            if (!$bookings || count($bookings) === 0) {
                return $this->json($res, true, "No venue bookings found", 200, [
                    'bookings' => []
                ]);
            }

            // Enrich each booking with venue data
            $enrichedBookings = [];
            foreach ($bookings as $booking) {
                $bookingArray = (array) $booking;
                
                // Get venue details if venue_id exists
                $venueId = $booking->venue_id ?? null;
                if ($venueId) {
                    $venue = DB::table('venue_listings')->where('id', $venueId)->first();
                    if ($venue) {
                        $bookingArray['venue_name'] = $venue->venue_name ?? null;
                        $bookingArray['venue_address'] = $venue->address ?? null;
                        $bookingArray['venue_capacity'] = $venue->venue_capacity ?? null;
                        $bookingArray['venue_image'] = $venue->logo ?? null;
                        
                        // Get owner info
                        $ownerId = $venue->user_id ?? null;
                        if ($ownerId) {
                            $owner = DB::table('credential')->where('id', $ownerId)->first();
                            if ($owner) {
                                $firstName = $owner->first_name ?? '';
                                $lastName = $owner->last_name ?? '';
                                $ownerName = trim($firstName . ' ' . $lastName);
                                $bookingArray['venue_owner_name'] = $ownerName ?: 'Unknown Owner';
                                $bookingArray['venue_owner_firebase_uid'] = $owner->firebase_uid ?? null;
                            }
                        }
                    }
                }
                
                // Add metadata for frontend
                $bookingArray['ID'] = $booking->ID ?? null;
                $bookingArray['ServiceName'] = $bookingArray['venue_name'] ?? 'Venue';
                $bookingArray['vendor_name'] = $bookingArray['venue_owner_name'] ?? null;
                $bookingArray['isVenueBooking'] = true;
                $bookingArray['booking_type'] = 'venue';
                $bookingArray['has_pending_reschedule'] = false;
                $bookingArray['reschedule_history'] = [];
                $bookingArray['approved_reschedules'] = [];
                $bookingArray['rejected_reschedules'] = [];
                
                $enrichedBookings[] = $bookingArray;
            }

            return $this->json($res, true, "Bookings retrieved", 200, [
                'bookings' => $enrichedBookings
            ]);

        } catch (\Exception $e) {
            error_log("GET_USER_VENUE_BOOKINGS_ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->json($res, false, "Failed to get bookings: " . $e->getMessage(), 500);
        }
    }

    /* =========================================================
     * GET VENUE OWNER'S BOOKINGS
     * ========================================================= */
    public function getVenueOwnerBookings(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;

            $bookings = DB::table('booking as b')
                ->leftJoin('venue_listings as v', 'b.venue_id', '=', 'v.id')
                ->leftJoin('credential as client', 'b.UserID', '=', 'client.id')
                ->where('v.user_id', $userId)
                ->whereNotNull('b.venue_id')
                ->select(
                    'b.*',
                    'v.venue_name',
                    'v.address as venue_address',
                    DB::raw('CONCAT(client.first_name, " ", client.last_name) as client_name'),
                    'client.email as client_email',
                    'client.phone as client_phone'
                )
                ->orderByDesc('b.BookingDate')
                ->get();

            return $this->json($res, true, "Bookings retrieved", 200, [
                'bookings' => $bookings
            ]);

        } catch (\Exception $e) {
            error_log("GET_VENUE_OWNER_BOOKINGS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to get bookings", 500);
        }
    }

    /* =========================================================
     * GET VENUE BOOKING DETAILS
     * ========================================================= */
    public function getVenueBookingDetails(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;
            $bookingId = (int) $args['id'];

            $booking = DB::table('booking as b')
                ->leftJoin('venue_listings as v', 'b.venue_id', '=', 'v.id')
                ->leftJoin('credential as client', 'b.UserID', '=', 'client.id')
                ->leftJoin('credential as owner', 'v.user_id', '=', 'owner.id')
                ->where(function($q) use ($bookingId) {
                    $q->where('b.id', $bookingId)->orWhere('b.BookingID', $bookingId);
                })
                ->whereNotNull('b.venue_id')
                ->where(function($query) use ($userId) {
                    $query->where('b.UserID', $userId)
                          ->orWhere('v.user_id', $userId);
                })
                ->select(
                    'b.*',
                    'v.venue_name',
                    'v.address as venue_address',
                    'v.venue_capacity',
                    'v.logo as venue_image',
                    DB::raw('CONCAT(client.first_name, " ", client.last_name) as client_name'),
                    'client.email as client_email',
                    'client.phone as client_phone',
                    DB::raw('CONCAT(owner.first_name, " ", owner.last_name) as venue_owner_name'),
                    'owner.firebase_uid as venue_owner_firebase_uid'
                )
                ->first();

            if (!$booking) {
                return $this->json($res, false, "Booking not found", 404);
            }

            return $this->json($res, true, "Booking details retrieved", 200, [
                'booking' => $booking
            ]);

        } catch (\Exception $e) {
            error_log("GET_VENUE_BOOKING_DETAILS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to get booking details", 500);
        }
    }

    /* =========================================================
     * UPDATE BOOKING STATUS (VENUE OWNER)
     * ========================================================= */
    public function updateBookingStatus(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;
            $bookingId = (int) $args['id'];

            $data = (array) $req->getParsedBody();
            $status = $data['status'] ?? null;

            if (!in_array($status, ['Confirmed', 'Rejected'])) {
                return $this->json($res, false, "Invalid status", 400);
            }

            // Verify ownership
            $booking = DB::table('booking as b')
                ->join('venue_listings as v', 'b.venue_id', '=', 'v.id')
                ->where(function($q) use ($bookingId) {
                    $q->where('b.id', $bookingId)->orWhere('b.BookingID', $bookingId);
                })
                ->where('v.user_id', $userId)
                ->select('b.*', 'v.venue_name', 'v.user_id as venue_owner_id')
                ->first();

            if (!$booking) {
                return $this->json($res, false, "Booking not found or access denied", 404);
            }

            // Update status
            DB::table('booking')
                ->where(function($q) use ($bookingId) {
                    $q->where('id', $bookingId)->orWhere('BookingID', $bookingId);
                })
                ->update([
                    'BookingStatus' => $status,
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

            // Notify client
            $this->sendNotification(
                $booking->UserID,
                'booking_status_update',
                "Venue Booking {$status}",
                "Your booking for {$booking->venue_name} has been {$status}"
            );

            return $this->json($res, true, "Booking status updated to {$status}", 200);

        } catch (\Exception $e) {
            error_log("UPDATE_VENUE_BOOKING_STATUS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to update booking status", 500);
        }
    }

    /* =========================================================
     * CANCEL BOOKING (CLIENT)
     * ========================================================= */
    public function cancelBooking(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;
            $bookingId = (int) $args['id'];

            $booking = DB::table('booking as b')
                ->leftJoin('venue_listings as v', 'b.venue_id', '=', 'v.id')
                ->where(function($q) use ($bookingId) {
                    $q->where('b.id', $bookingId)->orWhere('b.BookingID', $bookingId);
                })
                ->where('b.UserID', $userId)
                ->select('b.*', 'v.venue_name', 'v.user_id as venue_owner_id')
                ->first();

            if (!$booking) {
                return $this->json($res, false, "Booking not found", 404);
            }

            if ($booking->BookingStatus === 'Cancelled') {
                return $this->json($res, false, "Booking already cancelled", 400);
            }

            DB::table('booking')
                ->where(function($q) use ($bookingId) {
                    $q->where('id', $bookingId)->orWhere('BookingID', $bookingId);
                })
                ->update([
                    'BookingStatus' => 'Cancelled',
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

            // Notify venue owner
            if ($booking->venue_owner_id) {
                $this->sendNotification(
                    $booking->venue_owner_id,
                    'booking_cancelled',
                    'Venue Booking Cancelled',
                    "A booking for {$booking->venue_name} has been cancelled by the client"
                );
            }

            return $this->json($res, true, "Booking cancelled successfully", 200);

        } catch (\Exception $e) {
            error_log("CANCEL_VENUE_BOOKING_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to cancel booking", 500);
        }
    }

    /* =========================================================
     * RESCHEDULE BOOKING (CLIENT)
     * ========================================================= */
    public function rescheduleBooking(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }
            $userId = $user->mysql_id;
            $bookingId = (int) $args['id'];

            $data = (array) $req->getParsedBody();
            $newStartDate = $data['new_start_date'] ?? null;
            $newEndDate = $data['new_end_date'] ?? $newStartDate;

            if (!$newStartDate) {
                return $this->json($res, false, "New date is required", 422);
            }

            $booking = DB::table('booking')
                ->where(function($q) use ($bookingId) {
                    $q->where('id', $bookingId)->orWhere('BookingID', $bookingId);
                })
                ->where('UserID', $userId)
                ->first();

            if (!$booking) {
                return $this->json($res, false, "Booking not found", 404);
            }

            // Check new date availability
            $conflict = DB::table('booking')
                ->where('venue_id', $booking->venue_id)
                ->whereRaw('COALESCE(id, BookingID) != ?', [$bookingId])
                ->where(function($query) use ($newStartDate, $newEndDate) {
                    $query->whereBetween('start_date', [$newStartDate, $newEndDate])
                          ->orWhereBetween('end_date', [$newStartDate, $newEndDate])
                          ->orWhere(function($q) use ($newStartDate, $newEndDate) {
                              $q->where('start_date', '<=', $newStartDate)
                                ->where('end_date', '>=', $newEndDate);
                          });
                })
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->exists();

            if ($conflict) {
                return $this->json($res, false, "Venue is not available for the new dates", 409);
            }

            // Update booking
            DB::table('booking')
                ->where(function($q) use ($bookingId) {
                    $q->where('id', $bookingId)->orWhere('BookingID', $bookingId);
                })
                ->update([
                    'EventDate' => $newStartDate,
                    'start_date' => $newStartDate,
                    'end_date' => $newEndDate,
                    'BookingStatus' => 'Pending', // Reset to pending for owner approval
                    'UpdatedAt' => DB::raw('NOW()')
                ]);

            // Notify venue owner - FIX: Get the actual venue owner ID from venue_listings
            $venue = DB::table('venue_listings')->where('id', $booking->venue_id)->first();
            if ($venue && $venue->user_id) {
                $this->sendNotification(
                    $venue->user_id, // FIX: Use venue owner ID, not EventServiceProviderID
                    'booking_rescheduled',
                    'Venue Booking Rescheduled',
                    "A booking has been rescheduled to {$newStartDate}"
                );
            }

            return $this->json($res, true, "Booking rescheduled successfully. Awaiting venue owner approval.", 200);

        } catch (\Exception $e) {
            error_log("RESCHEDULE_VENUE_BOOKING_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to reschedule booking", 500);
        }
    }

    /* =========================================================
     * CHECK VENUE AVAILABILITY
     * ========================================================= */
    public function checkVenueAvailability(Request $req, Response $res, array $args)
    {
        try {
            $venueId = (int) $args['id'];
            $params = $req->getQueryParams();
            $startDate = $params['start_date'] ?? null;
            $endDate = $params['end_date'] ?? $startDate;

            if (!$startDate) {
                return $this->json($res, false, "Start date is required", 422);
            }

            $venue = DB::table('venue_listings')
                ->where('id', $venueId)
                ->first();

            if (!$venue) {
                return $this->json($res, false, "Venue not found", 404);
            }

            // Check for conflicting bookings
            $bookings = DB::table('booking')
                ->where('venue_id', $venueId)
                ->where(function($query) use ($startDate, $endDate) {
                    $query->whereBetween('start_date', [$startDate, $endDate])
                          ->orWhereBetween('end_date', [$startDate, $endDate])
                          ->orWhere(function($q) use ($startDate, $endDate) {
                              $q->where('start_date', '<=', $startDate)
                                ->where('end_date', '>=', $endDate);
                          });
                })
                ->whereNotIn('BookingStatus', ['Cancelled', 'Rejected'])
                ->select('start_date', 'end_date', 'BookingStatus')
                ->get();

            $available = $bookings->isEmpty();

            return $this->json($res, true, "Availability checked", 200, [
                'available' => $available,
                'venue' => [
                    'id' => $venue->id,
                    'name' => $venue->venue_name,
                    'capacity' => $venue->venue_capacity
                ],
                'conflicting_bookings' => $bookings
            ]);

        } catch (\Exception $e) {
            error_log("CHECK_VENUE_AVAILABILITY_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to check availability", 500);
        }
    }
}