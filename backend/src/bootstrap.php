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
 * -------------------------------------------------------
 * BOOT ELOQUENT (OPTIMIZED CONFIG)
 * -------------------------------------------------------
 */
$capsule = new Capsule();

// ✅ FIXED: PDO options (removed persistent connection for local dev)
$pdoOptions = [
    // ✅ CHANGED: Disable persistent connections locally (prevents connection exhaustion)
    PDO::ATTR_PERSISTENT => ($APP_ENV === 'production'),
    
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_OBJ,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    
    // ✅ IMPROVED: Timeout settings
    PDO::ATTR_TIMEOUT => 10, // Increased from 5 to 10 seconds
];

// ✅ IMPROVED: Conditional timeout settings
if (defined('PDO::MYSQL_ATTR_READ_TIMEOUT')) {
    $pdoOptions[PDO::MYSQL_ATTR_READ_TIMEOUT] = 15; // Increased from 10 to 15
}
if (defined('PDO::MYSQL_ATTR_WRITE_TIMEOUT')) {
    $pdoOptions[PDO::MYSQL_ATTR_WRITE_TIMEOUT] = 15; // Increased from 10 to 15
}

// ✅ IMPROVED: Connection pooling settings
$connectionConfig = [
    'driver'    => $driver,
    'host'      => $host,
    'port'      => (int)$port,
    'database'  => $db,
    'username'  => $user,
    'password'  => $pass,
    'charset'   => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix'    => '',
    'options'   => $pdoOptions,
    
    // ✅ IMPROVED: Connection management
    'sticky' => true,
    'read' => ['host' => [$host]],
    'write' => ['host' => [$host]],
];

// ✅ NEW: Add connection pooling for production
if ($APP_ENV === 'production') {
    $connectionConfig['pool'] = [
        'min' => 2,
        'max' => 10,
    ];
}

$capsule->addConnection($connectionConfig);

$capsule->setAsGlobal();
$capsule->bootEloquent();

// ✅ IMPROVED: Query logging only in development
if ($APP_ENV !== 'production') {
    $capsule->getConnection()->enableQueryLog();
}

/**
 * ✅ NEW: Test database connection on boot
 */
try {
    $capsule->getConnection()->getPdo();
    if ($APP_ENV !== 'production') {
        error_log('✅ Database connected successfully');
    }
} catch (\Exception $e) {
    error_log('❌ Database connection failed: ' . $e->getMessage());
    throw new RuntimeException('Could not connect to database: ' . $e->getMessage());
}

/**
 * ✅ IMPROVED: Timezone with validation
 */
$timezone = envx('APP_TIMEZONE', 'Asia/Manila'); // Changed default to match your .env
try {
    date_default_timezone_set($timezone);
} catch (\Exception $e) {
    error_log("⚠️ Invalid timezone '{$timezone}', falling back to UTC");
    date_default_timezone_set('UTC');
}

/**
 * ✅ IMPROVED: Firebase config with validation
 */
$firebaseApiKey = envx('FIREBASE_API_KEY');
$firebaseProjectId = envx('FIREBASE_PROJECT_ID');

if ($firebaseApiKey && $firebaseProjectId) {
    define('FIREBASE_API_KEY', $firebaseApiKey);
    define('FIREBASE_PROJECT_ID', $firebaseProjectId);
} else {
    if ($APP_ENV !== 'production') {
        error_log('⚠️ Firebase credentials missing');
    }
    define('FIREBASE_API_KEY', '');
    define('FIREBASE_PROJECT_ID', '');
}

/**
 * ✅ IMPROVED: Environment-based performance settings
 */
if ($APP_ENV === 'production') {
    ini_set('memory_limit', '512M'); // Increased for production
    ini_set('max_execution_time', '60'); // Increased for complex operations
    ini_set('display_errors', '0'); // Hide errors in production
    ini_set('log_errors', '1'); // Log errors instead
} else {
    ini_set('memory_limit', '256M');
    ini_set('max_execution_time', '30');
    ini_set('display_errors', '1'); // Show errors in development
    ini_set('log_errors', '1');
}

/**
 * ✅ NEW: Error reporting based on environment
 */
if ($APP_ENV === 'production') {
    error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_STRICT);
} else {
    error_reporting(E_ALL);
}

/**
 * ✅ NEW: Output buffering for better performance
 */
if ($APP_ENV === 'production') {
    ob_start('ob_gzhandler'); // Enable gzip compression
}

/**
 * ✅ NEW: Session configuration (if using sessions)
 */
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', ($APP_ENV === 'production') ? '1' : '0');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_samesite', 'Lax');
}

/**
 * ✅ NEW: Security headers helper (optional)
 */
if ($APP_ENV === 'production') {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}