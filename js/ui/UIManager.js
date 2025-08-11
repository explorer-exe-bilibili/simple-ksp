// UI管理器
class UIManager {
    constructor() {
        this.currentScene = 'main-menu';
        this.screens = new Map();
        this.messages = [];
        this.notifications = [];
        
        this.initialized = false;
        
        this.bindMethods();
    }
    
    bindMethods() {
        this.handleScreenChange = this.handleScreenChange.bind(this);
        this.handleMenuClick = this.handleMenuClick.bind(this);
        this.hideLoadingScreen = this.hideLoadingScreen.bind(this);
    }
    
    async initialize() {
        console.log('初始化UI管理器...');
        
        // 不要立即隐藏加载屏幕，等待游戏完全初始化
        // setTimeout(this.hideLoadingScreen, 2000);
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 初始化各个界面
        this.initializeScreens();
        
        // 等待UI组件初始化
        this.waitForUIComponents();
        
        this.initialized = true;
        console.log('UI管理器初始化完成');
        
        // UI管理器初始化完成后，延迟一点时间隐藏加载屏幕
        setTimeout(this.hideLoadingScreen, 1000);
    }
    
    waitForUIComponents() {
        // 等待全局UI组件初始化
        const checkComponents = () => {
            if (typeof assemblyUI !== 'undefined' && assemblyUI) {
                console.log('装配UI组件已就绪');
            }
            if (typeof flightUI !== 'undefined' && flightUI) {
                console.log('飞行UI组件已就绪');
            }
        };
        
        // 延迟检查，确保组件有时间初始化
        setTimeout(checkComponents, 500);
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    setupEventListeners() {
        // 菜单按钮点击
        document.addEventListener('click', this.handleMenuClick);
        
        // 窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 键盘快捷键
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
    }
    
    handleMenuClick(event) {
        const button = event.target.closest('[data-screen]');
        if (button) {
            const targetScreen = button.getAttribute('data-screen');
            this.switchScene(targetScreen);
        }
        
        // 处理其他UI交互
        this.handleUIInteraction(event);
    }
    
    handleUIInteraction(event) {
        const target = event.target;
        
        // 分级按钮
        if (target.id === 'stage-button') {
            if (gameEngine) {
                gameEngine.activateNextStage();
            }
        }
        
        // 推力控制
        if (target.id === 'throttle') {
            if (gameEngine && gameEngine.gameState.currentVehicle) {
                const throttle = parseFloat(target.value) / 100;
                gameEngine.gameState.currentVehicle.setThrottle(throttle);
            }
        }
        
        // 动作组按钮
        if (target.classList.contains('action-btn')) {
            const action = target.getAttribute('data-action');
            this.handleActionButton(action, target);
        }
        
        // 任务相关按钮
        if (target.classList.contains('mission-item')) {
            this.handleMissionClick(target);
        }
        
        // 载具相关按钮
        if (target.id === 'save-vehicle') {
            this.saveCurrentVehicle();
        }
        if (target.id === 'load-vehicle') {
            this.loadVehicle();
        }
        if (target.id === 'launch-vehicle') {
            this.launchVehicle();
        }
    }
    
    handleActionButton(action, button) {
        if (!gameEngine || !gameEngine.gameState.currentVehicle) return;
        
        const vehicle = gameEngine.gameState.currentVehicle;
        let result = false;
        
        switch (action) {
            case 'sas':
                result = vehicle.toggleSAS();
                break;
            case 'rcs':
                result = vehicle.toggleRCS();
                break;
            case 'gear':
                result = vehicle.toggleGear();
                break;
            case 'light':
                result = vehicle.toggleLights();
                break;
            case 'brake':
                result = vehicle.toggleBrakes();
                break;
        }
        
        // 更新按钮状态
        if (result !== false) {
            button.classList.toggle('active', result);
        }
    }
    
    handleMissionClick(missionElement) {
        const missionId = missionElement.getAttribute('data-mission-id');
        if (missionId && missionManager) {
            if (missionManager.startMission(missionId)) {
                this.showMessage('任务已开始', 'success');
                this.updateMissionLists();
            } else {
                this.showMessage('无法开始任务', 'error');
            }
        }
    }
    
    handleKeyboard(event) {
        // ESC键返回主菜单（在某些场景下）
        if (event.code === 'Escape' && this.currentScene !== 'flight') {
            if (this.currentScene !== 'main-menu') {
                this.switchScene('main-menu');
            }
        }
    }
    
    handleResize() {
        // 处理窗口大小变化
        if (gameEngine && gameEngine.renderer) {
            gameEngine.renderer.handleResize();
        }
    }
    
    initializeScreens() {
        // 缓存所有屏幕元素
        const screenElements = document.querySelectorAll('.screen');
        screenElements.forEach(screen => {
            this.screens.set(screen.id, screen);
        });
        
        // 初始化装配厂
        this.initializeAssembly();
        
        // 初始化飞行界面
        this.initializeFlight();
        
        // 初始化任务控制
        this.initializeMissions();
        
        // 初始化跟踪站
        this.initializeTracking();
    }
    
    initializeAssembly() {
        // 初始化部件面板
        this.updatePartsPanel();
        
        // 设置部件分类切换
        const categories = document.querySelectorAll('.category');
        categories.forEach(category => {
            category.addEventListener('click', () => {
                // 移除其他分类的active状态
                categories.forEach(c => c.classList.remove('active'));
                // 激活当前分类
                category.classList.add('active');
                
                // 更新部件列表
                const categoryName = category.getAttribute('data-category');
                this.updatePartsPanel(categoryName);
            });
        });
    }
    
    initializeFlight() {
        // 设置推力滑块
        const throttleSlider = document.getElementById('throttle');
        if (throttleSlider) {
            throttleSlider.addEventListener('input', (e) => {
                const throttle = parseFloat(e.target.value) / 100;
                const throttleValue = document.getElementById('throttle-value');
                if (throttleValue) {
                    throttleValue.textContent = Math.round(throttle * 100) + '%';
                }
                
                if (gameEngine && gameEngine.gameState.currentVehicle) {
                    gameEngine.gameState.currentVehicle.setThrottle(throttle);
                }
            });
        }
        
        // 初始化分级显示
        this.updateStagingDisplay();
    }
    
    initializeMissions() {
        // 初始化任务列表
        this.updateMissionLists();
    }
    
    initializeTracking() {
        // 初始化载具列表
        this.updateVesselList();
    }
    
    // 场景切换
    switchScene(newScene) {
        // 隐藏当前场景
        if (this.currentScene) {
            const currentScreen = this.screens.get(this.currentScene);
            if (currentScreen) {
                currentScreen.classList.remove('active');
            }
        }
        
        // 显示新场景
        const newScreen = this.screens.get(newScene);
        if (newScreen) {
            newScreen.classList.add('active');
            this.currentScene = newScene;
            
            // 通知游戏引擎场景变化
            if (gameEngine) {
                gameEngine.switchScene(newScene);
            }
            
            // 场景特定的初始化
            this.onSceneEnter(newScene);
        }
    }
    
    onSceneEnter(sceneName) {
        switch (sceneName) {
            case 'vehicle-assembly':
                this.updatePartsPanel();
                this.updateVehicleStats();
                // 通知装配UI
                if (typeof assemblyUI !== 'undefined' && assemblyUI) {
                    assemblyUI.renderAssembly();
                }
                break;
            case 'flight':
                this.updateFlightHUD();
                // 设置当前载具到飞行UI
                if (typeof flightUI !== 'undefined' && flightUI && gameEngine && gameEngine.gameState.currentVehicle) {
                    flightUI.setVehicle(gameEngine.gameState.currentVehicle);
                }
                break;
            case 'tracking-station':
                this.updateVesselList();
                break;
            case 'mission-control':
                this.updateMissionLists();
                break;
        }
    }
    
    // 更新UI
    update(deltaTime) {
        if (!this.initialized) return;
        
        // 根据当前场景更新相应的UI
        switch (this.currentScene) {
            case 'vehicle-assembly':
                this.updateAssemblyUI();
                break;
            case 'flight':
                this.updateFlightUI();
                break;
            case 'tracking-station':
                this.updateTrackingUI();
                break;
        }
        
        // 更新消息和通知
        this.updateMessages(deltaTime);
    }
    
    updateAssemblyUI() {
        this.updateVehicleStats();
    }
    
    updateFlightUI() {
        if (gameEngine && gameEngine.gameState.currentVehicle) {
            const vehicle = gameEngine.gameState.currentVehicle;
            
            // 更新飞行数据
            this.updateElement('altitude', this.formatDistance(vehicle.altitude));
            this.updateElement('velocity', this.formatSpeed(vehicle.velocity));
            this.updateElement('acceleration', this.formatAcceleration(vehicle.accelerationMagnitude));
            
            // 更新任务时间
            this.updateElement('mission-time', 'T+ ' + this.formatTime(gameEngine.gameState.missionTime));
            
            // 更新推力显示
            const throttleValue = Math.round(vehicle.throttle * 100) + '%';
            this.updateElement('throttle-value', throttleValue);
            
            // 更新分级显示
            this.updateStagingDisplay();
        }
    }
    
    updateTrackingUI() {
        this.updateVesselList();
    }
    
    // 更新部件面板
    updatePartsPanel(category = 'command') {
        const partsList = document.getElementById('parts-list');
        if (!partsList) return;
        
        partsList.innerHTML = '';
        
        // 根据分类筛选部件
        const availableParts = Object.keys(PART_LIBRARY).filter(partName => {
            const part = PART_LIBRARY[partName]();
            return !category || part.category === category;
        });
        
        availableParts.forEach(partName => {
            const part = PART_LIBRARY[partName]();
            const partElement = this.createPartItem(part);
            partsList.appendChild(partElement);
        });
    }
    
    createPartItem(part) {
        const div = document.createElement('div');
        div.className = 'part-item';
        div.draggable = true;
        div.setAttribute('data-part-name', part.name);
        
        div.innerHTML = `
            <div class="part-name">${part.name}</div>
            <div class="part-stats">
                <div class="part-stat">
                    <span>质量:</span>
                    <span>${part.mass.toFixed(2)} t</span>
                </div>
                <div class="part-stat">
                    <span>成本:</span>
                    <span>√${part.cost}</span>
                </div>
                ${part.type === 'engine' ? `
                    <div class="part-stat">
                        <span>推力:</span>
                        <span>${(part.maxThrust / 1000).toFixed(0)} kN</span>
                    </div>
                ` : ''}
                ${part.type === 'fuel' ? `
                    <div class="part-stat">
                        <span>燃料:</span>
                        <span>${part.resources.LiquidFuel || 0} L</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        return div;
    }
    
    // 更新载具统计
    updateVehicleStats() {
        if (!gameEngine || !gameEngine.gameState.currentVehicle) {
            this.updateElement('total-mass', '0 kg');
            this.updateElement('total-deltav', '0 m/s');
            this.updateElement('twr', '0');
            return;
        }
        
        const vehicle = gameEngine.gameState.currentVehicle;
        const stats = vehicle.getStats();
        
        this.updateElement('total-mass', this.formatMass(stats.totalMass));
        this.updateElement('total-deltav', Math.round(stats.deltaV) + ' m/s');
        this.updateElement('twr', stats.twr.toFixed(2));
    }
    
    // 更新分级显示
    updateStagingDisplay() {
        const stagingStack = document.getElementById('staging-stack');
        if (!stagingStack || !gameEngine || !gameEngine.gameState.currentVehicle) return;
        
        const vehicle = gameEngine.gameState.currentVehicle;
        stagingStack.innerHTML = '';
        
        vehicle.stages.forEach((stage, index) => {
            const stageDiv = document.createElement('div');
            stageDiv.className = 'stage-item';
            if (stage.number === vehicle.stage) {
                stageDiv.classList.add('current');
            }
            
            stageDiv.innerHTML = `
                <div>级别 ${stage.number}</div>
                <div>${stage.engines.length} 引擎</div>
                <div>${stage.decouplers.length} 分离器</div>
            `;
            
            stagingStack.appendChild(stageDiv);
        });
    }
    
    // 更新任务列表
    updateMissionLists() {
        if (!missionManager) return;
        
        // 更新可用任务
        const availableMissionsEl = document.getElementById('missions-list');
        if (availableMissionsEl) {
            availableMissionsEl.innerHTML = '';
            
            missionManager.getAvailableMissions().forEach(mission => {
                const missionEl = this.createMissionItem(mission);
                availableMissionsEl.appendChild(missionEl);
            });
        }
        
        // 更新活动任务
        const activeMissionsEl = document.getElementById('active-missions-list');
        if (activeMissionsEl) {
            activeMissionsEl.innerHTML = '';
            
            missionManager.getActiveMissions().forEach(mission => {
                const missionEl = this.createActiveMissionItem(mission);
                activeMissionsEl.appendChild(missionEl);
            });
        }
    }
    
    createMissionItem(mission) {
        const div = document.createElement('div');
        div.className = 'mission-item';
        div.setAttribute('data-mission-id', mission.id);
        
        const difficultyColor = {
            'easy': '#00ff88',
            'medium': '#ffaa00',
            'hard': '#ff4444',
            'extreme': '#ff0044'
        };
        
        div.innerHTML = `
            <div class="mission-title">${mission.name}</div>
            <div class="mission-description">${mission.description}</div>
            <div class="mission-reward" style="color: ${difficultyColor[mission.difficulty]}">
                难度: ${mission.difficulty.toUpperCase()}
            </div>
            <div class="mission-reward">
                奖励: √${mission.rewards.funds} | ${mission.rewards.science} 科学 | ${mission.rewards.reputation} 声誉
            </div>
        `;
        
        return div;
    }
    
    createActiveMissionItem(mission) {
        const div = document.createElement('div');
        div.className = 'mission-item active-mission';
        
        div.innerHTML = `
            <div class="mission-title">${mission.name}</div>
            <div class="mission-progress">
                进度: ${mission.progress.completed}/${mission.progress.total} (${mission.progress.percentage}%)
            </div>
            <div class="mission-objectives">
                ${mission.objectives.map(obj => `
                    <div class="objective ${obj.completed ? 'completed' : ''}">
                        ${obj.completed ? '✓' : '○'} ${obj.description || obj.type}
                    </div>
                `).join('')}
            </div>
            ${mission.timeRemaining ? `
                <div class="mission-time">
                    剩余时间: ${this.formatTime(mission.timeRemaining)}
                </div>
            ` : ''}
        `;
        
        return div;
    }
    
    // 更新载具列表
    updateVesselList() {
        const vesselsList = document.getElementById('vessels-list');
        if (!vesselsList || !gameEngine) return;
        
        vesselsList.innerHTML = '';
        
        gameEngine.gameState.activeVessels.forEach(vessel => {
            const vesselEl = this.createVesselItem(vessel);
            vesselsList.appendChild(vesselEl);
        });
    }
    
    createVesselItem(vessel) {
        const div = document.createElement('div');
        div.className = 'vessel-item';
        
        const info = vessel.getInfo();
        
        div.innerHTML = `
            <div class="vessel-name">${info.name}</div>
            <div class="vessel-info">
                <div>高度: ${this.formatDistance(info.altitude)}</div>
                <div>速度: ${this.formatSpeed(info.velocity)}</div>
                <div>质量: ${this.formatMass(info.mass)}</div>
                <div>推力: ${Math.round(info.throttle * 100)}%</div>
            </div>
        `;
        
        return div;
    }
    
    // 载具操作
    saveCurrentVehicle() {
        if (!gameEngine || !gameEngine.gameState.currentVehicle) return;
        
        const vehicle = gameEngine.gameState.currentVehicle;
        const design = vehicle.saveDesign();
        
        // 保存到本地存储
        const savedVehicles = JSON.parse(localStorage.getItem('simple-ksp-vehicles') || '[]');
        savedVehicles.push(design);
        localStorage.setItem('simple-ksp-vehicles', JSON.stringify(savedVehicles));
        
        this.showMessage('载具已保存', 'success');
    }
    
    loadVehicle() {
        const savedVehicles = JSON.parse(localStorage.getItem('simple-ksp-vehicles') || '[]');
        if (savedVehicles.length === 0) {
            this.showMessage('没有已保存的载具', 'warning');
            return;
        }
        
        // 简化版：加载最后保存的载具
        const lastVehicle = savedVehicles[savedVehicles.length - 1];
        const vehicle = Vehicle.loadFromDesign(lastVehicle);
        
        if (gameEngine) {
            gameEngine.setCurrentVehicle(vehicle);
            this.showMessage('载具已加载', 'success');
            this.updateVehicleStats();
        }
    }
    
    launchVehicle() {
        if (!gameEngine || !gameEngine.gameState.currentVehicle) {
            // 创建示例载具
            const vehicle = createVehicleFromTemplate('basic-rocket');
            if (vehicle && gameEngine) {
                gameEngine.setCurrentVehicle(vehicle);
            }
        }
        
        if (gameEngine) {
            gameEngine.switchScene('flight');
        }
    }
    
    // 消息系统
    showMessage(text, type = 'info', duration = 3000) {
        const message = {
            id: Date.now(),
            text,
            type,
            timestamp: Date.now(),
            duration
        };
        
        this.messages.push(message);
        this.displayMessage(message);
        
        // 自动移除消息
        setTimeout(() => {
            this.removeMessage(message.id);
        }, duration);
    }
    
    displayMessage(message) {
        // 创建消息容器（如果不存在）
        let messageContainer = document.getElementById('message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'message-container';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(messageContainer);
        }
        
        const messageEl = document.createElement('div');
        messageEl.id = `message-${message.id}`;
        messageEl.className = `message message-${message.type}`;
        messageEl.style.cssText = `
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
            border: 1px solid ${this.getMessageColor(message.type)};
            color: #ffffff;
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 5px;
            backdrop-filter: blur(10px);
            animation: slideInFromRight 0.3s ease-out;
        `;
        messageEl.textContent = message.text;
        
        messageContainer.appendChild(messageEl);
    }
    
    getMessageColor(type) {
        const colors = {
            'success': '#00ff88',
            'error': '#ff4444',
            'warning': '#ffaa00',
            'info': '#00d4ff'
        };
        return colors[type] || colors.info;
    }
    
    removeMessage(messageId) {
        const messageEl = document.getElementById(`message-${messageId}`);
        if (messageEl) {
            messageEl.style.animation = 'slideOutToRight 0.3s ease-out';
            setTimeout(() => {
                messageEl.remove();
            }, 300);
        }
        
        this.messages = this.messages.filter(m => m.id !== messageId);
    }
    
    updateMessages(deltaTime) {
        // 消息系统的更新逻辑（如果需要）
    }
    
    // 任务完成显示
    showMissionComplete(mission) {
        this.showMessage(`任务完成: ${mission.name}`, 'success', 5000);
        
        // 可以在这里添加更复杂的任务完成界面
    }
    
    // 暂停菜单
    showPauseMenu() {
        // TODO: 实现暂停菜单
    }
    
    hidePauseMenu() {
        // TODO: 隐藏暂停菜单
    }
    
    // 工具方法
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element && element.textContent !== content) {
            element.textContent = content;
        }
    }
    
    formatTime(seconds) {
        if (seconds < 0) return '00:00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatDistance(meters) {
        if (meters < 1000) {
            return Math.round(meters) + ' m';
        } else if (meters < 1000000) {
            return (meters / 1000).toFixed(1) + ' km';
        } else {
            return (meters / 1000000).toFixed(2) + ' Mm';
        }
    }
    
    formatSpeed(metersPerSecond) {
        return Math.round(metersPerSecond) + ' m/s';
    }
    
    formatAcceleration(metersPerSecondSquared) {
        return (metersPerSecondSquared || 0).toFixed(1) + ' m/s²';
    }
    
    formatMass(kg) {
        if (kg < 1000) {
            return kg.toFixed(1) + ' kg';
        } else {
            return (kg / 1000).toFixed(1) + ' t';
        }
    }
    
    render() {
        // UI渲染逻辑（如果需要Canvas UI）
    }
}

// CSS动画（通过JavaScript添加）
const style = document.createElement('style');
style.textContent = `
@keyframes slideInFromRight {
    0% { transform: translateX(100%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutToRight {
    0% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(100%); opacity: 0; }
}

.objective.completed {
    color: #00ff88;
    text-decoration: line-through;
}

.active-mission {
    border-left: 3px solid #00d4ff;
}
`;
document.head.appendChild(style);

// 导出给其他模块使用
window.UIManager = UIManager;
