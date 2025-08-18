# 🤖 Amir Bot Manager - Professional Bot Management System

A professional Facebook Messenger bot management system with integrated coin system, file management, and code editing capabilities.

## ✨ Features

### 🪙 Coin System
- **Daily Coin Collection**: Users can collect up to 10 coins per 24 hours
- **Coin-based Bot Running**: Bots consume 1 coin per hour while running
- **Automatic Bot Management**: Bots automatically stop when coins run out
- **WhatsApp Integration**: Direct link to purchase more coins

### 🎛️ Professional Dashboard
- **Modern UI**: Beautiful, responsive design with gradient backgrounds
- **Real-time Updates**: Live bot status and uptime monitoring
- **Coin Management**: Visual coin display and collection system
- **Bot Controls**: Start, stop, and reset bot functionality

### 🔧 Bot Manager
- **File Explorer**: Browse and manage bot files and folders
- **Code Editor**: Professional code editor with syntax highlighting
- **File Management**: Edit, save, and reset bot files
- **Console Interface**: Real-time bot console with status updates

### 📁 File Management
- **Priyansh Folder**: Access to commands and events folders
- **Configuration Files**: Edit appstate.json and config.json
- **Backup System**: Automatic backup before file modifications
- **Security**: Protected file access with user authentication

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm 10.0.0 or higher

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the application:
   ```bash
   npm start
   ```

### Access
- **Main Dashboard**: `http://localhost:21030/dashboard`
- **Bot Manager**: `http://localhost:21030/bot-manager`
- **Login Page**: `http://localhost:21030/login`

## 💰 Coin System Details

### How Coins Work
1. **Collection**: Users can collect 1 coin by clicking the "Collect Coins" button
2. **Daily Limit**: Maximum 10 coins can be collected per 24-hour period
3. **Bot Running**: Each bot consumes 1 coin per hour while running
4. **Automatic Stop**: Bots automatically stop when user runs out of coins

### Coin Collection Rules
- **New Users**: Start with 0 coins
- **Collection Time**: 24-hour cooldown between collection periods
- **Daily Maximum**: 10 coins per day
- **Reset**: Daily limit resets after 24 hours from first collection

### Bot Running Costs
- **Start Cost**: 1 coin to start a bot
- **Hourly Cost**: 1 coin per hour while running
- **Automatic Deduction**: Coins are deducted every hour automatically
- **Graceful Shutdown**: Bot stops when coins reach 0

## 🤖 Bot Management

### Starting a Bot
1. Ensure you have sufficient coins
2. Navigate to Bot Manager
3. Configure bot settings
4. Click "Start Bot"
5. Bot will consume 1 coin per hour

### Stopping a Bot
1. Click "Stop Bot" in Bot Manager
2. Bot process is terminated
3. Coin deduction stops
4. Bot status is updated

### File Editing
1. Select a file from the File Explorer
2. Edit code in the professional editor
3. Save changes with the Save button
4. Reset to original with the Reset button

## 🔐 User Management

### Registration
- Email and password required
- Minimum 8 character password
- Automatic coin system initialization

### Authentication
- Session-based authentication
- Secure password hashing with bcrypt
- Protected API endpoints

### User Data
- Coin balance tracking
- Bot running status
- Bot uptime monitoring
- File modification history

## 📱 WhatsApp Integration

### Coin Purchase
- Direct WhatsApp link: `https://wa.me/923114397148`
- Pre-filled message for coin purchase
- Contact: +92 311 4397148

## 🛠️ Technical Details

### Backend
- **Framework**: Express.js
- **Authentication**: Express-session with bcrypt
- **File System**: fs-extra for enhanced file operations
- **Process Management**: Child process spawning for bots

### Frontend
- **HTML5**: Modern semantic markup
- **CSS3**: Advanced styling with CSS variables
- **JavaScript**: ES6+ features and async/await
- **CodeMirror**: Professional code editor integration

### Database
- **Users**: JSON-based user storage
- **Bot Configurations**: JSON-based bot management
- **File Backups**: Automatic backup system

## 🔒 Security Features

- **Authentication Required**: All sensitive endpoints protected
- **File Access Control**: Users can only access authorized files
- **Directory Traversal Protection**: Secure file path handling
- **Session Management**: Secure session handling

## 📊 API Endpoints

### Authentication
- `POST /signup` - User registration
- `POST /login` - User authentication
- `POST /logout` - User logout

### Dashboard
- `GET /api/dashboard-data` - Get user dashboard data
- `POST /api/collect-coins` - Collect coins

### Bot Management
- `POST /start-bot` - Start a bot
- `POST /stop-bot` - Stop a bot
- `POST /restart-bot` - Restart a bot
- `POST /delete-bot` - Delete a bot

### File Management
- `GET /api/bot-files` - Get bot file structure
- `GET /api/bot-file-content/:filePath` - Get file content
- `POST /api/save-bot-file` - Save file changes
- `POST /api/reset-bot-file` - Reset file to original

## 🎨 UI Components

### Dashboard Cards
- **Coin System Card**: Gold gradient with coin display
- **Bot Status Card**: Blue gradient with bot controls
- **Action Buttons**: Professional gradient buttons

### Color Scheme
- **Primary**: #667eea (Blue)
- **Secondary**: #764ba2 (Purple)
- **Success**: #4facfe (Light Blue)
- **Warning**: #f093fb (Pink)
- **Danger**: #ff6b6b (Red)

## 📱 Responsive Design

- **Desktop**: Full-featured interface with side-by-side layout
- **Tablet**: Adaptive grid layout
- **Mobile**: Stacked layout for small screens

## 🔄 Auto-Restart System

- **Crash Recovery**: Automatic restart on bot crashes
- **Configurable**: Users can enable/disable auto-restart
- **Smart Detection**: Distinguishes between manual stops and crashes

## 📈 Monitoring & Logging

- **Real-time Status**: Live bot status updates
- **Uptime Tracking**: Precise bot running time
- **Console Output**: Real-time bot console messages
- **Error Logging**: Comprehensive error tracking

## 🚀 Future Enhancements

- **Premium Features**: Advanced bot capabilities
- **Team Management**: Multi-user bot collaboration
- **Analytics Dashboard**: Bot performance metrics
- **API Integration**: Third-party service connections

## 📞 Support

For technical support or coin purchases:
- **WhatsApp**: +92 311 4397148
- **Email**: Contact through the application

## 📄 License

This project is licensed under GPL-3.0.

---

**Made with ❤️ by Mian Amir**