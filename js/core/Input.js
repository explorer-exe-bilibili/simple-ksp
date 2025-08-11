// 输入管理类
class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = {
            x: 0,
            y: 0,
            leftButton: false,
            rightButton: false,
            middleButton: false,
            wheel: 0
        };
        
        this.initialized = false;
        this.bindings = new Map();
        
        // 默认按键绑定
        this.setupDefaultBindings();
    }
    
    async initialize() {
        console.log('初始化输入管理器...');
        
        this.setupEventListeners();
        
        this.initialized = true;
        console.log('输入管理器初始化完成');
    }
    
    setupDefaultBindings() {
        // 飞行控制
        this.bindings.set('KeyW', 'pitch_down');
        this.bindings.set('KeyS', 'pitch_up');
        this.bindings.set('KeyA', 'yaw_left');
        this.bindings.set('KeyD', 'yaw_right');
        this.bindings.set('KeyQ', 'roll_left');
        this.bindings.set('KeyE', 'roll_right');
        
        // 推力控制
        this.bindings.set('ShiftLeft', 'throttle_up');
        this.bindings.set('ControlLeft', 'throttle_down');
        this.bindings.set('KeyX', 'throttle_cut');
        this.bindings.set('KeyZ', 'throttle_max');
        
        // 分级控制
        this.bindings.set('Space', 'stage');
        
        // 动作组
        this.bindings.set('Digit1', 'action_group_1');
        this.bindings.set('Digit2', 'action_group_2');
        this.bindings.set('Digit3', 'action_group_3');
        this.bindings.set('Digit4', 'action_group_4');
        this.bindings.set('Digit5', 'action_group_5');
        
        // 系统控制
        this.bindings.set('KeyT', 'toggle_sas');
        this.bindings.set('KeyR', 'toggle_rcs');
        this.bindings.set('KeyG', 'toggle_gear');
        this.bindings.set('KeyU', 'toggle_lights');
        this.bindings.set('KeyB', 'toggle_brakes');
        
        // 视图控制
        this.bindings.set('KeyV', 'change_camera');
        this.bindings.set('KeyC', 'toggle_camera_mode');
        
        // 时间控制
        this.bindings.set('Period', 'time_warp_up'); // . 键
        this.bindings.set('Comma', 'time_warp_down'); // , 键
        this.bindings.set('Slash', 'time_warp_stop'); // / 键
        
        // 地图视图
        this.bindings.set('KeyM', 'toggle_map');
    }
    
    setupEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // 鼠标事件
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('wheel', this.handleWheel.bind(this));
        
        // 阻止右键菜单
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // 防止某些按键的默认行为
        document.addEventListener('keydown', (e) => {
            const preventKeys = ['Space', 'Tab', 'F5', 'F9', 'F12'];
            if (preventKeys.includes(e.code)) {
                e.preventDefault();
            }
        });
    }
    
    handleKeyDown(event) {
        this.keys[event.code] = true;
        
        // 执行绑定的动作
        const action = this.bindings.get(event.code);
        if (action) {
            this.executeAction(action, true);
        }
    }
    
    handleKeyUp(event) {
        this.keys[event.code] = false;
        
        // 执行绑定的动作（松开）
        const action = this.bindings.get(event.code);
        if (action) {
            this.executeAction(action, false);
        }
    }
    
    handleMouseDown(event) {
        switch (event.button) {
            case 0: // 左键
                this.mouse.leftButton = true;
                break;
            case 1: // 中键
                this.mouse.middleButton = true;
                break;
            case 2: // 右键
                this.mouse.rightButton = true;
                break;
        }
    }
    
    handleMouseUp(event) {
        switch (event.button) {
            case 0:
                this.mouse.leftButton = false;
                break;
            case 1:
                this.mouse.middleButton = false;
                break;
            case 2:
                this.mouse.rightButton = false;
                break;
        }
    }
    
    handleMouseMove(event) {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
        
        // 如果在飞行模式且按下右键，控制载具姿态
        if (this.mouse.rightButton && gameEngine && gameEngine.gameState.currentScene === 'flight') {
            const sensitivity = 0.002;
            const deltaX = event.movementX * sensitivity;
            const deltaY = event.movementY * sensitivity;
            
            this.executeAction('mouse_look', true, { deltaX, deltaY });
        }
    }
    
    handleWheel(event) {
        this.mouse.wheel = event.deltaY;
        
        // 滚轮控制摄像机缩放或推力
        if (event.shiftKey) {
            // Shift + 滚轮控制推力
            const throttleDelta = -event.deltaY * 0.001;
            this.executeAction('throttle_wheel', true, { delta: throttleDelta });
        } else {
            // 普通滚轮控制缩放
            const zoomDelta = -event.deltaY * 0.001;
            this.executeAction('camera_zoom', true, { delta: zoomDelta });
        }
    }
    
    executeAction(action, pressed, data = null) {
        if (!gameEngine) return;
        
        const vehicle = gameEngine.gameState.currentVehicle;
        
        switch (action) {
            // 载具控制
            case 'pitch_down':
                if (vehicle && pressed) vehicle.applyRotation('pitch', -1);
                break;
            case 'pitch_up':
                if (vehicle && pressed) vehicle.applyRotation('pitch', 1);
                break;
            case 'yaw_left':
                if (vehicle && pressed) vehicle.applyRotation('yaw', -1);
                break;
            case 'yaw_right':
                if (vehicle && pressed) vehicle.applyRotation('yaw', 1);
                break;
            case 'roll_left':
                if (vehicle && pressed) vehicle.applyRotation('roll', -1);
                break;
            case 'roll_right':
                if (vehicle && pressed) vehicle.applyRotation('roll', 1);
                break;
                
            // 推力控制
            case 'throttle_up':
                if (vehicle && pressed) vehicle.adjustThrottle(0.1);
                break;
            case 'throttle_down':
                if (vehicle && pressed) vehicle.adjustThrottle(-0.1);
                break;
            case 'throttle_cut':
                if (vehicle && pressed) vehicle.setThrottle(0);
                break;
            case 'throttle_max':
                if (vehicle && pressed) vehicle.setThrottle(1);
                break;
            case 'throttle_wheel':
                if (vehicle && data) vehicle.adjustThrottle(data.delta);
                break;
                
            // 分级
            case 'stage':
                if (pressed) gameEngine.activateNextStage();
                break;
                
            // 系统切换
            case 'toggle_sas':
                if (vehicle && pressed) vehicle.toggleSAS();
                break;
            case 'toggle_rcs':
                if (vehicle && pressed) vehicle.toggleRCS();
                break;
            case 'toggle_gear':
                if (vehicle && pressed) vehicle.toggleGear();
                break;
            case 'toggle_lights':
                if (vehicle && pressed) vehicle.toggleLights();
                break;
            case 'toggle_brakes':
                if (vehicle && pressed) vehicle.toggleBrakes();
                break;
                
            // 动作组
            case 'action_group_1':
            case 'action_group_2':
            case 'action_group_3':
            case 'action_group_4':
            case 'action_group_5':
                if (vehicle && pressed) {
                    const groupNumber = parseInt(action.split('_')[2]);
                    vehicle.activateActionGroup(groupNumber);
                }
                break;
                
            // 时间控制
            case 'time_warp_up':
                if (pressed) this.adjustTimeWarp(1);
                break;
            case 'time_warp_down':
                if (pressed) this.adjustTimeWarp(-1);
                break;
            case 'time_warp_stop':
                if (pressed) gameEngine.setTimeScale(1);
                break;
                
            // 摄像机控制
            case 'camera_zoom':
                if (gameEngine.renderer && data) {
                    gameEngine.renderer.camera.zoom = Math.max(0.01, 
                        Math.min(10, gameEngine.renderer.camera.zoom + data.delta));
                }
                break;
            case 'mouse_look':
                if (vehicle && data) {
                    // 鼠标控制载具姿态
                    vehicle.applyMouseInput(data.deltaX, data.deltaY);
                }
                break;
                
            // 视图切换
            case 'change_camera':
                if (pressed) this.cycleCamera();
                break;
            case 'toggle_map':
                if (pressed) this.toggleMapView();
                break;
        }
    }
    
    adjustTimeWarp(direction) {
        if (!gameEngine) return;
        
        const warpLevels = [1, 5, 10, 50, 100, 1000, 10000, 100000];
        const currentScale = gameEngine.gameState.timeScale;
        const currentIndex = warpLevels.findIndex(level => level === currentScale);
        
        let newIndex;
        if (direction > 0) {
            newIndex = Math.min(warpLevels.length - 1, currentIndex + 1);
        } else {
            newIndex = Math.max(0, currentIndex - 1);
        }
        
        gameEngine.setTimeScale(warpLevels[newIndex]);
    }
    
    cycleCamera() {
        // 切换摄像机模式的逻辑
        console.log('切换摄像机视角');
    }
    
    toggleMapView() {
        if (!gameEngine) return;
        
        if (gameEngine.gameState.currentScene === 'flight') {
            gameEngine.switchScene('tracking');
        } else if (gameEngine.gameState.currentScene === 'tracking') {
            gameEngine.switchScene('flight');
        }
    }
    
    update(deltaTime) {
        // 持续按键处理
        this.handleContinuousInput(deltaTime);
    }
    
    handleContinuousInput(deltaTime) {
        if (!gameEngine || gameEngine.gameState.currentScene !== 'flight') return;
        
        const vehicle = gameEngine.gameState.currentVehicle;
        if (!vehicle) return;
        
        // 持续的控制输入
        const rotationSpeed = 50 * deltaTime; // 度/秒
        
        if (this.keys['KeyW']) vehicle.applyRotation('pitch', -rotationSpeed);
        if (this.keys['KeyS']) vehicle.applyRotation('pitch', rotationSpeed);
        if (this.keys['KeyA']) vehicle.applyRotation('yaw', -rotationSpeed);
        if (this.keys['KeyD']) vehicle.applyRotation('yaw', rotationSpeed);
        if (this.keys['KeyQ']) vehicle.applyRotation('roll', -rotationSpeed);
        if (this.keys['KeyE']) vehicle.applyRotation('roll', rotationSpeed);
        
        // 持续的推力调整
        const throttleSpeed = 1.0 * deltaTime; // 每秒100%
        if (this.keys['ShiftLeft']) vehicle.adjustThrottle(throttleSpeed);
        if (this.keys['ControlLeft']) vehicle.adjustThrottle(-throttleSpeed);
    }
    
    // 检查按键状态
    isKeyPressed(keyCode) {
        return this.keys[keyCode] || false;
    }
    
    // 检查鼠标按钮状态
    isMouseButtonPressed(button) {
        switch (button) {
            case 0: return this.mouse.leftButton;
            case 1: return this.mouse.middleButton;
            case 2: return this.mouse.rightButton;
            default: return false;
        }
    }
    
    // 获取鼠标位置
    getMousePosition() {
        return { x: this.mouse.x, y: this.mouse.y };
    }
    
    // 设置按键绑定
    setBinding(keyCode, action) {
        this.bindings.set(keyCode, action);
    }
    
    // 获取按键绑定
    getBinding(keyCode) {
        return this.bindings.get(keyCode);
    }
    
    // 清除所有按键状态（用于场景切换时）
    clearInputState() {
        this.keys = {};
        this.mouse.leftButton = false;
        this.mouse.rightButton = false;
        this.mouse.middleButton = false;
        this.mouse.wheel = 0;
    }
    
    // 获取输入帮助文本
    getInputHelp() {
        return {
            flight: {
                movement: {
                    'WASD': '俯仰/偏航控制',
                    'QE': '滚转控制',
                    'Shift/Ctrl': '增加/减少推力',
                    'X': '推力归零',
                    'Z': '推力最大'
                },
                actions: {
                    'Space': '分离下一级',
                    'T': '切换SAS',
                    'R': '切换RCS',
                    'G': '切换起落架',
                    'U': '切换灯光',
                    'B': '切换刹车'
                },
                view: {
                    'V': '切换摄像机',
                    'C': '切换摄像机模式',
                    'M': '切换地图视图',
                    '鼠标滚轮': '缩放视角'
                },
                time: {
                    ',.': '时间加速控制',
                    '/': '停止时间加速'
                }
            },
            assembly: {
                basic: {
                    '鼠标左键': '选择部件',
                    '鼠标拖拽': '移动部件',
                    '鼠标右键': '旋转部件',
                    'Delete': '删除部件'
                }
            }
        };
    }
}

// 导出给其他模块使用
window.InputManager = InputManager;
