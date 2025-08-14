const fs = require('fs');
const path = require('path');
const logger = require('./utils/log');

// Cleanup script for bot optimization
const cleanupBotStorage = () => {
    try {
        const botCacheDir = path.join(__dirname, 'bot_cache');
        const tempConfigs = path.join(__dirname);
        
        // Clean up bot cache directories
        if (fs.existsSync(botCacheDir)) {
            const botDirs = fs.readdirSync(botCacheDir);
            let cleanedCount = 0;
            
            for (const botDir of botDirs) {
                const botPath = path.join(botCacheDir, botDir);
                const stats = fs.statSync(botPath);
                const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                
                // Remove cache directories older than 24 hours
                if (ageInHours > 24) {
                    fs.rmSync(botPath, { recursive: true, force: true });
                    cleanedCount++;
                    logger(`Cleaned up old bot cache: ${botDir}`, '[CLEANUP]');
                }
            }
            
            if (cleanedCount > 0) {
                logger(`Cleaned up ${cleanedCount} old bot cache directories`, '[CLEANUP]');
            }
        }
        
        // Clean up temporary config files
        const files = fs.readdirSync(tempConfigs);
        let configCleaned = 0;
        
        for (const file of files) {
            if (file.startsWith('temp_config_') && file.endsWith('.json')) {
                const filePath = path.join(tempConfigs, file);
                const stats = fs.statSync(filePath);
                const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                
                // Remove temp configs older than 1 hour
                if (ageInHours > 1) {
                    fs.unlinkSync(filePath);
                    configCleaned++;
                    logger(`Cleaned up old temp config: ${file}`, '[CLEANUP]');
                }
            }
        }
        
        if (configCleaned > 0) {
            logger(`Cleaned up ${configCleaned} old temp config files`, '[CLEANUP]');
        }
        
        // Clean up user_code directories that are too old
        const userCodeDir = path.join(__dirname, 'user_code');
        if (fs.existsSync(userCodeDir)) {
            const userDirs = fs.readdirSync(userCodeDir);
            let userCleaned = 0;
            
            for (const userDir of userDirs) {
                const userPath = path.join(userCodeDir, userDir);
                const stats = fs.statSync(userPath);
                const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                
                // Remove user code directories older than 30 days
                if (ageInDays > 30) {
                    fs.rmSync(userPath, { recursive: true, force: true });
                    userCleaned++;
                    logger(`Cleaned up old user code: ${userDir}`, '[CLEANUP]');
                }
            }
            
            if (userCleaned > 0) {
                logger(`Cleaned up ${userCleaned} old user code directories`, '[CLEANUP]');
            }
        }
        
        logger('Bot storage cleanup completed successfully', '[CLEANUP]');
        
    } catch (error) {
        logger(`Error during cleanup: ${error.message}`, '[CLEANUP ERROR]');
    }
};

// Run cleanup if called directly
if (require.main === module) {
    cleanupBotStorage();
}

module.exports = { cleanupBotStorage };