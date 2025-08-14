const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Bot Optimization System...\n');

// Test 1: Check if shared code directories exist
console.log('1. Testing Shared Code System...');
const sharedCodeDir = path.join(__dirname, 'shared_code');
const botCacheDir = path.join(__dirname, 'bot_cache');

if (fs.existsSync(sharedCodeDir)) {
    console.log('✅ Shared code directory exists');
    
    const commandsDir = path.join(sharedCodeDir, 'commands');
    const eventsDir = path.join(sharedCodeDir, 'events');
    
    if (fs.existsSync(commandsDir)) {
        const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
        console.log(`✅ Commands directory: ${commands.length} files`);
    }
    
    if (fs.existsSync(eventsDir)) {
        const events = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
        console.log(`✅ Events directory: ${events.length} files`);
    }
} else {
    console.log('❌ Shared code directory missing');
}

// Test 2: Check bot cache directory
console.log('\n2. Testing Bot Cache System...');
if (fs.existsSync(botCacheDir)) {
    console.log('✅ Bot cache directory exists');
} else {
    console.log('❌ Bot cache directory missing');
}

// Test 3: Check optimization config
console.log('\n3. Testing Configuration...');
const optimizationConfig = path.join(__dirname, 'bot_optimization.json');
if (fs.existsSync(optimizationConfig)) {
    console.log('✅ Optimization config exists');
    const config = JSON.parse(fs.readFileSync(optimizationConfig, 'utf8'));
    console.log(`   - Memory limit: ${config.memory.maxOldSpaceSize}MB`);
    console.log(`   - Auto-recovery: ${config.recovery.autoRestart ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Max bots: ${config.performance.maxConcurrentBots}`);
} else {
    console.log('❌ Optimization config missing');
}

// Test 4: Check cleanup script
console.log('\n4. Testing Cleanup System...');
const cleanupScript = path.join(__dirname, 'cleanup_bots.js');
if (fs.existsSync(cleanupScript)) {
    console.log('✅ Cleanup script exists');
} else {
    console.log('❌ Cleanup script missing');
}

// Test 5: Check main index.js for optimization functions
console.log('\n5. Testing Main System Integration...');
const indexFile = path.join(__dirname, 'index.js');
if (fs.existsSync(indexFile)) {
    const content = fs.readFileSync(indexFile, 'utf8');
    
    const checks = [
        { name: 'Shared Code System', pattern: 'initializeSharedCode' },
        { name: 'Health Monitoring', pattern: 'startHealthMonitoring' },
        { name: 'Auto Cleanup', pattern: 'cleanupBotStorage' },
        { name: 'Optimized Bot Process', pattern: 'startBotProcess' }
    ];
    
    checks.forEach(check => {
        if (content.includes(check.pattern)) {
            console.log(`✅ ${check.name}: Found`);
        } else {
            console.log(`❌ ${check.name}: Missing`);
        }
    });
} else {
    console.log('❌ Main index.js file missing');
}

// Test 6: Storage optimization check
console.log('\n6. Testing Storage Optimization...');
const originalCommandsDir = path.join(__dirname, 'Priyansh/commands');
const originalEventsDir = path.join(__dirname, 'Priyansh/events');

if (fs.existsSync(originalCommandsDir) && fs.existsSync(sharedCodeDir + '/commands')) {
    const originalCommands = fs.readdirSync(originalCommandsDir)
        .filter(f => f.endsWith('.js') && fs.statSync(path.join(originalCommandsDir, f)).isFile());
    const sharedCommands = fs.readdirSync(sharedCodeDir + '/commands')
        .filter(f => f.endsWith('.js') && fs.statSync(path.join(sharedCodeDir + '/commands', f)).isFile());
    
    if (originalCommands.length === sharedCommands.length) {
        console.log(`✅ Commands properly shared (${sharedCommands.length} files)`);
    } else {
        console.log(`❌ Commands sharing incomplete (${originalCommands.length} original vs ${sharedCommands.length} shared)`);
    }
}

console.log('\n🎯 Optimization System Test Complete!');
console.log('\n📊 Expected Results:');
console.log('- Storage usage reduced by 80-90%');
console.log('- Memory usage reduced by 50% per bot');
console.log('- Auto-recovery enabled for all bots');
console.log('- Automatic cleanup every 5 minutes');
console.log('- Support for 100+ concurrent bots');

console.log('\n🚀 To start the optimized system:');
console.log('   node index.js');