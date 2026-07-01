<?php
require_once __DIR__ . '/../vendor/autoload.php';

function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $name = trim($parts[0]);
            $value = trim($parts[1]);
            // Strip quotes if any
            $value = trim($value, "\"'");
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// Load env from parent directory
loadEnv(__DIR__ . '/../../.env');

$mongoUri = getenv('MONGODB_URI') ?: 'mongodb://127.0.0.1:27017/hontech';
// Clean URI for Client connection (it might contain the DB name, which PHP MongoDB\Client accepts)
// Parse database name from URI, e.g. mongodb://127.0.0.1:27017/hontech
$dbName = 'hontech';
$parsedUrl = parse_url($mongoUri);
if (isset($parsedUrl['path'])) {
    $dbName = ltrim($parsedUrl['path'], '/');
}

try {
    $client = new MongoDB\Client($mongoUri);
    $db = $client->selectDatabase($dbName);
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}
?>
