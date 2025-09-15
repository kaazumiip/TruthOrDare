<?php
require_once 'config.php';

class PreferencesManager {
    private $pdo;
    
    public function __construct() {
        $this->pdo = getConnection();
    }
    
    public function updateLanguagePreference($userId, $language) {
        try {
            // Validate language
            if (!in_array($language, ['english', 'khmer'])) {
                return ['success' => false, 'message' => 'Invalid language'];
            }
            
            // Update user's preferred language in users table
            $stmt = $this->pdo->prepare("UPDATE users SET preferred_language = ? WHERE id = ?");
            $stmt->execute([$language, $userId]);
            
            // Also store in preferences table for flexibility
            $stmt = $this->pdo->prepare("
                INSERT INTO user_preferences (user_id, preference_key, preference_value) 
                VALUES (?, 'language', ?) 
                ON DUPLICATE KEY UPDATE preference_value = ?
            ");
            $stmt->execute([$userId, $language, $language]);
            
            return ['success' => true, 'message' => 'Language preference updated successfully'];
            
        } catch(PDOException $e) {
            error_log("Language preference error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to update language preference'];
        }
    }
    
    public function getUserPreferences($userId) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT preference_key, preference_value 
                FROM user_preferences 
                WHERE user_id = ?
            ");
            $stmt->execute([$userId]);
            
            $preferences = [];
            while ($row = $stmt->fetch()) {
                $preferences[$row['preference_key']] = $row['preference_value'];
            }
            
            // Also get language from users table
            $stmt = $this->pdo->prepare("SELECT preferred_language FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if ($user) {
                $preferences['language'] = $user['preferred_language'];
            }
            
            return ['success' => true, 'preferences' => $preferences];
            
        } catch(PDOException $e) {
            return ['success' => false, 'message' => 'Failed to load preferences'];
        }
    }
}

// Handle AJAX requests for preferences
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax']) || 
    (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false)) {
    
    header('Content-Type: application/json');
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? '';
    
    $preferences = new PreferencesManager();
    
    switch($action) {
        case 'update_language':
            $userId = (int)($input['user_id'] ?? 0);
            $language = $input['language'] ?? 'english';
            
            if (!$userId) {
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            
            echo json_encode($preferences->updateLanguagePreference($userId, $language));
            break;
            
        case 'get_preferences':
            $userId = (int)($input['user_id'] ?? 0);
            
            if (!$userId) {
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            
            echo json_encode($preferences->getUserPreferences($userId));
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    exit;
}
?>