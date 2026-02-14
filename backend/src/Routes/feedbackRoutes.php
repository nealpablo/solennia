<?php
use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Src\Controllers\FeedbackController;
use Src\Middleware\AuthMiddleware;

return function (App $app) {
    $feedbackController = new FeedbackController();

    /**
     * ============================================
     * ORIGINAL: GENERAL SYSTEM FEEDBACK
     * ============================================
     */
    // Submit general feedback about the platform
    // POST /api/feedback
    $app->post('/api/feedback', function (Request $req, Response $res) use ($feedbackController) {
        return $feedbackController->submitGeneralFeedback($req, $res);
    })->add(new AuthMiddleware());

    /**
     * ============================================
     * UC08: BOOKING/VENDOR FEEDBACK & REPORTS
     * ============================================
     */
    // Submit feedback for a completed booking
    // POST /api/bookings/{id}/feedback
    $app->post('/api/bookings/{id}/feedback', function (Request $req, Response $res, array $args) use ($feedbackController) {
        return $feedbackController->submitBookingFeedback($req, $res, $args);
    })->add(new AuthMiddleware());

    // Get feedback for a specific booking
    // GET /api/bookings/{id}/feedback
    $app->get('/api/bookings/{id}/feedback', function (Request $req, Response $res, array $args) use ($feedbackController) {
        return $feedbackController->getBookingFeedback($req, $res, $args);
    })->add(new AuthMiddleware());

    // Get all feedback for a vendor (PUBLIC - no auth required)
    // GET /api/vendors/{id}/feedback
    $app->get('/api/vendors/{id}/feedback', function (Request $req, Response $res, array $args) use ($feedbackController) {
        return $feedbackController->getVendorFeedback($req, $res, $args);
    });

    // ⭐ NEW ROUTE - Get all feedback for a venue (PUBLIC - no auth required)
    // GET /api/venues/{id}/feedback
    $app->get('/api/venues/{id}/feedback', function (Request $req, Response $res, array $args) use ($feedbackController) {
        return $feedbackController->getVenueFeedback($req, $res, $args);
    });

    // Get all supplier reports (Admin only)
    // GET /api/admin/reports
    $app->get('/api/admin/reports', function (Request $req, Response $res) use ($feedbackController) {
        return $feedbackController->getAllReports($req, $res);
    })->add(new AuthMiddleware());

    // Update report status (Admin only)
    // PATCH /api/admin/reports/{id}
    $app->patch('/api/admin/reports/{id}', function (Request $req, Response $res, array $args) use ($feedbackController) {
        return $feedbackController->updateReportStatus($req, $res, $args);
    })->add(new AuthMiddleware());
};