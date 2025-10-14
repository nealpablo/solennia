<?php
use Illuminate\Database\Capsule\Manager as Capsule;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Load .env
 */
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

/**
 * Read DB config — support both DB_CONNECTION and DB_DRIVER
 */
$driver = $_ENV['DB_CONNECTION'] ?? $_ENV['DB_DRIVER'] ?? 'mysql';
$host   = $_ENV['DB_HOST']       ?? '127.0.0.1';
$port   = (int)($_ENV['DB_PORT'] ?? 3306);
$db     = $_ENV['DB_DATABASE']   ?? 'solennia';
$user   = $_ENV['DB_USERNAME']   ?? 'root';
$pass   = $_ENV['DB_PASSWORD']   ?? '';

/**
 * Eloquent (Illuminate/Database) bootstrap
 */
$capsule = new Capsule;
$capsule->addConnection([
    'driver'    => $driver,
    'host'      => $host,
    'port'      => $port,
    'database'  => $db,
    'username'  => $user,
    'password'  => $pass,
    'charset'   => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix'    => '',
]);

$capsule->setAsGlobal();
$capsule->bootEloquent();

/**
 * Optional: default timezone for timestamps
 */
date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'UTC');
