<?php
require_once 'config.php';

class AuthManager {
    private $pdo;
    
    public function __construct() {
        $this->pdo = getConnection();
    }
    
    public function register($username, $email, $password, $language = 'english') {
        try {
            // Validate input
            if (strlen($username) < 3 || strlen($username) > 50) {
                return ['success' => false, 'message' => 'Username must be 3-50 characters'];
            }
            
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'message' => 'Invalid email format'];
            }
            
            if (strlen($password) < 6) {
                return ['success' => false, 'message' => 'Password must be at least 6 characters'];
            }
            
            // Check if username or email already exists
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $email]);
            
            if ($stmt->fetch()) {
                return ['success' => false, 'message' => 'Username or email already exists'];
            }
            
            // Hash password
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            
            // Insert new user
            $stmt = $this->pdo->prepare("INSERT INTO users (username, email, password_hash, preferred_language) VALUES (?, ?, ?, ?)");
            $stmt->execute([$username, $email, $passwordHash, $language]);
            
            $userId = $this->pdo->lastInsertId();
            
            // Create session
            $sessionToken = $this->createSession($userId);
            
            return [
                'success' => true,
                'message' => 'Registration successful! Welcome to Chok Hmong!',
                'user' => [
                    'id' => $userId,
                    'username' => $username,
                    'email' => $email,
                    'language' => $language
                ],
                'session_token' => $sessionToken
            ];
            
        } catch(PDOException $e) {
            error_log("Registration error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Registration failed. Please try again.'];
        }
    }
    
    public function login($username, $password) {
        try {
            $stmt = $this->pdo->prepare("SELECT id, username, email, password_hash, preferred_language FROM users WHERE username = ? AND is_active = 1");
            $stmt->execute([$username]);
            
            $user = $stmt->fetch();
            
            if (!$user || !password_verify($password, $user['password_hash'])) {
                return ['success' => false, 'message' => 'Invalid username or password'];
            }
            
            // Update last login
            $stmt = $this->pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $stmt->execute([$user['id']]);
            
            // Create session
            $sessionToken = $this->createSession($user['id']);
            
            return [
                'success' => true,
                'message' => 'Welcome back, ' . $user['username'] . '!',
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'language' => $user['preferred_language']
                ],
                'session_token' => $sessionToken
            ];
            
        } catch(PDOException $e) {
            error_log("Login error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Login failed. Please try again.'];
        }
    }
    
    public function logout($sessionToken) {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM user_sessions WHERE session_token = ?");
            $stmt->execute([$sessionToken]);
            
            return ['success' => true, 'message' => 'Logged out successfully'];
            
        } catch(PDOException $e) {
            return ['success' => false, 'message' => 'Logout completed'];
        }
    }
    
    private function createSession($userId) {
        // Clean old sessions
        $stmt = $this->pdo->prepare("DELETE FROM user_sessions WHERE expires_at < NOW()");
        $stmt->execute();
        
        $sessionToken = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        $stmt = $this->pdo->prepare("INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $sessionToken, $expiresAt]);
        
        return $sessionToken;
    }
    
    public function validateSession($sessionToken) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT u.id, u.username, u.email, u.preferred_language 
                FROM users u 
                JOIN user_sessions s ON u.id = s.user_id 
                WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = 1
            ");
            $stmt->execute([$sessionToken]);
            
            return $stmt->fetch();
            
        } catch(PDOException $e) {
            return false;
        }
    }
}

// Handle AJAX requests - THIS IS IMPORTANT FOR FRONTEND CONNECTION
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax']) || 
    (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false)) {
    
    header('Content-Type: application/json');
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST; // Fallback to regular POST data
    }
    
    $action = $input['action'] ?? '';
    
    $auth = new AuthManager();
    
    switch($action) {
        case 'register':
            $username = trim($input['username'] ?? '');
            $email = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';
            $language = $input['language'] ?? 'english';
            
            echo json_encode($auth->register($username, $email, $password, $language));
            break;
            
        case 'login':
            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            
            echo json_encode($auth->login($username, $password));
            break;
            
        case 'logout':
            $sessionToken = $input['session_token'] ?? '';
            echo json_encode($auth->logout($sessionToken));
            break;
            
        case 'validate_session':
            $sessionToken = $input['session_token'] ?? '';
            $user = $auth->validateSession($sessionToken);
            
            if ($user) {
                echo json_encode(['success' => true, 'user' => $user]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Invalid session']);
            }
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    exit; // IMPORTANT: Stop execution after AJAX response
}
?>