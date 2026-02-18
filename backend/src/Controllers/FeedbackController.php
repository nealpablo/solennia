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

    /**
     * Get All Reports (For Admin Panel)
     */
    public function getAllReports(Request $req, Response $res)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            // Verify admin
            $adminDef = DB::table('credential')->where('id', $user->mysql_id)->first();
            if (!$adminDef || (int)$adminDef->role !== 2) {
                return $this->json($res, false, "Access denied", 403);
            }

            $reports = DB::table('supplier_reports as r')
                ->leftJoin('credential as reporter', 'r.ReporterID', '=', 'reporter.id')
                ->leftJoin('credential as vendor', 'r.VendorID', '=', 'vendor.id')
                ->leftJoin('event_service_provider as esp', 'r.VendorID', '=', 'esp.UserID')
                ->select(
                    'r.*',
                    'reporter.first_name as reporter_first_name',
                    'reporter.last_name as reporter_last_name',
                    'reporter.email as reporter_email',
                    'vendor.email as vendor_email',
                    'vendor.id as vendor_user_id',
                    'vendor.warning_count as vendor_warning_count',
                    'vendor.suspended_at as vendor_suspended_at', // Important for UI badges
                    'esp.BusinessName as vendor_name'
                )
                ->orderBy('r.CreatedAt', 'desc')
                ->get();

            // Fallback for vendor name if ESP profile missing
            foreach ($reports as $idx => $report) {
                if (empty($report->vendor_name)) {
                    $v = DB::table('credential')->where('id', $report->VendorID)->first();
                    $reports[$idx]->vendor_name = $v ? ($v->username ?? 'Unknown Vendor') : 'Unknown Vendor';
                }
            }

            return $this->json($res, true, "Reports fetched", 200, ['reports' => $reports]);

        } catch (\Throwable $e) {
            error_log("GET_ALL_REPORTS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to fetch reports", 500);
        }
    }

    /**
     * Update Report Status
     */
    public function updateReportStatus(Request $req, Response $res, array $args)
    {
        try {
            $user = $req->getAttribute('user');
            if (!$user || !isset($user->mysql_id)) {
                return $this->json($res, false, "Unauthorized", 401);
            }

            // Verify admin
            $adminDef = DB::table('credential')->where('id', $user->mysql_id)->first();
            if (!$adminDef || (int)$adminDef->role !== 2) {
                return $this->json($res, false, "Access denied", 403);
            }

            $reportId = $args['id'] ?? null;
            $data = (array)$req->getParsedBody();
            $status = $data['status'] ?? null;
            $adminNotes = $data['admin_notes'] ?? null;

            if (!$reportId || !$status) {
                return $this->json($res, false, "Missing ID or status", 400);
            }

            // Check if report exists
            $exists = DB::table('supplier_reports')->where('ID', $reportId)->exists();
            if (!$exists) {
                return $this->json($res, false, "Report not found", 404);
            }

            DB::table('supplier_reports')
                ->where('ID', $reportId)
                ->update([
                    'Status' => $status,
                    'AdminNotes' => $adminNotes,
                    'ReviewedBy' => $user->mysql_id,
                    'ReviewedAt' => date('Y-m-d H:i:s'),
                    'UpdatedAt' => date('Y-m-d H:i:s')
                ]);

            return $this->json($res, true, "Report status updated", 200);

        } catch (\Throwable $e) {
            error_log("UPDATE_REPORT_STATUS_ERROR: " . $e->getMessage());
            return $this->json($res, false, "Failed to update report status", 500);
        }
    }
}