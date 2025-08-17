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
        
        // 地图视图状态
        this.mapViewActive = false;
        
        // 时间加速
        this.timeAcceleration = 1;
        this.allowedTimeAccelerations = [1, 5, 10, 50, 100, 1000];
        
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
         
        // 初始化导航条（设置初始状态）
        this.updateNavigationPointer();

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
                // 更新地图视图（如果开启）
                this.updateMapView();
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
        
        // 更新实时数据
        document.getElementById('altitude').textContent = `${this.simulation.altitude.toFixed(1)} m`;
        document.getElementById('velocity').textContent = `${this.simulation.velocity.toFixed(1)} m/s`;
        document.getElementById('acceleration').textContent = `${this.simulation.acceleration.toFixed(2)} m/s²`;
        document.getElementById('mass').textContent = `${this.simulation.mass.toFixed(2)} t`;
        
        // 计算当前推重比
        const totalThrust = this.simulation.calculateThrust() / 1000; // 转换为kN
        const twr = this.simulation.mass > 0 ? (totalThrust / (this.simulation.mass * 9.81)) : 0;
        document.getElementById('twr').textContent = twr.toFixed(2);
        
        // 计算剩余Delta-V（简化计算）
        const stagingInfo = this.assembly.getStagingInfo();
        const remainingDeltaV = stagingInfo.slice(this.simulation.currentStage).reduce((sum, stage) => sum + stage.deltaV, 0);
        document.getElementById('deltaV').textContent = `${remainingDeltaV.toFixed(0)} m/s`;
        
        // 更新当前级燃料显示
        this.updateCurrentStageFuel();
        // 更新导航条指针位置（以当前朝向为中心）
        this.updateNavigationPointer();
    }
        // 更新导航条指针位置（以当前朝向为中心）
    updateNavigationPointer() {
        const navPointer = document.getElementById('navPointer');
        const navCenter = document.querySelector('.nav-center');
        const navLabels = document.querySelector('.nav-labels');
        const navGuidance = document.getElementById('navGuidance');
        const navHint = document.getElementById('navHint');
        
        if (!navPointer || !navCenter || !navLabels) return;
        
        // 获取当前转向角度（相对于垂直向上）
        const currentAngle = this.simulation ? (this.simulation.steeringAngle || 0) : 0;
        
        // 导航条的范围设为 ±45° 
        const maxAngle = 45;
        const navBarWidth = 80; // 导航条宽度（像素）
        
        // 计算指针位置（以当前朝向为中心）
        // 当前朝向在导航条中心，左右各显示45°范围
        const angleOffset = 0; // 当前朝向始终在中心
        const pixelOffset = (angleOffset / maxAngle) * (navBarWidth / 2);
        const pointerPosition = 50 + (pixelOffset / navBarWidth) * 100; // 转换为百分比
        
        // 限制指针位置在导航条范围内
        const clampedPosition = Math.max(0, Math.min(100, pointerPosition));
        
        // 更新指针位置
        navPointer.style.left = `${clampedPosition}%`;

        // 更新标签以反映当前朝向
        const leftAngle = currentAngle - maxAngle;
        const rightAngle = currentAngle + maxAngle;
        const centerAngle = currentAngle;
        
        // 标准化角度到 0-360 范围
        const normalizeAngle = (angle) => {
            while (angle >= 360) angle -= 360;
            while (angle < 0) angle += 360;
            return angle;
        };
        
        const leftLabel = navLabels.querySelector('.nav-label.left');
        const centerLabel = navLabels.querySelector('.nav-label.center');
        const rightLabel = navLabels.querySelector('.nav-label.right');
        
        if (leftLabel && centerLabel && rightLabel) {
            leftLabel.textContent = `${normalizeAngle(leftAngle).toFixed(0)}°`;
            centerLabel.textContent = `${normalizeAngle(centerAngle).toFixed(0)}°`;
            rightLabel.textContent = `${normalizeAngle(rightAngle).toFixed(0)}°`;
        }
        
        // 更新中心标记的颜色，让它更明显地表示当前朝向
        if (navCenter) {
            navCenter.style.background = currentAngle === 0 ? '#00ff00' : '#ffaa00';
            navCenter.style.boxShadow = `0 0 8px ${currentAngle === 0 ? '#00ff00' : '#ffaa00'}`;
        }
        
        // 添加速度方向标记
        this.updateVelocityDirection(maxAngle, navBarWidth, currentAngle);
    }
    
    // 更新速度方向标记
    updateVelocityDirection(maxAngle, navBarWidth, currentAngle) {
        let velocityMarker = document.getElementById('velocityMarker');
        const navBar = document.querySelector('.nav-bar');
        
        if (!navBar) return;
        
        // 如果速度标记不存在则创建
        if (!velocityMarker) {
            velocityMarker = document.createElement('div');
            velocityMarker.id = 'velocityMarker';
            velocityMarker.style.cssText = `
                position: absolute;
                top: -2px;
                width: 3px;
                height: calc(100% + 4px);
                background: #00ff00;
                z-index: 15;
                border-radius: 1px;
                box-shadow: 0 0 4px #00ff00;
                transition: left 0.1s ease;
                pointer-events: none;
            `;
            navBar.appendChild(velocityMarker);
        }
        
        // 计算速度方向
        if (this.simulation && this.simulation.isRunning) {
            const vr = this.simulation.radialVelocity || 0;
            const vt = (this.simulation.radialDistance * this.simulation.angularVelocity) || 0;
            
            // 计算速度矢量的角度（相对于垂直向上）
            let velocityAngle = Math.atan2(vt, vr) * 180 / Math.PI;
            
            // 将速度角度转换为相对于当前朝向的偏移
            let angleOffset = velocityAngle - currentAngle;
            
            // 标准化角度偏移到 ±180 范围
            while (angleOffset > 180) angleOffset -= 360;
            while (angleOffset < -180) angleOffset += 360;
            
            // 检查速度方向是否在导航条显示范围内
            if (Math.abs(angleOffset) <= maxAngle) {
                const pixelOffset = (angleOffset / maxAngle) * (navBarWidth / 2);
                const markerPosition = 50 + (pixelOffset / navBarWidth) * 100;
                const clampedPosition = Math.max(0, Math.min(100, markerPosition));
                
                velocityMarker.style.left = `${clampedPosition}%`;
                velocityMarker.style.display = 'block';
                
                // 添加工具提示
                velocityMarker.title = `速度方向: ${normalizeAngle(velocityAngle).toFixed(1)}°`;
            } else {
                // 速度方向超出显示范围，隐藏标记
                velocityMarker.style.display = 'none';
            }
        } else {
            // 未发射时隐藏速度标记
            velocityMarker.style.display = 'none';
        }
        
        // 标准化角度函数（本地版本）
        function normalizeAngle(angle) {
            while (angle >= 360) angle -= 360;
            while (angle < 0) angle += 360;
            return angle;
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
            case 'm':
                // M键：切换地图视图
                this.toggleMapView();
                handled = true;
                break;
            case '1':
                // 1键：×1 时间加速
                this.setTimeAcceleration(1);
                handled = true;
                break;
            case '2':
                // 2键：×5 时间加速
                this.setTimeAcceleration(5);
                handled = true;
                break;
            case '3':
                // 3键：×10 时间加速
                this.setTimeAcceleration(10);
                handled = true;
                break;
            case '4':
                // 4键：×50 时间加速
                this.setTimeAcceleration(50);
                handled = true;
                break;
            case '5':
                // 5键：×100 时间加速
                this.setTimeAcceleration(100);
                handled = true;
                break;
            case '6':
                // 6键：×1000 时间加速
                this.setTimeAcceleration(1000);
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
    
    // 切换地图视图
    toggleMapView() {
        this.mapViewActive = !this.mapViewActive;
        
        const mapOverlay = document.getElementById('mapOverlay');
        
        if (this.mapViewActive) {
            // 显示地图
            this.showMapView();
        } else {
            // 隐藏地图
            if (mapOverlay) {
                mapOverlay.style.display = 'none';
            }
        }
        
        console.log(`地图视图 ${this.mapViewActive ? '已开启' : '已关闭'}`);
    }
    
    // 显示地图视图
    showMapView() {
        // 创建或获取地图覆盖层
        let mapOverlay = document.getElementById('mapOverlay');
        if (!mapOverlay) {
            mapOverlay = this.createMapOverlay();
        }
        
        // 重置轨迹历史
        this.trajectoryHistory = [];
        
        mapOverlay.style.display = 'flex';
        this.updateMapView();
    }
    
    // 创建地图覆盖层
    createMapOverlay() {
        const mapOverlay = document.createElement('div');
        mapOverlay.id = 'mapOverlay';
        mapOverlay.className = 'map-overlay';
        
        mapOverlay.innerHTML = `
            <div class="map-container">
                <div class="map-header">
                    <h3>轨道地图</h3>
                    <button class="map-close-btn" onclick="launchPad.toggleMapView()">×</button>
                </div>
                <div class="map-content">
                    <svg id="mapSvg" viewBox="-400 -400 800 800">
                        <!-- 地球 -->
                        <circle cx="0" cy="0" r="100" fill="#4CAF50" stroke="#2E7D32" stroke-width="2"/>
                        <circle cx="0" cy="0" r="100" fill="url(#earthGradient)" opacity="0.8"/>
                        
                        <!-- 大气层 -->
                        <circle cx="0" cy="0" r="120" fill="none" stroke="#87CEEB" stroke-width="1" opacity="0.5"/>
                        
                        <!-- 轨道参考线 -->
                        <circle cx="0" cy="0" r="150" fill="none" stroke="#FFF" stroke-width="1" opacity="0.3" stroke-dasharray="5,5"/>
                        <circle cx="0" cy="0" r="200" fill="none" stroke="#FFF" stroke-width="1" opacity="0.3" stroke-dasharray="5,5"/>
                        <circle cx="0" cy="0" r="250" fill="none" stroke="#FFF" stroke-width="1" opacity="0.3" stroke-dasharray="5,5"/>
                        
                        <!-- 轨道路径预测（绿色） -->
                        <path id="orbitPath" fill="none" stroke="#00FF00" stroke-width="2" opacity="0.8"/>
                        
                        <!-- 火箭轨迹历史（淡蓝色） -->
                        <path id="trajectoryPath" fill="none" stroke="#40E0D0" stroke-width="1.5" opacity="0.6"/>
                        
                        <!-- 火箭位置 -->
                        <circle id="rocketMarker" cx="0" cy="-100" r="4" fill="#FF4444" stroke="#FFF" stroke-width="2"/>
                        <text id="rocketLabel" x="5" y="-95" fill="#FFF" font-size="12">🚀</text>
                        
                        <!-- 渐变定义 -->
                        <defs>
                            <radialGradient id="earthGradient" cx="30%" cy="30%">
                                <stop offset="0%" stop-color="#81C784"/>
                                <stop offset="50%" stop-color="#4CAF50"/>
                                <stop offset="100%" stop-color="#2E7D32"/>
                            </radialGradient>
                        </defs>
                    </svg>
                </div>
                <div class="map-info">
                    <div class="map-data">
                        <span>高度: <span id="mapAltitude">0 km</span></span>
                        <span>速度: <span id="mapVelocity">0 m/s</span></span>
                        <span>角度: <span id="mapAngle">0°</span></span>
                    </div>
                    <div class="map-hint">按 M 键关闭地图 | 鼠标滚轮缩放</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(mapOverlay);
        
        // 添加缩放功能
        this.setupMapZoom();
        
        return mapOverlay;
    }
    
    // 设置地图缩放功能
    setupMapZoom() {
        this.mapZoomLevel = 1.0;
        this.trajectoryHistory = []; // 轨迹历史记录
        
        const mapSvg = document.getElementById('mapSvg');
        if (!mapSvg) return;
        
        mapSvg.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.mapZoomLevel *= delta;
            
            // 限制缩放范围
            this.mapZoomLevel = Math.max(0.3, Math.min(5.0, this.mapZoomLevel));
            
            // 更新视图框
            const baseSize = 400;
            const size = baseSize / this.mapZoomLevel;
            mapSvg.setAttribute('viewBox', `-${size} -${size} ${size * 2} ${size * 2}`);
            
            console.log(`地图缩放: ${(this.mapZoomLevel * 100).toFixed(0)}%`);
        });
    }
    
    // 更新地图视图
    updateMapView() {
        if (!this.mapViewActive || !this.simulation) return;
        
        const rocketMarker = document.getElementById('rocketMarker');
        const rocketLabel = document.getElementById('rocketLabel');
        const mapAltitude = document.getElementById('mapAltitude');
        const mapVelocity = document.getElementById('mapVelocity');
        const mapAngle = document.getElementById('mapAngle');
        const orbitPath = document.getElementById('orbitPath');
        const trajectoryPath = document.getElementById('trajectoryPath');
        
        if (!rocketMarker) return;
        
        // 计算火箭在地图上的位置
        const earthRadius = 100; // 地图上地球的半径（像素）
        const scale = earthRadius / (this.simulation.earthRadius / 1000); // km per pixel
        
        // 火箭距离地心的距离（地图像素）
        const rocketRadius = earthRadius + (this.simulation.altitude / 1000) * scale;
        
        // 火箭的角位置
        const angle = this.simulation.angularPosition || 0;
        
        // 计算火箭在地图上的坐标
        const rocketX = rocketRadius * Math.sin(angle);
        const rocketY = -rocketRadius * Math.cos(angle); // Y轴向上为负
        
        // 更新火箭位置
        rocketMarker.setAttribute('cx', rocketX);
        rocketMarker.setAttribute('cy', rocketY);
        rocketLabel.setAttribute('x', rocketX + 5);
        rocketLabel.setAttribute('y', rocketY - 5);
        
        // 记录轨迹历史
        if (this.trajectoryHistory) {
            this.trajectoryHistory.push({x: rocketX, y: rocketY, time: Date.now()});
            
            // 限制历史记录长度（保留最近500个点）
            if (this.trajectoryHistory.length > 500) {
                this.trajectoryHistory = this.trajectoryHistory.slice(-500);
            }
            
            // 绘制轨迹历史
            this.drawTrajectoryHistory(trajectoryPath);
        }
        
        // 更新信息显示
        if (mapAltitude) mapAltitude.textContent = `${(this.simulation.altitude / 1000).toFixed(1)} km`;
        if (mapVelocity) {
            const totalVelocity = Math.sqrt(
                this.simulation.radialVelocity * this.simulation.radialVelocity + 
                (this.simulation.radialDistance * this.simulation.angularVelocity) * (this.simulation.radialDistance * this.simulation.angularVelocity)
            );
            mapVelocity.textContent = `${totalVelocity.toFixed(0)} m/s`;
        }
        if (mapAngle) mapAngle.textContent = `${(angle * 180 / Math.PI).toFixed(1)}°`;
        
        // 绘制轨道路径预测（绿色）
        if (orbitPath && this.simulation.orbitalData) {
            this.drawOrbitPrediction(orbitPath, earthRadius, scale, rocketX, rocketY);
        }
    }
    
    // 绘制轨迹历史
    drawTrajectoryHistory(pathElement) {
        if (!this.trajectoryHistory || this.trajectoryHistory.length < 2) return;
        
        let pathD = '';
        this.trajectoryHistory.forEach((point, index) => {
            if (index === 0) {
                pathD += `M ${point.x} ${point.y}`;
            } else {
                pathD += ` L ${point.x} ${point.y}`;
            }
        });
        
        pathElement.setAttribute('d', pathD);
    }
    
    // 绘制轨道预测路径（绿色）
    drawOrbitPrediction(pathElement, earthRadius, scale, currentX, currentY) {
        if (!this.simulation.orbitalData) {
            pathElement.setAttribute('d', '');
            return;
        }
        
        const data = this.simulation.orbitalData;
        
        // 只有在轨道状态下才显示预测路径
        if (!data.isInOrbit && this.simulation.altitude < 100000) {
            // 低空时绘制抛物线轨迹
            this.drawTrajectoryPrediction(pathElement, earthRadius, scale, currentX, currentY);
            return;
        }
        
        // 计算轨道参数
        const r = this.simulation.radialDistance;
        const vr = this.simulation.radialVelocity;
        const vt = this.simulation.radialDistance * this.simulation.angularVelocity;
        
        // 计算轨道能量和角动量
        const GM = this.simulation.earthMass * this.simulation.gravitationalConstant;
        const specificEnergy = (vr * vr + vt * vt) / 2 - GM / r;
        const angularMomentum = r * vt;
        
        // 计算半长轴
        const semiMajorAxis = -GM / (2 * specificEnergy);
        
        // 计算离心率
        const eccentricity = Math.sqrt(1 + (2 * specificEnergy * angularMomentum * angularMomentum) / (GM * GM));
        
        // 限制离心率防止极端情况
        const e = Math.min(eccentricity, 0.98);
        
        if (semiMajorAxis > 0 && e < 1) {
            // 椭圆轨道
            this.drawEllipticalOrbit(pathElement, semiMajorAxis, e, earthRadius, scale);
        } else {
            // 双曲线轨道或抛物线轨道
            this.drawHyperbolicTrajectory(pathElement, earthRadius, scale, currentX, currentY);
        }
    }
    
    // 绘制椭圆轨道
    drawEllipticalOrbit(pathElement, semiMajorAxis, eccentricity, earthRadius, scale) {
        // 使用当前位置和速度，通过物理积分绘制真实轨道
        const GM = this.simulation.earthMass * this.simulation.gravitationalConstant;
        
        // 当前状态
        let r = this.simulation.radialDistance;
        let theta = this.simulation.angularPosition;
        let vr = this.simulation.radialVelocity;
        let vtheta = this.simulation.radialDistance * this.simulation.angularVelocity;
        
        // 保存初始状态
        const initialTheta = theta;
        
        let pathD = '';
        const maxSteps = 200;
        const dt = 50; // 50秒步长
        
        for (let i = 0; i <= maxSteps; i++) {
            // 转换到地图坐标
            const mapR = r / 1000 * scale;
            const x = mapR * Math.sin(theta);
            const y = -mapR * Math.cos(theta);
            
            if (i === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                pathD += ` L ${x} ${y}`;
            }
            
            // 检查是否完成一圈轨道
            if (i > 20 && Math.abs(theta - initialTheta - 2 * Math.PI) < 0.5) {
                // 轨道闭合，连接到起点
                const mapR0 = this.simulation.radialDistance / 1000 * scale;
                const x0 = mapR0 * Math.sin(initialTheta);
                const y0 = -mapR0 * Math.cos(initialTheta);
                pathD += ` L ${x0} ${y0}`;
                break;
            }
            
            // 物理积分
            if (i < maxSteps) {
                // 计算重力加速度
                const gravity = GM / (r * r);
                const ar = vtheta * vtheta / r - gravity; // 径向加速度（包含离心力）
                const atheta = -2 * vr * vtheta / r; // 切向加速度（科里奥利效应）
                
                // 更新速度
                vr += ar * dt;
                vtheta += atheta * dt;
                
                // 更新位置
                r += vr * dt;
                theta += vtheta / r * dt;
                
                // 防止撞击地面或飞得太远
                if (r <= this.simulation.earthRadius * 1.01 || r > this.simulation.earthRadius * 20) {
                    break;
                }
            }
        }
        
        pathElement.setAttribute('d', pathD);
    }
    
    // 绘制圆形轨道
    drawCircularOrbit(pathElement, radius, earthRadius, scale) {
        const r = radius / 1000 * scale;
        const pathD = `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0`;
        pathElement.setAttribute('d', pathD);
    }
    
    // 绘制双曲线轨迹
    drawHyperbolicTrajectory(pathElement, earthRadius, scale, currentX, currentY) {
        let pathD = `M ${currentX} ${currentY}`;
        
        // 简单的未来轨迹预测（基于当前速度）
        const vr = this.simulation.radialVelocity;
        const vt = this.simulation.radialDistance * this.simulation.angularVelocity;
        
        // 预测未来30个时间步的位置
        const dt = 10; // 时间步长（秒）
        let currentAngle = this.simulation.angularPosition;
        let currentRadius = this.simulation.radialDistance;
        
        for (let i = 1; i <= 30; i++) {
            // 简化的积分
            currentRadius += vr * dt;
            currentAngle += (vt / currentRadius) * dt;
            
            const predictedX = (currentRadius / 1000 * scale) * Math.sin(currentAngle);
            const predictedY = -(currentRadius / 1000 * scale) * Math.cos(currentAngle);
            
            pathD += ` L ${predictedX} ${predictedY}`;
            
            // 如果脱离显示范围则停止
            if (Math.abs(predictedX) > 800 || Math.abs(predictedY) > 800) break;
        }
        
        pathElement.setAttribute('d', pathD);
    }
    
    // 绘制低空抛物线轨迹
    drawTrajectoryPrediction(pathElement, earthRadius, scale, currentX, currentY) {
        let pathD = `M ${currentX} ${currentY}`;
        
        // 基于当前速度和重力的抛物线预测
        const vr = this.simulation.radialVelocity;
        const vt = this.simulation.radialDistance * this.simulation.angularVelocity;
        const r = this.simulation.radialDistance;
        
        const dt = 5; // 时间步长
        let angle = this.simulation.angularPosition;
        let radius = r;
        let radialVel = vr;
        
        for (let i = 1; i <= 50; i++) {
            // 计算重力加速度
            const GM = this.simulation.earthMass * this.simulation.gravitationalConstant;
            const gravity = GM / (radius * radius);
            
            // 更新位置和速度
            radialVel -= gravity * dt;
            radius += radialVel * dt;
            angle += (vt / radius) * dt;
            
            // 检查是否撞击地面
            if (radius <= this.simulation.earthRadius) break;
            
            const predX = (radius / 1000 * scale) * Math.sin(angle);
            const predY = -(radius / 1000 * scale) * Math.cos(angle);
            
            pathD += ` L ${predX} ${predY}`;
            
            // 限制显示范围
            if (Math.abs(predX) > 600 || Math.abs(predY) > 600) break;
        }
        
        pathElement.setAttribute('d', pathD);
    }
    
    // 设置时间加速
    setTimeAcceleration(multiplier) {
        if (this.allowedTimeAccelerations.includes(multiplier)) {
            this.timeAcceleration = multiplier;
            
            // 同时设置物理引擎的时间加速
            if (this.simulation) {
                this.simulation.setTimeAcceleration(multiplier);
            }
            
            // 更新显示
            const timeAccelValue = document.getElementById('timeAccelValue');
            if (timeAccelValue) {
                timeAccelValue.textContent = `×${multiplier}`;
                
                // 根据加速倍率改变颜色
                if (multiplier === 1) {
                    timeAccelValue.style.color = '#4CAF50'; // 绿色 - 正常时间
                } else if (multiplier <= 10) {
                    timeAccelValue.style.color = '#FFA726'; // 橙色 - 低速加速
                } else if (multiplier <= 100) {
                    timeAccelValue.style.color = '#FF7043'; // 深橙色 - 中速加速
                } else {
                    timeAccelValue.style.color = '#F44336'; // 红色 - 高速加速
                }
            }
            
            console.log(`时间加速设置为 ×${multiplier}`);
        }
    }
    
    // 获取当前时间加速
    getTimeAcceleration() {
        return this.timeAcceleration;
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
