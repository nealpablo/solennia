<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

/*
|--------------------------------------------------------------------------
| Environment Loader  (Safe for Railway or Local)
|--------------------------------------------------------------------------
|
| • In local dev (.env present): load it normally.
| • In production (Railway): use injected environment variables.
|
*/
$rootPath = dirname(__DIR__);

if (file_exists($rootPath . '/.env')) {
    // Local dev
    $dotenv = Dotenv::createImmutable($rootPath);
    $dotenv->load();
} else {
    // Production (Railway)
    $dotenv = Dotenv::createImmutable($rootPath);
    $dotenv->safeLoad();
}

/*
|--------------------------------------------------------------------------
| Read DB config — supports both DB_CONNECTION and DB_DRIVER
|--------------------------------------------------------------------------
*/
$driver = $_ENV['DB_CONNECTION'] ?? $_ENV['DB_DRIVER'] ?? 'mysql';
$host   = $_ENV['DB_HOST']       ?? '127.0.0.1';
$port   = (int)($_ENV['DB_PORT'] ?? 3306);
$db     = $_ENV['DB_DATABASE']   ?? 'solennia';
$user   = $_ENV['DB_USERNAME']   ?? 'root';
$pass   = $_ENV['DB_PASSWORD']   ?? '';

/*
|--------------------------------------------------------------------------
| Eloquent (Illuminate/Database) bootstrap
|--------------------------------------------------------------------------
*/
$capsule = new Capsule();
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

/*
|--------------------------------------------------------------------------
| Optional: default timezone
|--------------------------------------------------------------------------
*/
date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'UTC');
