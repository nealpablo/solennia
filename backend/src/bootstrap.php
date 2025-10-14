<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

// Compute root the same way as index.php
$DOCROOT = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/../public', '/');
$PROJECT_ROOT = \dirname($DOCROOT);

// Autoload is already done in index.php, but keep safe:
if (!class_exists(Dotenv::class)) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
}

/* Env: safe load (works with Railway Variables) */
if (file_exists($PROJECT_ROOT . '/.env')) {
    Dotenv::createImmutable($PROJECT_ROOT)->load();
} else {
    Dotenv::createImmutable($PROJECT_ROOT)->safeLoad();
}

/* Database */
$driver = $_ENV['DB_CONNECTION'] ?? $_ENV['DB_DRIVER'] ?? 'mysql';
$host   = $_ENV['DB_HOST']       ?? '127.0.0.1';
$port   = (int)($_ENV['DB_PORT'] ?? 3306);
$db     = $_ENV['DB_DATABASE']   ?? 'solennia';
$user   = $_ENV['DB_USERNAME']   ?? 'root';
$pass   = $_ENV['DB_PASSWORD']   ?? '';

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

date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'UTC');
