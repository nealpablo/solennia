<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Resolve project root and load env
 * - In production, don't require a .env (use Railway Variables)
 */
$ROOT = realpath(__DIR__ . '/..'); // <- always /app in Railway
$APP_ENV = $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?? 'production';

if ($APP_ENV !== 'production' && is_file($ROOT . '/.env')) {
    Dotenv::createImmutable($ROOT)->load();
} else {
    Dotenv::createImmutable($ROOT)->safeLoad();
}

/**
 * Read DB config STRICTLY from env (no localhost defaults)
 * Pick ONE pair in Railway Variables:
 *   Public proxy: DB_HOST=shortline.proxy.rlwy.net, DB_PORT=52789
 *   Internal    : DB_HOST=solennia.railway.internal, DB_PORT=3306
 */
$driver = $_ENV['DB_CONNECTION'] ?? 'mysql';
$host   = $_ENV['DB_HOST']       ?? null;
$port   = isset($_ENV['DB_PORT']) ? (int)$_ENV['DB_PORT'] : null;
$db     = $_ENV['DB_DATABASE']   ?? null;
$user   = $_ENV['DB_USERNAME']   ?? null;
$pass   = $_ENV['DB_PASSWORD']   ?? null;

if (!$host || !$port || !$db || !$user) {
    throw new \RuntimeException('Missing DB envs. Set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD in Railway.');
}

/** Bootstrap Eloquent */
$capsule = new Capsule();
$capsule->addConnection([
    'driver'    => $driver,
    'host'      => $host,
    'port'      => $port,
    'database'  => $db,
    'username'  => $user,
    'password'  => $pass ?? '',
    'charset'   => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix'    => '',
]);

// Touch connection now; if it fails, you’ll see the real reason in logs
try {
    $capsule->getConnection()->getPdo();
} catch (\Throwable $e) {
    error_log("DB_CONNECT_FAIL to {$host}:{$port} as {$user}/{$db} -> " . $e->getMessage());
    throw $e;
}

$capsule->setAsGlobal();
$capsule->bootEloquent();

date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'UTC');
