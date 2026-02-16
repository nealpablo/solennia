<?php

namespace Src\Services;

use Illuminate\Database\Capsule\Manager as DB;

class NotificationService
{

    // Send notification to specific user
    public static function send($userId, $type, $title, $message)
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

            return true;
        }
        catch (Exception $e) {
            error_log("Failed to send notification: " . $e->getMessage());
            return false;
        }
    }

    // Send notification to all admins (role = 2)
    public static function sendToAdmin($type, $title, $message)
    {
        try {
            $admins = DB::table('credential')
                ->where('role', 2)
                ->get();

            foreach ($admins as $admin) {
                self::send($admin->id, $type, $title, $message);
            }

            return count($admins);
        }
        catch (Exception $e) {
            error_log("Failed to send admin notification: " . $e->getMessage());
            return false;
        }
    }
}