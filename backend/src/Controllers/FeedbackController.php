<?php

namespace Src\Controllers;

use Illuminate\Database\Capsule\Manager as DB;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class FeedbackController
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

    private function sendNotification($userId, $type, $title, $message)
    {
        try {
            DB::table('notifications')->insert([
                'user_id'    => $userId,
                'type'       => $type,
                'title'      => $title,
                'message'    => $message,
                'read'       => false,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Throwable $e) {
            error_log("NOTIFICATION_ERROR: " . $e->getMessage());
        }
    }

    /**
     * Check if a column exists in credential table without crashing.
     * Used to degrade gracefully when DB migration hasn't run yet.
     */
    private function credentialHasColumn(string $column): bool
    {
        try {
            $cols = DB::select("SHOW COLUMNS FROM `credential` LIKE ?", [$column]);
            return !empty($cols);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Get All Reports (For Admin Panel)
     *
     * ROOT CAUSE OF 500: Was joining on r.ReporterID and r.VendorID — those columns
     * don't exist. Real columns are r.ReportedBy and r.EventServiceProviderID.
     * Also: selecting warning_count / suspended_at which may not exist yet in DB.
     * FIX: correct column names + runtime column-existence check so it never 500s.
     */
    public function getAllReports(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            $adminDef = DB::table('credential')->where('id', $user->mysql_id)->first();
            if (!$adminDef || (int)$adminDef->role !== 2) {
                return $this->json($res, false, "Access denied", 403);
            }

            // Safely check if new columns exist before selecting them
            $hasNewCols = $this->credentialHasColumn('warning_count');

            $selectCols = [
                'r.ID',
                'r.FeedbackID',
                'r.BookingID',
                'r.ReportedBy',
                'r.EventServiceProviderID',
                'r.ReportReason',
                'r.ReportDetails',
                'r.Status',
                'r.AdminNotes',
                'r.ReviewedBy',
                'r.ReviewedAt',
                'r.CreatedAt',
                'reporter.first_name as reporter_first_name',
                'reporter.last_name  as reporter_last_name',
                'reporter.email      as reporter_email',
                'vc.email            as vendor_email',
                'vc.id               as vendor_user_id',
                'esp.BusinessName    as vendor_name',
                'b.ServiceName',
                'b.EventDate',
            ];

            if ($hasNewCols) {
                $selectCols[] = 'vc.warning_count as vendor_warning_count';
                $selectCols[] = 'vc.suspended_at  as vendor_suspended_at';
            } else {
                $selectCols[] = DB::raw('0    as vendor_warning_count');
                $selectCols[] = DB::raw('NULL as vendor_suspended_at');
            }

            $reports = DB::table('supplier_reports as r')
                // FIX: correct column names
                ->leftJoin('credential as reporter',    'r.ReportedBy',             '=', 'reporter.id')
                ->leftJoin('event_service_provider as esp', 'r.EventServiceProviderID', '=', 'esp.ID')
                ->leftJoin('credential as vc',          'esp.UserID',               '=', 'vc.id')
                ->leftJoin('booking as b',              'r.BookingID',              '=', 'b.ID')
                ->select($selectCols)
                ->orderBy('r.CreatedAt', 'desc')
                ->get();

            // Fallback: fill vendor_name from credential if ESP profile missing
            foreach ($reports as $report) {
                if (empty($report->vendor_name) && !empty($report->vendor_user_id)) {
                    $v = DB::table('credential')->where('id', $report->vendor_user_id)->first();
                    $report->vendor_name = $v
                        ? (trim(($v->first_name ?? '') . ' ' . ($v->last_name ?? '')) ?: ($v->username ?? 'Unknown Vendor'))
                        : 'Unknown Vendor';
                }
                if (!isset($report->vendor_warning_count)) $report->vendor_warning_count = 0;
                if (!isset($report->vendor_suspended_at))  $report->vendor_suspended_at  = null;
            }

            return $this->json($res, true, "Reports fetched", 200, ['reports' => $reports]);

        } catch (\Throwable $e) {
            error_log("GET_ALL_REPORTS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to fetch reports: " . $e->getMessage(), 500);
        }
    }

    /**
     * Update Report Status (Admin only)
     * Also notifies both client and supplier of outcome.
     */
    public function updateReportStatus(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            $adminDef = DB::table('credential')->where('id', $user->mysql_id)->first();
            if (!$adminDef || (int)$adminDef->role !== 2) {
                return $this->json($res, false, "Access denied", 403);
            }

            $reportId   = $args['id'] ?? null;
            $data       = (array) $req->getParsedBody();
            $status     = $data['status']      ?? null;
            $adminNotes = $data['admin_notes'] ?? null;

            if (!$reportId || !$status) {
                return $this->json($res, false, "Missing ID or status", 400);
            }

            $report = DB::table('supplier_reports')->where('ID', $reportId)->first();
            if (!$report) {
                return $this->json($res, false, "Report not found", 404);
            }

            DB::table('supplier_reports')
                ->where('ID', $reportId)
                ->update([
                    'Status'     => $status,
                    'AdminNotes' => $adminNotes,
                    'ReviewedBy' => $user->mysql_id,
                    'ReviewedAt' => date('Y-m-d H:i:s'),
                    'UpdatedAt'  => date('Y-m-d H:i:s'),
                ]);

            // Notify client who filed
            if (!empty($report->ReportedBy)) {
                $clientMsg = match($status) {
                    'Resolved'     => 'Your report has been reviewed and resolved. Thank you for helping keep Solennia safe.',
                    'Dismissed'    => 'Your report has been reviewed. After investigation, no action was taken at this time.',
                    'Under_Review' => 'Your report is currently under active review. We will notify you of the outcome.',
                    default        => 'Your report status has been updated.',
                };
                $this->sendNotification($report->ReportedBy, 'report_update', 'Report Update', $clientMsg);
            }

            // Notify supplier on resolution
            if (!empty($report->EventServiceProviderID) && in_array($status, ['Resolved', 'Dismissed'])) {
                $esp = DB::table('event_service_provider')
                    ->where('ID', $report->EventServiceProviderID)
                    ->first();
                if ($esp && !empty($esp->UserID)) {
                    $supplierMsg = $status === 'Resolved'
                        ? 'A complaint filed against your account has been reviewed and actioned. Please review platform guidelines to avoid future issues.'
                        : 'A complaint filed against your account has been reviewed and dismissed. No action was taken.';
                    $this->sendNotification($esp->UserID, 'report_outcome', 'Account Notice', $supplierMsg);
                }
            }

            return $this->json($res, true, "Report status updated", 200);

        } catch (\Throwable $e) {
            error_log("UPDATE_REPORT_STATUS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to update report status", 500);
        }
    }
}