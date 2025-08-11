// 飞行UI管理器
class FlightUI {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.vehicle = null;
        this.isThrottleMode = false;
        this.isMapMode = false;
        this.selectedStage = 0;
        
        this.initialize();
    }
    
    initialize() {
        this.setupFlightControls();
        this.setupHUD();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }
    
    setupFlightControls() {
        // 创建飞行控制面板
        const flightScreen = document.getElementById('flight');
        if (!flightScreen) return;
        
        // 检查是否已存在控制面板
        let controlPanel = flightScreen.querySelector('.flight-controls');
        if (!controlPanel) {
            controlPanel = document.createElement('div');
            controlPanel.className = 'flight-controls';
            controlPanel.innerHTML = `
                <div class="throttle-control">
                    <label>推力:</label>
                    <input type="range" id="throttle-slider" min="0" max="100" value="0">
                    <span id="throttle-value">0%</span>
                </div>
                
                <div class="stage-control">
                    <button id="stage-button" class="stage-btn">分离 (Space)</button>
                    <div class="stage-info">
                        <span>第 <span id="current-stage">1</span> 级</span>
                    </div>
                </div>
                
                <div class="attitude-controls">
                    <div class="attitude-indicator">
                        <div class="attitude-ball" id="attitude-ball"></div>
                    </div>
                    <div class="rcs-controls">
                        <button id="rcs-toggle" class="rcs-btn">RCS</button>
                        <button id="sas-toggle" class="sas-btn">SAS</button>
                    </div>
                </div>
                
                <div class="time-controls">
                    <button class="time-btn" data-warp="0.1">0.1x</button>
                    <button class="time-btn active" data-warp="1">1x</button>
                    <button class="time-btn" data-warp="2">2x</button>
                    <button class="time-btn" data-warp="5">5x</button>
                    <button class="time-btn" data-warp="10">10x</button>
                </div>
                
                <div class="view-controls">
                    <button id="map-toggle" class="view-btn">轨道视图 (M)</button>
                    <button id="camera-mode" class="view-btn">相机模式</button>
                </div>
                
                <div class="navigation-controls">
                    <button class="nav-btn" data-target="prograde">顺行点</button>
                    <button class="nav-btn" data-target="retrograde">逆行点</button>
                    <button class="nav-btn" data-target="normal">法向</button>
                    <button class="nav-btn" data-target="antinormal">反法向</button>
                    <button class="nav-btn" data-target="radial">径向</button>
                    <button class="nav-btn" data-target="antiradial">反径向</button>
                </div>
            `;
            flightScreen.appendChild(controlPanel);
        }
    }
    
    setupHUD() {
        const flightScreen = document.getElementById('flight');
        if (!flightScreen) return;
        
        // 检查是否已存在HUD
        let hud = flightScreen.querySelector('.flight-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.className = 'flight-hud';
            hud.innerHTML = `
                <div class="hud-top">
                    <div class="mission-time">
                        <span>任务时间: <span id="mission-time">T+ 00:00:00</span></span>
                    </div>
                    <div class="vessel-name">
                        <span id="vessel-name">未命名载具</span>
                    </div>
                </div>
                
                <div class="hud-left">
                    <div class="altitude-speed">
                        <div class="altitude">
                            <span>海拔高度</span>
                            <span id="altitude-value">0 m</span>
                        </div>
                        <div class="speed">
                            <span>表面速度</span>
                            <span id="surface-speed">0.0 m/s</span>
                        </div>
                        <div class="orbital-speed">
                            <span>轨道速度</span>
                            <span id="orbital-speed">0.0 m/s</span>
                        </div>
                    </div>
                    
                    <div class="resources">
                        <div class="resource-bar">
                            <span>液体燃料</span>
                            <div class="bar">
                                <div class="bar-fill" id="liquid-fuel-bar" style="width: 100%"></div>
                            </div>
                            <span id="liquid-fuel-value">0/0</span>
                        </div>
                        <div class="resource-bar">
                            <span>氧化剂</span>
                            <div class="bar">
                                <div class="bar-fill" id="oxidizer-bar" style="width: 100%"></div>
                            </div>
                            <span id="oxidizer-value">0/0</span>
                        </div>
                        <div class="resource-bar">
                            <span>电力</span>
                            <div class="bar">
                                <div class="bar-fill" id="electric-charge-bar" style="width: 100%"></div>
                            </div>
                            <span id="electric-charge-value">0/0</span>
                        </div>
                    </div>
                </div>
                
                <div class="hud-right">
                    <div class="orbital-info">
                        <div class="apoapsis">
                            <span>远拱点</span>
                            <span id="apoapsis-value">- m</span>
                        </div>
                        <div class="periapsis">
                            <span>近拱点</span>
                            <span id="periapsis-value">- m</span>
                        </div>
                        <div class="orbital-period">
                            <span>轨道周期</span>
                            <span id="orbital-period">-</span>
                        </div>
                        <div class="inclination">
                            <span>轨道倾角</span>
                            <span id="inclination">0.0°</span>
                        </div>
                    </div>
                    
                    <div class="target-info" id="target-info" style="display: none;">
                        <h4>目标信息</h4>
                        <div class="target-distance">
                            <span>距离: <span id="target-distance">-</span></span>
                        </div>
                        <div class="relative-velocity">
                            <span>相对速度: <span id="relative-velocity">-</span></span>
                        </div>
                    </div>
                </div>
                
                <div class="hud-bottom">
                    <div class="staging-sequence">
                        <h4>分级序列</h4>
                        <div id="stage-sequence"></div>
                    </div>
                    
                    <div class="warning-messages" id="warning-messages"></div>
                </div>
                
                <div class="navball-container">
                    <div class="navball" id="navball">
                        <canvas id="navball-canvas" width="100" height="100"></canvas>
                        <div class="navball-markers">
                            <div class="marker prograde" id="prograde-marker">⊕</div>
                            <div class="marker retrograde" id="retrograde-marker">⊖</div>
                        </div>
                    </div>
                    <div class="navball-speed">
                        <span id="navball-speed">0.0 m/s</span>
                    </div>
                </div>
            `;
            flightScreen.appendChild(hud);
        }
    }
    
    setupEventListeners() {
        // 推力控制
        const throttleSlider = document.getElementById('throttle-slider');
        if (throttleSlider) {
            throttleSlider.addEventListener('input', (e) => {
                this.setThrottle(parseInt(e.target.value));
            });
        }
        
        // 分离按钮
        const stageButton = document.getElementById('stage-button');
        if (stageButton) {
            stageButton.addEventListener('click', () => {
                this.activateNextStage();
            });
        }
        
        // RCS切换
        const rcsToggle = document.getElementById('rcs-toggle');
        if (rcsToggle) {
            rcsToggle.addEventListener('click', () => {
                this.toggleRCS();
            });
        }
        
        // SAS切换
        const sasToggle = document.getElementById('sas-toggle');
        if (sasToggle) {
            sasToggle.addEventListener('click', () => {
                this.toggleSAS();
            });
        }
        
        // 时间加速控制
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const warp = parseFloat(e.target.dataset.warp);
                this.setTimeWarp(warp);
                
                // 更新按钮状态
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        // 轨道视图切换
        const mapToggle = document.getElementById('map-toggle');
        if (mapToggle) {
            mapToggle.addEventListener('click', () => {
                this.toggleMapMode();
            });
        }
        
        // 导航点控制
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setNavigationTarget(e.target.dataset.target);
            });
        });
        
        // 返回按钮
        const backButton = document.querySelector('#flight .back-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.confirmExit();
            });
        }
    }
    
    setupKeyboardShortcuts() {
        // 移除之前的事件监听器（如果存在）
        document.removeEventListener('keydown', this.handleKeyPress);
        
        // 绑定键盘事件
        this.handleKeyPress = (event) => {
            if (document.querySelector('#flight').classList.contains('active')) {
                switch (event.code) {
                    case 'Space':
                        event.preventDefault();
                        this.activateNextStage();
                        break;
                    case 'KeyX':
                        event.preventDefault();
                        this.setThrottle(0);
                        break;
                    case 'KeyZ':
                        event.preventDefault();
                        this.setThrottle(100);
                        break;
                    case 'KeyM':
                        event.preventDefault();
                        this.toggleMapMode();
                        break;
                    case 'KeyR':
                        if (event.ctrlKey) {
                            event.preventDefault();
                            this.toggleRCS();
                        }
                        break;
                    case 'KeyT':
                        if (event.ctrlKey) {
                            event.preventDefault();
                            this.toggleSAS();
                        }
                        break;
                    // 飞行控制 WASD
                    case 'KeyW':
                        this.applyPitchInput(-1);
                        break;
                    case 'KeyS':
                        this.applyPitchInput(1);
                        break;
                    case 'KeyA':
                        this.applyYawInput(-1);
                        break;
                    case 'KeyD':
                        this.applyYawInput(1);
                        break;
                    case 'KeyQ':
                        this.applyRollInput(-1);
                        break;
                    case 'KeyE':
                        this.applyRollInput(1);
                        break;
                }
            }
        };
        
        document.addEventListener('keydown', this.handleKeyPress);
    }
    
    setVehicle(vehicle) {
        this.vehicle = vehicle;
        this.updateVesselName();
        this.updateStagingSequence();
        this.selectedStage = vehicle.stages ? vehicle.stages.length - 1 : 0;
    }
    
    updateVesselName() {
        const vesselNameElement = document.getElementById('vessel-name');
        if (vesselNameElement && this.vehicle) {
            vesselNameElement.textContent = this.vehicle.name || '未命名载具';
        }
    }
    
    update(deltaTime) {
        if (!this.vehicle) return;
        
        this.updateFlightData();
        this.updateResources();
        this.updateOrbitalInfo();
        this.updateNavball();
        this.updateWarnings();
        this.updateMissionTime(deltaTime);
    }
    
    updateFlightData() {
        if (!this.vehicle) return;
        
        // 高度
        const altitudeElement = document.getElementById('altitude-value');
        if (altitudeElement) {
            const altitude = this.vehicle.position.y - this.gameEngine.celestialBodies.kerbin.radius;
            altitudeElement.textContent = this.formatDistance(Math.max(0, altitude));
        }
        
        // 表面速度
        const surfaceSpeedElement = document.getElementById('surface-speed');
        if (surfaceSpeedElement && this.vehicle.velocity) {
            const speed = Math.sqrt(this.vehicle.velocity.x ** 2 + this.vehicle.velocity.y ** 2);
            surfaceSpeedElement.textContent = speed.toFixed(1) + ' m/s';
        }
        
        // 轨道速度
        const orbitalSpeedElement = document.getElementById('orbital-speed');
        if (orbitalSpeedElement && this.vehicle.velocity) {
            const speed = Math.sqrt(this.vehicle.velocity.x ** 2 + this.vehicle.velocity.y ** 2);
            orbitalSpeedElement.textContent = speed.toFixed(1) + ' m/s';
        }
        
        // 导航球速度显示
        const navballSpeedElement = document.getElementById('navball-speed');
        if (navballSpeedElement && this.vehicle.velocity) {
            const speed = Math.sqrt(this.vehicle.velocity.x ** 2 + this.vehicle.velocity.y ** 2);
            navballSpeedElement.textContent = speed.toFixed(1) + ' m/s';
        }
    }
    
    updateResources() {
        if (!this.vehicle) return;
        
        const resources = this.vehicle.getResources();
        
        // 液体燃料
        this.updateResourceBar('liquid-fuel', resources.liquidFuel, resources.maxLiquidFuel);
        
        // 氧化剂
        this.updateResourceBar('oxidizer', resources.oxidizer, resources.maxOxidizer);
        
        // 电力
        this.updateResourceBar('electric-charge', resources.electricCharge, resources.maxElectricCharge);
    }
    
    updateResourceBar(resourceType, current, max) {
        const barElement = document.getElementById(`${resourceType}-bar`);
        const valueElement = document.getElementById(`${resourceType}-value`);
        
        if (barElement && valueElement) {
            const percentage = max > 0 ? (current / max) * 100 : 0;
            barElement.style.width = percentage + '%';
            
            // 根据剩余量改变颜色
            if (percentage > 50) {
                barElement.style.backgroundColor = '#4CAF50';
            } else if (percentage > 20) {
                barElement.style.backgroundColor = '#FF9800';
            } else {
                barElement.style.backgroundColor = '#F44336';
            }
            
            valueElement.textContent = `${current.toFixed(1)}/${max.toFixed(1)}`;
        }
    }
    
    updateOrbitalInfo() {
        if (!this.vehicle) return;
        
        const orbit = this.vehicle.getOrbit();
        if (orbit) {
            // 远拱点
            const apoapsisElement = document.getElementById('apoapsis-value');
            if (apoapsisElement) {
                apoapsisElement.textContent = orbit.apoapsis > 0 ? this.formatDistance(orbit.apoapsis) : '- m';
            }
            
            // 近拱点
            const periapsisElement = document.getElementById('periapsis-value');
            if (periapsisElement) {
                periapsisElement.textContent = orbit.periapsis > 0 ? this.formatDistance(orbit.periapsis) : '- m';
            }
            
            // 轨道周期
            const periodElement = document.getElementById('orbital-period');
            if (periodElement) {
                periodElement.textContent = orbit.period > 0 ? this.formatTime(orbit.period) : '-';
            }
            
            // 轨道倾角
            const inclinationElement = document.getElementById('inclination');
            if (inclinationElement) {
                inclinationElement.textContent = orbit.inclination.toFixed(1) + '°';
            }
        }
    }
    
    updateNavball() {
        const canvas = document.getElementById('navball-canvas');
        if (!canvas || !this.vehicle) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2 - 5;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制导航球背景
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // 绘制地平线
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI);
        ctx.stroke();
        
        // 绘制中心十字
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 10, centerY);
        ctx.lineTo(centerX + 10, centerY);
        ctx.moveTo(centerX, centerY - 10);
        ctx.lineTo(centerX, centerY + 10);
        ctx.stroke();
    }
    
    updateStagingSequence() {
        if (!this.vehicle) return;
        
        const stageSequence = document.getElementById('stage-sequence');
        if (stageSequence) {
            stageSequence.innerHTML = '';
            
            if (this.vehicle.stages && this.vehicle.stages.length > 0) {
                this.vehicle.stages.forEach((stage, index) => {
                    const stageElement = document.createElement('div');
                    stageElement.className = 'stage-item';
                    if (index === this.selectedStage) {
                        stageElement.classList.add('active');
                    }
                    
                    stageElement.innerHTML = `
                        <span class="stage-number">${this.vehicle.stages.length - index}</span>
                        <span class="stage-parts">${stage.parts.length} 部件</span>
                    `;
                    
                    stageSequence.appendChild(stageElement);
                });
            }
        }
        
        // 更新当前级数显示
        const currentStageElement = document.getElementById('current-stage');
        if (currentStageElement) {
            currentStageElement.textContent = this.vehicle.stages ? 
                (this.vehicle.stages.length - this.selectedStage).toString() : '1';
        }
    }
    
    updateWarnings() {
        const warningsContainer = document.getElementById('warning-messages');
        if (!warningsContainer || !this.vehicle) return;
        
        const warnings = [];
        
        // 检查燃料不足
        const resources = this.vehicle.getResources();
        if (resources.liquidFuel < resources.maxLiquidFuel * 0.1) {
            warnings.push('⚠️ 液体燃料不足');
        }
        if (resources.oxidizer < resources.maxOxidizer * 0.1) {
            warnings.push('⚠️ 氧化剂不足');
        }
        if (resources.electricCharge < resources.maxElectricCharge * 0.1) {
            warnings.push('⚠️ 电力不足');
        }
        
        // 检查过热
        if (this.vehicle.temperature && this.vehicle.temperature > 1000) {
            warnings.push('🔥 载具过热');
        }
        
        // 更新警告显示
        warningsContainer.innerHTML = warnings.map(warning => 
            `<div class="warning">${warning}</div>`
        ).join('');
    }
    
    updateMissionTime(deltaTime) {
        if (!this.gameEngine.missionTime) {
            this.gameEngine.missionTime = 0;
        }
        
        this.gameEngine.missionTime += deltaTime;
        
        const missionTimeElement = document.getElementById('mission-time');
        if (missionTimeElement) {
            missionTimeElement.textContent = 'T+ ' + this.formatTime(this.gameEngine.missionTime);
        }
    }
    
    setThrottle(value) {
        if (!this.vehicle) return;
        
        this.vehicle.setThrottle(value / 100);
        
        // 更新UI显示
        const throttleSlider = document.getElementById('throttle-slider');
        const throttleValue = document.getElementById('throttle-value');
        
        if (throttleSlider) throttleSlider.value = value;
        if (throttleValue) throttleValue.textContent = value + '%';
    }
    
    activateNextStage() {
        if (!this.vehicle) return;
        
        const result = this.vehicle.activateNextStage();
        if (result.success) {
            this.selectedStage = Math.max(0, this.selectedStage - 1);
            this.updateStagingSequence();
            
            // 显示分离消息
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage(`第${result.stageNumber}级已分离`, 'info', 2000);
            }
        } else {
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage('没有更多级可分离', 'warning', 2000);
            }
        }
    }
    
    toggleRCS() {
        if (!this.vehicle) return;
        
        this.vehicle.rcsEnabled = !this.vehicle.rcsEnabled;
        
        const rcsButton = document.getElementById('rcs-toggle');
        if (rcsButton) {
            rcsButton.classList.toggle('active', this.vehicle.rcsEnabled);
        }
        
        if (this.gameEngine && this.gameEngine.ui) {
            const status = this.vehicle.rcsEnabled ? '开启' : '关闭';
            this.gameEngine.ui.showMessage(`RCS ${status}`, 'info', 1500);
        }
    }
    
    toggleSAS() {
        if (!this.vehicle) return;
        
        this.vehicle.sasEnabled = !this.vehicle.sasEnabled;
        
        const sasButton = document.getElementById('sas-toggle');
        if (sasButton) {
            sasButton.classList.toggle('active', this.vehicle.sasEnabled);
        }
        
        if (this.gameEngine && this.gameEngine.ui) {
            const status = this.vehicle.sasEnabled ? '开启' : '关闭';
            this.gameEngine.ui.showMessage(`SAS ${status}`, 'info', 1500);
        }
    }
    
    setTimeWarp(factor) {
        if (this.gameEngine) {
            this.gameEngine.setTimeWarp(factor);
        }
    }
    
    toggleMapMode() {
        this.isMapMode = !this.isMapMode;
        
        const mapButton = document.getElementById('map-toggle');
        if (mapButton) {
            mapButton.textContent = this.isMapMode ? '飞行视图 (M)' : '轨道视图 (M)';
            mapButton.classList.toggle('active', this.isMapMode);
        }
        
        // 通知游戏引擎切换视图模式
        if (this.gameEngine) {
            this.gameEngine.setMapMode(this.isMapMode);
        }
    }
    
    setNavigationTarget(target) {
        if (!this.vehicle) return;
        
        this.vehicle.setNavigationTarget(target);
        
        // 更新按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetButton = document.querySelector(`[data-target="${target}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        if (this.gameEngine && this.gameEngine.ui) {
            this.gameEngine.ui.showMessage(`导航目标: ${this.getTargetName(target)}`, 'info', 2000);
        }
    }
    
    getTargetName(target) {
        const names = {
            'prograde': '顺行点',
            'retrograde': '逆行点',
            'normal': '法向',
            'antinormal': '反法向',
            'radial': '径向',
            'antiradial': '反径向'
        };
        return names[target] || target;
    }
    
    applyPitchInput(value) {
        if (!this.vehicle) return;
        this.vehicle.applyPitchInput(value);
    }
    
    applyYawInput(value) {
        if (!this.vehicle) return;
        this.vehicle.applyYawInput(value);
    }
    
    applyRollInput(value) {
        if (!this.vehicle) return;
        this.vehicle.applyRollInput(value);
    }
    
    confirmExit() {
        if (confirm('确定要退出飞行模式吗？未保存的进度将会丢失。')) {
            // 重置载具状态
            if (this.vehicle) {
                this.vehicle.reset();
            }
            
            // 切换回主菜单
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.switchScreen('main-menu');
            }
        }
    }
    
    // 工具方法
    formatDistance(meters) {
        if (meters >= 1000000) {
            return (meters / 1000000).toFixed(2) + ' Mm';
        } else if (meters >= 1000) {
            return (meters / 1000).toFixed(2) + ' km';
        } else {
            return meters.toFixed(0) + ' m';
        }
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 清理方法
    destroy() {
        document.removeEventListener('keydown', this.handleKeyPress);
    }
}

// 全局飞行UI实例
let flightUI = null;
