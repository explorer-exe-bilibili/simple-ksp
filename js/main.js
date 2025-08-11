// 主游戏文件
console.log('Simple KSP - 网页版坎巴拉太空计划');
console.log('游戏开始初始化...');

// 全局变量
let gameEngine = null;
let missionManager = null;

// 游戏初始化
async function initializeGame() {
    try {
        console.log('创建游戏引擎...');
        
        // 创建游戏引擎实例
        gameEngine = new GameEngine();
        
        // 创建任务管理器
        missionManager = new MissionManager();
        
        // 初始化游戏引擎
        console.log('初始化游戏引擎...');
        const engineInitialized = await gameEngine.initialize();
        if (!engineInitialized) {
            throw new Error('游戏引擎初始化失败');
        }
        
        // 初始化任务管理器
        console.log('初始化任务管理器...');
        missionManager.initialize();
        
        // 启动游戏循环
        console.log('启动游戏循环...');
        gameEngine.start();
        
        // 初始化UI组件
        console.log('初始化UI组件...');
        initializeUIComponents();
        
        console.log('游戏初始化完成！');
        
        // 设置默认载具（用于测试）
        setTimeout(() => {
            setupDefaultVehicle();
        }, 500);
        
        // 显示欢迎消息
        setTimeout(() => {
            if (gameEngine && gameEngine.ui) {
                gameEngine.ui.showMessage('欢迎来到Simple KSP！', 'success', 5000);
                // 确保主菜单显示
                gameEngine.ui.switchScene('main-menu');
            }
        }, 1500);
        
        return true;
        
    } catch (error) {
        console.error('游戏初始化失败:', error);
        showInitializationError(error);
        return false;
    }
}

// 设置默认载具
function setupDefaultVehicle() {
    try {
        // 创建基础火箭
        const vehicle = createVehicleFromTemplate('basic-rocket');
        
        if (vehicle && gameEngine) {
            gameEngine.setCurrentVehicle(vehicle);
            console.log('默认载具已加载:', vehicle.name);
        }
        
    } catch (error) {
        console.error('创建默认载具失败:', error);
    }
}

// 显示初始化错误
function showInitializationError(error) {
    // 移除加载屏幕
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="loading-content">
                <h1>Simple KSP</h1>
                <div style="color: #ff4444; margin-top: 30px;">
                    <h2>初始化失败</h2>
                    <p>${error.message || '未知错误'}</p>
                    <button onclick="location.reload()" style="
                        background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 153, 204, 0.3));
                        border: 2px solid rgba(0, 212, 255, 0.5);
                        color: #ffffff;
                        padding: 15px 30px;
                        font-size: 1.1em;
                        border-radius: 8px;
                        cursor: pointer;
                        margin-top: 20px;
                    ">重新加载</button>
                </div>
            </div>
        `;
    }
}

// 初始化UI组件
function initializeUIComponents() {
    try {
        console.log('初始化UI组件...');
        
        // 创建装配UI实例
        if (typeof AssemblyUI !== 'undefined') {
            assemblyUI = new AssemblyUI(gameEngine);
            console.log('装配UI初始化完成');
        }
        
        // 创建飞行UI实例
        if (typeof FlightUI !== 'undefined') {
            flightUI = new FlightUI(gameEngine);
            console.log('飞行UI初始化完成');
        }
        
        // 将UI实例绑定到游戏引擎
        if (gameEngine) {
            gameEngine.assemblyUI = assemblyUI;
            gameEngine.flightUI = flightUI;
        }
        
        console.log('所有UI组件初始化完成');
    } catch (error) {
        console.error('UI组件初始化失败:', error);
    }
}

// 游戏主循环扩展（如果需要）
function gameUpdate() {
    // 更新任务管理器
    if (missionManager && gameEngine) {
        missionManager.update(gameEngine.gameState);
    }
    
    // 其他游戏逻辑更新
    updateGameLogic();
    
    // 请求下一帧
    requestAnimationFrame(gameUpdate);
}

// 游戏逻辑更新
function updateGameLogic() {
    // 检查载具状态
    if (gameEngine && gameEngine.gameState.currentVehicle) {
        const vehicle = gameEngine.gameState.currentVehicle;
        
        // 检查载具是否坠毁
        if (vehicle.altitude !== undefined && vehicle.altitude < 0) {
            handleVehicleCrash(vehicle);
        }
        
        // 检查载具是否进入轨道
        if (vehicle.altitude > 70000 && vehicle.orbitInfo) {
            handleOrbitAchievement(vehicle);
        }
    }
    
    // 自动保存游戏状态（每分钟）
    if (Date.now() % 60000 < 100) { // 大约每分钟一次
        autoSave();
    }
}

// 处理载具坠毁
function handleVehicleCrash(vehicle) {
    console.log('载具坠毁:', vehicle.name);
    
    if (gameEngine && gameEngine.ui) {
        gameEngine.ui.showMessage('载具坠毁！', 'error', 3000);
    }
    
    // 重置载具到发射台
    setTimeout(() => {
        vehicle.resetForLaunch();
        vehicle.setPosition(0, 0, 70); // 发射台位置
        
        if (gameEngine) {
            gameEngine.switchScene('main-menu');
        }
    }, 2000);
}

// 处理轨道成就
function handleOrbitAchievement(vehicle) {
    // 检查是否是首次进入轨道
    const firstOrbit = localStorage.getItem('simple-ksp-first-orbit');
    if (!firstOrbit) {
        localStorage.setItem('simple-ksp-first-orbit', 'true');
        
        if (gameEngine && gameEngine.ui) {
            gameEngine.ui.showMessage('🎉 首次进入轨道！', 'success', 5000);
        }
    }
}

// 自动保存
function autoSave() {
    try {
        if (gameEngine) {
            const saveData = {
                gameState: gameEngine.gameState,
                timestamp: Date.now(),
                version: '1.0.0'
            };
            
            localStorage.setItem('simple-ksp-autosave', JSON.stringify(saveData));
        }
    } catch (error) {
        console.error('自动保存失败:', error);
    }
}

// 加载自动保存
function loadAutoSave() {
    try {
        const saveData = localStorage.getItem('simple-ksp-autosave');
        if (saveData) {
            const data = JSON.parse(saveData);
            
            if (gameEngine && data.gameState) {
                // 合并保存的游戏状态
                Object.assign(gameEngine.gameState, data.gameState);
                console.log('自动保存已加载');
            }
        }
    } catch (error) {
        console.error('加载自动保存失败:', error);
    }
}

// 调试功能
function enableDebugMode() {
    window.DEBUG_MODE = true;
    
    // 添加调试命令到全局作用域
    window.debugCommands = {
        // 载具调试
        setAltitude: (altitude) => {
            if (gameEngine && gameEngine.gameState.currentVehicle) {
                gameEngine.gameState.currentVehicle.physics.position.y = altitude;
                console.log(`载具高度设置为: ${altitude}m`);
            }
        },
        
        setVelocity: (x, y, z) => {
            if (gameEngine && gameEngine.gameState.currentVehicle) {
                const vehicle = gameEngine.gameState.currentVehicle;
                vehicle.physics.velocity.x = x || 0;
                vehicle.physics.velocity.y = y || 0;
                vehicle.physics.velocity.z = z || 0;
                console.log(`载具速度设置为: (${x}, ${y}, ${z})`);
            }
        },
        
        addFuel: (amount = 1000) => {
            if (gameEngine && gameEngine.gameState.currentVehicle) {
                const vehicle = gameEngine.gameState.currentVehicle;
                vehicle.parts.forEach(part => {
                    if (part.resources.LiquidFuel !== undefined) {
                        part.resources.LiquidFuel = Math.min(
                            part.resources.LiquidFuel + amount,
                            part.maxResources.LiquidFuel || part.resources.LiquidFuel + amount
                        );
                    }
                    if (part.resources.Oxidizer !== undefined) {
                        part.resources.Oxidizer = Math.min(
                            part.resources.Oxidizer + amount,
                            part.maxResources.Oxidizer || part.resources.Oxidizer + amount
                        );
                    }
                });
                console.log(`添加燃料: ${amount}L`);
            }
        },
        
        // 时间调试
        setTimeScale: (scale) => {
            if (gameEngine) {
                gameEngine.setTimeScale(scale);
                console.log(`时间加速设置为: ${scale}x`);
            }
        },
        
        // 任务调试
        completeAllObjectives: () => {
            if (missionManager) {
                missionManager.activeMissions.forEach(mission => {
                    mission.completedObjectives = [...Array(mission.objectives.length).keys()];
                    console.log(`任务 "${mission.name}" 所有目标已完成`);
                });
            }
        },
        
        // 性能调试
        getPerformanceStats: () => {
            if (gameEngine) {
                return gameEngine.getPerformanceStats();
            }
        },
        
        // 显示帮助
        help: () => {
            console.log('调试命令:');
            console.log('debugCommands.setAltitude(高度) - 设置载具高度');
            console.log('debugCommands.setVelocity(x, y, z) - 设置载具速度');
            console.log('debugCommands.addFuel(数量) - 添加燃料');
            console.log('debugCommands.setTimeScale(倍数) - 设置时间加速');
            console.log('debugCommands.completeAllObjectives() - 完成所有任务目标');
            console.log('debugCommands.getPerformanceStats() - 获取性能统计');
        }
    };
    
    console.log('调试模式已启用！输入 debugCommands.help() 查看可用命令。');
}

// 性能监控
function startPerformanceMonitoring() {
    setInterval(() => {
        if (gameEngine && window.DEBUG_MODE) {
            const stats = gameEngine.getPerformanceStats();
            if (stats.fps < 30) {
                console.warn('性能警告: FPS过低 -', stats);
            }
        }
    }, 5000);
}

// 错误处理
window.addEventListener('error', (event) => {
    console.error('游戏运行错误:', event.error);
    
    if (gameEngine && gameEngine.ui) {
        gameEngine.ui.showMessage('游戏出现错误，请刷新页面', 'error', 10000);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise错误:', event.reason);
});

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM加载完成，开始初始化游戏...');
    
    // 检查浏览器兼容性
    if (!checkBrowserCompatibility()) {
        showBrowserCompatibilityError();
        return;
    }
    
    // 启用调试模式（开发阶段）
    if (window.location.search.includes('debug') || window.location.hostname === 'localhost') {
        enableDebugMode();
    }
    
    // 初始化游戏
    const initialized = await initializeGame();
    
    if (initialized) {
        // 加载自动保存
        loadAutoSave();
        
        // 启动性能监控
        startPerformanceMonitoring();
        
        console.log('🚀 Simple KSP 已准备就绪！');
    }
});

// 检查浏览器兼容性
function checkBrowserCompatibility() {
    // 检查Canvas支持
    const canvas = document.createElement('canvas');
    if (!canvas.getContext || !canvas.getContext('2d')) {
        return false;
    }
    
    // 检查ES6支持
    try {
        eval('class TestClass {}');
        eval('const test = () => {};');
    } catch (e) {
        return false;
    }
    
    // 检查localStorage支持
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
    } catch (e) {
        return false;
    }
    
    return true;
}

// 显示浏览器兼容性错误
function showBrowserCompatibilityError() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="loading-content">
                <h1>Simple KSP</h1>
                <div style="color: #ff4444; margin-top: 30px;">
                    <h2>浏览器不兼容</h2>
                    <p>您的浏览器不支持运行此游戏所需的功能。</p>
                    <p>请使用现代浏览器，如Chrome、Firefox、Safari或Edge的最新版本。</p>
                </div>
            </div>
        `;
    }
}

// 导出到全局作用域
window.gameEngine = gameEngine;
window.missionManager = missionManager;

// 游戏版本信息
console.log('Simple KSP v1.0.0');
console.log('作者: AI Assistant');
console.log('基于Web技术的KSP太空模拟游戏');
console.log('GitHub: https://github.com/your-username/simple-ksp');

// 游戏启动完成标志
window.GAME_LOADED = true;
