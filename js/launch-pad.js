// 发射台主控制器
class LaunchPad {
    constructor() {
        this.rocketData = null;
        this.assembly = null;
        this.simulation = null;
        this.isLaunched = false;
        this.countdown = -1;
        this.countdownTimer = null;
        
        // 节流阀控制
        this.throttle = 0; // 节流阀设置 (0-100%)
        this.isDraggingThrottle = false;
        this.throttleBar = null;
        this.throttleFill = null;
        this.throttleHandle = null;
        
        // 键盘状态标志
        this.keyStates = {
            a: false,      // 左转
            d: false,      // 右转
            shift: false,  // 增加节流阀
            ctrl: false    // 减少节流阀
        };
        
        // 连续输入定时器
        this.keyInputTimer = null;
        
        // 触屏控制相关
        this.touchSupport = this.detectTouchSupport();
        this.touchThrottleDragging = false;
        this.touchSteeringActive = false;
        
        // 火箭显示状态跟踪（避免不必要的重新渲染）
        this.lastCrashedState = false;
        this.lastLandedState = false;
        this.lastStageState = 0;
        
        this.initializeUI();
        this.loadRocketData();
        
        // 初始化世界坐标系统（在发射前显示地面和天空）
        this.initializeWorldCoordinateSystem();
        
        // 确保页面有焦点以接收键盘事件
        window.focus();
        
        // 页面失去焦点时清理按键状态
        window.addEventListener('blur', () => {
            this.clearKeyStates();
        });
        
        // 页面卸载时清理定时器
        window.addEventListener('beforeunload', () => {
            this.stopContinuousInput();
        });
    }
    
    // 清理按键状态
    clearKeyStates() {
        this.keyStates = {
            a: false,
            d: false,
            shift: false,
            ctrl: false
        };
        this.stopContinuousInput();
    }

    // 初始化世界坐标系统
    initializeWorldCoordinateSystem() {
        // 在发射前就显示地面和天空，以火箭当前位置为参考点
        const altitude = 0; // 发射前高度为0
        const horizontalPos = 0; // 发射前水平位置为0
        
        // 创建初始的世界背景
        this.updateWorldBackground(altitude, horizontalPos);
        
        console.log('世界坐标系统已初始化');
    }
    
    // 初始化UI
    initializeUI() {
        // 隐藏加载覆盖层
        this.hideLoading();
        
        // 初始化控制按钮状态
        this.updateControlButtons();
        
        // 初始化节流阀控制
        this.initializeThrottleControl();
        
        // 初始化键盘控制
        this.initializeKeyboardControls();
        
        // 初始化触屏控制
        if (this.touchSupport) {
            this.initializeTouchControls();
        }
    }

    // 从localStorage加载火箭数据
    loadRocketData() {
        try {
            const savedRocket = localStorage.getItem('launchRocket');
            if (!savedRocket) {
                this.showError(window.i18n ? window.i18n.t('errors.noRocketData') : '没有找到火箭数据，请先在装配厂创建火箭');
                return;
            }

            this.rocketData = JSON.parse(savedRocket);
            console.log('加载火箭数据:', this.rocketData);

            // 重建火箭装配
            this.assembly = new RocketAssembly();
            this.assembly.name = this.rocketData.name || (window.i18n ? window.i18n.t('rocketBuilder.infoPanel.unnamed') : '未命名载具');
            
            // 重建部件和连接
            if (this.rocketData.parts && this.rocketData.parts.length > 0) {
                this.rebuildRocket();
                this.displayRocket();
                this.updateFlightData();
                this.updateStagingInfo();
            } else {
                this.showError(window.i18n ? window.i18n.t('errors.invalidRocketData') : '火箭数据无效，请重新加载');
            }

        } catch (error) {
            console.error('加载火箭数据失败:', error);
            const errorMessage = window.i18n ? 
                window.i18n.t('errors.loadRocketDataFailed') + ': ' + error.message : 
                (window.i18n ? window.i18n.t('errors.loadRocketDataFailed') : '加载火箭数据失败') + ': ' + error.message;
            this.showError(errorMessage);
        }
    }

    // 重建火箭装配
    rebuildRocket() {
        // 添加所有部件
        this.rocketData.parts.forEach(partData => {
            const part = this.assembly.addPart(partData.data, partData.position);
            part.id = partData.id;
            
            // 恢复燃料状态
            if (partData.fuelStatus) {
                part.fuelStatus = { ...partData.fuelStatus };
            } else if (part.data.fuel_capacity) {
                // 如果没有燃料状态但部件有燃料容量，初始化为满油
                part.fuelStatus = {
                    liquid_fuel: part.data.fuel_capacity.liquid_fuel || 0,
                    oxidizer: part.data.fuel_capacity.oxidizer || 0
                };
                console.log(`初始化燃料状态 ${part.data.name}:`, part.fuelStatus);
            }
        });

        // 重建连接关系
        if (this.rocketData.connections) {
            this.assembly.connections = [...this.rocketData.connections];
        }

        // 设置根部件
        if (this.rocketData.rootPart) {
            this.assembly.rootPart = this.rocketData.rootPart;
            console.log('设置根部件:', this.assembly.rootPart);
        } else {
            // 如果没有明确的根部件，使用第一个部件
            if (this.assembly.parts.length > 0) {
                this.assembly.rootPart = this.assembly.parts[0].id;
                console.log('使用第一个部件作为根部件:', this.assembly.rootPart);
            }
        }

        console.log('火箭重建完成，部件数量:', this.assembly.parts.length);
        console.log('引擎数量:', this.assembly.parts.filter(p => p.data.type === 'engine').length);
        console.log('燃料罐数量:', this.assembly.parts.filter(p => p.data.fuel_capacity).length);
    }

    // 在发射台显示火箭
    displayRocket() {
        const display = document.getElementById('rocketDisplay');
        const rocketName = document.getElementById('rocketName');
        
        if (!display) return;
        
        // 如果火箭已坠毁，不显示火箭
        if (this.simulation && this.simulation.crashed) {
            // 保持显示区域，但清空内容（爆炸效果可能还在显示）
            const rocketContainer = display.querySelector('.rocket-container');
            if (rocketContainer) {
                rocketContainer.classList.add('rocket-crashed');
            }
            return;
        }
        
        // 如果火箭已着陆，显示着陆状态
        if (this.simulation && this.simulation.landed) {
            // 火箭着陆后仍然显示，但可以添加着陆标识
            // 继续正常显示流程，只是状态不同
        }
        
        // 清空显示区域
        display.innerHTML = '';
        
        // 设置火箭名称
        if (rocketName) {
            rocketName.textContent = this.assembly.name;
        }

        // 计算火箭尺寸和位置
        const bounds = this.calculateRocketBounds();
        const scale = this.calculateDisplayScale(bounds);
        
        // 创建火箭容器
        const rocketContainer = document.createElement('div');
        rocketContainer.className = 'rocket-container';
        
        // 使用世界坐标系统的定位方式
        const displayRect = display.getBoundingClientRect();
        const centerX = displayRect.width / 2;
        const centerY = displayRect.height / 2;
        
        rocketContainer.style.position = 'absolute';
        rocketContainer.style.left = `${centerX}px`;
        rocketContainer.style.top = `${centerY}px`;
        rocketContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        rocketContainer.style.zIndex = '10';
        
        // 如果火箭已着陆且高度为0，添加着陆样式和标识
        if (this.simulation && this.simulation.landed && this.simulation.altitude <= 0) {
            rocketContainer.classList.add('rocket-landed');
            
            // 创建着陆标识
            const landingBadge = document.createElement('div');
            landingBadge.className = 'landing-badge';
            landingBadge.textContent = window.i18n ? 
                `✅ ${window.i18n.t('launchPad.status.landed')}` : 
                '✅ 已着陆';
            landingBadge.style.cssText = `
                position: absolute;
                top: -30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 255, 0, 0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 0.8em;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
                animation: landingBadge 2s ease-in-out infinite alternate;
                z-index: 1001;
                pointer-events: none;
            `;
            rocketContainer.appendChild(landingBadge);
        }
        
        // 渲染只与根部件连通的部件
        const connectedPartIds = this.assembly.getConnectedParts();
        const connectedParts = this.assembly.parts.filter(part => 
            connectedPartIds.includes(part.id)
        );
        
        // 如果有模拟运行，过滤掉已分离的部件
        const visibleParts = this.simulation && this.simulation.separatedPartIds ? 
            connectedParts.filter(part => !this.simulation.separatedPartIds.has(part.id)) :
            connectedParts;
        
        console.log(`总部件数: ${this.assembly.parts.length}, 连通部件数: ${connectedParts.length}, 可见部件数: ${visibleParts.length}`);
        if (this.simulation && this.simulation.separatedPartIds) {
            console.log(`已分离部件数: ${this.simulation.separatedPartIds.size}`);
        }
        
        visibleParts.forEach(part => {
            this.renderRocketPart(rocketContainer, part, bounds, scale);
        });

        display.appendChild(rocketContainer);
    }

    // 计算火箭边界
    calculateRocketBounds() {
        // 只计算与根部件连通的部件边界
        const connectedPartIds = this.assembly.getConnectedParts();
        const connectedParts = this.assembly.parts.filter(part => 
            connectedPartIds.includes(part.id)
        );
        
        if (connectedParts.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        connectedParts.forEach(part => {
            const partWidth = part.data.dimensions.width * 40;
            const partHeight = part.data.dimensions.height * 40;
            
            const left = part.position.x;
            const right = part.position.x + partWidth;
            const top = part.position.y;
            const bottom = part.position.y + partHeight;

            minX = Math.min(minX, left);
            maxX = Math.max(maxX, right);
            minY = Math.min(minY, top);
            maxY = Math.max(maxY, bottom);
        });

        return { minX, maxX, minY, maxY };
    }

    // 计算显示缩放
    calculateDisplayScale(bounds) {
        const maxWidth = 300;  // 最大显示宽度
        const maxHeight = 400; // 最大显示高度
        
        const rocketWidth = bounds.maxX - bounds.minX;
        const rocketHeight = bounds.maxY - bounds.minY;
        
        const scaleX = rocketWidth > 0 ? maxWidth / rocketWidth : 1;
        const scaleY = rocketHeight > 0 ? maxHeight / rocketHeight : 1;
        
        return Math.min(scaleX, scaleY, 1); // 不超过原始大小
    }

    // 设置火箭为视角中心（已被世界坐标系统取代）
    centerRocketView(rocketContainer) {
        // 此方法已被世界坐标系统取代，不再使用
        // 保留以防需要回滚，但不执行任何操作
        
        /*
        const displayArea = document.getElementById('rocketDisplay');
        if (!displayArea) return;

        const displayRect = displayArea.getBoundingClientRect();
        const centerX = displayRect.width / 2;
        const centerY = displayRect.height / 2;

        if (!this.simulation) {
            // 发射前：火箭在屏幕中心偏下位置，模拟在发射台上
            rocketContainer.style.position = 'absolute';
            rocketContainer.style.left = `${centerX}px`;
            rocketContainer.style.top = `${centerY + 100}px`; // 偏下一些，模拟在地面
            rocketContainer.style.transform = rocketContainer.style.transform + ' translate(-50%, -50%)';
            
            console.log('火箭定位：发射台模式');
            return;
        }

        // 飞行中的定位在 updateCameraView 中处理
        console.log('火箭定位：飞行模式 - 由updateCameraView处理');
        */
    }

    // 渲染单个火箭部件
    renderRocketPart(container, part, bounds, scale) {
        // 检查部件是否已分离，如果已分离则不渲染
        if (this.simulation && this.simulation.separatedPartIds && this.simulation.separatedPartIds.has(part.id)) {
            console.log(`跳过渲染已分离部件: ${part.data.name} (ID: ${part.id})`);
            return;
        }
        
        const partElement = document.createElement('div');
        partElement.className = 'rocket-part';
        partElement.id = `launch-part-${part.id}`;
        
        // 计算相对位置（相对于火箭中心）
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        const relativeX = part.position.x - centerX;
        const relativeY = part.position.y - centerY;
        
        partElement.style.left = `${relativeX}px`;
        partElement.style.top = `${relativeY}px`;
        partElement.style.width = `${part.data.dimensions.width * 40}px`;
        partElement.style.height = `${part.data.dimensions.height * 40}px`;
        
        // 加载SVG
        if (part.data.svg_path) {
            fetch(part.data.svg_path)
                .then(response => response.text())
                .then(svgContent => {
                    partElement.innerHTML = svgContent;
                    
                    // 如果是引擎，添加火焰效果容器
                    if (part.data.type === 'engine') {
                        const flame = document.createElement('div');
                        flame.className = 'engine-flame';
                        flame.id = `flame-${part.id}`;
                        
                        // 将火焰定位在引擎底部外面，而不是引擎内部
                        flame.style.position = 'absolute';
                        flame.style.left = '50%';
                        flame.style.top = '100%'; // 引擎底部外面
                        flame.style.transform = 'translateX(-50%)';
                        flame.style.zIndex = '-1'; // 确保火焰在引擎后面
                        
                        partElement.appendChild(flame);
                    }
                })
                .catch(error => {
                    console.error('加载部件SVG失败:', error);
                    partElement.style.backgroundColor = '#666';
                    partElement.style.border = '1px solid #999';
                });
        }
        
        container.appendChild(partElement);
    }

    // 更新飞行数据显示
    updateFlightData() {
        // 使用连通部件的数据
        const totalMass = this.assembly.getConnectedMass();
        const stagingInfo = this.assembly.getStagingInfo();
        const totalDeltaV = stagingInfo.reduce((sum, stage) => sum + stage.deltaV, 0);
        
        // 计算推重比（只考虑连通的引擎）
        const connectedPartIds = this.assembly.getConnectedParts();
        const connectedEngines = this.assembly.parts.filter(p => 
            p.data.type === 'engine' && connectedPartIds.includes(p.id)
        );
        const totalThrust = connectedEngines.reduce((sum, engine) => sum + (engine.data.thrust || 0), 0);
        const twr = totalMass > 0 ? (totalThrust / (totalMass * 9.81)) : 0;

        // 计算连通燃料罐的燃料量
        const connectedFuelTanks = this.assembly.parts.filter(p => 
            p.data.fuel_capacity && connectedPartIds.includes(p.id)
        );
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        
        connectedFuelTanks.forEach(tank => {
            if (tank.fuelStatus) {
                totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                totalOxidizer += tank.fuelStatus.oxidizer || 0;
            }
        });

        // 更新显示
        document.getElementById('altitude').textContent = '0 m';
        document.getElementById('velocity').textContent = '0 m/s';
        document.getElementById('acceleration').textContent = '0 m/s²';
        document.getElementById('mass').textContent = `${totalMass.toFixed(2)} t`;
        document.getElementById('twr').textContent = twr.toFixed(2);
        document.getElementById('deltaV').textContent = `${totalDeltaV.toFixed(0)} m/s`;
        
        // 更新燃料显示
        if (document.getElementById('liquidFuel')) {
            document.getElementById('liquidFuel').textContent = totalLiquidFuel.toFixed(1);
        }
        if (document.getElementById('oxidizer')) {
            document.getElementById('oxidizer').textContent = totalOxidizer.toFixed(1);
        }
        
        console.log(`连通燃料状态 - 液体燃料: ${totalLiquidFuel.toFixed(1)}, 氧化剂: ${totalOxidizer.toFixed(1)}, 连通燃料罐数量: ${connectedFuelTanks.length}`);
        console.log(`连通部件统计 - 总部件: ${this.assembly.parts.length}, 连通部件: ${connectedPartIds.length}, 连通引擎: ${connectedEngines.length}`);
    }

    // 启动飞行数据更新循环
    startFlightDataUpdate() {
        this.stopFlightDataUpdate(); // 确保清除之前的循环
        
        this.flightDataUpdateTimer = setInterval(() => {
            if (this.simulation) {
                // 只有坠毁时才停止更新，着陆时继续更新以便检测重新起飞
                if (this.simulation.crashed) {
                    this.stopFlightDataUpdate();
                    return;
                }
                
                // 更新飞行数据显示
                this.updateLiveFlightData();
                // 更新视角中心（平滑跟随火箭）
                this.updateCameraView();
                // 只在状态发生重大变化时更新火箭显示，避免闪烁
                this.updateRocketDisplayIfNeeded();
            }
        }, 100); // 每100ms更新一次
    }
    
    // 更新相机视角（火箭始终保持在屏幕中心）
    updateCameraView() {
        if (!this.simulation) return;
        
        const rocketContainer = document.querySelector('.rocket-container');
        if (!rocketContainer) return;
        
        const displayArea = document.getElementById('rocketDisplay');
        if (!displayArea) return;
        
        const displayRect = displayArea.getBoundingClientRect();
        const centerX = displayRect.width / 2;
        const centerY = displayRect.height / 2;
        
        // 获取火箭的世界坐标和状态
        const altitude = this.simulation.altitude;
        const horizontalPos = this.simulation.horizontalPosition;
        const steeringAngle = this.simulation.steeringAngle || 0;
        
        // 计算缩放比例（基于高度，但保持可读性）
        const minScale = 0.3;
        const maxScale = 1.0;
        const scaleAltitude = 2000; // 2000米时开始缩小
        const scale = Math.max(minScale, maxScale - (altitude / scaleAltitude) * (maxScale - minScale));
        
        // 火箭始终保持在屏幕中心，不受任何其他因素影响
        rocketContainer.style.position = 'absolute';
        rocketContainer.style.left = `${centerX}px`;
        rocketContainer.style.top = `${centerY}px`;
        rocketContainer.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${steeringAngle}deg)`;
        rocketContainer.style.zIndex = '10';
        
        // 更新世界背景位置（相对于火箭移动）
        this.updateWorldBackground(altitude, horizontalPos);
        
        // 调试信息
        if (Math.floor(Date.now() / 1000) % 5 === 0 && Date.now() % 1000 < 100) {
            console.log(`世界坐标: 高度=${altitude.toFixed(1)}m, 水平=${horizontalPos.toFixed(1)}m, 角度=${steeringAngle.toFixed(1)}°, 缩放=${scale.toFixed(2)}`);
        }
    }
    
    // 更新世界背景（发射台、地面等相对于火箭移动）
    updateWorldBackground(altitude, horizontalPos) {
        const worldBackground = document.getElementById('worldBackground');
        if (!worldBackground) return;
        
        const displayArea = document.getElementById('rocketDisplay');
        if (!displayArea) return;
        
        const displayRect = displayArea.getBoundingClientRect();
        const centerX = displayRect.width / 2;
        const centerY = displayRect.height / 2;
        
        // 计算世界坐标到屏幕坐标的映射
        // 1米 = 2像素的比例
        const pixelsPerMeter = 2;
        
        // 发射台在世界坐标(0, 0)，现在计算它在屏幕上的位置
        const launchPadScreenX = centerX - (horizontalPos * pixelsPerMeter);
        const launchPadScreenY = centerY + (altitude * pixelsPerMeter);
        
        // 更新发射台位置
        this.updateLaunchPad(launchPadScreenX, launchPadScreenY);
        
        // 更新地面和背景
        this.updateGroundAndSky(altitude, horizontalPos, pixelsPerMeter);
    }
    
    // 更新发射台位置
    updateLaunchPad(screenX, screenY) {
        const worldBackground = document.getElementById('worldBackground');
        if (!worldBackground) return;
        
        // 查找或创建发射台元素
        let launchPad = worldBackground.querySelector('.world-launch-pad');
        if (!launchPad) {
            launchPad = document.createElement('div');
            launchPad.className = 'world-launch-pad';
            launchPad.innerHTML = `
                <div class="launch-tower-main"></div>
                <div class="launch-platform"></div>
            `;
            worldBackground.appendChild(launchPad);
        }
        
        // 更新发射台位置
        launchPad.style.position = 'absolute';
        launchPad.style.left = `${screenX}px`;
        launchPad.style.top = `${screenY}px`;
        launchPad.style.transform = 'translate(-50%, -100%)'; // 以底部中心为锚点
        launchPad.style.zIndex = '5';
    }
    
    // 更新地面和天空
    updateGroundAndSky(altitude, horizontalPos, pixelsPerMeter) {
        const worldBackground = document.getElementById('worldBackground');
        if (!worldBackground) return;
        
        const displayArea = document.getElementById('rocketDisplay');
        const displayRect = displayArea.getBoundingClientRect();
        const centerX = displayRect.width / 2;
        const centerY = displayRect.height / 2;
        
        // 地面高度在屏幕上的位置
        const groundScreenY = centerY + (altitude * pixelsPerMeter);
        
        // 查找或创建地面元素
        let ground = worldBackground.querySelector('.world-ground');
        if (!ground) {
            ground = document.createElement('div');
            ground.className = 'world-ground';
            worldBackground.appendChild(ground);
        }
        
        // 更新地面位置和大小
        ground.style.position = 'absolute';
        ground.style.left = '0';
        ground.style.top = `${groundScreenY}px`;
        ground.style.width = '100%';
        ground.style.height = `${Math.max(displayRect.height - groundScreenY + 100, 100)}px`;
        ground.style.zIndex = '1';
        
        // 查找或创建天空渐变元素
        let sky = worldBackground.querySelector('.world-sky');
        if (!sky) {
            sky = document.createElement('div');
            sky.className = 'world-sky';
            worldBackground.appendChild(sky);
        }
        
        // 根据高度调整天空颜色
        const skyColor = this.getSkyColorByAltitude(altitude);
        sky.style.position = 'absolute';
        sky.style.left = '0';
        sky.style.top = '0';
        sky.style.width = '100%';
        sky.style.height = '100%';
        sky.style.background = skyColor;
        sky.style.zIndex = '0';
    }
    
    // 根据高度获取天空颜色
    getSkyColorByAltitude(altitude) {
        if (altitude < 1000) {
            // 低空：蓝天
            return 'linear-gradient(to bottom, #87CEEB 0%, #87CEEB 60%, #90EE90 100%)';
        } else if (altitude < 10000) {
            // 中空：渐变到深蓝
            const ratio = altitude / 10000;
            return `linear-gradient(to bottom, 
                hsl(200, 70%, ${70 - ratio * 30}%) 0%, 
                hsl(200, 60%, ${60 - ratio * 20}%) 60%, 
                #87CEEB ${100 - ratio * 40}%)`;
        } else if (altitude < 50000) {
            // 高空：深蓝到黑色
            const ratio = (altitude - 10000) / 40000;
            return `linear-gradient(to bottom, 
                hsl(220, 50%, ${40 - ratio * 30}%) 0%, 
                hsl(220, 40%, ${30 - ratio * 25}%) 50%, 
                hsl(220, 30%, ${20 - ratio * 15}%) 100%)`;
        } else {
            // 太空：黑色星空
            return 'linear-gradient(to bottom, #000011 0%, #000033 50%, #000011 100%)';
        }
    }
    
    // 停止飞行数据更新循环
    stopFlightDataUpdate() {
        if (this.flightDataUpdateTimer) {
            clearInterval(this.flightDataUpdateTimer);
            this.flightDataUpdateTimer = null;
        }
    }
    
    // 只在需要时更新火箭显示，避免闪烁
    updateRocketDisplayIfNeeded() {
        if (!this.simulation) return;
        
        // 只在这些情况下才重新渲染火箭显示
        const shouldUpdate = 
            this.simulation.crashed !== this.lastCrashedState ||
            this.simulation.landed !== this.lastLandedState ||
            this.simulation.currentStage !== this.lastStageState;
        
        if (shouldUpdate) {
            console.log('火箭状态发生变化，更新显示', {
                crashed: this.simulation.crashed,
                landed: this.simulation.landed,
                currentStage: this.simulation.currentStage,
                separatedParts: this.simulation.separatedPartIds ? this.simulation.separatedPartIds.size : 0
            });
            this.displayRocket();
            
            // 更新状态记录
            this.lastCrashedState = this.simulation.crashed;
            this.lastLandedState = this.simulation.landed;
            this.lastStageState = this.simulation.currentStage;
        }
    }
    
    // 更新实时飞行数据
    updateLiveFlightData() {
        if (!this.simulation) return;
        
        // 更新基础数据
        document.getElementById('altitude').textContent = `${this.simulation.altitude.toFixed(1)} m`;
        document.getElementById('velocity').textContent = `${this.simulation.velocity.toFixed(1)} m/s`;
        document.getElementById('acceleration').textContent = `${this.simulation.acceleration.toFixed(2)} m/s²`;
        document.getElementById('mass').textContent = `${this.simulation.mass.toFixed(2)} t`;
        
        // 更新水平数据
        const horizontalVelocityElement = document.getElementById('horizontalVelocity');
        const horizontalPositionElement = document.getElementById('horizontalPosition');
        if (horizontalVelocityElement) {
            horizontalVelocityElement.textContent = `${this.simulation.horizontalVelocity.toFixed(1)} m/s`;
        }
        if (horizontalPositionElement) {
            horizontalPositionElement.textContent = `${Math.round(this.simulation.horizontalPosition)} m`;
        }
        
        // 计算当前推重比
        const totalThrust = this.simulation.calculateThrust() / 1000; // 转换为kN
        const twr = this.simulation.mass > 0 ? (totalThrust / (this.simulation.mass * 9.81)) : 0;
        document.getElementById('twr').textContent = twr.toFixed(2);
        
        // 计算剩余Delta-V（简化计算）
        const stagingInfo = this.assembly.getStagingInfo();
        const remainingDeltaV = stagingInfo.slice(this.simulation.currentStage).reduce((sum, stage) => sum + stage.deltaV, 0);
        document.getElementById('deltaV').textContent = `${remainingDeltaV.toFixed(0)} m/s`;
        
        // 更新轨道数据
        this.updateOrbitalData();
        
        // 更新当前级燃料显示
        this.updateCurrentStageFuel();
    }
    
    // 更新轨道数据显示
    updateOrbitalData() {
        if (!this.simulation) return;
        
        // 计算总速度
        const totalVelocity = Math.sqrt(
            this.simulation.velocity * this.simulation.velocity + 
            this.simulation.horizontalVelocity * this.simulation.horizontalVelocity
        );
        
        // 计算距地心距离
        const distanceFromCenter = (this.simulation.earthRadius + this.simulation.altitude) / 1000; // 转换为km
        
        // 更新显示
        const totalVelocityElement = document.getElementById('totalVelocity');
        const orbitalStatusElement = document.getElementById('orbitalStatus');
        const distanceFromCenterElement = document.getElementById('distanceFromCenter');
        
        if (totalVelocityElement) {
            totalVelocityElement.textContent = `${totalVelocity.toFixed(1)} m/s`;
        }
        
        if (orbitalStatusElement) {
            if (this.simulation.inOrbit) {
                orbitalStatusElement.textContent = '🛰️ 在轨道';
                orbitalStatusElement.style.color = '#00ff00';
            } else {
                orbitalStatusElement.textContent = '🚀 亚轨道';
                orbitalStatusElement.style.color = '#ffaa00';
            }
        }
        
        if (distanceFromCenterElement) {
            distanceFromCenterElement.textContent = `${distanceFromCenter.toFixed(1)} km`;
        }
    }
    
    // 更新当前级燃料显示
    updateCurrentStageFuel() {
        if (!this.simulation) return;
        
        const currentStageParts = this.assembly.parts.filter(part => 
            this.simulation.isPartInCurrentStage && this.simulation.isPartInCurrentStage(part)
        );
        
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        
        currentStageParts.forEach(part => {
            if (part.fuelStatus) {
                totalLiquidFuel += part.fuelStatus.liquid_fuel || 0;
                totalOxidizer += part.fuelStatus.oxidizer || 0;
            }
        });
        
        if (document.getElementById('liquidFuel')) {
            document.getElementById('liquidFuel').textContent = totalLiquidFuel.toFixed(1);
        }
        if (document.getElementById('oxidizer')) {
            document.getElementById('oxidizer').textContent = totalOxidizer.toFixed(1);
        }
    }

    // 更新分级信息
    updateStagingInfo() {
        const stageList = document.getElementById('stageList');
        if (!stageList) return;

        const stagingInfo = this.assembly.getStagingInfo();
        stageList.innerHTML = '';

        console.log('发射台分级信息:', stagingInfo);

        if (stagingInfo.length === 0) {
            stageList.innerHTML = `<div style="color: #999; text-align: center; padding: 20px;">${window.i18n ? window.i18n.t('launchPad.singleStage') : '单级火箭'}<br>${window.i18n ? window.i18n.t('launchPad.noStagingInfo') : '无分级信息'}</div>`;
            return;
        }

        // 创建一个完整的分级列表，包括最后一级（没有分离器的级）
        const completeStages = [...stagingInfo];
        
        // 如果有分级，最后一级是剩余的所有部件
        if (stagingInfo.length > 0) {
            const lastStageInfo = stagingInfo[stagingInfo.length - 1];
            if (lastStageInfo.upperStage && lastStageInfo.upperStage.length > 0) {
                const finalStageEngines = lastStageInfo.upperStage.filter(p => p.data.type === 'engine');
                const finalStageMass = this.calculateFinalStageMass(lastStageInfo.upperStage);
                
                completeStages.push({
                    stage: stagingInfo.length + 1,
                    decoupler: null,
                    partsCount: lastStageInfo.upperStage.length,
                    mass: finalStageMass,
                    deltaV: 0, // 最后一级的Delta-V需要单独计算
                    engines: finalStageEngines,
                    upperStage: lastStageInfo.upperStage,
                    lowerStage: []
                });
            }
        }

        completeStages.forEach((stage, index) => {
            const stageElement = document.createElement('div');
            stageElement.className = `stage-item ${index === 0 ? 'active' : ''}`;
            stageElement.id = `stage-${index}`;
            
            // 计算引擎数量 - 每级显示其自己的引擎
            const engineCount = stage.engines ? stage.engines.length : 0;
            
            stageElement.innerHTML = `
                <div class="stage-header">
                    <span>${window.i18n ? window.i18n.t('launchPad.stage') : '第'} ${stage.stage} ${window.i18n ? window.i18n.t('launchPad.stageUnit') : '级'}</span>
                    <span>${stage.partsCount} ${window.i18n ? window.i18n.t('launchPad.parts') : '部件'}</span>
                </div>
                <div class="stage-info">
                    <span>${window.i18n ? window.i18n.t('launchPad.mass') : '质量'}: ${stage.mass.toFixed(1)}t</span>
                    <span>ΔV: ${stage.deltaV.toFixed(0)}m/s</span>
                </div>
                <div class="stage-engines">
                    <span>${window.i18n ? window.i18n.t('launchPad.engines') : '引擎'}: ${engineCount}</span>
                    <span>${stage.decoupler ? 
                        (window.i18n ? window.i18n.t('launchPad.withDecoupler') : '有分离器') : 
                        (window.i18n ? window.i18n.t('launchPad.withoutDecoupler') : '无分离器')}</span>
                </div>
            `;
            
            stageList.appendChild(stageElement);
        });
    }

    // 计算最终级的质量
    calculateFinalStageMass(parts) {
        let totalMass = 0;
        parts.forEach(part => {
            totalMass += part.data.mass;
            // 添加燃料质量
            if (part.fuelStatus) {
                totalMass += (part.fuelStatus.liquid_fuel * 0.005) + 
                           (part.fuelStatus.oxidizer * 0.0055);
            }
        });
        return totalMass;
    }

    // 更新控制按钮状态
    updateControlButtons() {
        const launchBtn = document.getElementById('launchBtn');
        const abortBtn = document.getElementById('abortBtn');
        const stageBtn = document.getElementById('stageBtn');

        if (launchBtn) {
            launchBtn.disabled = this.isLaunched || this.countdown >= 0;
            if (this.countdown >= 0) {
                launchBtn.textContent = window.i18n ? window.i18n.t('launchPad.countdownInProgress') : '倒计时中...';
            } else if (this.isLaunched) {
                launchBtn.textContent = window.i18n ? window.i18n.t('launchPad.launched') : '已发射';
            } else {
                launchBtn.textContent = window.i18n ? window.i18n.t('launchPad.igniteAndLaunch') : '点火发射';
            }
        }

        if (stageBtn) {
            stageBtn.disabled = !this.isLaunched;
        }

        if (abortBtn) {
            abortBtn.disabled = !this.isLaunched && this.countdown < 0;
        }
    }

    // 开始发射倒计时
    startCountdown() {
        if (this.countdown >= 0 || this.isLaunched) return;

        this.countdown = 3; // 3秒倒计时
        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');

        if (countdownText) countdownText.textContent = window.i18n ? window.i18n.t('launchPad.launchCountdown') : '发射倒计时';
        
        this.updateControlButtons();

        this.countdownTimer = setInterval(() => {
            if (countdownNumber) {
                countdownNumber.textContent = this.countdown;
            }

            if (this.countdown <= 0) {
                this.executeLaunch();
                return;
            }

            this.countdown--;
        }, 1000);
    }

    // 执行发射
    executeLaunch() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        this.countdown = -1;
        this.isLaunched = true;

        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');

        if (countdownText) countdownText.textContent = window.i18n ? window.i18n.t('launchPad.launch') : '发射！';
        if (countdownNumber) countdownNumber.textContent = '🚀';

        // 启动物理模拟
        this.simulation = new LaunchSimulation(this.assembly);
        this.simulation.setThrottle(this.throttle / 100); // 设置初始节流阀值
        this.simulation.start();

        // 初始化状态跟踪变量
        this.lastCrashedState = false;
        this.lastLandedState = false;
        this.lastStageState = 0;

        // 启动飞行数据更新循环
        this.startFlightDataUpdate();

        this.updateControlButtons();

        setTimeout(() => {
            if (countdownText) countdownText.textContent = window.i18n ? window.i18n.t('launchPad.status.flying') : '飞行中';
            if (countdownNumber) countdownNumber.textContent = '';
        }, 3000);
    }

    // 中止发射
    abortLaunch() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        // 停止飞行数据更新
        this.stopFlightDataUpdate();

        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        this.countdown = -1;
        this.isLaunched = false;

        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');

        if (countdownText) countdownText.textContent = '任务中止';
        if (countdownNumber) countdownNumber.textContent = '⚠️';

        this.updateControlButtons();

        setTimeout(() => {
            if (countdownText) countdownText.textContent = '准备发射';
            if (countdownNumber) countdownNumber.textContent = '';
        }, 3000);
    }

    // 显示错误信息
    showError(message) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 2em; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 1.2em; color: #ff6666; margin-bottom: 20px;">${message}</div>
                    <button onclick="goBackToAssembly()" style="
                        padding: 10px 20px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1em;
                    ">返回装配厂</button>
                </div>
            `;
            loadingOverlay.style.display = 'flex';
        }
    }

    // 隐藏加载覆盖层
    hideLoading() {
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }, 1000); // 1秒后隐藏
    }
    
    // ========== 节流阀控制功能 ==========
    
    // 初始化节流阀控制
    initializeThrottleControl() {
        this.throttleSlider = document.getElementById('throttleSliderHorizontal');
        this.throttleFill = document.getElementById('throttleFill');
        this.throttleHandle = document.getElementById('throttleHandle');
        
        if (!this.throttleSlider || !this.throttleFill || !this.throttleHandle) {
            console.log('节流阀控制元素未找到，跳过初始化');
            return;
        }
        
        // 绑定鼠标事件
        this.throttleSlider.addEventListener('mousedown', this.handleThrottleSliderClick.bind(this));
        this.throttleHandle.addEventListener('mousedown', this.handleThrottleHandleDrag.bind(this));
        
        // 绑定全局鼠标事件（用于拖拽）
        document.addEventListener('mousemove', this.handleThrottleDrag.bind(this));
        document.addEventListener('mouseup', this.handleThrottleDragEnd.bind(this));
    }
    
    // 初始化键盘控制
    initializeKeyboardControls() {
        // 绑定键盘快捷键
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // 防止页面失去焦点时的问题
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.clearKeyStates();
            }
        });
        
        // 初始化显示
        this.updateThrottleDisplay();
    }
    
    // 处理节流阀滑杆点击
    handleThrottleSliderClick(event) {
        if (this.isDraggingThrottle) return;
        
        const rect = this.throttleSlider.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
        
        this.setThrottle(percentage);
    }
    
    // 处理节流阀手柄拖拽开始
    handleThrottleHandleDrag(event) {
        event.preventDefault();
        this.isDraggingThrottle = true;
        this.throttleHandle.style.cursor = 'grabbing';
        
        // 防止文本选择
        document.body.style.userSelect = 'none';
    }
    
    // 处理节流阀拖拽
    handleThrottleDrag(event) {
        if (!this.isDraggingThrottle) return;
        
        const rect = this.throttleSlider.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (mouseX / rect.width) * 100));
        
        this.setThrottle(percentage);
    }
    
    // 处理节流阀拖拽结束
    handleThrottleDragEnd() {
        if (this.isDraggingThrottle) {
            this.isDraggingThrottle = false;
            this.throttleHandle.style.cursor = 'grab';
            document.body.style.userSelect = '';
        }
    }
    
    // 处理按键按下事件
    handleKeyDown(event) {
        // 忽略在输入框中的按键
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // 防止重复触发
        if (event.repeat) {
            return;
        }
        
        const key = event.key.toLowerCase();
        let handled = false;
        
        // 更新按键状态
        switch (key) {
            case 'a':
                this.keyStates.a = true;
                handled = true;
                break;
            case 'd':
                this.keyStates.d = true;
                handled = true;
                break;
            case 'shift':
                this.keyStates.shift = true;
                handled = true;
                break;
            case 'control':
                this.keyStates.ctrl = true;
                handled = true;
                break;
            // 一次性按键（保持原有功能）
            case 'z':
                // Z键：最大节流阀
                this.setThrottle(100);
                handled = true;
                break;
            case 'x':
                // X键：关闭节流阀
                this.setThrottle(0);
                handled = true;
                break;
            case 's':
                // S键：重置转向
                if (this.simulation && this.simulation.isRunning) {
                    this.simulation.resetSteering();
                }
                handled = true;
                break;
        }
        
        if (handled) {
            event.preventDefault();
            
            // 启动连续输入处理
            if (!this.keyInputTimer) {
                this.startContinuousInput();
            }
        }
    }
    
    // 处理按键释放事件
    handleKeyUp(event) {
        // 忽略在输入框中的按键
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const key = event.key.toLowerCase();
        let handled = false;
        
        // 更新按键状态
        switch (key) {
            case 'a':
                this.keyStates.a = false;
                handled = true;
                break;
            case 'd':
                this.keyStates.d = false;
                handled = true;
                break;
            case 'shift':
                this.keyStates.shift = false;
                handled = true;
                break;
            case 'control':
                this.keyStates.ctrl = false;
                handled = true;
                break;
        }
        
        if (handled) {
            event.preventDefault();
            
            // 检查是否还有按键按下，如果没有则停止连续输入
            const hasActiveKeys = Object.values(this.keyStates).some(state => state);
            if (!hasActiveKeys && this.keyInputTimer) {
                this.stopContinuousInput();
            }
        }
    }
    
    // 启动连续输入处理
    startContinuousInput() {
        this.keyInputTimer = setInterval(() => {
            this.processContinuousInput();
        }, 50); // 每50ms处理一次，提供流畅的控制
    }
    
    // 停止连续输入处理
    stopContinuousInput() {
        if (this.keyInputTimer) {
            clearInterval(this.keyInputTimer);
            this.keyInputTimer = null;
        }
    }
    
    // 处理连续输入
    processContinuousInput() {
        // 转向控制
        if (this.simulation && this.simulation.isRunning) {
            if (this.keyStates.a) {
                this.simulation.steerLeft();
            }
            if (this.keyStates.d) {
                this.simulation.steerRight();
            }
        }
        
        // 节流阀控制
        if (this.keyStates.shift && !this.keyStates.ctrl) {
            // Shift键：增加节流阀
            this.setThrottle(Math.min(100, this.throttle + 1));
        } else if (this.keyStates.ctrl && !this.keyStates.shift) {
            // Ctrl键：减少节流阀
            this.setThrottle(Math.max(0, this.throttle - 1));
        }
    }
    
    // 设置节流阀值
    setThrottle(percentage) {
        this.throttle = Math.max(0, Math.min(100, percentage));
        this.updateThrottleDisplay();
        this.updateEngineStatus();
        this.updatePresetButtons();
        
        // 如果正在飞行，更新推力
        if (this.simulation && this.simulation.isRunning) {
            this.simulation.setThrottle(this.throttle / 100);
        }
    }
    
    // 更新节流阀显示
    updateThrottleDisplay() {
        if (!this.throttleFill || !this.throttleHandle) return;
        
        const percentage = this.throttle;
        
        // 更新填充条（水平）
        this.throttleFill.style.width = `${percentage}%`;
        
        // 更新手柄位置（水平）
        this.throttleHandle.style.left = `${percentage}%`;
        
        // 更新百分比文本
        const throttlePercentageElement = document.getElementById('throttlePercentage');
        if (throttlePercentageElement) {
            throttlePercentageElement.textContent = `${Math.round(percentage)}%`;
        }
    }
    
    // 更新引擎状态显示
    updateEngineStatus() {
        if (!this.assembly) return;
        
        const engines = this.assembly.parts.filter(part => part.data.type === 'engine');
        const activeEngineCount = engines.length;
        const totalThrust = engines.reduce((sum, engine) => {
            return sum + (engine.data.thrust || 0) * (this.throttle / 100);
        }, 0);
        
        // 更新活跃引擎数量
        const activeEngineCountElement = document.getElementById('activeEngineCount');
        if (activeEngineCountElement) {
            activeEngineCountElement.textContent = activeEngineCount.toString();
        }
        
        // 更新当前推力
        const currentThrustElement = document.getElementById('currentThrust');
        if (currentThrustElement) {
            currentThrustElement.textContent = `${Math.round(totalThrust)} kN`;
        }
    }
    
    // 更新预设按钮状态
    updatePresetButtons() {
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(button => {
            const preset = parseInt(button.textContent);
            if (Math.abs(this.throttle - preset) < 1) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    // 获取当前推力比
    getCurrentTWR() {
        if (!this.assembly) return 0;
        
        const engines = this.assembly.parts.filter(part => part.data.type === 'engine');
        const totalThrust = engines.reduce((sum, engine) => {
            return sum + (engine.data.thrust || 0) * (this.throttle / 100);
        }, 0) * 1000; // 转换为牛顿
        
        const totalMass = this.assembly.getTotalMass() * 1000; // 转换为千克
        const weight = totalMass * 9.81; // 重力
        
        return totalThrust / weight;
    }
    
    // 检测触屏支持
    detectTouchSupport() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }
    
    // 初始化触屏控制
    initializeTouchControls() {
        const touchPanel = document.getElementById('touchControlPanel');
        const touchControlButtons = document.getElementById('touchControlButtons');
        
        if (touchPanel) {
            touchPanel.classList.add('active');
        }
        
        if (touchControlButtons) {
            touchControlButtons.classList.add('active');
        }
        
        // 初始化转向控制
        this.initializeTouchSteering();
        
        // 初始化节流阀控制
        this.initializeTouchThrottle();
        
        // 初始化主要控制按钮
        this.initializeTouchMainControls();
        
        // 初始化右上角按钮组
        this.initializeTouchTopButtons();
    }
    
    // 初始化触屏转向控制
    initializeTouchSteering() {
        const steeringPad = document.getElementById('touchSteeringPad');
        const steeringIndicator = document.getElementById('touchSteeringIndicator');
        
        if (!steeringPad || !steeringIndicator) return;
        
        let startX = 0, startY = 0;
        let padRect = null;
        
        const handleTouchStart = (e) => {
            e.preventDefault();
            this.touchSteeringActive = true;
            padRect = steeringPad.getBoundingClientRect();
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        };
        
        const handleTouchMove = (e) => {
            if (!this.touchSteeringActive || !padRect) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const centerX = padRect.left + padRect.width / 2;
            const centerY = padRect.top + padRect.height / 2;
            
            const deltaX = touch.clientX - centerX;
            const deltaY = touch.clientY - centerY;
            
            const maxRadius = padRect.width / 2 - 15;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            let finalX = deltaX;
            let finalY = deltaY;
            
            if (distance > maxRadius) {
                finalX = (deltaX / distance) * maxRadius;
                finalY = (deltaY / distance) * maxRadius;
            }
            
            // 计算转向角度（只考虑水平方向）
            const angle = Math.max(-45, Math.min(45, (finalX / maxRadius) * 45));
            
            // 更新指示器位置
            steeringIndicator.style.transform = `translate(-50%, -50%) translate(${finalX}px, ${finalY}px)`;
            
            // 更新角度显示
            document.getElementById('touchSteeringAngle').textContent = `${Math.round(angle)}°`;
            
            // 应用转向
            if (this.simulation && this.simulation.isRunning) {
                this.simulation.setSteering(angle);
            }
        };
        
        const handleTouchEnd = (e) => {
            e.preventDefault();
            this.touchSteeringActive = false;
            
            // 回弹到中心
            steeringIndicator.style.transform = 'translate(-50%, -50%)';
            document.getElementById('touchSteeringAngle').textContent = '0°';
            
            // 重置转向
            if (this.simulation && this.simulation.isRunning) {
                this.simulation.setSteering(0);
            }
        };
        
        steeringPad.addEventListener('touchstart', handleTouchStart, { passive: false });
        steeringPad.addEventListener('touchmove', handleTouchMove, { passive: false });
        steeringPad.addEventListener('touchend', handleTouchEnd, { passive: false });
        steeringPad.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
    
    // 初始化触屏节流阀控制
    initializeTouchThrottle() {
        const throttleSlider = document.getElementById('touchThrottleSlider');
        const throttleHandle = document.getElementById('touchThrottleHandle');
        const throttleFill = document.getElementById('touchThrottleFill');
        
        if (!throttleSlider || !throttleHandle || !throttleFill) return;
        
        const handleTouchStart = (e) => {
            e.preventDefault();
            this.touchThrottleDragging = true;
        };
        
        const handleTouchMove = (e) => {
            if (!this.touchThrottleDragging) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const rect = throttleSlider.getBoundingClientRect();
            const y = touch.clientY - rect.top;
            const percentage = Math.max(0, Math.min(100, (1 - y / rect.height) * 100));
            
            this.updateTouchThrottle(percentage);
        };
        
        const handleTouchEnd = (e) => {
            e.preventDefault();
            this.touchThrottleDragging = false;
        };
        
        throttleSlider.addEventListener('touchstart', handleTouchStart, { passive: false });
        throttleSlider.addEventListener('touchmove', handleTouchMove, { passive: false });
        throttleSlider.addEventListener('touchend', handleTouchEnd, { passive: false });
        throttleSlider.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
    
    // 更新触屏节流阀显示
    updateTouchThrottle(percentage) {
        this.setThrottle(percentage);
        
        const throttleHandle = document.getElementById('touchThrottleHandle');
        const throttleFill = document.getElementById('touchThrottleFill');
        const throttleValue = document.getElementById('touchThrottleValue');
        
        if (throttleHandle) {
            throttleHandle.style.bottom = `${percentage}%`;
        }
        
        if (throttleFill) {
            throttleFill.style.height = `${percentage}%`;
        }
        
        if (throttleValue) {
            throttleValue.textContent = `${Math.round(percentage)}%`;
        }
    }
    
    // 初始化触屏主要控制按钮
    initializeTouchMainControls() {
        const launchBtn = document.getElementById('touchLaunchBtn');
        const stageBtn = document.getElementById('touchStageBtn');
        const abortBtn = document.getElementById('touchAbortBtn');
        
        if (launchBtn) {
            launchBtn.addEventListener('click', () => {
                startLaunch();
            });
        }
        
        if (stageBtn) {
            stageBtn.addEventListener('click', () => {
                activateNextStage();
            });
        }
        
        if (abortBtn) {
            abortBtn.addEventListener('click', () => {
                abortLaunch();
            });
        }
    }
    
    // 初始化右上角按钮组
    initializeTouchTopButtons() {
        const launchBtn = document.getElementById('touchLaunchBtn');
        const stageBtn = document.getElementById('touchStageBtn');
        const abortBtn = document.getElementById('touchAbortBtn');
        
        // 由于HTML结构改变，这些按钮现在在右上角按钮组中
        // 事件监听器逻辑保持不变，因为ID相同
        if (launchBtn) {
            launchBtn.addEventListener('click', () => {
                startLaunch();
            });
            launchBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                launchBtn.style.transform = 'scale(0.95)';
            });
            launchBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                launchBtn.style.transform = 'scale(1)';
            });
        }
        
        if (stageBtn) {
            stageBtn.addEventListener('click', () => {
                activateNextStage();
            });
            stageBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                stageBtn.style.transform = 'scale(0.95)';
            });
            stageBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                stageBtn.style.transform = 'scale(1)';
            });
        }
        
        if (abortBtn) {
            abortBtn.addEventListener('click', () => {
                abortLaunch();
            });
            abortBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                abortBtn.style.transform = 'scale(0.95)';
            });
            abortBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                abortBtn.style.transform = 'scale(1)';
            });
        }
    }
}

// 全局节流阀控制函数
function setThrottle(percentage) {
    if (window.launchPad) {
        window.launchPad.setThrottle(percentage);
    }
}

function goBackToAssembly() {
    window.location.href = 'rocket-builder.html';
}

function startLaunch() {
    if (window.launchPad) {
        window.launchPad.startCountdown();
    }
}

function abortLaunch() {
    if (window.launchPad) {
        window.launchPad.abortLaunch();
    }
}

function activateNextStage() {
    if (window.launchPad && window.launchPad.simulation) {
        const success = window.launchPad.simulation.activateNextStage();
        
        if (!success) {
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('launchPad.notifications.staging.failed') : '分级失败';
                const message = window.i18n ? window.i18n.t('launchPad.notifications.staging.noMoreStages') : '没有更多级可分离';
                showNotification(title, message, 'warning');
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            const title = window.i18n ? window.i18n.t('launchPad.notifications.staging.failed') : '分级失败';
            const message = window.i18n ? window.i18n.t('launchPad.notifications.staging.notLaunched') : '火箭尚未发射';
            showNotification(title, message, 'warning');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.launchPad = new LaunchPad();
});

// 监听 i18n 准备就绪事件
document.addEventListener('i18nReady', function() {
    if (window.launchPad) {
        // 在 i18n 系统准备好后更新所有动态内容
        setTimeout(() => {
            window.launchPad.updateStagingInfo();
            window.launchPad.updateControlButtons();
            // 更新火箭名称显示
            const rocketNameElement = document.getElementById('rocketName');
            if (rocketNameElement && window.launchPad.assembly) {
                rocketNameElement.textContent = window.launchPad.assembly.name || 
                    (window.i18n ? window.i18n.t('rocketBuilder.infoPanel.unnamed') : '未命名载具');
            }
        }, 100); // 短暂延迟确保 DOM 更新完成
    }
});

// 监听语言变更事件，更新动态内容
window.addEventListener('languageChanged', function() {
    if (window.launchPad) {
        // 更新分级信息显示
        window.launchPad.updateStagingInfo();
        // 更新控制按钮文本
        window.launchPad.updateControlButtons();
        // 更新火箭名称显示
        const rocketNameElement = document.getElementById('rocketName');
        if (rocketNameElement && window.launchPad.assembly) {
            rocketNameElement.textContent = window.launchPad.assembly.name || 
                (window.i18n ? window.i18n.t('rocketBuilder.infoPanel.unnamed') : '未命名载具');
        }
    }
});

// 导出供其他模块使用
window.LaunchPad = LaunchPad;
