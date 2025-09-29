# Chok Hmong Game - Troubleshooting Guide

## 🚀 Quick Start
1. Double-click `start-game.bat` to start the server
2. Open your browser and go to `http://localhost:3000`

## ❌ Common Issues & Solutions

### 1. Port Already in Use Error
**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**
- **Option A:** Use the `start-game.bat` file (it automatically kills processes on port 3000)
- **Option B:** Manually kill the process:
  ```cmd
  netstat -ano | findstr :3000
  taskkill /PID [PID_NUMBER] /F
  ```
- **Option C:** Change the port in `server.js` (line 397) from 3000 to another port like 3001

### 2. Node.js Not Found
**Error:** `'node' is not recognized as an internal or external command`

**Solution:**
1. Download and install Node.js from https://nodejs.org/
2. Restart your command prompt/terminal
3. Verify installation: `node --version`

### 3. Missing Dependencies
**Error:** `Cannot find module 'socket.io'` or similar

**Solution:**
```cmd
npm install
```

### 4. Server Won't Start
**Check these:**
1. Make sure you're in the correct directory (`E:\TruthOrDare`)
2. Check if `server.js` exists
3. Verify all files are present:
   - `index.html`
   - `multiPlayer.html`
   - `script.js`
   - `server.js`
   - `package.json`

### 5. Game Features Not Working

#### Voice Chat Issues:
- Make sure you allow microphone permissions in your browser
- Try refreshing the page
- Check browser console for errors (F12)

#### QR Code Not Generating:
- Check if you have internet connection (QR library loads from CDN)
- Try refreshing the page

#### Multiplayer Connection Issues:
- Make sure the server is running
- Check if both players are on the same network
- Try refreshing both browser windows

## 🔧 Manual Server Start

If the batch file doesn't work:

1. **Open Command Prompt as Administrator**
2. **Navigate to the game folder:**
   ```cmd
   cd E:\TruthOrDare
   ```
3. **Kill any existing processes on port 3000:**
   ```cmd
   netstat -ano | findstr :3000
   taskkill /PID [PID_NUMBER] /F
   ```
4. **Install dependencies (if needed):**
   ```cmd
   npm install
   ```
5. **Start the server:**
   ```cmd
   node server.js
   ```

## 🌐 Accessing the Game

- **Main Game:** http://localhost:3000
- **Direct Multiplayer:** http://localhost:3000/multiPlayer.html
- **Single Player:** http://localhost:3000/index.html

## 📱 Mobile/Network Access

To play with friends on the same network:

1. **Find your computer's IP address:**
   ```cmd
   ipconfig
   ```
2. **Share the IP with friends:** `http://[YOUR_IP]:3000`
3. **Make sure Windows Firewall allows Node.js**

## 🐛 Debug Mode

To see detailed error messages:

1. **Open browser console (F12)**
2. **Check the Console tab for JavaScript errors**
3. **Check the Network tab for failed requests**

## 📞 Still Having Issues?

1. **Check the server console output** for error messages
2. **Try a different port** by editing `server.js` line 397
3. **Restart your computer** if nothing else works
4. **Make sure no antivirus is blocking the connection**

## 🎮 Game Features Checklist

- ✅ Server starts without errors
- ✅ Main page loads with bubble theme
- ✅ Single player mode works
- ✅ Multiplayer room creation works
- ✅ Room joining works
- ✅ Voice chat works (microphone permission required)
- ✅ QR code generation works
- ✅ Game questions appear correctly

---

**Need more help?** Check the server console output for specific error messages!