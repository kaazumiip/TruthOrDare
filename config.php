<?php
define('DB_HOST', 'localhost');        // Usually 'localhost'
define('DB_USER', 'your_username');    // Your MySQL username (often 'root')
define('DB_PASS', 'your_password');    // Your MySQL password
define('DB_NAME', 'chok_hmong');       // Keep this as 'chok_hmong'

// Create connection function
function getConnection() {
    try {
        $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8", DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $pdo;
    } catch(PDOException $e) {
        die("Connection failed: " . $e->getMessage());
    }
}

// Start session for the entire application
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Set timezone
date_default_timezone_set('Asia/Phnom_Penh');
?>