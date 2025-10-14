<?php
use Illuminate\Database\Capsule\Manager as Capsule;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

$ROOT = realpath(__DIR__ . '/..');

// robust env accessor
function envx(string $key, $default = null) {
    if (array_key_exists($key, $_ENV))    return $_ENV[$key];
    if (array_key_exists($key, $_SERVER)) return $_SERVER[$key];
    $v = getenv($key);
    return $v !== false ? $v : $default;
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
