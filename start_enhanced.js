#!/usr/bin/env node

/**
 * Enhanced Bot System Startup Script
 * This script initializes the enhanced Facebook Messenger bot system
 * with resource management, auto-recovery, and monitoring capabilities.
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 Starting Enhanced Facebook Messenger Bot System...\n');

// Check if required files exist
const requiredFiles = [
    'index.js',
    'Priyansh.js',
    'package.json',
    'bot_config.json'
];

console.log('📋 Checking required files...');
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} - Found`);
    } else {
        console.log(`❌ ${file} - Missing`);
        console.error(`\nError: Required file ${file} not found!`);
        console.error('Please ensure all required files are present before starting.');
        process.exit(1);
    }
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
    console.error('\n❌ Error: Node.js version 16 or higher is required!');
    console.error(`Current version: ${nodeVersion}`);
    console.error('Please upgrade Node.js and try again.');
    process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}\n`);

// Check if dependencies are installed
if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    const installProcess = spawn('npm', ['install', '--legacy-peer-deps'], {
        stdio: 'inherit',
        shell: true
    });

    installProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Dependencies installed successfully!\n');
            startSystem();
        } else {
            console.error(`❌ Failed to install dependencies (exit code: ${code})`);
            process.exit(1);
        }
    });
} else {
    console.log('✅ Dependencies already installed\n');
    startSystem();
}

function startSystem() {
    console.log('🔧 Starting enhanced bot system...');
    
    // Set environment variables for enhanced performance
    const env = {
        ...process.env,
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=2048 --expose-gc',
        UV_THREADPOOL_SIZE: '64'
    };

    // Start the main system
    const mainProcess = spawn('node', ['index.js'], {
        stdio: 'inherit',
        shell: true,
        env: env
    });

    // Handle process events
    mainProcess.on('error', (error) => {
        console.error(`\n❌ Failed to start system: ${error.message}`);
        process.exit(1);
    });

    mainProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n⚠️  System exited with code ${code}`);
            console.log('🔄 Attempting to restart in 5 seconds...');
            
            setTimeout(() => {
                console.log('🔄 Restarting system...');
                startSystem();
            }, 5000);
        } else {
            console.log('\n✅ System stopped gracefully');
        }
    });

    // Handle process signals
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        mainProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        mainProcess.kill('SIGTERM');
    });

    // Graceful shutdown
    process.on('exit', (code) => {
        if (code === 0) {
            console.log('\n✅ System shutdown complete');
        } else {
            console.log(`\n⚠️  System shutdown with code ${code}`);
        }
    });
}

console.log('🎯 System initialization complete!');
console.log('📱 Your enhanced Facebook Messenger bot system is ready.');
console.log('🌐 Access the dashboard at: http://localhost:21030');
console.log('👑 Owner: Mian Amir | WhatsApp: +923114397148\n');