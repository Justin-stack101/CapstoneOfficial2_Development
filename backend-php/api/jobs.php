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

$jobsCollection = $db->selectCollection('jobs');

$method = $_SERVER['REQUEST_METHOD'];
$pathInfo = $_SERVER['PATH_INFO'] ?? '/';
$path = rtrim($pathInfo, '/');

function getRequestBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function generateStubNumber($collection) {
    $datePrefix = date('mdy');
    $regex = new MongoDB\BSON\Regex('^' . $datePrefix . '-');
    $count = $collection->countDocuments(['claimStub' => $regex]);
    return $datePrefix . '-' . str_pad($count + 1, 3, '0', STR_PAD_LEFT);
}

// Clean up old temp files (older than 2 minutes)
$tempDir = __DIR__ . '/../temp';
if (!is_dir($tempDir)) {
    mkdir($tempDir, 0777, true);
}
foreach (glob("$tempDir/temp_*") as $file) {
    if (time() - filemtime($file) > 120) {
        unlink($file);
    }
}

// 1. Public endpoint for temp downloads (no auth required)
if (preg_match('#^/export-download/([^/]+)$#', $path, $matches) && $method === 'GET') {
    $fileId = $matches[1];
    $filePath = "$tempDir/temp_$fileId";
    if (!file_exists($filePath)) {
        header('HTTP/1.1 404 Not Found');
        echo 'File not found or link has expired.';
        exit;
    }
    
    $fileData = json_decode(file_get_contents($filePath), true);
    unlink($filePath); // delete immediately after sending
    
    if (!$fileData) {
        header('HTTP/1.1 500 Internal Server Error');
        echo 'Error reading staged file.';
        exit;
    }
    
    header('Content-Type: ' . $fileData['contentType']);
    header('Content-Disposition: attachment; filename="' . $fileData['fileName'] . '"');
    echo base64_decode($fileData['fileData']);
    exit;
}

// All other endpoints require authentication
$user = authenticateUser();

if ($path === '' && $method === 'GET') {
    $query = [];
    if (isset($_GET['all']) && $_GET['all'] === 'true') {
        if ($user['role'] !== 'owner' && $user['role'] !== 'admin') {
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['message' => 'Access forbidden. Only Owners and Admins can access historical records.']);
            exit;
        }
    } elseif (!isset($_GET['monitor']) || $_GET['monitor'] !== 'true') {
        $query['status'] = ['$ne' => 'Completed'];
    }

    if ($user['role'] !== 'owner' && $user['role'] !== 'admin') {
        $query['branch'] = $user['branch'] ?? 'Branch A';
    }

    $jobsCursor = $jobsCollection->find($query, ['sort' => ['updatedAt' => -1]]);
    $jobs = [];
    foreach ($jobsCursor as $job) {
        // format output
        $job['id'] = $job['id'] ?? (string)$job['_id'];
        $job['_id'] = (string)$job['_id'];
        $jobs[] = $job;
    }
    echo json_encode($jobs);
    exit;

} elseif ($path === '/analytics' && $method === 'GET') {
    requireRole($user, ['owner']);
    $query = [];
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    
    if ($startDate || $endDate) {
        $query['dateReceived'] = [];
        if ($startDate) $query['dateReceived']['$gte'] = $startDate;
        if ($endDate) $query['dateReceived']['$lte'] = $endDate;
    }

    $jobsCursor = $jobsCollection->find($query, ['sort' => ['dateReceived' => -1]]);
    $jobs = [];
    foreach ($jobsCursor as $job) {
        $job['id'] = $job['id'] ?? (string)$job['_id'];
        $job['_id'] = (string)$job['_id'];
        $jobs[] = $job;
    }
    echo json_encode($jobs);
    exit;

} elseif ($path === '' && $method === 'POST') {
    requireRole($user, ['assistant', 'sa']);
    $body = getRequestBody();

    $source = $body['source'] ?? 'Walk-in';
    $plate = $body['plate'] ?? '';
    $name = $body['name'] ?? '';
    $contact = $body['contact'] ?? '';
    $vehicle = $body['vehicle'] ?? '';
    $category = $body['category'] ?? '';
    $concern = $body['concern'] ?? '';
    $dateReceived = $body['dateReceived'] ?? '';
    $arrival = $body['arrival'] ?? '';
    $apptDate = $body['apptDate'] ?? '';
    $apptTime = $body['apptTime'] ?? '';
    $confirmed = (bool)($body['confirmed'] ?? false);
    $branch = $body['branch'] ?? '';
    $laneType = $body['laneType'] ?? '';

    if (empty($plate) || empty($name) || empty($vehicle) || empty($category)) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'Plate, Name, Vehicle, and Category are required.']);
        exit;
    }

    $isWalkin = $source === 'Walk-in';
    $prefix = $isWalkin ? 'WLK-' : 'ONL-';
    $jobId = $prefix . rand(1000, 9999);

    $finalArrival = $arrival;
    $claimStub = '';
    $initialStatus = 'Pending';

    if ($isWalkin) {
        $finalArrival = !empty($arrival) ? $arrival : date('H:i');
        $claimStub = generateStubNumber($jobsCollection);
        $initialStatus = 'Waiting';
    }

    $targetBranch = ($user['role'] === 'owner' || $user['role'] === 'admin') ? (!empty($branch) ? $branch : 'Branch A') : ($user['branch'] ?? 'Branch A');

    $newJob = [
        'id' => $jobId,
        'source' => $source,
        'plate' => strtoupper($plate),
        'name' => $name,
        'contact' => $contact,
        'vehicle' => $vehicle,
        'category' => $category,
        'concern' => $concern,
        'dateReceived' => !empty($dateReceived) ? $dateReceived : date('Y-m-d'),
        'arrival' => $finalArrival,
        'apptDate' => $apptDate,
        'apptTime' => $apptTime,
        'confirmed' => $confirmed,
        'claimStub' => $claimStub,
        'status' => $initialStatus,
        'branch' => $targetBranch,
        'location' => 'None',
        'saName' => $isWalkin ? $user['name'] : '',
        'laneType' => $laneType,
        'createdAt' => new MongoDB\BSON\UTCDateTime(),
        'updatedAt' => new MongoDB\BSON\UTCDateTime()
    ];

    $result = $jobsCollection->insertOne($newJob);
    $newJob['_id'] = (string)$result->getInsertedId();
    
    header('HTTP/1.1 201 Created');
    echo json_encode($newJob);
    exit;

} elseif (preg_match('#^/([^/]+)/field$#', $path, $matches) && $method === 'PATCH') {
    $jobId = $matches[1];
    $body = getRequestBody();
    $field = $body['field'] ?? '';
    $value = $body['value'] ?? null;

    $job = $jobsCollection->findOne(['id' => $jobId]);
    if (!$job) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Job not found.']);
        exit;
    }

    if ($user['role'] !== 'owner' && $user['role'] !== 'admin' && ($job['branch'] ?? 'Branch A') !== ($user['branch'] ?? 'Branch A')) {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. This vehicle belongs to another branch.']);
        exit;
    }

    if ($field === 'arrival' && ($job['source'] ?? '') === 'Online') {
        if ($user['role'] !== 'sa' && $user['role'] !== 'assistant') {
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['message' => 'Access forbidden. Only SAs and Assistants can edit arrival for online bookings.']);
            exit;
        }
    } else {
        if ($user['role'] === 'owner' || $user['role'] === 'admin') {
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['message' => 'Access forbidden. Owners and Admins are read-only for operational records.']);
            exit;
        }
        if ($user['role'] === 'assistant' && ($job['status'] ?? '') !== 'Pending') {
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['message' => 'Access forbidden. Assistant is read-only for active workshop records.']);
            exit;
        }
    }

    $updates = [];
    if ($field === 'location') {
        if ($value && strpos($value, 'Lift') === 0) {
            $liftNum = (int)explode(' ', $value)[1] - 1;

            $liftOccupied = $jobsCollection->findOne([
                'id' => ['$ne' => $jobId],
                'location' => $value,
                'status' => ['$nin' => ['Completed', 'Released']]
            ]);

            if ($liftOccupied) {
                header('HTTP/1.1 400 Bad Request');
                echo json_encode(['message' => "Lift 0" . ($liftNum + 1) . " is already occupied by vehicle " . ($liftOccupied['plate'] ?? '') . "!"]);
                exit;
            }

            $updates['location'] = $value;
            $updates['bayAssigned'] = $liftNum;
            $updates['status'] = 'In Progress';
        } else {
            $updates['location'] = 'None';
            $updates['bayAssigned'] = null;
            if (($job['status'] ?? '') === 'In Progress') {
                $updates['status'] = 'Waiting';
            }
        }
    } else {
        $updates[$field] = $value;
    }

    // Merge updates into local representation to calculate goalStatus
    $tempJob = array_merge((array)$job, $updates);
    
    if ($field === 'arrival' || $field === 'departure' || $field === 'category') {
        $isPMS = isset($tempJob['category']) && strpos(strtoupper($tempJob['category']), 'PMS') !== false;
        if ($isPMS && !empty($tempJob['arrival']) && !empty($tempJob['departure'])) {
            try {
                list($arrH, $arrM) = explode(':', $tempJob['arrival']);
                list($depH, $depM) = explode(':', $tempJob['departure']);
                $arrMin = (int)$arrH * 60 + (int)$arrM;
                $depMin = (int)$depH * 60 + (int)$depM;
                $diff = $depMin - $arrMin;
                if ($diff < 0) $diff += 24 * 60;
                $updates['goalStatus'] = $diff <= 120 ? 'Successful' : 'Failed';
            } catch (Exception $e) {}
        }
    }

    $updates['updatedAt'] = new MongoDB\BSON\UTCDateTime();
    $jobsCollection->updateOne(['id' => $jobId], ['$set' => $updates]);

    $updatedJob = $jobsCollection->findOne(['id' => $jobId]);
    $updatedJob['_id'] = (string)$updatedJob['_id'];
    echo json_encode($updatedJob);
    exit;

} elseif (preg_match('#^/([^/]+)/status$#', $path, $matches) && $method === 'PATCH') {
    $jobId = $matches[1];
    $body = getRequestBody();
    $status = $body['status'] ?? '';

    $job = $jobsCollection->findOne(['id' => $jobId]);
    if (!$job) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Job not found.']);
        exit;
    }

    if ($user['role'] !== 'owner' && $user['role'] !== 'admin' && ($job['branch'] ?? 'Branch A') !== ($user['branch'] ?? 'Branch A')) {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. This vehicle belongs to another branch.']);
        exit;
    }

    if ($user['role'] === 'owner' || $user['role'] === 'admin') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. Owners and Admins are read-only for operational records.']);
        exit;
    }

    if ($user['role'] === 'assistant' && ($job['status'] ?? '') !== 'Pending') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. Assistant is read-only for active workshop records.']);
        exit;
    }

    $originalStatus = $job['status'] ?? '';
    $updates = ['status' => $status];

    if (in_array($status, ['Ready', 'Released', 'Completed', 'Carry Over', 'Waiting'])) {
        $updates['location'] = 'None';
        $updates['bayAssigned'] = null;
    }

    if ($status === 'Waiting' && $originalStatus === 'Pending') {
        $updates['remarks'] = '';
    }

    if ($status === 'Waiting' && ($job['source'] ?? '') === 'Online' && empty($job['claimStub'])) {
        $updates['claimStub'] = generateStubNumber($jobsCollection);
    }

    if ($status === 'Released' && empty($job['departure'])) {
        $updates['departure'] = date('H:i');
    }

    if ($status === 'Completed') {
        $updates['dateCompleted'] = date('Y-m-d');
        if (empty($job['departure'])) {
            $updates['departure'] = date('H:i');
        }
    }

    $tempJob = array_merge((array)$job, $updates);
    $isPMS = isset($tempJob['category']) && strpos(strtoupper($tempJob['category']), 'PMS') !== false;
    if ($isPMS && !empty($tempJob['arrival']) && !empty($tempJob['departure']) && (empty($tempJob['goalStatus']) || $tempJob['goalStatus'] === 'N/A')) {
        try {
            list($arrH, $arrM) = explode(':', $tempJob['arrival']);
            list($depH, $depM) = explode(':', $tempJob['departure']);
            $arrMin = (int)$arrH * 60 + (int)$arrM;
            $depMin = (int)$depH * 60 + (int)$depM;
            $diff = $depMin - $arrMin;
            if ($diff < 0) $diff += 24 * 60;
            $updates['goalStatus'] = $diff <= 120 ? 'Successful' : 'Failed';
        } catch (Exception $e) {}
    }

    $updates['updatedAt'] = new MongoDB\BSON\UTCDateTime();
    $jobsCollection->updateOne(['id' => $jobId], ['$set' => $updates]);

    $updatedJob = $jobsCollection->findOne(['id' => $jobId]);
    $updatedJob['_id'] = (string)$updatedJob['_id'];
    echo json_encode($updatedJob);
    exit;

} elseif (preg_match('#^/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    $jobId = $matches[1];

    $job = $jobsCollection->findOne(['id' => $jobId]);
    if (!$job) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['message' => 'Job record not found.']);
        exit;
    }

    if ($user['role'] !== 'owner' && $user['role'] !== 'admin' && ($job['branch'] ?? 'Branch A') !== ($user['branch'] ?? 'Branch A')) {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. This vehicle belongs to another branch.']);
        exit;
    }

    if ($user['role'] === 'assistant' && ($job['status'] ?? '') !== 'Pending') {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['message' => 'Access forbidden. Assistant can only delete pending bookings.']);
        exit;
    }

    $jobsCollection->deleteOne(['id' => $jobId]);
    echo json_encode(['message' => 'Job successfully removed from system.']);
    exit;

} elseif ($path === '/export-temp' && $method === 'POST') {
    $body = getRequestBody();
    $fileData = $body['fileData'] ?? null;
    $fileName = $body['fileName'] ?? null;
    $contentType = $body['contentType'] ?? null;

    if (!$fileData || !$fileName || !$contentType) {
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['message' => 'Missing parameters.']);
        exit;
    }

    $fileId = 'temp_' . bin2hex(random_bytes(8));
    $stagedData = [
        'fileData' => $fileData,
        'fileName' => $fileName,
        'contentType' => $contentType,
        'timestamp' => time()
    ];
    
    file_put_contents("$tempDir/temp_$fileId", json_encode($stagedData));
    echo json_encode(['fileId' => $fileId]);
    exit;
}

header('HTTP/1.1 404 Not Found');
echo json_encode(['message' => 'Endpoint not found.']);
?>
