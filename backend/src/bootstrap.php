<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

/*
|----------------------------------------------------------------------
| Env loading (safe in Railway; works locally with .env)
|----------------------------------------------------------------------
*/
$rootPath = dirname(__DIR__);
if (file_exists($rootPath . '/.env')) {
    Dotenv::createImmutable($rootPath)->load();
} else {
    Dotenv::createImmutable($rootPath)->safeLoad();
}

/*
|----------------------------------------------------------------------
| Resolve DB settings from Railway or .env
|  - Prefer internal host (private network) when available
|  - Fall back to public proxy host/port automatically
|  - Also supports MYSQL_URL / MYSQL_PUBLIC_URL from Railway
|----------------------------------------------------------------------
*/
function parseMysqlUrl(?string $url): ?array {
    if (!$url) return null;
    $p = parse_url($url);
    if (!$p || ($p['scheme'] ?? '') !== 'mysql') return null;
    return [
        'host' => $p['host'] ?? '127.0.0.1',
        'port' => isset($p['port']) ? (int)$p['port'] : 3306,
        'user' => $p['user'] ?? 'root',
        'pass' => $p['pass'] ?? '',
        'db'   => isset($p['path']) ? ltrim($p['path'], '/') : 'railway',
    ];
}

// 1) Try internal (private) vars first
$internal = [
    'host' => $_ENV['DB_HOST']        ?? $_ENV['MYSQLHOST']      ?? null,
    'port' => isset($_ENV['DB_PORT']) ? (int)$_ENV['DB_PORT'] :
             (isset($_ENV['MYSQLPORT']) ? (int)$_ENV['MYSQLPORT'] : null),
    'user' => $_ENV['DB_USERNAME']    ?? $_ENV['MYSQLUSER']      ?? null,
    'pass' => $_ENV['DB_PASSWORD']    ?? $_ENV['MYSQLPASSWORD']  ?? null,
    'db'   => $_ENV['DB_DATABASE']    ?? $_ENV['MYSQLDATABASE']  ?? null,
];

// 2) If MYSQL_URL is present, let it populate internal details
$fromInternalUrl = parseMysqlUrl($_ENV['MYSQL_URL'] ?? null);
if ($fromInternalUrl) $internal = array_merge($internal, $fromInternalUrl);

// 3) Prepare public (proxy) fallback
$public = parseMysqlUrl($_ENV['MYSQL_PUBLIC_URL'] ?? null);
if (!$public) {
    // Allow explicit public host/port via ENV too
    $public = [
        'host' => $_ENV['DB_HOST_PUBLIC'] ?? null,
        'port' => isset($_ENV['DB_PORT_PUBLIC']) ? (int)$_ENV['DB_PORT_PUBLIC'] : null,
        'user' => $_ENV['DB_USERNAME_PUBLIC'] ?? $internal['user'] ?? 'root',
        'pass' => $_ENV['DB_PASSWORD_PUBLIC'] ?? $internal['pass'] ?? '',
        'db'   => $_ENV['DB_DATABASE_PUBLIC'] ?? $internal['db']  ?? 'railway',
    ];
}

// Helper that attempts a connection and returns Capsule on success
function tryConnect(array $cfg): ?Capsule {
    if (empty($cfg['host']) || empty($cfg['port']) || empty($cfg['db']) || !isset($cfg['user'])) {
        return null;
    }
    try {
        $capsule = new Capsule();
        $capsule->addConnection([
            'driver'    => 'mysql',
            'host'      => $cfg['host'],
            'port'      => (int)$cfg['port'],
            'database'  => $cfg['db'],
            'username'  => $cfg['user'],
            'password'  => $cfg['pass'] ?? '',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix'    => '',
        ]);
        // Touch the connection to verify it works now (throws if not)
        $capsule->getConnection()->getPdo();
        return $capsule;
    } catch (\Throwable $e) {
        error_log('DB_CONNECT_FAIL ['.($cfg['host'] ?? 'null').':'.($cfg['port'] ?? 'null').']: '.$e->getMessage());
        return null;
    }
}

// Try internal first, then public
$capsule = tryConnect($internal) ?? tryConnect($public);

if (!$capsule) {
    // As a last resort, throw—your /api/dbtest will report this clearly
    throw new \RuntimeException('Database connection failed (internal and public both failed).');
}

$capsule->setAsGlobal();
$capsule->bootEloquent();

/*
|----------------------------------------------------------------------
| Optional: timezone
|----------------------------------------------------------------------
*/
date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'UTC');
