<?php
// index.php - Complete Main Page with HTML Design + PHP Backend
require_once 'config.php';
require_once 'auth.php';

// Check if user is logged in via session token
$currentUser = null;
$sessionToken = $_COOKIE['chok_session'] ?? null;

if ($sessionToken) {
    $auth = new AuthManager();
    $currentUser = $auth->validateSession($sessionToken);
}

// Get user's preferred language
$preferredLanguage = 'english';
if ($currentUser && isset($currentUser['preferred_language'])) {
    $preferredLanguage = $currentUser['preferred_language'];
}
?>
<!DOCTYPE html>
<html lang="<?php echo $preferredLanguage === 'khmer' ? 'km' : 'en'; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chok Hmong - ចុកហ្មង</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Khmer:wght@400;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Comic Sans Ms', 'Khmer Os', 'Khmer UI', 'Leelawadee UI', Arial sans-serif;
            background: linear-gradient(135deg, #f5e6a8 0%, #f0d982 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        /* Authentication Modal */
        .auth-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .auth-content {
            background: white;
            padding: 40px;
            border-radius: 20px;
            width: 400px;
            max-width: 90%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            position: relative;
        }
        
        .auth-title {
            font-size: 1.8rem;
            color: #e91e63;
            margin-bottom: 20px;
            font-weight: 700;
        }
        
        .auth-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .auth-input {
            padding: 12px 15px;
            border: 2px solid #ddd;
            border-radius: 10px;
            font-size: 1rem;
            font-family: 'Nunito', sans-serif;
            transition: border-color 0.3s ease;
        }
        
        .auth-input:focus {
            outline: none;
            border-color: #e91e63;
        }
        
        .auth-btn {
            padding: 12px 20px;
            background: linear-gradient(135deg, #e91e63, #ad1457);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .auth-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(233, 30, 99, 0.4);
        }
        
        .auth-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .auth-switch {
            margin-top: 15px;
            color: #666;
        }
        
        .auth-switch a {
            color: #e91e63;
            text-decoration: none;
            font-weight: 600;
        }
        
        .close-auth {
            position: absolute;
            top: 15px;
            right: 20px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        }
        
        /* User Info */
        .user-info {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            background: rgba(255,255,255,0.9);
            padding: 10px 20px;
            border-radius: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .user-name {
            font-weight: 600;
            color: #333;
        }
        
        .logout-btn {
            background: #e91e63;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 15px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .logout-btn:hover {
            background: #ad1457;
            transform: translateY(-1px);
        }
        
        /* Language Selector */
        .language-indicator {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(255,255,255,0.9);
            padding: 10px 15px;
            border-radius: 20px;
            font-weight: 600;
            color: #333;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        /* Guest Mode Notice */
        .guest-notice {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,193,7,0.9);
            padding: 10px 20px;
            border-radius: 25px;
            color: #333;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .login-prompt {
            background: #2196f3;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 15px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            margin-left: 10px;
            transition: all 0.3s ease;
        }
        
        .login-prompt:hover {
            background: #1976d2;
            transform: translateY(-1px);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .title {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 10px;
        }
        
        .title h1 {
            font-size: 3.5rem;
            font-weight: 800;
            color: #e91e63;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            letter-spacing: 2px;
        }
        
        .dart-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #e91e63, #3f51b5);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            box-shadow: 0 4px 15px rgba(233, 30, 99, 0.3);
        }
        
        .khmer-subtitle {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .description {
            font-size: 1rem;
            color: #555;
            max-width: 600px;
            line-height: 1.6;
            font-weight: 500;
        }
        
        .features {
            display: flex;
            gap: 30px;
            margin-bottom: 50px;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .feature-card {
            background: white;
            border-radius: 20px;
            padding: 30px 25px;
            text-align: center;
            width: 280px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 35px rgba(0,0,0,0.15);
        }
        
        .feature-icon {
            width: 60px;
            height: 60px;
            margin: 0 auto 20px;
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
        }
        
        .interactive-icon {
            background: linear-gradient(135deg, #e91e63, #ad1457);
        }
        
        .language-icon {
            background: linear-gradient(135deg, #4fc3f7, #29b6f6);
        }
        
        .categories-icon {
            background: linear-gradient(135deg, #ffb74d, #ffa726);
        }
        
        .feature-title {
            font-size: 1.4rem;
            font-weight: 700;
            color: #333;
            margin-bottom: 10px;
        }
        
        .feature-description {
            font-size: 0.9rem;
            color: #666;
            line-height: 1.5;
            font-weight: 500;
        }
        
        .adventure-section {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .adventure-title {
            font-size: 2.2rem;
            font-weight: 700;
            color: #e91e63;
            margin-bottom: 30px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        
        .buttons {
            display: flex;
            gap: 20px;
            margin-bottom: 40px;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .btn {
            padding: 15px 35px;
            border-radius: 50px;
            border: none;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Nunito', sans-serif;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #e91e63, #ad1457);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #ad1457, #880e4f);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(233, 30, 99, 0.4);
        }
        
        .btn-secondary {
            background: linear-gradient(135deg, #90a4ae, #78909c);
            color: white;
        }
        
        .btn-secondary:hover {
            background: linear-gradient(135deg, #78909c, #607d8b);
            transform: translateY(-2px);
        }
        
        .language-section {
            text-align: center;
        }
        
        .language-title {
            font-size: 1.6rem;
            font-weight: 700;
            color: #e91e63;
            margin-bottom: 20px;
        }
        
        .language-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .lang-btn {
            padding: 12px 25px;
            border-radius: 25px;
            border: none;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Nunito', sans-serif;
            box-shadow: 0 3px 10px rgba(0,0,0,0.15);
        }
        
        .lang-btn.english {
            background: linear-gradient(135deg, #2196f3, #1976d2);
            color: white;
        }
        
        .lang-btn.khmer {
            background: linear-gradient(135deg, #e91e63, #ad1457);
            color: white;
        }
        
        .lang-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.25);
        }
        
        .lang-btn.active {
            box-shadow: 0 0 0 3px rgba(233, 30, 99, 0.3);
        }
        
        /* Loading spinner */
        .loading {
            display: none;
            width: 20px;
            height: 20px;
            border: 2px solid #ffffff;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Success/Error messages */
        .message {
            padding: 10px 15px;
            border-radius: 8px;
            margin: 10px 0;
            font-weight: 600;
        }
        
        .message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        @media (max-width: 768px) {
            .title h1 {
                font-size: 2.5rem;
            }
            
            .features {
                flex-direction: column;
                align-items: center;
            }
            
            .feature-card {
                width: 100%;
                max-width: 300px;
            }
            
            .buttons {
                flex-direction: column;
                align-items: center;
            }
            
            .btn {
                width: 100%;
                max-width: 250px;
                justify-content: center;
            }
            
            .user-info, .guest-notice {
                position: relative;
                top: auto;
                right: auto;
                margin-bottom: 20px;
            }
            
            .language-indicator {
                position: relative;
                top: auto;
                left: auto;
                margin-bottom: 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Language Indicator -->
    <div class="language-indicator" id="langIndicator">
        🌍 <?php echo $preferredLanguage === 'khmer' ? 'ខ្មែរ' : 'English'; ?>
    </div>

    <!-- User Info / Guest Notice -->
    <?php if ($currentUser): ?>
    <div class="user-info" id="userInfo">
        <span class="user-name">Welcome, <?php echo htmlspecialchars($currentUser['username']); ?>!</span>
        <button class="logout-btn" onclick="logout()">Logout</button>
    </div>
    <?php else: ?>
    <div class="guest-notice" id="guestNotice">
        👤 Guest Mode
        <button class="login-prompt" onclick="showLogin()">Login</button>
    </div>
    <?php endif; ?>

    <!-- Authentication Modal -->
    <div class="auth-modal" id="authModal">
        <div class="auth-content">
            <button class="close-auth" onclick="closeAuth()">&times;</button>
            <h2 class="auth-title" id="authTitle">Login to Chok Hmong</h2>
            <div id="authMessage"></div>
            
            <form class="auth-form" id="authForm" onsubmit="handleAuth(event)">
                <input type="text" class="auth-input" id="username" placeholder="Username" required>
                <input type="password" class="auth-input" id="password" placeholder="Password" required>
                <input type="email" class="auth-input" id="email" placeholder="Email" style="display: none;">
                
                <button type="submit" class="auth-btn" id="authSubmit">
                    <span id="authButtonText">Login</span>
                    <div class="loading" id="authLoading"></div>
                </button>
            </form>
            
            <div class="auth-switch">
                <span id="authSwitchText">Don't have an account?</span>
                <a href="#" onclick="toggleAuthMode()" id="authSwitchLink">Sign up</a>
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT - YOUR BEAUTIFUL DESIGN -->
    <div class="header">
        <div class="title">
            <div class="dart-icon">🎯</div>
            <h1 id="mainTitle">Chok Hmong</h1>
            <div class="dart-icon">🎯</div>
        </div>
        <div class="khmer-subtitle" id="khmerSubtitle">ចុកហ្មង</div>
        <div class="description" id="description">
            Get ready for deep questions that will "chok" you! Challenge yourself with<br>
            thought-provoking cards that spark conversation and fun moments.
        </div>
    </div>
    
    <div class="features">
        <div class="feature-card">
            <div class="feature-icon interactive-icon">📱</div>
            <div class="feature-title" id="interactiveTitle">Interactive Cards</div>
            <div class="feature-description" id="interactiveDesc">
                Flip cards to reveal exciting questions and challenges
            </div>
        </div>
        
        <div class="feature-card">
            <div class="feature-icon language-icon">🌍</div>
            <div class="feature-title" id="multiLangTitle">Multi-Language</div>
            <div class="feature-description" id="multiLangDesc">
                Choose between Khmer and English questions
            </div>
        </div>
        
        <div class="feature-card">
            <div class="feature-icon categories-icon">🎲</div>
            <div class="feature-title" id="categoriesTitle">Fun Categories</div>
            <div class="feature-description" id="categoriesDesc">
                Different types of questions for every mood
            </div>
        </div>
    </div>
    
    <div class="adventure-section">
        <h2 class="adventure-title" id="adventureTitle">Choose Your Adventure</h2>
        
        <div class="buttons">
            <button class="btn btn-primary" onclick="startSinglePlayer()">
                🎯 <span id="singlePlayerText">Single Player</span>
            </button>
            <button class="btn btn-secondary">
                👥 <span id="multiplayerText">Multiplayer (Coming Soon)</span>
            </button>
        </div>
    </div>
    
    <div class="language-section">
        <h3 class="language-title" id="langSectionTitle">Select Language | ជ្រើសរើសភាសា</h3>
        <div class="language-buttons">
            <button class="lang-btn english <?php echo $preferredLanguage === 'english' ? 'active' : ''; ?>" 
                    id="englishBtn" onclick="changeLanguage('english')">
                🇺🇸 English
            </button>
            <button class="lang-btn khmer <?php echo $preferredLanguage === 'khmer' ? 'active' : ''; ?>" 
                    id="khmerBtn" onclick="changeLanguage('khmer')">
                🇰🇭 ខ្មែរ
            </button>
        </div>
    </div>

    <script>
        // Initialize with PHP data
        let currentUser = <?php echo $currentUser ? json_encode($currentUser) : 'null'; ?>;
        let isLoggedIn = currentUser !== null;
        let currentLanguage = '<?php echo $preferredLanguage; ?>';
        let isLoginMode = true;

        // Language translations
        const translations = {
            english: {
                mainTitle: 'Chok Hmong',
                description: 'Get ready for deep questions that will "chok" you! Challenge yourself with<br>thought-provoking cards that spark conversation and fun moments.',
                interactiveTitle: 'Interactive Cards',
                interactiveDesc: 'Flip cards to reveal exciting questions and challenges',
                multiLangTitle: 'Multi-Language',
                multiLangDesc: 'Choose between Khmer and English questions',
                categoriesTitle: 'Fun Categories',
                categoriesDesc: 'Different types of questions for every mood',
                adventureTitle: 'Choose Your Adventure',
                singlePlayerText: 'Single Player',
                multiplayerText: 'Multiplayer (Coming Soon)',
                langIndicator: '🌍 English'
            },
            khmer: {
                mainTitle: 'ចុកហ្មង',
                description: 'រៀបចំខ្លួនសម្រាប់សំណួរស៊ីជម្រៅដែលនឹង "ចុក" អ្នក! ជំរុញខ្លួនឯងជាមួយ<br>កាតបញ្ហាប្រឈមដែលបំផុសគំនិតនិងបង្កើតមេនាទីកម្សាន្ត។',
                interactiveTitle: 'កាតអន្តរកម្ម',
                interactiveDesc: 'បង្វែរកាតដើម្បីបង្ហាញសំណួរនិងបញ្ហាប្រឈមគួរឱ្យរំភើប',
                multiLangTitle: 'ពហុភាសា',
                multiLangDesc: 'ជ្រើសរើសរវាងសំណួរខ្មែរនិងអង់គ្លេស',
                categoriesTitle: 'ប្រភេទកម្សាន្ត',
                categoriesDesc: 'ប្រភេទសំណួរផ្សេងៗសម្រាប់រាល់អារម្មណ៍',
                adventureTitle: 'ជ្រើសរើសការផ្សងព្រេងរបស់អ្នក',
                singlePlayerText: 'អ្នកលេងតែម្នាក់',
                multiplayerText: 'អ្នកលេងច្រើននាក់ (នឹងមកដល់ឆាប់ៗ)',
                langIndicator: '🌍 ខ្មែរ'
            }
        };

        // Authentication functions with real PHP connection
        async function performLogin(username, password) {
            try {
                const response = await fetch('auth.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'login',
                        username: username,
                        password: password
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    currentUser = result.user;
                    isLoggedIn = true;
                    
                    // Set secure session cookie
                    const expires = new Date();
                    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
                    document.cookie = `chok_session=${result.session_token}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
                    
                    updateUserInterface();
                    closeAuth();
                    showMessage(result.message, 'success');
                    
                    // Update language if user has preference
                    if (result.user.language) {
                        changeLanguage(result.user.language);
                    }
                } else {
                    showMessage(result.message, 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage('Login failed. Please check your connection.', 'error');
            }
        }
        
        async function performSignup(username, password, email) {
            try {
                const response = await fetch('auth.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'register',
                        username: username,
                        password: password,
                        email: email,
                        language: currentLanguage
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    currentUser = result.user;
                    isLoggedIn = true;
                    
                    // Set session cookie
                    const expires = new Date();
                    expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
                    document.cookie = `chok_session=${result.session_token}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
                    
                    updateUserInterface();
                    closeAuth();
                    showMessage(result.message, 'success');
                } else {
                    showMessage(result.message, 'error');
                }
            } catch (error) {
                console.error('Signup error:', error);
                showMessage('Registration failed. Please try again.', 'error');
            }
        }
        
        async function logout() {
            try {
                const sessionToken = getCookie('chok_session');
                
                if (sessionToken) {
                    await fetch('auth.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'logout',
                            session_token: sessionToken
                        })
                    });
                }
                
                // Clear session
                currentUser = null;
                isLoggedIn = false;
                document.cookie = 'chok_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                
                showMessage('You have been logged out successfully', 'success');
                
                // Reload page to reset PHP state
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                // Still logout locally
                currentUser = null;
                isLoggedIn = false;
                document.cookie = 'chok_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                showMessage('You have been logged out', 'success');
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        }
        
        // Language preference with database sync
        async function updateLanguagePreference(language) {
            if (isLoggedIn && currentUser) {
                try {
                    await fetch('preferences.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'update_language',
                            user_id: currentUser.id,
                            language: language
                        })
                    });
                } catch (error) {
                    console.error('Failed to update language preference:', error);
                }
            }
        }
        
        function changeLanguage(language) {
            currentLanguage = language;
            
            // Update active button
            document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(language === 'english' ? 'englishBtn' : 'khmerBtn').classList.add('active');
            
            // Update language indicator
            document.getElementById('langIndicator').textContent = translations[language].langIndicator;
            
            // Update all text content
            updatePageContent();
            
            // Save preference locally and on server
            localStorage.setItem('chok_language', language);
            updateLanguagePreference(language);
            
            showMessage(`Language changed to ${language === 'english' ? 'English' : 'Khmer'}`, 'success');
        }
        
        function updatePageContent() {
            const lang = translations[currentLanguage];
            
            // Update main content
            document.getElementById('mainTitle').textContent = lang.mainTitle;
            document.getElementById('description').innerHTML = lang.description;
            document.getElementById('interactiveTitle').textContent = lang.interactiveTitle;
            document.getElementById('interactiveDesc').textContent = lang.interactiveDesc;
            document.getElementById('multiLangTitle').textContent = lang.multiLangTitle;
            document.getElementById('multiLangDesc').textContent = lang.multiLangDesc;
            document.getElementById('categoriesTitle').textContent = lang.categoriesTitle;
            document.getElementById('categoriesDesc').textContent = lang.categoriesDesc;
            document.getElementById('adventureTitle').textContent = lang.adventureTitle;
            document.getElementById('singlePlayerText').textContent = lang.singlePlayerText;
            document.getElementById('multiplayerText').textContent = lang.multiplayerText;
        }
        
        // Modal functions
        function showLogin() {
            document.getElementById('authModal').style.display = 'flex';
            isLoginMode = true;
            updateAuthModal();
        }

        function closeAuth() {
            document.getElementById('authModal').style.display = 'none';
            clearAuthForm();
        }

        function toggleAuthMode() {
            isLoginMode = !isLoginMode;
            updateAuthModal();
        }

        function updateAuthModal() {
            const title = document.getElementById('authTitle');
            const submitBtn = document.getElementById('authButtonText');
            const switchText = document.getElementById('authSwitchText');
            const switchLink = document.getElementById('authSwitchLink');
            const email = document.getElementById('email');

            if (isLoginMode) {
                title.textContent = 'Login to Chok Hmong';
                submitBtn.textContent = 'Login';
                switchText.textContent = "Don't have an account?";
                switchLink.textContent = 'Sign up';
                email.style.display = 'none';
                email.required = false;
            } else {
                title.textContent = 'Sign Up for Chok Hmong';
                submitBtn.textContent = 'Sign Up';
                switchText.textContent = 'Already have an account?';
                switchLink.textContent = 'Login';
                email.style.display = 'block';
                email.required = true;
            }
        }

        function clearAuthForm() {
            document.getElementById('authForm').reset();
            document.getElementById('authMessage').innerHTML = '';
        }

        function handleAuth(event) {
            event.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const email = document.getElementById('email').value.trim();
            
            if (!username || !password) {
                showMessage('Please fill in all required fields', 'error');
                return;
            }
            
            if (!isLoginMode && !email) {
                showMessage('Please enter your email address', 'error');
                return;
            }
            
            showLoading(true);
            
            // Call appropriate function
            if (isLoginMode) {
                performLogin(username, password);
            } else {
                performSignup(username, password, email);
            }
            
            setTimeout(() => showLoading(false), 1000);
        }

        function updateUserInterface() {
            const userInfo = document.getElementById('userInfo');
            const guestNotice = document.getElementById('guestNotice');

            if (isLoggedIn && currentUser) {
                if (userInfo) {
                    userInfo.style.display = 'flex';
                    const userName = userInfo.querySelector('.user-name');
                    if (userName) {
                        userName.textContent = 'Welcome, ' + currentUser.username + '!';
                    }
                }
                if (guestNotice) {
                    guestNotice.style.display = 'none';
                }
            } else {
                if (userInfo) userInfo.style.display = 'none';
                if (guestNotice) guestNotice.style.display = 'flex';
            }
        }

        function showLoading(show) {
            const loading = document.getElementById('authLoading');
            const buttonText = document.getElementById('authButtonText');
            const submitBtn = document.getElementById('authSubmit');

            if (loading && buttonText && submitBtn) {
                if (show) {
                    loading.style.display = 'block';
                    buttonText.style.display = 'none';
                    submitBtn.disabled = true;
                } else {
                    loading.style.display = 'none';
                    buttonText.style.display = 'block';
                    submitBtn.disabled = false;
                }
            }
        }

        function showMessage(message, type) {
            const messageDiv = document.getElementById('authMessage');
            if (messageDiv) {
                messageDiv.innerHTML = `<div class="message ${type}">${message}</div>`;
                
                setTimeout(() => {
                    messageDiv.innerHTML = '';
                }, 5000);
            }
        }
        
        // Game navigation
        function startSinglePlayer() {
            if (isLoggedIn) {
                // Redirect to game page with user data
                const gameUrl = `game.php?mode=single&lang=${currentLanguage}&user=${currentUser.id}`;
                showMessage('Starting Single Player mode...', 'success');
                
                setTimeout(() => {
                    // For now, just show message since game.php doesn't exist yet
                    alert(`Ready to redirect to: ${gameUrl}\n\nYour teammates can create game.php to handle this!`);
                    // window.location.href = gameUrl; // Uncomment when game.php exists
                }, 1000);
            } else {
                showMessage('Please login first to start playing', 'error');
                setTimeout(() => showLogin(), 1000);
            }
        }
        
        // Utility functions
        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        function loadLanguagePreference() {
            const savedLanguage = localStorage.getItem('chok_language');
            if (savedLanguage && translations[savedLanguage]) {
                changeLanguage(savedLanguage);
            }
        }
        
        // Event listeners
        window.addEventListener('click', function(event) {
            const modal = document.getElementById('authModal');
            if (event.target === modal) {
                closeAuth();
            }
        });

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeAuth();
            }
        });

        // Initialize everything when page loads
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Page loaded. Current user:', currentUser);
            console.log('Is logged in:', isLoggedIn);
            console.log('Current language:', currentLanguage);
            
            updateUserInterface();
            
            // Load correct language on page load
            if (currentLanguage) {
                // Update page content with preferred language
                updatePageContent();
                
                // Set correct active button
                document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
                const activeBtn = document.getElementById(currentLanguage === 'english' ? 'englishBtn' : 'khmerBtn');
                if (activeBtn) activeBtn.classList.add('active');
            }
        });
    </script>
</body>
</html>