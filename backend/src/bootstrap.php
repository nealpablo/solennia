<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

$ROOT = realpath(__DIR__ . '/..');

function envx($k,$d=null){ $v=getenv($k); if($v!==false)return $v; return $_ENV[$k]??$_SERVER[$k]??$d; }

$databaseUrl = envx('DATABASE_URL');
if ($databaseUrl) {
    $p = parse_url($databaseUrl);
    $host = $p['host'] ?? '127.0.0.1';
    $port = (int)($p['port'] ?? 3306);
    $user = $p['user'] ?? 'root';
    $pass = $p['pass'] ?? '';
    $db   = ltrim($p['path'] ?? '/railway','/');
} else {
    $host = envx('DB_HOST');
    $port = (int)envx('DB_PORT');
    $user = envx('DB_USERNAME');
    $pass = envx('DB_PASSWORD','');
    $db   = envx('DB_DATABASE');
}

// load .env locally only
$APP_ENV = envx('APP_ENV', 'production');
if ($APP_ENV !== 'production' && is_file($ROOT . '/.env')) {
    Dotenv::createImmutable($ROOT)->load();
} else {
    Dotenv::createImmutable($ROOT)->safeLoad();
}

// read DB config from env (with envx)
$driver = envx('DB_CONNECTION', 'mysql');
$host   = envx('DB_HOST');
$port   = envx('DB_PORT');
$db     = envx('DB_DATABASE');
$user   = envx('DB_USERNAME');
$pass   = envx('DB_PASSWORD', '');

if (!$host || !$port || !$db || !$user) {
    throw new \RuntimeException('Missing DB envs. Set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD in Railway.');
}

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

try {
    $capsule->getConnection()->getPdo();
} catch (\Throwable $e) {
    error_log("DB_CONNECT_FAIL to {$host}:{$port} as {$user}/{$db} -> " . $e->getMessage());
    throw $e;
}

$capsule->setAsGlobal();
$capsule->bootEloquent();

date_default_timezone_set(envx('APP_TIMEZONE', 'UTC'));
