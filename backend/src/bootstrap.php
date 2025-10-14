<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

function envx(string $k, $d = null) {
    if (array_key_exists($k, $_ENV))    return $_ENV[$k];
    if (array_key_exists($k, $_SERVER)) return $_SERVER[$k];
    $v = getenv($k);
    return $v !== false ? $v : $d;
}

$ROOT    = realpath(__DIR__ . '/..');
$APP_ENV = envx('APP_ENV', 'production');

if ($APP_ENV !== 'production' && is_file($ROOT.'/.env')) {
    Dotenv::createImmutable($ROOT)->load();
} else {
    Dotenv::createImmutable($ROOT)->safeLoad();
}

/** ---- Build DB config (DATABASE_URL preferred) ---- */
$host = $user = $pass = $db = $port = null;

if ($url = envx('DATABASE_URL')) {
    $p = parse_url($url);
    $host = $p['host'] ?? null;
    $port = isset($p['port']) ? (int)$p['port'] : null;
    $user = $p['user'] ?? null;
    $pass = $p['pass'] ?? '';
    $db   = isset($p['path']) ? ltrim($p['path'], '/') : null;
} else {
    $host = envx('DB_HOST');
    $port = envx('DB_PORT');
    $user = envx('DB_USERNAME');
    $pass = envx('DB_PASSWORD', '');
    $db   = envx('DB_DATABASE');
}

$driver = envx('DB_CONNECTION', 'mysql');

$capsule = new Capsule();
if ($host && $port && $db && $user) {
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
    // do NOT touch the connection here — let routes try it
    $GLOBALS['DB_CONFIG_OK'] = true;
} else {
    error_log('DB_CONFIG_INCOMPLETE: host/port/db/user missing');
    $GLOBALS['DB_CONFIG_OK'] = false;
}

$capsule->setAsGlobal();
$capsule->bootEloquent();

date_default_timezone_set(envx('APP_TIMEZONE', 'UTC'));
