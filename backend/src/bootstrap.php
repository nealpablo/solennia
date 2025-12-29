<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Safe env reader (Railway + local)
 */
function envx(string $k, $d = null) {
    if (array_key_exists($k, $_ENV))    return $_ENV[$k];
    if (array_key_exists($k, $_SERVER)) return $_SERVER[$k];
    $v = getenv($k);
    return $v !== false ? $v : $d;
}

$ROOT    = realpath(__DIR__ . '/..');
$APP_ENV = envx('APP_ENV', 'production');

/**
 * Load .env only locally
 */
if ($APP_ENV !== 'production' && is_file($ROOT . '/.env')) {
    Dotenv::createImmutable($ROOT)->load();
}

/**
 * -------------------------------------------------------
 * DATABASE CONFIG (Railway-first)
 * -------------------------------------------------------
 */
$driver = 'mysql';

/** 1️⃣ Railway MySQL variables (PRIMARY) */
$host = envx('MYSQLHOST');
$db   = envx('MYSQLDATABASE');
$user = envx('MYSQLUSER');
$pass = envx('MYSQLPASSWORD');
$port = envx('MYSQLPORT', 3306);

/** 2️⃣ Fallback: DATABASE_URL */
if (!$host && ($url = envx('DATABASE_URL'))) {
    $p = parse_url($url);
    $host = $p['host'] ?? null;
    $port = $p['port'] ?? 3306;
    $user = $p['user'] ?? null;
    $pass = $p['pass'] ?? '';
    $db   = isset($p['path']) ? ltrim($p['path'], '/') : null;
}

/** 3️⃣ Fallback: local DB_* vars */
if (!$host) {
    $host = envx('DB_HOST');
    $db   = envx('DB_DATABASE');
    $user = envx('DB_USERNAME');
    $pass = envx('DB_PASSWORD', '');
    $port = envx('DB_PORT', 3306);
}

/**
 * Fail fast if DB is still incomplete
 */
if (!$host || !$db || !$user) {
    error_log('❌ DB CONFIG INCOMPLETE');
    error_log(json_encode([
        'host' => $host,
        'db'   => $db,
        'user' => $user,
        'port' => $port
    ]));
    throw new RuntimeException('Database configuration incomplete');
}

/**
 * Boot Eloquent
 */
$capsule = new Capsule();
$capsule->addConnection([
    'driver'    => $driver,
    'host'      => $host,
    'port'      => (int)$port,
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
 * Timezone
 */
date_default_timezone_set(envx('APP_TIMEZONE', 'Asia/Singapore'));

/**
 * Firebase config
 */
define('FIREBASE_API_KEY', envx('FIREBASE_API_KEY'));
define('FIREBASE_PROJECT_ID', envx('FIREBASE_PROJECT_ID'));
