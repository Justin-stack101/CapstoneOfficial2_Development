<?php
require_once __DIR__ . '/../config/db.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function getJWTSecret() {
    return getenv('JWT_SECRET') ?: 'supersecretjwtkey12345!';
}

function authenticateUser() {
    global $db;
    
    $token = $_COOKIE['token'] ?? null;
    
    if (!$token) {
        // Fallback: check Authorization header
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $token = str_replace('Bearer ', '', $headers['Authorization']);
        } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
        }
    }
    
    if (!$token) {
        header('HTTP/1.1 401 Unauthorized');
        header('Content-Type: application/json');
        echo json_encode(['message' => 'Authentication required. Access denied.']);
        exit;
    }
    
    try {
        $secret = getJWTSecret();
        $decoded = JWT::decode($token, new Key($secret, 'HS256'));
        
        $userId = $decoded->id;
        
        $usersCollection = $db->selectCollection('users');
        $user = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($userId)]);
        
        if (!$user || !($user['isActive'] ?? true)) {
            header('HTTP/1.1 401 Unauthorized');
            header('Content-Type: application/json');
            echo json_encode(['message' => 'User account is inactive or deleted.']);
            exit;
        }
        
        return $user;
    } catch (Exception $e) {
        header('HTTP/1.1 401 Unauthorized');
        header('Content-Type: application/json');
        echo json_encode(['message' => 'Invalid or expired authentication token.']);
        exit;
    }
}

function requireRole($user, $allowedRoles) {
    if (!isset($user['role']) || !in_array($user['role'], $allowedRoles)) {
        header('HTTP/1.1 403 Forbidden');
        header('Content-Type: application/json');
        echo json_encode(['message' => 'Access forbidden. Insufficient permissions.']);
        exit;
    }
}
?>
