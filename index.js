const { spawn } = require("child_process");
const axios = require("axios");
const logger = require("./utils/log");
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const bcrypt = require('bcrypt');
const session = require('express-session');
const os = require('os');

const app = express();
const port = process.env.PORT || 21030; // Use hosting port or default to 5000

// ==================== RESOURCE MANAGEMENT SYSTEM ====================
class ResourceManager {
    constructor() {
        this.maxBotsPerUser = 50; // Maximum bots per user
        this.maxTotalBots = 200; // Maximum total bots across all users
        this.maxMemoryPerBot = 512; // MB per bot
        this.maxStoragePerUser = 100; // MB per user
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
        this.healthCheckInterval = 30 * 1000; // 30 seconds
        
        this.startResourceMonitoring();
    }

    // Monitor system resources
    startResourceMonitoring() {
        setInterval(() => {
            this.checkSystemHealth();
        }, this.healthCheckInterval);

        setInterval(() => {
            this.cleanupResources();
        }, this.cleanupInterval);
    }

    // Check system health and restart failed bots
    async checkSystemHealth() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

        // If memory usage is high, restart some bots
        if (memoryUsage > 80) {
            logger(`High memory usage detected: ${memoryUsage.toFixed(2)}%`, "[ RESOURCE WARNING ]");
            this.optimizeMemoryUsage();
        }

        // Check bot health and restart failed ones
        for (const [botId, bot] of global.activeBots) {
            if (bot.process && bot.process.killed) {
                logger(`Bot ${botId} process is dead, attempting restart`, "[ HEALTH CHECK ]");
                await this.autoRestartBot(botId, bot);
            }
        }
    }

    // Optimize memory usage by restarting some bots
    optimizeMemoryUsage() {
        const bots = Array.from(global.activeBots.entries());
        if (bots.length > 10) {
            // Restart oldest bots to free memory
            const oldestBots = bots
                .sort((a, b) => a[1].startTime - b[1].startTime)
                .slice(0, Math.floor(bots.length * 0.2)); // Restart 20% oldest bots

            oldestBots.forEach(([botId, bot]) => {
                logger(`Restarting bot ${botId} for memory optimization`, "[ MEMORY OPTIMIZATION ]");
                this.autoRestartBot(botId, bot);
            });
        }
    }

    // Auto-restart bot on failure
    async autoRestartBot(botId, bot) {
        try {
            if (bot.restartAttempts >= 3) {
                logger(`Bot ${botId} failed too many times, stopping auto-restart`, "[ AUTO-RESTART LIMIT ]");
                global.activeBots.delete(botId);
                return;
            }

            bot.restartAttempts = (bot.restartAttempts || 0) + 1;
            logger(`Auto-restarting bot ${botId} (attempt ${bot.restartAttempts})`, "[ AUTO-RESTART ]");

            // Wait before restart (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, bot.restartAttempts - 1), 30000);
            setTimeout(async () => {
                await this.restartBotProcess(botId, bot);
            }, delay);

        } catch (error) {
            logger(`Error in auto-restart for bot ${botId}: ${error.message}`, "[ AUTO-RESTART ERROR ]");
        }
    }

    // Restart bot process
    async restartBotProcess(botId, bot) {
        try {
            const newChild = spawn("node", ["--max-old-space-size=512", "--trace-warnings", "--async-stack-traces", "Priyansh.js"], {
                cwd: __dirname,
                stdio: ["pipe", "pipe", "pipe"],
                shell: true,
                detached: true,
                env: { 
                    ...process.env, 
                    BOT_CONFIG: bot.configPath, 
                    BOT_ID: botId,
                    USER_ID: bot.userId,
                    NODE_ENV: 'production'
                }
            });

            if (newChild.pid) {
                try {
                    process.setpgid(newChild.pid, newChild.pid);
                } catch (e) {
                    logger(`Warning: Could not set process group for restarted bot ${botId}: ${e.message}`, "[ BOT WARNING ]");
                }
            }

            // Update bot process
            bot.process = newChild;
            bot.startTime = new Date();
            bot.lastRestart = new Date();

            // Set up event handlers
            newChild.stdout.on('data', (data) => {
                logger(`[BOT ${botId} OUTPUT]: ${data.toString()}`, "[INFO]");
            });

            newChild.stderr.on('data', (data) => {
                logger(`[BOT ${botId} ERROR]: ${data.toString()}`, "[ERROR]");
            });

            newChild.on("close", (codeExit) => {
                logger(`Restarted Bot ${botId} closed with exit code: ${codeExit}`, "[ BOT CLOSE ]");
                if (codeExit !== 0) {
                    // If bot still fails, try to restart again
                    setTimeout(() => {
                        this.autoRestartBot(botId, bot);
                    }, 5000);
                }
            });

            newChild.on("error", (error) => {
                logger(`Restarted Bot ${botId} process error: ${error.message}`, "[ BOT ERROR ]");
                setTimeout(() => {
                    this.autoRestartBot(botId, bot);
                }, 5000);
            });

            logger(`Bot ${botId} restarted successfully with new PID ${newChild.pid}`, "[ AUTO-RESTART SUCCESS ]");

        } catch (error) {
            logger(`Error restarting bot process ${botId}: ${error.message}`, "[ RESTART ERROR ]");
        }
    }

    // Clean up resources
    cleanupResources() {
        try {
            // Clean up temporary config files
            const tempFiles = fs.readdirSync(__dirname).filter(file => 
                file.startsWith('temp_config_') && file.endsWith('.json')
            );

            tempFiles.forEach(file => {
                const botId = file.replace('temp_config_', '').replace('.json', '');
                if (!global.activeBots.has(botId)) {
                    try {
                        fs.unlinkSync(path.join(__dirname, file));
                        logger(`Cleaned up orphaned config file: ${file}`, "[ CLEANUP ]");
                    } catch (e) {
                        // File might be in use
                    }
                }
            });

            // Clean up empty bot directories
            const botsDir = path.join(__dirname, 'bots');
            if (fs.existsSync(botsDir)) {
                const userDirs = fs.readdirSync(botsDir);
                userDirs.forEach(userDir => {
                    const userPath = path.join(botsDir, userDir);
                    const botDirs = fs.readdirSync(userPath);
                    
                    botDirs.forEach(botDir => {
                        const botPath = path.join(userPath, botDir);
                        const botId = botDir;
                        
                        if (!global.activeBots.has(botId)) {
                            try {
                                fs.removeSync(botPath);
                                logger(`Cleaned up inactive bot directory: ${botPath}`, "[ CLEANUP ]");
                            } catch (e) {
                                // Directory might be in use
                            }
                        }
                    });
                });
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

        } catch (error) {
            logger(`Error during resource cleanup: ${error.message}`, "[ CLEANUP ERROR ]");
        }
    }

    // Check if user can create more bots
    canCreateBot(userId) {
        const userBots = getUserBotsDB();
        const userBotCount = Object.keys(userBots[userId] || {}).length;
        const totalBots = global.activeBots.size;

        if (userBotCount >= this.maxBotsPerUser) {
            return { allowed: false, reason: `Maximum bots per user (${this.maxBotsPerUser}) reached` };
        }

        if (totalBots >= this.maxTotalBots) {
            return { allowed: false, reason: `Maximum total bots (${this.maxTotalBots}) reached` };
        }

        return { allowed: true };
    }

    // Get system resource usage
    getResourceUsage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;

        return {
            memory: {
                total: Math.round(totalMemory / 1024 / 1024),
                used: Math.round(usedMemory / 1024 / 1024),
                free: Math.round(freeMemory / 1024 / 1024),
                usage: Math.round(memoryUsage)
            },
            bots: {
                active: global.activeBots.size,
                max: this.maxTotalBots
            },
            uptime: process.uptime()
        };
    }
}

// Initialize resource manager
const resourceManager = new ResourceManager();

// ==================== STORAGE OPTIMIZATION SYSTEM ====================
class StorageOptimizer {
    constructor() {
        this.symbolicLinks = new Map();
        this.fileHashes = new Map();
        this.cleanupInterval = 10 * 60 * 1000; // 10 minutes
        this.startCleanup();
    }

    // Create symbolic link instead of copying file
    createSymbolicLink(sourcePath, destPath) {
        try {
            if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
            }
            
            // Create symbolic link to save space
            fs.symlinkSync(sourcePath, destPath);
            this.symbolicLinks.set(destPath, sourcePath);
            
            return true;
        } catch (error) {
            logger(`Error creating symbolic link: ${error.message}`, "[ STORAGE ERROR ]");
            // Fallback to copying
            try {
                fs.copyFileSync(sourcePath, destPath);
                return false;
            } catch (copyError) {
                logger(`Error copying file: ${copyError.message}`, "[ STORAGE ERROR ]");
                return false;
            }
        }
    }

    // Optimize bot setup by using symbolic links
    optimizeBotSetup(botDir, commands, events, userEmail) {
        const botCommandsDir = path.join(botDir, 'commands');
        const botEventsDir = path.join(botDir, 'events');

        fs.mkdirSync(botCommandsDir, { recursive: true });
        fs.mkdirSync(botEventsDir, { recursive: true });

        // Optimize commands
        if (commands && Array.isArray(commands)) {
            commands.forEach(cmd => {
                const cmdFileName = cmd.endsWith('.js') ? cmd : `${cmd}.js`;
                const userSpecificPath = path.join(__dirname, 'user_code', userEmail, 'commands', cmdFileName);
                const originalPath = path.join(__dirname, 'Priyansh/commands', cmdFileName);
                const destPath = path.join(botCommandsDir, cmdFileName);

                let srcPath = originalPath;
                if (fs.existsSync(userSpecificPath)) {
                    srcPath = userSpecificPath;
                }

                if (fs.existsSync(srcPath)) {
                    this.createSymbolicLink(srcPath, destPath);
                }
            });
        }

        // Optimize events
        if (events && Array.isArray(events)) {
            events.forEach(evt => {
                const evtFileName = evt.endsWith('.js') ? evt : `${evt}.js`;
                const userSpecificPath = path.join(__dirname, 'user_code', userEmail, 'events', evtFileName);
                const originalPath = path.join(__dirname, 'Priyansh/events', evtFileName);
                const destPath = path.join(botEventsDir, evtFileName);

                let srcPath = originalPath;
                if (fs.existsSync(userSpecificPath)) {
                    srcPath = userSpecificPath;
                }

                if (fs.existsSync(srcPath)) {
                    this.createSymbolicLink(srcPath, destPath);
                }
            });
        }
    }

    // Clean up symbolic links
    cleanupSymbolicLinks() {
        for (const [destPath, sourcePath] of this.symbolicLinks) {
            try {
                if (fs.existsSync(destPath)) {
                    const stats = fs.lstatSync(destPath);
                    if (stats.isSymbolicLink()) {
                        fs.unlinkSync(destPath);
                        this.symbolicLinks.delete(destPath);
                    }
                }
            } catch (error) {
                // Link might be broken or in use
            }
        }
    }

    // Start cleanup process
    startCleanup() {
        setInterval(() => {
            this.cleanupSymbolicLinks();
        }, this.cleanupInterval);
    }
}

// Initialize storage optimizer
const storageOptimizer = new StorageOptimizer();

// ==================== ESSENTIAL MIDDLEWARE & CONFIGURATION ====================
// Increase payload limits for better scalability
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: 'amir-bot-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Authentication helper functions
const getUsersDB = () => {
    try {
        return JSON.parse(fs.readFileSync('./users.json', 'utf8'));
    } catch {
        return [];
    }
};

const saveUsersDB = (users) => {
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
};

const getUserBotsDB = () => {
    try {
        return JSON.parse(fs.readFileSync('./user_bots.json', 'utf8'));
    } catch {
        return {};
    }
};

const saveUserBotsDB = (userBots) => {
    fs.writeFileSync('./user_bots.json', JSON.stringify(userBots, null, 2));
};

// Update bot ownership tracking
const trackBotOwnership = (userId, botId, botConfig) => {
    const userBots = getUserBotsDB();
    if (!userBots[userId]) {
        userBots[userId] = {};
    }
    userBots[userId][botId] = {
        createdAt: new Date().toISOString(),
        config: botConfig,
        lastActive: new Date().toISOString()
    };
    saveUserBotsDB(userBots);
};

const removeBotOwnership = (userId, botId) => {
    const userBots = getUserBotsDB();
    if (userBots[userId] && userBots[userId][botId]) {
        delete userBots[userId][botId];
        saveUserBotsDB(userBots);
    }
};

// ==================== ENHANCED BOT MANAGEMENT ====================
// Store active bot processes with better memory management
global.activeBots = new Map();

// Add request logging middleware with rate limiting
const requestCounts = new Map();
app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    // Clean old entries
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.lastRequest > 60000) { // Clean entries older than 1 minute
            requestCounts.delete(key);
        }
    }

    // Track requests
    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, lastRequest: now });
    } else {
        const data = requestCounts.get(ip);
        data.count++;
        data.lastRequest = now;
    }

    // Only log if reasonable frequency (not spam)
    const data = requestCounts.get(ip);
    if (data.count <= 20 || data.count % 50 === 0) {
        logger(`${req.method} ${req.url} from ${req.ip}`, "[ REQUEST ]");
    }

    next();
});

// Set higher limits for concurrent connections
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Serve the login page for the root route
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'), (err) => {
        if (err) {
            logger(`Error serving login.html: ${err.message}`, "[ERROR]");
            res.status(500).send('Unable to load the login page. Check server logs.');
        }
    });
});

// Serve the login page explicitly
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'), (err) => {
        if (err) {
            logger(`Error serving login.html: ${err.message}`, "[ERROR]");
            res.status(500).send('Unable to load the login page. Check server logs.');
        }
    });
});

// Serve the dashboard for authenticated users
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'), (err) => {
        if (err) {
            logger(`Error serving dashboard.html: ${err.message}`, "[ERROR]");
            res.status(500).send('Unable to load the dashboard. Check server logs.');
        }
    });
});

// Add a route for bot manager (with authentication required)
app.get('/bot-manager', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            logger(`Error serving bot manager: ${err.message}`, "[ERROR]");
            res.status(500).send('Unable to load the bot manager. Check server logs.');
        }
    });
});

// Authentication Routes
app.post('/signup', async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
        return res.json({ status: "error", message: "All fields are required" });
    }

    if (password !== confirmPassword) {
        return res.json({ status: "error", message: "Passwords do not match" });
    }

    if (password.length < 8) {
        return res.json({ status: "error", message: "Password must be at least 8 characters long" });
    }

    const users = getUsersDB();

    if (users.find(user => user.email === email)) {
        return res.json({ status: "error", message: "Email already exists" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsersDB(users);

        req.session.userId = newUser.id;
        req.session.userEmail = newUser.email;

        logger(`New user registered: ${email}`, "[AUTH]");
        res.json({ status: "success", message: "Account created successfully" });
    } catch (error) {
        logger(`Signup error: ${error.message}`, "[ERROR]");
        res.json({ status: "error", message: "Error creating account" });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ status: "error", message: "Email and password are required" });
    }

    const users = getUsersDB();
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.json({ status: "error", message: "Invalid email or password" });
    }

    try {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.json({ status: "error", message: "Invalid email or password" });
        }

        req.session.userId = user.id;
        req.session.userEmail = user.email;

        logger(`User logged in: ${email}`, "[AUTH]");
        res.json({ status: "success", message: "Login successful" });
    } catch (error) {
        logger(`Login error: ${error.message}`, "[ERROR]");
        res.json({ status: "error", message: "Login error" });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.json({ status: "error", message: "Logout failed" });
        }
        res.json({ status: "success", message: "Logged out successfully" });
    });
});

app.get('/api/user-info', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Not authenticated" });
    }

    res.json({ 
        status: "success", 
        user: { 
            id: req.session.userId, 
            email: req.session.userEmail 
        } 
    });
});

app.post('/start-bot', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { appstate, adminUid, prefix, commands, events, botId } = req.body;
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;

    if (!botId) {
        return res.json({ status: "error", message: "Bot ID is required" });
    }

    // Check resource limits before starting bot
    const resourceCheck = resourceManager.canCreateBot(userId);
    if (!resourceCheck.allowed) {
        return res.json({ status: "error", message: resourceCheck.reason });
    }

    // Check if bot ID already exists for any user
    const userBots = getUserBotsDB();
    for (const [ownerId, bots] of Object.entries(userBots)) {
        if (bots[botId] && ownerId !== userId) {
            return res.json({ status: "error", message: "Bot ID already taken by another user" });
        }
    }

    if (global.activeBots.has(botId)) {
        return res.json({ status: "error", message: "Bot is already running" });
    }

    // Check if this is a restart of an existing bot (user owns it but it's stopped)
    const isExistingBot = userBots[userId] && userBots[userId][botId];
    let config;

    if (isExistingBot) {
        // Use existing bot configuration for restart
        config = userBots[userId][botId].config;
        logger(`Restarting existing bot ${botId} for user ${userId}`, "[ BOT RESTART ]");
    } else {
        // New bot creation
        const baseConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        config = {
            ...baseConfig,
            appstate: appstate || baseConfig.appstate,
            ADMINBOT: adminUid ? [adminUid] : baseConfig.ADMINBOT,
            PREFIX: prefix || baseConfig.PREFIX,
            commands: commands || null,
            events: events || null,
            botId: botId
        };
    }

    try {

        const configPath = path.resolve(`temp_config_${botId}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        logger(`Starting bot ${botId} with config: ${configPath}`, "[ BOT START ]");

        const botDir = path.join(__dirname, 'bots', userId, botId);
        fs.mkdirSync(botDir, { recursive: true });

        // Use storage optimization for bot setup
        storageOptimizer.optimizeBotSetup(botDir, commands, events, userEmail);

        const child = spawn("node", ["--max-old-space-size=512", "--trace-warnings", "--async-stack-traces", "Priyansh.js"], {
            cwd: __dirname,
            stdio: ["pipe", "pipe", "pipe"],
            shell: true,
            detached: true, // Enable process group creation
            env: { 
                ...process.env, 
                BOT_CONFIG: configPath, 
                BOT_ID: botId,
                USER_ID: userId,
                NODE_ENV: 'production'
            }
        });

        // Create a new process group so we can kill all child processes
        if (child.pid) {
            try {
                process.setpgid(child.pid, child.pid);
            } catch (e) {
                logger(`Warning: Could not set process group for bot ${botId}: ${e.message}`, "[ BOT WARNING ]");
            }
        }

        global.activeBots.set(botId, { 
            process: child, 
            startTime: new Date(), 
            configPath,
            userId: userId,
            config: config
        });

        // Track bot ownership
        trackBotOwnership(userId, botId, config);

        let responseSet = false;

        const timeout = setTimeout(() => {
            if (!responseSet) {
                responseSet = true;
                res.json({ status: "success", message: "Bot starting..." });
            }
        }, 5000); // Increased timeout to 5 seconds

        child.stdout.on('data', (data) => {
            logger(`[BOT ${botId} OUTPUT]: ${data.toString()}`, "[INFO]");
        });

        child.stderr.on('data', (data) => {
            logger(`[BOT ${botId} ERROR]: ${data.toString()}`, "[ERROR]");
        });

        child.on("close", (codeExit) => {
            clearTimeout(timeout);
            logger(`Bot ${botId} closed with exit code: ${codeExit}`, "[ BOT CLOSE ]");
            global.activeBots.delete(botId);

            try {
                if (fs.existsSync(configPath)) {
                    fs.unlinkSync(configPath);
                }
            } catch (cleanupError) {
                logger(`Error cleaning up config file: ${cleanupError.message}`, "[ CLEANUP ERROR ]");
            }

            // Trigger auto-restart for non-zero exit codes
            if (codeExit !== 0) {
                setTimeout(() => {
                    resourceManager.autoRestartBot(botId, { userId, config });
                }, 5000);
            }

            if (!responseSet) {
                responseSet = true;
                if (codeExit === 0) {
                    res.json({ status: "success", message: "Bot started successfully" });
                } else {
                    res.json({ status: "error", message: `Bot exited with code ${codeExit}. Auto-restart initiated.` });
                }
            }
        });

        child.on("error", (error) => {
            clearTimeout(timeout);
            logger(`Bot ${botId} process error: ${error.message}`, "[ BOT ERROR ]");
            global.activeBots.delete(botId);

            try {
                if (fs.existsSync(configPath)) {
                    fs.unlinkSync(configPath);
                }
            } catch (cleanupError) {
                logger(`Error cleaning up config file: ${cleanupError.message}`, "[ CLEANUP ERROR ]");
            }

            // Trigger auto-restart for this bot
            setTimeout(() => {
                resourceManager.autoRestartBot(botId, { userId, config });
            }, 5000);

            if (!responseSet) {
                responseSet = true;
                res.json({ status: "error", message: `Process error: ${error.message}. Auto-restart initiated.` });
            }
        });

        if (!responseSet) {
            responseSet = true;
            res.json({ status: "success", message: "Bot starting..." });
        }

    } catch (error) {
        logger(`Error starting bot ${botId}: ${error.message}`, "[ ERROR ]");
        res.json({ status: "error", message: `Failed to start bot: ${error.message}` });
    }
});

app.post('/stop-bot', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { botId } = req.body;
    const userId = req.session.userId;
    const bot = global.activeBots.get(botId);

    // Check if user owns this bot
    const userBots = getUserBotsDB();
    if (!userBots[userId] || !userBots[userId][botId]) {
        return res.json({ status: "error", message: "You don't have permission to stop this bot" });
    }

    if (bot && bot.process) {
        try {
            // Force kill the process and all its children
            if (bot.process.pid) {
                try {
                    // Kill the entire process group
                    process.kill(-bot.process.pid, 'SIGKILL');
                } catch (killError) {
                    // Fallback to killing just the main process
                    bot.process.kill('SIGKILL');
                }
            }

            // Wait a moment then force cleanup
            setTimeout(() => {
                if (bot.process && !bot.process.killed) {
                    try {
                        bot.process.kill('SIGKILL');
                    } catch (e) {
                        logger(`Additional cleanup attempt: ${e.message}`, "[ BOT CLEANUP ]");
                    }
                }
            }, 1000);

            global.activeBots.delete(botId);

            if (bot.configPath && fs.existsSync(bot.configPath)) {
                fs.unlinkSync(bot.configPath);
            }

            logger(`Bot ${botId} stopped successfully with PID ${bot.process.pid}`, "[ BOT STOP ]");
            res.json({ status: "success", message: "Bot stopped successfully" });
        } catch (error) {
            logger(`Error stopping bot ${botId}: ${error.message}`, "[ ERROR ]");
            res.json({ status: "error", message: `Error stopping bot: ${error.message}` });
        }
    } else {
        res.json({ status: "error", message: "Bot not found or already stopped" });
    }
});

app.post('/delete-bot', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { botId } = req.body;
    const userId = req.session.userId;

    // Check if user owns this bot
    const userBots = getUserBotsDB();
    if (!userBots[userId] || !userBots[userId][botId]) {
        return res.json({ status: "error", message: "You don't have permission to delete this bot" });
    }

    try {
        // Stop the bot if it's running
        const bot = global.activeBots.get(botId);
        if (bot && bot.process) {
            // Force kill the process and all its children
            if (bot.process.pid) {
                try {
                    // Kill the entire process group
                    process.kill(-bot.process.pid, 'SIGKILL');
                } catch (killError) {
                    // Fallback to killing just the main process
                    bot.process.kill('SIGKILL');
                }
            }

            // Wait a moment then force cleanup
            setTimeout(() => {
                if (bot.process && !bot.process.killed) {
                    try {
                        bot.process.kill('SIGKILL');
                    } catch (e) {
                        logger(`Additional cleanup attempt during delete: ${e.message}`, "[ BOT CLEANUP ]");
                    }
                }
            }, 1000);

            global.activeBots.delete(botId);

            if (bot.configPath && fs.existsSync(bot.configPath)) {
                fs.unlinkSync(bot.configPath);
            }

            logger(`Bot ${botId} process terminated with PID ${bot.process.pid} during deletion`, "[ BOT DELETE ]");
        }

        // Remove from ownership tracking
        removeBotOwnership(userId, botId);

        logger(`Bot ${botId} deleted by user ${userId}`, "[ BOT DELETE ]");
        res.json({ status: "success", message: "Bot deleted successfully" });
    } catch (error) {
        logger(`Error deleting bot ${botId}: ${error.message}`, "[ ERROR ]");
        res.json({ status: "error", message: `Error deleting bot: ${error.message}` });
    }
});

app.post('/restart-bot', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { botId } = req.body;
    const userId = req.session.userId;

    // Check if user owns this bot
    const userBots = getUserBotsDB();
    if (!userBots[userId] || !userBots[userId][botId]) {
        return res.json({ status: "error", message: "You don't have permission to restart this bot" });
    }

    try {
        const bot = global.activeBots.get(botId);

        if (!bot || !bot.process) {
            return res.json({ status: "error", message: "Bot is not currently running. Please start it manually." });
        }

        const savedConfig = bot.config;

        // First, stop the current bot process
        if (bot.process.pid) {
            try {
                // Kill the entire process group
                process.kill(-bot.process.pid, 'SIGKILL');
            } catch (killError) {
                // Fallback to killing just the main process
                bot.process.kill('SIGKILL');
            }
        }

        // Clean up old resources
        global.activeBots.delete(botId);
        if (bot.configPath && fs.existsSync(bot.configPath)) {
            fs.unlinkSync(bot.configPath);
        }

        logger(`Bot ${botId} stopped for restart`, "[ BOT RESTART ]");

        // Use resource manager for restart
        setTimeout(async () => {
            try {
                await resourceManager.restartBotProcess(botId, {
                    ...bot,
                    config: savedConfig,
                    userId: userId
                });
            } catch (restartError) {
                logger(`Error restarting bot ${botId}: ${restartError.message}`, "[ RESTART ERROR ]");
            }
        }, 2000);

        res.json({ status: "success", message: "Bot is being restarted..." });

    } catch (error) {
        logger(`Error restarting bot ${botId}: ${error.message}`, "[ ERROR ]");
        res.json({ status: "error", message: `Error restarting bot: ${error.message}` });
    }
});

// New endpoint for bulk bot operations
app.post('/bulk-bot-operation', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { operation, botIds } = req.body;
    const userId = req.session.userId;

    if (!operation || !botIds || !Array.isArray(botIds)) {
        return res.json({ status: "error", message: "Invalid operation or bot IDs" });
    }

    const userBots = getUserBotsDB();
    const userOwnedBots = userBots[userId] || {};
    const results = [];

    botIds.forEach(botId => {
        if (!userOwnedBots[botId]) {
            results.push({ botId, status: "error", message: "Bot not found or no permission" });
            return;
        }

        try {
            switch (operation) {
                case 'start':
                    // This would need to be implemented based on your start logic
                    results.push({ botId, status: "info", message: "Start operation not implemented in bulk" });
                    break;
                case 'stop':
                    const bot = global.activeBots.get(botId);
                    if (bot && bot.process) {
                        try {
                            if (bot.process.pid) {
                                process.kill(-bot.process.pid, 'SIGKILL');
                            }
                            global.activeBots.delete(botId);
                            results.push({ botId, status: "success", message: "Bot stopped" });
                        } catch (e) {
                            results.push({ botId, status: "error", message: e.message });
                        }
                    } else {
                        results.push({ botId, status: "info", message: "Bot not running" });
                    }
                    break;
                case 'restart':
                    // Use resource manager for restart
                    const restartBot = global.activeBots.get(botId);
                    if (restartBot && restartBot.process) {
                        resourceManager.autoRestartBot(botId, restartBot);
                        results.push({ botId, status: "success", message: "Bot restart initiated" });
                    } else {
                        results.push({ botId, status: "info", message: "Bot not running, cannot restart" });
                    }
                    break;
                default:
                    results.push({ botId, status: "error", message: "Unknown operation" });
            }
        } catch (error) {
            results.push({ botId, status: "error", message: error.message });
        }
    });

    res.json({
        status: "success",
        operation: operation,
        results: results
    });
});



app.get('/api/available-items', (req, res) => {
    try {
        const commandsPath = path.join(__dirname, 'Priyansh/commands');
        const eventsPath = path.join(__dirname, 'Priyansh/events');

        let commands = [];
        let events = [];

        // Check if directories exist before reading them
        if (fs.existsSync(commandsPath)) {
            commands = fs.readdirSync(commandsPath)
                .filter(file => file.endsWith('.js') && !file.includes('example'))
                .map(file => file.replace('.js', ''))
                .sort();
        }

        if (fs.existsSync(eventsPath)) {
            events = fs.readdirSync(eventsPath)
                .filter(file => file.endsWith('.js') && !file.includes('example'))
                .map(file => file.replace('.js', ''))
                .sort();
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ 
            status: 'success',
            commands: commands, 
            events: events 
        });
    } catch (error) {
        logger(`Error fetching available items: ${error.message}`, "[ ERROR ]");
        res.setHeader('Content-Type', 'application/json');
        res.json({ 
            status: 'error',
            message: error.message,
            commands: [], 
            events: [] 
        });
    }
});

app.get('/admin/all-bots', (req, res) => {
    const status = {};

    for (const [botId, bot] of global.activeBots) {
        const uptime = bot.startTime ? Math.floor((new Date() - bot.startTime) / 1000) : 0;
        status[botId] = { 
            running: bot.process && !bot.process.killed, 
            uptime: `${uptime}s`,
            pid: bot.process ? bot.process.pid : null,
            startTime: bot.startTime,
            userId: bot.userId,
            restartAttempts: bot.restartAttempts || 0,
            lastRestart: bot.lastRestart,
            config: {
                prefix: bot.config?.PREFIX,
                adminUid: bot.config?.ADMINBOT,
                commands: bot.config?.commands,
                events: bot.config?.events
            }
        };
    }

    res.json({ 
        totalBots: global.activeBots.size, 
        bots: status,
        resources: resourceManager.getResourceUsage()
    });
});

// New endpoint for system resource monitoring
app.get('/admin/system-status', (req, res) => {
    const resourceUsage = resourceManager.getResourceUsage();
    const storageInfo = {
        symbolicLinks: storageOptimizer.symbolicLinks.size,
        activeBots: global.activeBots.size,
        maxBots: resourceManager.maxTotalBots
    };

    res.json({
        status: 'success',
        resources: resourceUsage,
        storage: storageInfo,
        timestamp: new Date().toISOString()
    });
});

// New endpoint for force cleanup
app.post('/admin/force-cleanup', (req, res) => {
    try {
        resourceManager.cleanupResources();
        storageOptimizer.cleanupSymbolicLinks();
        
        res.json({
            status: 'success',
            message: 'Forced cleanup completed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger(`Error in force cleanup: ${error.message}`, "[ ADMIN CLEANUP ERROR ]");
        res.json({
            status: 'error',
            message: error.message
        });
    }
});

// New endpoint for system performance monitoring
app.get('/admin/performance', (req, res) => {
    try {
        const resourceUsage = resourceManager.getResourceUsage();
        const processInfo = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch
        };

        // Get disk usage information
        const diskUsage = {
            total: 0,
            used: 0,
            free: 0
        };

        try {
            const stats = fs.statSync(__dirname);
            // This is a simplified disk usage calculation
            diskUsage.total = stats.size || 0;
        } catch (e) {
            // Disk stats might not be available
        }

        res.json({
            status: 'success',
            system: {
                resources: resourceUsage,
                process: processInfo,
                disk: diskUsage
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger(`Error getting performance data: ${error.message}`, "[ PERFORMANCE ERROR ]");
        res.json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/admin/download-appstate/:botId', (req, res) => {
    const { botId } = req.params;
    const bot = global.activeBots.get(botId);

    if (!bot || !bot.config) {
        return res.status(404).json({ error: 'Bot not found or no config available' });
    }

    try {
        let appstateData = typeof bot.config.appstate === 'string' ? bot.config.appstate : JSON.stringify(bot.config.appstate, null, 2);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="appstate_${botId}.json"`);

        res.send(appstateData);

        logger(`Admin downloaded appstate for bot ${botId}`, "[ ADMIN DOWNLOAD ]");

    } catch (error) {
        logger(`Error downloading appstate for bot ${botId}: ${error.message}`, "[ ERROR ]");
        res.status(500).json({ error: 'Failed to process appstate data' });
    }
});

app.get('/bot-status', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const userId = req.session.userId;
    const userBots = getUserBotsDB();
    const userOwnedBots = userBots[userId] || {};

    const status = {};
    let activeCount = 0;

    // Check all user's bots (both active and inactive)
    for (const [botId, botData] of Object.entries(userOwnedBots)) {
        const activeBotInfo = global.activeBots.get(botId);

        if (activeBotInfo && activeBotInfo.process && !activeBotInfo.process.killed) {
            // Bot is currently running
            const uptime = activeBotInfo.startTime ? Math.floor((new Date() - activeBotInfo.startTime) / 1000) : 0;
            status[botId] = {
                running: true,
                uptime: `${uptime}s`,
                pid: activeBotInfo.process.pid,
                startTime: activeBotInfo.startTime,
                config: botData.config,
                createdAt: botData.createdAt,
                lastActive: activeBotInfo.startTime
            };
            activeCount++;
        } else {
            // Bot exists but is not running
            status[botId] = {
                running: false,
                uptime: '0s',
                pid: null,
                startTime: null,
                config: botData.config,
                createdAt: botData.createdAt,
                lastActive: botData.lastActive
            };
        }
    }

    res.json({ 
        totalBots: Object.keys(userOwnedBots).length,
        activeBotsCount: activeCount, 
        bots: status 
    });
});

app.get('/api/bot-details/:botId', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { botId } = req.params;
    const userId = req.session.userId;
    const userBots = getUserBotsDB();

    // Check if user owns this bot
    if (!userBots[userId] || !userBots[userId][botId]) {
        return res.json({ status: "error", message: "Bot not found or you don't have permission to view it" });
    }

    const botData = userBots[userId][botId];
    const activeBotInfo = global.activeBots.get(botId);
    const isRunning = activeBotInfo && activeBotInfo.process && !activeBotInfo.process.killed;

    const details = {
        botId: botId,
        running: isRunning,
        config: botData.config,
        createdAt: botData.createdAt,
        lastActive: isRunning ? activeBotInfo.startTime : botData.lastActive,
        uptime: isRunning ? Math.floor((new Date() - activeBotInfo.startTime) / 1000) : 0,
        pid: isRunning ? activeBotInfo.process.pid : null,
        startTime: isRunning ? activeBotInfo.startTime : null,
        totalCommands: botData.config.commands ? botData.config.commands.length : 0,
        totalEvents: botData.config.events ? botData.config.events.length : 0,
        restartAttempts: activeBotInfo ? (activeBotInfo.restartAttempts || 0) : 0,
        lastRestart: activeBotInfo ? activeBotInfo.lastRestart : null
    };

    res.json({ status: "success", bot: details });
});

// New endpoint for user resource usage
app.get('/api/user-resources', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const userId = req.session.userId;
    const userBots = getUserBotsDB();
    const userOwnedBots = userBots[userId] || {};
    const activeBots = Object.keys(userOwnedBots).filter(botId => 
        global.activeBots.has(botId)
    );

    const resourceInfo = {
        totalBots: Object.keys(userOwnedBots).length,
        activeBots: activeBots.length,
        maxBotsPerUser: resourceManager.maxBotsPerUser,
        maxStoragePerUser: resourceManager.maxStoragePerUser,
        canCreateMore: resourceManager.canCreateBot(userId).allowed
    };

    res.json({
        status: "success",
        resources: resourceInfo
    });
});

// New endpoint for monitoring all user bots with health status
app.get('/api/user-bots-health', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const userId = req.session.userId;
    const userBots = getUserBotsDB();
    const userOwnedBots = userBots[userId] || {};

    const healthStatus = {};
    let healthyBots = 0;
    let unhealthyBots = 0;

    for (const [botId, botData] of Object.entries(userOwnedBots)) {
        const activeBotInfo = global.activeBots.get(botId);
        const isRunning = activeBotInfo && activeBotInfo.process && !activeBotInfo.process.killed;
        
        if (isRunning) {
            const uptime = activeBotInfo.startTime ? Math.floor((new Date() - activeBotInfo.startTime) / 1000) : 0;
            const restartAttempts = activeBotInfo.restartAttempts || 0;
            
            healthStatus[botId] = {
                status: 'healthy',
                running: true,
                uptime: `${uptime}s`,
                restartAttempts: restartAttempts,
                lastRestart: activeBotInfo.lastRestart,
                pid: activeBotInfo.process.pid,
                startTime: activeBotInfo.startTime
            };
            
            if (restartAttempts > 0) {
                healthStatus[botId].status = 'recovered';
                healthStatus[botId].healthNote = `Bot recovered after ${restartAttempts} restart attempts`;
            }
            
            healthyBots++;
        } else {
            healthStatus[botId] = {
                status: 'stopped',
                running: false,
                uptime: '0s',
                restartAttempts: 0,
                lastActive: botData.lastActive,
                healthNote: 'Bot is currently stopped'
            };
            unhealthyBots++;
        }
    }

    res.json({
        status: "success",
        summary: {
            totalBots: Object.keys(userOwnedBots).length,
            healthyBots: healthyBots,
            unhealthyBots: unhealthyBots,
            healthPercentage: Object.keys(userOwnedBots).length > 0 ? 
                Math.round((healthyBots / Object.keys(userOwnedBots).length) * 100) : 0
        },
        bots: healthStatus
    });
});

// New endpoint for automatic bot recovery
app.post('/api/auto-recover-bots', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const userId = req.session.userId;
    const userBots = getUserBotsDB();
    const userOwnedBots = userBots[userId] || {};

    const recoveryResults = [];
    let recoveredCount = 0;

    for (const [botId, botData] of Object.entries(userOwnedBots)) {
        const activeBotInfo = global.activeBots.get(botId);
        const isRunning = activeBotInfo && activeBotInfo.process && !activeBotInfo.process.killed;
        
        if (!isRunning) {
            try {
                // Attempt to restart stopped bot
                resourceManager.autoRestartBot(botId, { 
                    userId, 
                    config: botData.config,
                    restartAttempts: 0
                });
                
                recoveryResults.push({
                    botId,
                    status: 'recovery_initiated',
                    message: 'Bot recovery process started'
                });
                recoveredCount++;
                
            } catch (error) {
                recoveryResults.push({
                    botId,
                    status: 'recovery_failed',
                    message: error.message
                });
            }
        } else {
            recoveryResults.push({
                botId,
                status: 'already_running',
                message: 'Bot is already running'
            });
        }
    }

    res.json({
        status: "success",
        message: `Recovery initiated for ${recoveredCount} bots`,
        totalBots: Object.keys(userOwnedBots).length,
        recoveredCount: recoveredCount,
        results: recoveryResults
    });
});

// Code Editor Routes
app.get('/code-editor', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'code-editor.html'), (err) => {
        if (err) {
            logger(`Error serving code-editor.html: ${err.message}`, "[ERROR]");
            res.status(500).send('Unable to load the code editor. Check server logs.');
        }
    });
});

app.get('/api/code-files', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    try {
        const commandsPath = path.join(__dirname, 'Priyansh/commands');
        const eventsPath = path.join(__dirname, 'Priyansh/events');

        let commands = [];
        let events = [];

        if (fs.existsSync(commandsPath)) {
            commands = fs.readdirSync(commandsPath)
                .filter(file => file.endsWith('.js'))
                .sort();
        }

        if (fs.existsSync(eventsPath)) {
            events = fs.readdirSync(eventsPath)
                .filter(file => file.endsWith('.js'))
                .sort();
        }

        res.json({ 
            status: 'success',
            commands: commands, 
            events: events 
        });
    } catch (error) {
        logger(`Error fetching code files: ${error.message}`, "[ERROR]");
        res.json({ 
            status: 'error',
            message: error.message,
            commands: [], 
            events: [] 
        });
    }
});

app.get('/api/code-file/:type/:fileName', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { type, fileName } = req.params;
    const userEmail = req.session.userEmail;

    if (!['command', 'event'].includes(type)) {
        return res.json({ status: "error", message: "Invalid file type" });
    }

    try {
        const userSpecificDir = path.join(__dirname, 'user_code', userEmail, type === 'command' ? 'commands' : 'events');
        const originalDir = path.join(__dirname, 'Priyansh', type === 'command' ? 'commands' : 'events');

        const userSpecificPath = path.join(userSpecificDir, fileName);
        const originalPath = path.join(originalDir, fileName);

        let filePath = originalPath;
        let content = '';

        // Check if user has a custom version first
        if (fs.existsSync(userSpecificPath)) {
            filePath = userSpecificPath;
        }

        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
            res.json({ status: 'success', content: content });
        } else {
            res.json({ status: 'error', message: 'File not found' });
        }
    } catch (error) {
        logger(`Error reading code file: ${error.message}`, "[ERROR]");
        res.json({ status: 'error', message: error.message });
    }
});

app.post('/api/save-code-file', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { type, fileName, content } = req.body;
    const userEmail = req.session.userEmail;

    if (!['command', 'event'].includes(type)) {
        return res.json({ status: "error", message: "Invalid file type" });
    }

    try {
        const userSpecificDir = path.join(__dirname, 'user_code', userEmail, type === 'command' ? 'commands' : 'events');

        // Create user-specific directory if it doesn't exist
        fs.mkdirSync(userSpecificDir, { recursive: true });

        const userSpecificPath = path.join(userSpecificDir, fileName);

        // Save the modified code to user-specific directory
        fs.writeFileSync(userSpecificPath, content, 'utf8');

        logger(`User ${userEmail} saved custom ${type}: ${fileName}`, "[CODE EDITOR]");
        res.json({ status: 'success', message: 'File saved successfully' });
    } catch (error) {
        logger(`Error saving code file: ${error.message}`, "[ERROR]");
        res.json({ status: 'error', message: error.message });
    }
});

app.post('/api/reset-code-file', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const { type, fileName } = req.body;
    const userEmail = req.session.userEmail;

    if (!['command', 'event'].includes(type)) {
        return res.json({ status: "error", message: "Invalid file type" });
    }

    try {
        const userSpecificDir = path.join(__dirname, 'user_code', userEmail, type === 'command' ? 'commands' : 'events');
        const originalDir = path.join(__dirname, 'Priyansh', type === 'command' ? 'commands' : 'events');

        const userSpecificPath = path.join(userSpecificDir, fileName);
        const originalPath = path.join(originalDir, fileName);

        // Delete user-specific file if exists
        if (fs.existsSync(userSpecificPath)) {
            fs.unlinkSync(userSpecificPath);
        }

        // Return original content
        let content = '';
        if (fs.existsSync(originalPath)) {
            content = fs.readFileSync(originalPath, 'utf8');
        }

        logger(`User ${userEmail} reset ${type}: ${fileName}`, "[CODE EDITOR]");
        res.json({ status: 'success', content: content });
    } catch (error) {
        logger(`Error resetting code file: ${error.message}`, "[ERROR]");
        res.json({ status: 'error', message: error.message });
    }
});

// Handle uncaught exceptions to prevent server crashes
process.on('uncaughtException', (error) => {
    logger(`Uncaught Exception: ${error.message}`, "[ CRITICAL ERROR ]");
    console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger(`Unhandled Rejection at: ${promise}, reason: ${reason}`, "[ CRITICAL ERROR ]");
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    logger('SIGTERM received, shutting down gracefully...', "[ SHUTDOWN ]");

    for (const [botId, bot] of global.activeBots) {
        try {
            if (bot.process && !bot.process.killed) {
                // Force kill the process and all its children
                if (bot.process.pid) {
                    try {
                        // Kill the entire process group
                        process.kill(-bot.process.pid, 'SIGKILL');
                    } catch (killError) {
                        // Fallback to killing just the main process
                        bot.process.kill('SIGKILL');
                    }
                }
                logger(`Stopped bot ${botId} during shutdown`, "[ SHUTDOWN ]");
            }
        } catch (error) {
            logger(`Error stopping bot ${botId}: ${error.message}`, "[ SHUTDOWN ERROR ]");
        }
    }

    process.exit(0);
});

process.on('SIGINT', () => {
    logger('SIGINT received, shutting down gracefully...', "[ SHUTDOWN ]");

    for (const [botId, bot] of global.activeBots) {
        try {
            if (bot.process && !bot.process.killed) {
                // Force kill the process and all its children
                if (bot.process.pid) {
                    try {
                        // Kill the entire process group
                        process.kill(-bot.process.pid, 'SIGKILL');
                    } catch (killError) {
                        // Fallback to killing just the main process
                        bot.process.kill('SIGKILL');
                    }
                }
                logger(`Stopped bot ${botId} during shutdown`, "[ SHUTDOWN ]");
            }
        } catch (error) {
            logger(`Error stopping bot ${botId}: ${error.message}`, "[ SHUTDOWN ERROR ]");
        }
    }

    process.exit(0);
});

const server = app.listen(port, '0.0.0.0', () => {
    logger(`🚀 Server is running on port ${port}...`, "[ Starting ]");
    logger(`🌐 Server accessible at: http://0.0.0.0:${port}`, "[ Starting ]");
    logger(`📝 Login page: http://0.0.0.0:${port}/`, "[ Starting ]");
    logger(`🤖 Bot Manager: http://0.0.0.0:${port}/bot-manager`, "[ Starting ]");
    logger(`👑 Owner: Mian Amir | WhatsApp: +923114397148`, "[ Starting ]");

    // Log static file serving
    logger(`📁 Static files served from: ${path.join(__dirname, 'public')}`, "[ Starting ]");
}).on('error', (err) => {
    logger(`Server error: ${err.message}`, "[ Error ]");
    if (err.code === 'EADDRINUSE') {
        logger(`Port ${port} is already in use. Trying port ${port + 1}...`, "[ Error ]");
        server.listen(port + 1, '0.0.0.0');
    }
});

// Set server timeout for better handling of long requests
server.timeout = 300000; // 5 minutes