<?php
header("Access-Control-Allow-Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
use Firebase\JWT\JWT;

$usersCollection = $db->selectCollection('users');

$method = $_SERVER['REQUEST_METHOD'];
$pathInfo = $_SERVER['PATH_INFO'] ?? '/';
$path = rtrim($pathInfo, '/');

function getRequestBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function generateToken($userId, $role) {
    $secret = getJWTSecret();
    $payload = [
        'id' => (string)$userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + (24 * 60 * 60) // 1 day
    ];
    return JWT::encode($payload, $secret, 'HS256');
}

function setTokenCookie($token) {
    setcookie('token', $token, [
        'expires' => time() + (24 * 60 * 60),
        'path' => '/',
        'domain' => '',
        'secure' => false,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

if ($path === '/login' && $method === 'POST') {
    $body = getRequestBody();
    $email = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';

    if (empty($email) || empty($password)) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'Email and password are required.']);
        exit;
    }

    $user = $usersCollection->findOne(['email' => $email]);

    if (!$user || !password_verify($password, $user['password'])) {
        header('HTTP/1.1 401 Unauthorized');
        echo json_encode(['message' => 'Invalid credentials.']);
        exit;
    }

    if (!($user['isActive'] ?? true)) {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Account has been deactivated.']);
        exit;
    }

    if ($user['mfaEnabled'] ?? false) {
        echo json_encode([
            'requiresMfa' => true,
            'userId' => (string)$user['_id'],
            'email' => $user['email']
        ]);
        exit;
    }

    $usersCollection->updateOne(
        ['_id' => $user['_id']],
        ['$set' => ['isOnline' => true, 'lastActive' => new MongoDB\BSON\UTCDateTime()]]
    );

    $token = generateToken($user['_id'], $user['role']);
    setTokenCookie($token);

    echo json_encode([
        'id' => (string)$user['_id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role']
    ]);
    exit;

} elseif ($path === '/me' && $method === 'GET') {
    $user = authenticateUser();
    echo json_encode([
        'id' => (string)$user['_id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'branch' => $user['branch'] ?? 'Branch A',
        'backupEmail' => $user['backupEmail'] ?? null,
        'mfaEnabled' => $user['mfaEnabled'] ?? false,
        'googleLinked' => isset($user['googleId']),
        'googleEmail' => $user['googleEmail'] ?? null
    ]);
    exit;

} elseif ($path === '/logout' && $method === 'POST') {
    $token = $_COOKIE['token'] ?? null;
    if ($token) {
        try {
            $secret = getJWTSecret();
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            $usersCollection->updateOne(
                ['_id' => new MongoDB\BSON\ObjectId($decoded->id)],
                ['$set' => ['isOnline' => false]]
            );
        } catch (Exception $e) {}
    }
    setcookie('token', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    echo json_encode(['message' => 'Successfully logged out.']);
    exit;

} elseif ($path === '/ping' && $method === 'POST') {
    $user = authenticateUser();
    $usersCollection->updateOne(
        ['_id' => $user['_id']],
        ['$set' => ['isOnline' => true, 'lastActive' => new MongoDB\BSON\UTCDateTime()]]
    );
    echo json_encode(['success' => true]);
    exit;

} elseif ($path === '/staff' && $method === 'GET') {
    $user = authenticateUser();
    requireRole($user, ['owner', 'admin']);
    
    $staff = $usersCollection->find([]);
    $response = [];
    foreach ($staff as $s) {
        $response[] = [
            'id' => (string)$s['_id'],
            'name' => $s['name'],
            'email' => $s['email'],
            'role' => $s['role'],
            'branch' => $s['branch'] ?? 'Branch A',
            'isActive' => $s['isActive'] ?? true,
            'isOnline' => $s['isOnline'] ?? false,
            'lastActive' => isset($s['lastActive']) ? $s['lastActive']->toDateTime()->format(DateTime::ATOM) : null
        ];
    }
    echo json_encode($response);
    exit;

} elseif ($path === '/staff' && $method === 'POST') {
    $user = authenticateUser();
    requireRole($user, ['owner', 'admin']);
    
    $body = getRequestBody();
    $name = trim($body['name'] ?? '');
    $email = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';
    $role = $body['role'] ?? '';
    $branch = $body['branch'] ?? 'Branch A';

    if (empty($name) || empty($email) || empty($password) || empty($role)) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'All fields are required.']);
        exit;
    }

    $exists = $usersCollection->findOne(['email' => $email]);
    if ($exists) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'Email is already registered.']);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $result = $usersCollection->insertOne([
        'name' => $name,
        'email' => $email,
        'password' => $hashedPassword,
        'role' => $role,
        'branch' => $branch,
        'isActive' => true,
        'isOnline' => false,
        'createdAt' => new MongoDB\BSON\UTCDateTime(),
        'updatedAt' => new MongoDB\BSON\UTCDateTime()
    ]);

    echo json_encode([
        'id' => (string)$result->getInsertedId(),
        'name' => $name,
        'email' => $email,
        'role' => $role,
        'branch' => $branch
    ]);
    exit;

} elseif (preg_match('#^/staff/([^/]+)/role$#', $path, $matches) && $method === 'PUT') {
    $user = authenticateUser();
    requireRole($user, ['owner', 'admin']);
    $targetId = $matches[1];
    
    $body = getRequestBody();
    $role = $body['role'] ?? '';
    
    $validRoles = ['owner', 'admin', 'assistant', 'sa'];
    if (!in_array($role, $validRoles)) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'Invalid role type.']);
        exit;
    }

    $targetUser = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($targetId)]);
    if (!$targetUser) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Staff member not found.']);
        exit;
    }

    if ($targetUser['role'] === 'owner' || ($role === 'owner' && $user['role'] !== 'owner')) {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. Owner role is protected.']);
        exit;
    }

    $usersCollection->updateOne(
        ['_id' => new MongoDB\BSON\ObjectId($targetId)],
        ['$set' => ['role' => $role]]
    );

    echo json_encode([
        'id' => $targetId,
        'name' => $targetUser['name'],
        'email' => $targetUser['email'],
        'role' => $role
    ]);
    exit;

} elseif (preg_match('#^/staff/([^/]+)/branch$#', $path, $matches) && $method === 'PATCH') {
    $user = authenticateUser();
    requireRole($user, ['owner', 'admin']);
    $targetId = $matches[1];
    
    $body = getRequestBody();
    $branch = $body['branch'] ?? '';

    if (empty($branch)) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'Branch is required.']);
        exit;
    }

    $targetUser = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($targetId)]);
    if (!$targetUser) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Staff member not found.']);
        exit;
    }

    if ($targetUser['role'] === 'owner' && $user['role'] === 'admin') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. Administrators cannot modify the System Owner account.']);
        exit;
    }

    $usersCollection->updateOne(
        ['_id' => new MongoDB\BSON\ObjectId($targetId)],
        ['$set' => ['branch' => $branch]]
    );

    echo json_encode([
        'id' => $targetId,
        'name' => $targetUser['name'],
        'email' => $targetUser['email'],
        'role' => $targetUser['role'],
        'branch' => $branch
    ]);
    exit;

} elseif (preg_match('#^/staff/([^/]+)/toggle-active$#', $path, $matches) && $method === 'PATCH') {
    $user = authenticateUser();
    requireRole($user, ['owner', 'admin']);
    $targetId = $matches[1];
    
    $body = getRequestBody();
    $isActive = (bool)($body['isActive'] ?? true);

    $targetUser = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($targetId)]);
    if (!$targetUser) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Staff member not found.']);
        exit;
    }

    if ($targetUser['role'] === 'owner') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Cannot suspend or deactivate System Owner accounts.']);
        exit;
    }

    $usersCollection->updateOne(
        ['_id' => new MongoDB\BSON\ObjectId($targetId)],
        ['$set' => ['isActive' => $isActive]]
    );

    echo json_encode([
        'message' => 'Personnel account access ' . ($isActive ? 'restored' : 'suspended') . '.',
        'isActive' => $isActive
    ]);
    exit;

} elseif (preg_match('#^/staff/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    $user = authenticateUser();
    requireRole($user, ['owner', 'admin']);
    $targetId = $matches[1];

    $targetUser = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($targetId)]);
    if (!$targetUser) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Staff member not found.']);
        exit;
    }

    if ($targetUser['role'] === 'owner') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. System Owner accounts cannot be deleted.']);
        exit;
    }

    $usersCollection->deleteOne(['_id' => new MongoDB\BSON\ObjectId($targetId)]);
    echo json_encode(['message' => 'Staff access successfully revoked.']);
    exit;
}

header('HTTP/1.1 404 Not Found');
echo json_encode(['message' => 'Endpoint not found.']);
?>
