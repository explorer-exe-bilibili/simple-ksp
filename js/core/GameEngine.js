// 游戏引擎核心类
class GameEngine {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.deltaTime = 0;
        this.lastTime = 0;
        this.fps = 60;
        this.targetFrameTime = 1000 / this.fps;
        
        // 游戏状态
        this.gameState = {
            currentScene: 'menu', // menu, assembly, flight, tracking, mission, settings
            timeScale: 1,
            missionTime: 0,
            currentVehicle: null,
            activeVessels: [],
            completedMissions: []
        };
        
        // 子系统
        this.physics = null;
        this.renderer = null;
        this.input = null;
        this.ui = null;
        
        this.bindMethods();
    }
    
    bindMethods() {
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    async initialize() {
        try {
            console.log('初始化游戏引擎...');
            
            // 初始化子系统
            this.physics = new PhysicsEngine();
            this.renderer = new RenderEngine();
            this.input = new InputManager();
            this.ui = new UIManager();
            
            // 初始化各个子系统
            await this.physics.initialize();
            await this.renderer.initialize();
            await this.input.initialize();
            await this.ui.initialize();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            console.log('游戏引擎初始化完成');
            return true;
        } catch (error) {
            console.error('游戏引擎初始化失败:', error);
            return false;
        }
    }
    
    setupEventListeners() {
        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.renderer.handleResize();
            this.ui.handleResize();
        });
        
        // 游戏暂停/恢复
        window.addEventListener('blur', () => {
            if (this.gameState.currentScene === 'flight') {
                this.pause();
            }
        });
        
        window.addEventListener('focus', () => {
            if (this.gameState.currentScene === 'flight') {
                this.resume();
            }
        });
        
        // 键盘快捷键
        window.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'Space':
                    if (this.gameState.currentScene === 'flight') {
                        event.preventDefault();
                        this.activateNextStage();
                    }
                    break;
                case 'Escape':
                    if (this.gameState.currentScene === 'flight') {
                        this.togglePause();
                    }
                    break;
                case 'F5':
                    event.preventDefault();
                    this.quickSave();
                    break;
                case 'F9':
                    event.preventDefault();
                    this.quickLoad();
                    break;
            }
        });
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
        console.log('游戏引擎启动');
    }
    
    stop() {
        this.isRunning = false;
        console.log('游戏引擎停止');
    }
    
    pause() {
        this.isPaused = true;
        this.ui.showPauseMenu();
    }
    
    resume() {
        this.isPaused = false;
        this.ui.hidePauseMenu();
        this.lastTime = performance.now(); // 重置时间以避免大的deltaTime
    }
    
    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000; // 转换为秒
        this.lastTime = currentTime;
        
        // 限制deltaTime以防止物理不稳定
        this.deltaTime = Math.min(this.deltaTime, 0.033); // 最大30fps
        
        if (!this.isPaused) {
            this.update(this.deltaTime * this.gameState.timeScale);
        }
        
        this.render();
        
        // 请求下一帧
        requestAnimationFrame(this.gameLoop);
    }
    
    update(deltaTime) {
        // 更新任务时间
        if (this.gameState.currentScene === 'flight') {
            this.gameState.missionTime += deltaTime;
        }
        
        // 更新各个子系统
        if (this.physics) {
            this.physics.update(deltaTime);
        }
        
        if (this.input) {
            this.input.update(deltaTime);
        }
        
        if (this.ui) {
            this.ui.update(deltaTime);
        }
        
        // 更新当前载具
        if (this.gameState.currentVehicle) {
            this.gameState.currentVehicle.update(deltaTime);
        }
        
        // 更新所有活动载具
        this.gameState.activeVessels.forEach(vessel => {
            if (vessel !== this.gameState.currentVehicle) {
                vessel.update(deltaTime);
            }
        });
    }
    
    render() {
        if (this.renderer) {
            this.renderer.render(this.gameState);
        }
        
        if (this.ui) {
            this.ui.render(this.gameState);
        }
    }
    
    // 场景管理
    switchScene(newScene) {
        const oldScene = this.gameState.currentScene;
        this.gameState.currentScene = newScene;
        
        console.log(`场景切换: ${oldScene} -> ${newScene}`);
        
        // 场景特定的处理
        switch (newScene) {
            case 'flight':
                if (this.gameState.currentVehicle) {
                    this.startFlight();
                }
                break;
            case 'assembly':
                this.startAssembly();
                break;
            case 'tracking':
                this.startTracking();
                break;
        }
        
        // 通知UI管理器更新界面
        if (this.ui) {
            this.ui.switchScene(newScene);
        }
    }
    
    startFlight() {
        this.gameState.missionTime = 0;
        this.gameState.timeScale = 1;
        
        if (this.gameState.currentVehicle) {
            // 重置载具状态
            this.gameState.currentVehicle.resetForLaunch();
            
            // 设置发射台位置
            this.gameState.currentVehicle.setPosition(0, 0, 70); // 发射台高度70米
            
            console.log('开始飞行任务');
        }
    }
    
    startAssembly() {
        console.log('进入载具装配厂');
    }
    
    startTracking() {
        console.log('进入跟踪站');
    }
    
    // 载具管理
    setCurrentVehicle(vehicle) {
        this.gameState.currentVehicle = vehicle;
        
        // 添加到活动载具列表
        if (!this.gameState.activeVessels.includes(vehicle)) {
            this.gameState.activeVessels.push(vehicle);
        }
        
        console.log('设置当前载具:', vehicle.name);
    }
    
    activateNextStage() {
        if (this.gameState.currentVehicle) {
            this.gameState.currentVehicle.activateNextStage();
        }
    }
    
    // 时间控制
    setTimeScale(scale) {
        this.gameState.timeScale = Math.max(0, Math.min(scale, 1000000));
        console.log('时间加速:', this.gameState.timeScale + 'x');
    }
    
    // 保存/加载
    quickSave() {
        try {
            const saveData = {
                gameState: this.gameState,
                timestamp: Date.now()
            };
            
            localStorage.setItem('simple-ksp-quicksave', JSON.stringify(saveData));
            console.log('快速保存完成');
            
            if (this.ui) {
                this.ui.showMessage('游戏已保存', 'success');
            }
        } catch (error) {
            console.error('快速保存失败:', error);
            if (this.ui) {
                this.ui.showMessage('保存失败', 'error');
            }
        }
    }
    
    quickLoad() {
        try {
            const saveData = localStorage.getItem('simple-ksp-quicksave');
            if (!saveData) {
                console.log('没有找到保存文件');
                if (this.ui) {
                    this.ui.showMessage('没有找到保存文件', 'warning');
                }
                return;
            }
            
            const data = JSON.parse(saveData);
            this.gameState = { ...this.gameState, ...data.gameState };
            
            console.log('快速加载完成');
            
            if (this.ui) {
                this.ui.showMessage('游戏已加载', 'success');
            }
        } catch (error) {
            console.error('快速加载失败:', error);
            if (this.ui) {
                this.ui.showMessage('加载失败', 'error');
            }
        }
    }
    
    // 工具方法
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatNumber(number, decimals = 0) {
        return number.toLocaleString('zh-CN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    // 获取性能统计
    getPerformanceStats() {
        return {
            fps: Math.round(1 / this.deltaTime),
            frameTime: Math.round(this.deltaTime * 1000),
            timeScale: this.gameState.timeScale,
            activeVessels: this.gameState.activeVessels.length,
            missionTime: this.gameState.missionTime
        };
    }
}

// 全局游戏引擎实例
let gameEngine = null;

// 导出给其他模块使用
window.GameEngine = GameEngine;
