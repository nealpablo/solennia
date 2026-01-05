<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Safe env reader (Railway + local)
 */
function envx(string $k, $d = null) {
    $v = getenv($k);
    if ($v !== false) return $v;

    if (array_key_exists($k, $_SERVER)) {
        return $_SERVER[$k];
    }

    return $d;
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
 * DATABASE CONFIG (Railway-first) WITH CONNECTION POOLING
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
 * ✅ Boot Eloquent with OPTIMIZED CONNECTION POOLING (Compatible Version)
 */
$capsule = new Capsule();

// ✅ Build PDO options - only use constants that exist
$pdoOptions = [
    PDO::ATTR_PERSISTENT => true, // Reuse connections
    PDO::ATTR_EMULATE_PREPARES => false, // Use native prepared statements
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_OBJ,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    PDO::ATTR_TIMEOUT => 5, // 5 second connection timeout
];

// ✅ Only add MySQL-specific timeouts if they're available
if (defined('PDO::MYSQL_ATTR_READ_TIMEOUT')) {
    $pdoOptions[PDO::MYSQL_ATTR_READ_TIMEOUT] = 10;
}
if (defined('PDO::MYSQL_ATTR_WRITE_TIMEOUT')) {
    $pdoOptions[PDO::MYSQL_ATTR_WRITE_TIMEOUT] = 10;
}

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
    
    // ✅ PERFORMANCE OPTIMIZATIONS (Compatible)
    'options' => $pdoOptions,
    
    // ✅ Connection pool settings
    'pool' => [
        'min' => 2,  // Minimum connections
        'max' => 10, // Maximum connections
    ],
    
    // ✅ Query performance
    'sticky' => true, // Sticky connections for write/read
    'read' => [ // Read replicas (if available)
        'host' => [$host],
    ],
    'write' => [ // Write primary
        'host' => [$host],
    ],
]);

$capsule->setAsGlobal();
$capsule->bootEloquent();

// ✅ Enable query log only in development
if ($APP_ENV !== 'production') {
    $capsule->getConnection()->enableQueryLog();
}

/**
 * Timezone
 */
date_default_timezone_set(envx('APP_TIMEZONE', 'Asia/Singapore'));

/**
 * Firebase config
 */
define('FIREBASE_API_KEY', envx('FIREBASE_API_KEY'));
define('FIREBASE_PROJECT_ID', envx('FIREBASE_PROJECT_ID'));

/**
 * ✅ PERFORMANCE SETTINGS
 */
// Increase memory limit for image processing
ini_set('memory_limit', '256M');

// Set max execution time
ini_set('max_execution_time', '30');

// Enable OPcache in production (if available)
if ($APP_ENV === 'production' && function_exists('opcache_reset')) {
    ini_set('opcache.enable', '1');
    ini_set('opcache.memory_consumption', '128');
    ini_set('opcache.interned_strings_buffer', '8');
    ini_set('opcache.max_accelerated_files', '10000');
}