// 发射模拟核心类
class LaunchSimulation {
    constructor(assembly) {
        this.assembly = assembly;
        this.isRunning = false;
        this.isPaused = false;
        this.crashed = false;       // 坠毁状态
        this.landed = false;        // 着陆状态
        this.landingNotificationShown = false; // 着陆通知是否已显示
        
        // 物理状态
        this.altitude = 0;          // 垂直高度 (米)
        this.horizontalPosition = 0; // 水平位置 (米, 0为发射台位置)
        this.velocity = 0;          // 垂直速度 (米/秒)
        this.horizontalVelocity = 0; // 水平速度 (米/秒)
        this.acceleration = 0;      // 垂直加速度 (米/秒²)
        this.horizontalAcceleration = 0; // 水平加速度 (米/秒²)
        this.mass = 0;              // 当前质量 (吨)
        
        // 环境参数
        this.gravity = 9.81;        // 海平面重力加速度
        this.airDensity = 1.225;    // 海平面空气密度
        this.dragCoefficient = 0.3; // 阻力系数（火箭形状优化）
        this.crossSectionArea = 1.0; // 横截面积（平方米）
        
        // 地球参数（球体模型）
        this.earthRadius = 6371000; // 地球半径 (m)
        this.earthMass = 5.972e24;  // 地球质量 (kg)
        this.gravitationalConstant = 6.674e-11; // 万有引力常数 (m³/kg/s²)
        
        // 天体系统
        this.celestialBodies = {
            earth: {
                name: 'Earth',
                mass: 5.972e24,
                radius: 6371000,
                gravitationalParameter: 3.986e14, // GM值
                influenceRadius: 66200000, // 地球引力影响范围 (约66,200 km)
                x: 0,
                y: 0
            },
            moon: {
                name: 'Moon',
                mass: 7.342e22,
                radius: 1737400,
                gravitationalParameter: 4.904e12, // GM值
                influenceRadius: 12000000, // 月球引力影响范围 (约12,000 km)
                orbitalRadius: 384400000, // 月球轨道半径
                orbitalPeriod: 2360584,   // 轨道周期 (秒)
                currentAngle: 0,          // 当前轨道角度
                x: 384400000,             // 当前位置
                y: 0,
                angularVelocity: 2 * Math.PI / 2360584
            }
        };
        
        // 当前主要引力来源
        this.currentGravitySource = 'earth';
        
        console.log('天体系统已初始化:', {
            地球引力范围: this.celestialBodies.earth.influenceRadius / 1000 + ' km',
            月球引力范围: this.celestialBodies.moon.influenceRadius / 1000 + ' km',
            月球轨道半径: this.celestialBodies.moon.orbitalRadius / 1000 + ' km'
        });
        
        // 球坐标系统（相对于地心）
        this.radialDistance = this.earthRadius; // 距离地心的距离（初始为地球半径）
        this.angularPosition = 0;    // 角位置（弧度，0为发射台正上方）
        this.radialVelocity = 0;     // 径向速度（远离地心为正）
        this.angularVelocity = 0;    // 角速度（弧度/秒）
        
        // 时间步长
        this.deltaTime = 0.1;       // 100ms per step
        this.baseDeltaTime = 0.1;   // 基础时间步长
        this.timeAcceleration = 1;  // 时间加速倍率
        this.simulationTimer = null;
        this.lastDebugTime = 0;     // 调试输出时间控制
        this.lastFuelDebugTime = 0; // 燃料调试输出时间控制
        this.lastDistanceOutputTime = 0; // 距离输出时间控制
        
        // 节流阀控制
        this.throttle = 1.0;        // 节流阀设置 (0.0-1.0)
        
        // 转向控制
        this.steeringAngle = 0;     // 转向角度 (无限制，0°为垂直向上)
        this.steeringStep = 1;      // 每次调整的转向步长（更小的步长实现平滑控制）
        
        // 当前激活的级
        this.currentStage = 0;
        this.stages = [];
        this.separatedPartIds = new Set(); // 跟踪已分离的部件ID
        
        // 轨道状态
        this.hasReachedOrbit = false;
        this.orbitalData = null;
        
        this.initializeStages();
    }

    // 更新月球位置
    updateMoonPosition(deltaTime) {
        const moon = this.celestialBodies.moon;
        
        // 更新月球轨道角度
        moon.currentAngle += moon.angularVelocity * deltaTime;
        
        // 计算月球位置（以地球为中心的圆形轨道）
        moon.x = moon.orbitalRadius * Math.cos(moon.currentAngle);
        moon.y = moon.orbitalRadius * Math.sin(moon.currentAngle);
    }
    
    // 计算到指定天体的距离
    getDistanceToCelestialBody(bodyName) {
        const body = this.celestialBodies[bodyName];
        if (!body) return Infinity;
        
        // 火箭的绝对位置（以地球中心为原点）
        const rocketX = this.horizontalPosition;
        const rocketY = this.altitude + this.earthRadius;
        
        // 计算距离
        const dx = rocketX - body.x;
        const dy = rocketY - body.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 确定当前主要引力来源
    determineCurrentGravitySource() {
        const distanceToEarth = this.getDistanceToCelestialBody('earth');
        const distanceToMoon = this.getDistanceToCelestialBody('moon');
        
        // 检查是否在月球引力范围内
        if (distanceToMoon <= this.celestialBodies.moon.influenceRadius) {
            if (this.currentGravitySource !== 'moon') {
                console.log('进入月球引力范围');
                this.currentGravitySource = 'moon';
            }
        }
        // 检查是否在地球引力范围内
        else if (distanceToEarth <= this.celestialBodies.earth.influenceRadius) {
            if (this.currentGravitySource !== 'earth') {
                console.log('进入地球引力范围');
                this.currentGravitySource = 'earth';
            }
        }
        // 如果都不在范围内，保持当前引力源
        
        return this.currentGravitySource;
    }

    // 初始化分级信息
    initializeStages() {
        this.stages = this.assembly.getStagingInfo();
        this.mass = this.assembly.getTotalMass(); // 恢复使用总质量
        
        // 如果没有分级信息（没有分离器），创建一个默认的单级
        if (this.stages.length === 0) {
            console.log('没有检测到分级，创建默认单级');
            this.stages = [{
                stage: 1,
                decoupler: null,
                partsCount: this.assembly.parts.length,
                mass: this.mass,
                deltaV: this.assembly.estimateDeltaV(),
                engines: this.assembly.parts.filter(p => p.data.type === 'engine'),
                allParts: this.assembly.parts // 添加所有部件引用
            }];
        } else {
            // 为每个分级添加详细的部件信息
            this.stages.forEach((stage, index) => {
                if (stage.decoupler) {
                    const separationGroups = this.assembly.getDecouplerSeparationGroups(stage.decoupler.id);
                    if (separationGroups) {
                        // 对于第一级（index=0），包含下级部件（被抛弃的部分）+ 分离器
                        // 对于后续级别，包含上级部件（保留的部分）
                        if (index === 0) {
                            // 第一级：下级部件 + 分离器
                            stage.stageParts = [...separationGroups.lowerStage, separationGroups.decoupler];
                            stage.engines = separationGroups.lowerStage.filter(p => p.data.type === 'engine');
                        } else {
                            // 后续级别：上级部件
                            stage.stageParts = separationGroups.upperStage;
                            stage.engines = separationGroups.upperStage.filter(p => p.data.type === 'engine');
                        }
                        
                        console.log(`第${index + 1}级包含部件:`, stage.stageParts.map(p => p.data.name));
                        console.log(`第${index + 1}级引擎:`, stage.engines.map(e => e.data.name));
                    }
                }
            });
            
            // 添加最终级（最后一个分离器上面的部件，没有分离器的级）
            if (this.stages.length > 0) {
                const lastDecouplerStage = this.stages[this.stages.length - 1];
                if (lastDecouplerStage && lastDecouplerStage.upperStage && lastDecouplerStage.upperStage.length > 0) {
                    const finalStage = {
                        stage: this.stages.length + 1,
                        decoupler: null,
                        partsCount: lastDecouplerStage.upperStage.length,
                        mass: this.calculateFinalStageMass(lastDecouplerStage.upperStage),
                        deltaV: 0, // 最终级通常没有推力
                        engines: lastDecouplerStage.upperStage.filter(p => p.data.type === 'engine'),
                        stageParts: lastDecouplerStage.upperStage,
                        upperStage: lastDecouplerStage.upperStage,
                        lowerStage: []
                    };
                    
                    this.stages.push(finalStage);
                    console.log(`添加最终级:`, finalStage.stageParts.map(p => p.data.name));
                }
            }
        }
        
        console.log('初始化分级:', this.stages);
        console.log('初始质量:', this.mass, 'tons');
    }
    
    // 计算最终级质量的辅助方法
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

    // 计算当前有效质量（排除已分离的部件）
    getCurrentStageMass() {
        let totalMass = 0;
        
        // 遍历所有部件，只计算未分离的部件质量
        this.assembly.parts.forEach(part => {
            if (!this.separatedPartIds.has(part.id)) {
                totalMass += part.data.mass;
                // 添加燃料质量
                if (part.fuelStatus) {
                    totalMass += (part.fuelStatus.liquid_fuel * 0.005) + 
                               (part.fuelStatus.oxidizer * 0.0055);
                }
            }
        });
        
        return totalMass;
    }

    // 开始模拟
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        
        // 重置状态
        this.altitude = 0;
        this.horizontalPosition = 0;
        this.velocity = 0;
        this.horizontalVelocity = 0;
        this.acceleration = 0;
        this.horizontalAcceleration = 0;
        this.steeringAngle = 0;
        this.crashed = false;
        this.landed = false;
        this.landingNotificationShown = false; // 重置着陆通知标志
        
        // 启动模拟循环 - 使用固定的更新频率
        this.simulationTimer = setInterval(() => {
            if (!this.isPaused) {
                // 高倍率时间加速时进行多次物理更新
                const numSteps = Math.max(1, this.timeAcceleration);
                for (let i = 0; i < numSteps; i++) {
                    this.updatePhysics();
                    this.checkStaging();
                    
                    // 如果火箭坠毁或其他关键状态改变，停止多步更新
                    if (this.crashed || !this.isRunning) break;
                }
                this.updateDisplay();
            }
        }, this.baseDeltaTime * 1000); // 保持100ms的固定更新间隔
        
        console.log('发射模拟开始');
    }

    // 停止模拟
    stop() {
        if (this.simulationTimer) {
            clearInterval(this.simulationTimer);
            this.simulationTimer = null;
        }
        
        this.isRunning = false;
        this.isPaused = false;
        
        console.log('发射模拟停止');
    }

    // 暂停/恢复模拟
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(this.isPaused ? '模拟暂停' : '模拟继续');
    }

    // 更新物理状态（球形地球模型）
    updatePhysics() {
        // 更新月球位置
        this.updateMoonPosition(this.deltaTime);
        
        // 每秒输出一次飞船与地球和月球的距离
        const currentTime = Date.now();
        if (currentTime - this.lastDistanceOutputTime >= 1000) { // 1000ms = 1秒
            const distanceToEarth = this.getDistanceToCelestialBody('earth');
            const distanceToMoon = this.getDistanceToCelestialBody('moon');
            
            console.log(`距离信息 - 地球: ${(distanceToEarth / 1000).toFixed(1)} km, 月球: ${(distanceToMoon / 1000).toFixed(1)} km, 引力源: ${this.currentGravitySource}`);
            
            this.lastDistanceOutputTime = currentTime;
        }
        
        // 更新球坐标系统
        this.updateSphericalCoordinates();
        
        // 计算当前推力（总推力）
        const totalThrust = this.calculateThrust();
        
        // 将推力分解为径向和切向分量（球坐标系）
        const steeringRadians = this.steeringAngle * Math.PI / 180;
        const radialThrust = totalThrust * Math.cos(steeringRadians);     // 径向分量（远离地心）
        const tangentialThrust = totalThrust * Math.sin(steeringRadians); // 切向分量
        
        // 计算空气阻力（径向和切向分别计算）
        const radialDrag = this.calculateDrag(this.radialVelocity);
        const tangentialDrag = this.calculateDrag(this.radialVelocity * this.angularVelocity); // 切向速度
        
        // 计算球形地球的重力（随高度变化）
        const currentGravity = this.calculateGravityAtAltitude(this.altitude);
        const gravityForce = -(this.mass * 1000 * currentGravity); // 重力总是指向地心（径向负方向）
        
        // 计算离心力（在径向方向，远离地心）
        const centrifugalForce = this.mass * 1000 * this.angularVelocity * this.angularVelocity * this.radialDistance;
        
        // 计算净力（球坐标系）
        const netRadialForce = radialThrust + gravityForce + centrifugalForce + radialDrag;
        const netTangentialForce = tangentialThrust + tangentialDrag;
        
        // 计算加速度 (m/s²)
        const radialAcceleration = netRadialForce / (this.mass * 1000);
        const tangentialAcceleration = netTangentialForce / (this.mass * 1000);
        
        // 角加速度（考虑径向距离变化对角动量的影响）
        const angularAcceleration = (tangentialAcceleration / this.radialDistance) - 
                                   (2 * this.radialVelocity * this.angularVelocity / this.radialDistance);
        
        // 更新加速度字段供显示使用
        this.acceleration = radialAcceleration; // 径向加速度作为主要加速度显示
        this.horizontalAcceleration = tangentialAcceleration; // 切向加速度作为水平加速度
        
        // 调试输出（每秒输出一次）
        if (Math.floor(Date.now() / 1000) !== this.lastDebugTime) {
            this.lastDebugTime = Math.floor(Date.now() / 1000);
            console.log(`球形地球物理状态:`);
            console.log(`  转向角度: ${this.steeringAngle.toFixed(1)}°`);
            console.log(`  径向距离: ${(this.radialDistance/1000).toFixed(1)}km`);
            console.log(`  高度: ${(this.altitude/1000).toFixed(1)}km`);
            console.log(`  当前重力: ${currentGravity.toFixed(2)}m/s²`);
            console.log(`  径向加速度: ${radialAcceleration.toFixed(2)}m/s²`);
            console.log(`  切向加速度: ${tangentialAcceleration.toFixed(2)}m/s²`);
            console.log(`  径向速度: ${this.radialVelocity.toFixed(1)}m/s`);
            console.log(`  角速度: ${(this.angularVelocity * 180/Math.PI).toFixed(3)}°/s`);
            console.log(`  轨道速度: ${(this.radialDistance * this.angularVelocity / 1000).toFixed(1)}km/s`);
            console.log(`  离心力: ${(centrifugalForce/1000).toFixed(1)}kN`);
        }
        
        // 更新速度（球坐标系） - 使用基础时间步长
        this.radialVelocity += radialAcceleration * this.baseDeltaTime;
        this.angularVelocity += angularAcceleration * this.baseDeltaTime;
        
        // 更新位置（球坐标系） - 使用基础时间步长
        this.radialDistance += this.radialVelocity * this.baseDeltaTime;
        this.angularPosition += this.angularVelocity * this.baseDeltaTime;
        
        // 转换回直角坐标系用于显示
        this.altitude = this.radialDistance - this.earthRadius;
        this.horizontalPosition = this.angularPosition * this.earthRadius; // 近似处理
        this.velocity = this.radialVelocity;
        this.horizontalVelocity = this.radialDistance * this.angularVelocity;
        
        // 地面检查
        if (this.altitude < 0) {
            this.altitude = 0;
            this.radialDistance = this.earthRadius;
            this.handleLanding();
        }
        
        // 检查轨道状态
        this.checkOrbitalStatus();
        
        // 重新起飞检查：如果火箭已着陆但有向上的推力或高度大于0，可以重新起飞
        if (this.landed) {
            // 如果火箭高度大于0，说明已经重新起飞
            if (this.altitude > 0) {
                this.landed = false; // 取消着陆状态
                this.landingNotificationShown = false; // 重置着陆通知标志，下次着陆时可以再次显示
                console.log(`火箭重新起飞！高度: ${this.altitude.toFixed(2)}m, landed状态: ${this.landed}`);
                
                // 显示重新起飞通知
                if (typeof showNotification === 'function') {
                    const title = window.i18n ? window.i18n.t('launchPad.notifications.takeoff.title') : '重新起飞';
                    const message = window.i18n ? window.i18n.t('launchPad.notifications.takeoff.message') : '火箭离开地面！';
                    showNotification(title, message, 'info');
                }
                
                // 更新状态显示
                this.updateTakeoffStatus();
            }
            // 如果在地面但有足够推力，也可以重新起飞
            else if (this.altitude === 0 && verticalThrust > 0) {
                // 计算推重比，如果推力足够大，可以重新起飞
                const weight = this.mass * 1000 * this.gravity; // 重量（牛顿）
                const thrustToWeightRatio = verticalThrust / weight; // 使用垂直推力计算推重比
                
                if (thrustToWeightRatio > 1.0) { // 推重比大于1才能起飞
                    this.landed = false; // 取消着陆状态
                    this.landingNotificationShown = false; // 重置着陆通知标志，下次着陆时可以再次显示
                    console.log(`火箭重新起飞！推重比: ${thrustToWeightRatio.toFixed(2)}, landed状态: ${this.landed}`);
                    
                    // 显示重新起飞通知
                    if (typeof showNotification === 'function') {
                        const title = window.i18n ? window.i18n.t('launchPad.notifications.takeoff.title') : '重新起飞';
                        const message = window.i18n ? window.i18n.t('launchPad.notifications.takeoff.message') : '火箭离开地面！';
                        showNotification(title, message, 'info');
                    }
                    
                    // 更新状态显示
                    this.updateTakeoffStatus();
                }
            }
        }
        
        // 更新质量（燃料消耗）
        this.updateMass();
        
        // 更新视觉效果
        this.updateVisualEffects();
    }

    // 计算推力
    calculateThrust() {
        // 找到所有未分离的引擎
        const activeEngines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && !this.separatedPartIds.has(part.id)
        );
        
        // console.log(`当前级引擎数量: ${activeEngines.length}, 已分离部件: ${this.separatedPartIds.size}`);
        
        let totalThrust = 0;
        activeEngines.forEach(engine => {
            if (this.hasEnoughFuel(engine)) {
                // 检查引擎排气是否被阻挡
                const isBlocked = this.isEngineExhaustBlocked(engine);
                
                if (!isBlocked) {
                    // 根据高度调整推力（简化的大气效应）
                    const atmosphericPressure = Math.exp(-this.altitude / 8000); // 简化大气模型
                    const thrustAtm = engine.data.thrust_atm || engine.data.thrust;
                    const thrustVac = engine.data.thrust || thrustAtm;
                    
                    const currentThrust = thrustAtm + (thrustVac - thrustAtm) * (1 - atmosphericPressure);
                    // 应用节流阀设置
                    const throttledThrust = currentThrust * this.throttle;
                    totalThrust += throttledThrust;
                    // console.log(`引擎 ${engine.data.name} (ID: ${engine.id}) 推力: ${throttledThrust.toFixed(1)} kN (${Math.round(this.throttle * 100)}%)`);
                } else {
                    // console.log(`引擎 ${engine.data.name} (ID: ${engine.id}) 排气被阻挡，无推力输出`);
                }
            }
        });
        
        // console.log(`总推力: ${totalThrust.toFixed(1)} kN`);
        return totalThrust * 1000; // 转换为牛顿
    }
    
    // 计算当前位置的重力加速度（多天体系统）
    calculateGravityAtAltitude(altitude) {
        // 确定当前主要引力来源
        const gravitySource = this.determineCurrentGravitySource();
        const body = this.celestialBodies[gravitySource];
        
        if (gravitySource === 'earth') {
            // 地球重力：使用标准公式
            const r = this.earthRadius + altitude;
            return body.gravitationalParameter / (r * r);
        } else if (gravitySource === 'moon') {
            // 月球重力：计算到月球中心的距离
            const distanceToMoon = this.getDistanceToCelestialBody('moon');
            
            // 避免除零错误
            if (distanceToMoon < body.radius) {
                return body.gravitationalParameter / (body.radius * body.radius);
            }
            
            return body.gravitationalParameter / (distanceToMoon * distanceToMoon);
        }
        
        // 默认返回地球重力
        const r = this.earthRadius + altitude;
        return this.celestialBodies.earth.gravitationalParameter / (r * r);
    }
    
    // 获取当前引力天体信息
    getCurrentGravityBodyInfo() {
        const body = this.celestialBodies[this.currentGravitySource];
        const distance = this.getDistanceToCelestialBody(this.currentGravitySource);
        
        return {
            name: body.name,
            distance: distance,
            altitude: this.currentGravitySource === 'earth' ? 
                distance - this.earthRadius : 
                distance - body.radius,
            surfaceGravity: body.gravitationalParameter / (body.radius * body.radius)
        };
    }
    
    // 更新球坐标系统
    updateSphericalCoordinates() {
        // 将直角坐标转换为球坐标
        // altitude 对应径向距离的变化
        this.radialDistance = this.earthRadius + this.altitude;
        
        // horizontalPosition 对应角位置的变化
        // 弧长 = 半径 × 角度，所以角度 = 弧长 / 半径
        this.angularPosition = this.horizontalPosition / this.earthRadius;
        
        // 更新球坐标速度
        this.radialVelocity = this.velocity; // 径向速度就是垂直速度
        this.angularVelocity = this.horizontalVelocity / this.radialDistance; // 角速度 = 切向速度 / 半径
        
        // 反向更新：从球坐标计算实际的直角坐标位置
        this.altitude = this.radialDistance - this.earthRadius;
        this.horizontalPosition = this.angularPosition * this.earthRadius; // 简化：假设小角度
    }

    // 计算空气阻力
    calculateDrag(velocity = this.velocity) {
        // 如果速度为0，没有空气阻力
        if (velocity === 0) return 0;
        
        // 简化的阻力模型
        const atmosphericDensity = this.airDensity * Math.exp(-this.altitude / 8000);
        
        // F_drag = 0.5 * ρ * v² * Cd * A
        // 阻力大小总是正值
        const dragMagnitude = 0.5 * atmosphericDensity * (velocity * velocity) * 
                             this.dragCoefficient * this.crossSectionArea;
        
        // 阻力方向与速度方向相反
        // 如果速度向上/向右(+)，阻力向下/向左(-)
        // 如果速度向下/向左(-)，阻力向上/向右(+)
        const dragForce = -Math.sign(velocity) * dragMagnitude;
        
        return dragForce;
    }

    // 更新质量（燃料消耗）
    updateMass() {
        const engines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && !this.separatedPartIds.has(part.id)
        );
        
        engines.forEach(engine => {
            if (this.hasEnoughFuel(engine) && engine.data.fuel_consumption) {
                const consumption = engine.data.fuel_consumption;
                // 根据节流阀调整燃料消耗
                const throttleMultiplier = this.throttle;
                
                // 优先从引擎自身消耗燃料
                if (engine.fuelStatus) {
                    if (consumption.liquid_fuel) {
                        engine.fuelStatus.liquid_fuel = Math.max(0, 
                            engine.fuelStatus.liquid_fuel - consumption.liquid_fuel * this.baseDeltaTime * throttleMultiplier
                        );
                    }
                    if (consumption.oxidizer) {
                        engine.fuelStatus.oxidizer = Math.max(0, 
                            engine.fuelStatus.oxidizer - consumption.oxidizer * this.baseDeltaTime * throttleMultiplier
                        );
                    }
                } else {
                    // 只从当前级的燃料罐中消耗燃料
                    this.consumeFuelFromCurrentStageTanks(consumption, throttleMultiplier);
                }
            }
        });
        
        // 重新计算总质量（只计算未分离的部件）
        this.mass = this.getCurrentStageMass();
    }

    // 从当前级的燃料罐中消耗燃料的辅助方法
    consumeFuelFromCurrentStageTanks(consumption, throttleMultiplier = 1) {
        // 只获取未分离的燃料罐
        const activeFuelTanks = this.assembly.parts.filter(p => 
            p.data.fuel_capacity && p.fuelStatus && !this.separatedPartIds.has(p.id)
        );
        
        if (activeFuelTanks.length === 0) return;

        // 计算活跃燃料罐的总燃料量
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        activeFuelTanks.forEach(tank => {
            totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
            totalOxidizer += tank.fuelStatus.oxidizer || 0;
        });

        // 按比例从活跃燃料罐消耗燃料
        if (consumption.liquid_fuel && totalLiquidFuel > 0) {
            const liquidFuelToConsume = consumption.liquid_fuel * this.baseDeltaTime * throttleMultiplier;
            activeFuelTanks.forEach(tank => {
                if (tank.fuelStatus.liquid_fuel > 0) {
                    const proportion = tank.fuelStatus.liquid_fuel / totalLiquidFuel;
                    const consumeFromThisTank = liquidFuelToConsume * proportion;
                    tank.fuelStatus.liquid_fuel = Math.max(0, 
                        tank.fuelStatus.liquid_fuel - consumeFromThisTank
                    );
                }
            });
        }

        if (consumption.oxidizer && totalOxidizer > 0) {
            const oxidizerToConsume = consumption.oxidizer * this.baseDeltaTime * throttleMultiplier;
            activeFuelTanks.forEach(tank => {
                if (tank.fuelStatus.oxidizer > 0) {
                    const proportion = tank.fuelStatus.oxidizer / totalOxidizer;
                    const consumeFromThisTank = oxidizerToConsume * proportion;
                    tank.fuelStatus.oxidizer = Math.max(0, 
                        tank.fuelStatus.oxidizer - consumeFromThisTank
                    );
                }
            });
        }
        
        // console.log(`当前级燃料消耗 (${Math.round(throttleMultiplier * 100)}% 节流阀): 液体燃料-${(consumption.liquid_fuel * this.baseDeltaTime * throttleMultiplier).toFixed(2)}, 氧化剂-${(consumption.oxidizer * this.baseDeltaTime * throttleMultiplier).toFixed(2)}`);
    }

    // 检查分级条件
    checkStaging() {
        // 如果是单级火箭，不需要检查分级
        if (this.stages.length <= 1) {
            return;
        }
        
        if (this.currentStage >= this.stages.length - 1) {
            return; // 已经是最后一级
        }
        
        // 检查当前级是否燃料耗尽
        const activeEngines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && !this.separatedPartIds.has(part.id)
        );
        
        if (activeEngines.length === 0) {
            console.log('当前没有活跃引擎，尝试分离');
            setTimeout(() => {
                this.activateNextStage();
            }, 500);
            return;
        }
        
        // 检查是否还有任何引擎有燃料
        const hasActiveFuel = activeEngines.some(engine => this.hasEnoughFuel(engine));
        
        // 额外检查：如果引擎依赖燃料罐，检查活跃燃料罐总量
        if (!hasActiveFuel) {
            const activeFuelTanks = this.assembly.parts.filter(p => 
                p.data.fuel_capacity && p.fuelStatus && !this.separatedPartIds.has(p.id)
            );
            
            let totalLiquidFuel = 0;
            let totalOxidizer = 0;
            
            activeFuelTanks.forEach(tank => {
                totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                totalOxidizer += tank.fuelStatus.oxidizer || 0;
            });
            
            console.log(`第${this.currentStage + 1}级分级检查 - 液体燃料: ${totalLiquidFuel.toFixed(1)}, 氧化剂: ${totalOxidizer.toFixed(1)}`);
            
            if (totalLiquidFuel <= 0.1 && totalOxidizer <= 0.1) { // 允许一点误差
                console.log(`第${this.currentStage + 1}级燃料耗尽，准备分离`);
                setTimeout(() => {
                    this.activateNextStage();
                }, 1000); // 1秒后自动分离
            }
        }
    }

    // 激活下一级
    activateNextStage() {
        // 单级火箭没有下一级
        if (this.stages.length <= 1) {
            console.log('单级火箭，没有更多分级');
            return false;
        }
        
        if (this.currentStage >= this.stages.length - 1) {
            console.log('已经是最后一级，没有更多分级');
            return false;
        }

        const currentStage = this.stages[this.currentStage];
        console.log(`正在分离第${this.currentStage + 1}级:`, currentStage);
        
        // 记录分级前的质量
        const massBefore = this.mass;
        const altitudeBefore = this.altitude;
        
        // 如果当前级有分离器，处理分离
        if (currentStage && currentStage.decoupler) {
            // 获取分离的部件组
            const separationGroups = this.assembly.getDecouplerSeparationGroups(currentStage.decoupler.id);
            const separatedParts = [...separationGroups.lowerStage, separationGroups.decoupler];
            
            // 将分离的部件标记为已分离
            separatedParts.forEach(part => {
                this.separatedPartIds.add(part.id);
                console.log(`标记部件为已分离: ${part.data.name} (ID: ${part.id})`);
                
                // 如果是引擎，关闭其火焰效果
                if (part.data.type === 'engine') {
                    const flameElement = document.getElementById(`flame-${part.id}`);
                    if (flameElement) {
                        flameElement.style.display = 'none';
                        flameElement.classList.remove('active');
                    }
                }
            });
            
            console.log(`分离了 ${separatedParts.length} 个部件:`, separatedParts.map(p => p.data.name));
        } else {
            console.log('注意：当前级没有分离器，但仍然执行分级');
        }
        
        // 更新分级状态
        this.currentStage++;
        
        // 重新初始化当前级别的燃料罐为满燃料状态
        this.initializeCurrentStageFuelTanks();
        
        // 重新计算质量（排除已分离的部件）
        this.mass = this.getCurrentStageMass();
        console.log(`分级: ${massBefore.toFixed(2)}t → ${this.mass.toFixed(2)}t (减少 ${(massBefore - this.mass).toFixed(2)}t)`);
        console.log(`高度保持: ${altitudeBefore.toFixed(1)}m → ${this.altitude.toFixed(1)}m`);
        
        // 强制更新显示以避免UI跳跃
        this.updateDisplay();
        
        // 更新UI
        this.updateStagingUI();
        
        console.log(`已激活第 ${this.currentStage + 1} 级`);
        
        // 显示通知
        if (typeof showNotification === 'function') {
            const title = window.i18n ? window.i18n.t('launchPad.notifications.staging.title') : '分级';
            const message = window.i18n ? 
                window.i18n.t('launchPad.notifications.staging.message', { stage: this.currentStage, next: this.currentStage + 1 }) : 
                `第 ${this.currentStage} 级已分离，激活第 ${this.currentStage + 1} 级`;
            showNotification(title, message, 'info');
        }
        
        return true;
    }

    // 重新初始化当前级别的燃料罐为满燃料状态
    initializeCurrentStageFuelTanks() {
        // 获取当前级别的所有燃料罐
        const activeFuelTanks = this.assembly.parts.filter(part => 
            part.data.fuel_capacity && !this.separatedPartIds.has(part.id)
        );
        
        // 获取当前级别的所有引擎（可能有内置燃料）
        const activeEngines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && part.data.fuel_capacity && !this.separatedPartIds.has(part.id)
        );
        
        console.log(`重新初始化 ${activeFuelTanks.length} 个燃料罐和 ${activeEngines.length} 个带燃料的引擎`);
        
        // 重置燃料罐
        activeFuelTanks.forEach(tank => {
            if (tank.data.fuel_capacity) {
                tank.fuelStatus = {
                    liquid_fuel: tank.data.fuel_capacity.liquid_fuel || 0,
                    oxidizer: tank.data.fuel_capacity.oxidizer || 0
                };
                // console.log(`燃料罐 ${tank.data.name} 燃料重置: 液体燃料=${tank.fuelStatus.liquid_fuel}, 氧化剂=${tank.fuelStatus.oxidizer}`);
            }
        });
        
        // 重置引擎内置燃料
        activeEngines.forEach(engine => {
            if (engine.data.fuel_capacity) {
                engine.fuelStatus = {
                    liquid_fuel: engine.data.fuel_capacity.liquid_fuel || 0,
                    oxidizer: engine.data.fuel_capacity.oxidizer || 0
                };
                // console.log(`引擎 ${engine.data.name} 燃料重置: 液体燃料=${engine.fuelStatus.liquid_fuel}, 氧化剂=${engine.fuelStatus.oxidizer}`);
            }
        });
    }

    // 更新显示
    updateDisplay() {
        // 更新基础飞行数据
        document.getElementById('altitude').textContent = `${Math.round(this.altitude)} m`;
        document.getElementById('mass').textContent = `${this.mass.toFixed(2)} t`;
        
        // 更新水平数据
        const horizontalVelocityElement = document.getElementById('horizontalVelocity');
        const horizontalPositionElement = document.getElementById('horizontalPosition');
        if (horizontalVelocityElement) {
            horizontalVelocityElement.textContent = `${Math.round(this.horizontalVelocity)} m/s`;
        }
        if (horizontalPositionElement) {
            horizontalPositionElement.textContent = `${Math.round(this.horizontalPosition)} m`;
        }
        
        // 计算当前推重比（使用当前高度的重力）
        const thrust = this.calculateThrust() / 1000; // 转换为kN
        const currentGravity = this.calculateGravityAtAltitude(this.altitude);
        const twr = this.mass > 0 ? (thrust / (this.mass * currentGravity)) : 0;
        document.getElementById('twr').textContent = twr.toFixed(2);
        
        // 更新轨道信息显示
        this.updateOrbitalDisplay();
        
        // 更新燃料显示
        this.updateFuelDisplay();
        
        // 更新转向显示
        this.updateSteeringDisplay();
        
    }
    
    // 更新轨道信息显示
    updateOrbitalDisplay() {
        if (!this.orbitalData) return;
        
        // 更新轨道速度
        const orbitalVelocityElement = document.getElementById('orbitalVelocity');
        if (orbitalVelocityElement) {
            orbitalVelocityElement.textContent = `${(this.orbitalData.orbitalVelocity / 1000).toFixed(2)} km/s`;
        }
        
        // 更新圆轨道速度（用于参考）
        const circularVelocityElement = document.getElementById('circularVelocity');
        if (circularVelocityElement) {
            circularVelocityElement.textContent = `${(this.orbitalData.circularVelocity / 1000).toFixed(2)} km/s`;
        }
        
        // 更新轨道类型
        const orbitTypeElement = document.getElementById('orbitType');
        if (orbitTypeElement) {
            orbitTypeElement.textContent = this.orbitalData.orbitType;
            // 根据轨道状态设置颜色
            if (this.orbitalData.isInOrbit) {
                orbitTypeElement.style.color = '#4CAF50'; // 绿色表示成功入轨
            } else if (this.orbitalData.orbitType.includes('椭圆')) {
                orbitTypeElement.style.color = '#FF9800'; // 橙色表示椭圆轨道
            } else {
                orbitTypeElement.style.color = '#F44336'; // 红色表示其他状态
            }
        }
        
        // 更新离心率
        const eccentricityElement = document.getElementById('eccentricity');
        if (eccentricityElement) {
            eccentricityElement.textContent = this.orbitalData.eccentricity.toFixed(3);
        }
        
        // 更新轨道状态指示器
        const orbitStatusElement = document.getElementById('orbitStatus');
        if (orbitStatusElement) {
            if (this.orbitalData.isInOrbit) {
                orbitStatusElement.textContent = '✅ 已入轨';
                orbitStatusElement.style.color = '#4CAF50';
            } else if (this.altitude > 50000) {
                orbitStatusElement.textContent = '🚀 接近轨道';
                orbitStatusElement.style.color = '#FF9800';
            } else {
                orbitStatusElement.textContent = '⬆️ 上升中';
                orbitStatusElement.style.color = '#2196F3';
            }
        }
        
        // 更新火箭位置
        this.updateRocketPosition();
    }

    // 更新燃料显示
    updateFuelDisplay() {
        // 只显示未分离的燃料罐燃料
        const activeFuelTanks = this.assembly.parts.filter(p => 
            p.data.fuel_capacity && !this.separatedPartIds.has(p.id)
        );
        
        let currentStageLiquidFuel = 0;
        let currentStageOxidizer = 0;
        
        activeFuelTanks.forEach(tank => {
            if (tank.fuelStatus) {
                currentStageLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                currentStageOxidizer += tank.fuelStatus.oxidizer || 0;
            }
        });

        // 同时计算总燃料（所有部件，包括分离的）
        const allFuelTanks = this.assembly.parts.filter(p => p.data.fuel_capacity);
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        
        allFuelTanks.forEach(tank => {
            if (tank.fuelStatus) {
                totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                totalOxidizer += tank.fuelStatus.oxidizer || 0;
            }
        });

        // 更新主要燃料显示（当前活跃级）
        if (document.getElementById('liquidFuel')) {
            document.getElementById('liquidFuel').textContent = currentStageLiquidFuel.toFixed(1);
        }
        if (document.getElementById('oxidizer')) {
            document.getElementById('oxidizer').textContent = currentStageOxidizer.toFixed(1);
        }
        
        // 更新总燃料显示（如果有的话）
        if (document.getElementById('totalLiquidFuel')) {
            document.getElementById('totalLiquidFuel').textContent = totalLiquidFuel.toFixed(1);
        }
        if (document.getElementById('totalOxidizer')) {
            document.getElementById('totalOxidizer').textContent = totalOxidizer.toFixed(1);
        }
        
        // 添加当前级燃料信息到控制台（调试用）
        if (Math.floor(Date.now() / 1000) !== this.lastFuelDebugTime) {
            this.lastFuelDebugTime = Math.floor(Date.now() / 1000);
            console.log(`活跃级燃料 - 液体燃料: ${currentStageLiquidFuel.toFixed(1)}, 氧化剂: ${currentStageOxidizer.toFixed(1)}`);
            console.log(`总燃料 - 液体燃料: ${totalLiquidFuel.toFixed(1)}, 氧化剂: ${totalOxidizer.toFixed(1)}`);
        }
    }

    // 更新火箭视觉位置（已被世界坐标系统取代）
    updateRocketPosition() {
        // 注释掉旧的火箭定位系统，现在由launch-pad.js中的世界坐标系统负责
        // 旧系统会与新的相机系统冲突，导致火箭位置异常
        
        /*
        const rocketDisplay = document.getElementById('rocketDisplay');
        if (rocketDisplay) {
            // 根据高度调整火箭垂直位置（视觉效果）
            const maxVisualHeight = 300; // 最大视觉移动距离
            const visualHeight = Math.min(this.altitude / 1000 * 50, maxVisualHeight);
            
            // 根据水平位置调整火箭水平位置
            const maxVisualHorizontal = 200; // 最大水平移动距离
            const visualHorizontalOffset = Math.max(-maxVisualHorizontal, 
                Math.min(maxVisualHorizontal, this.horizontalPosition / 500 * 50));
            
            const baseBottom = 200; // 基础底部位置
            const newBottom = baseBottom + visualHeight;
            
            // 基础水平位置是50%（屏幕中心）
            const baseLeft = 50; // 50% from left
            const newLeft = baseLeft + (visualHorizontalOffset / window.innerWidth * 100); // 转换为百分比
            
            rocketDisplay.style.bottom = `${newBottom}px`;
            rocketDisplay.style.left = `${newLeft}%`;
            rocketDisplay.style.transform = `translateX(-50%) scale(${Math.max(0.3, 1 - visualHeight / 1000)}) rotate(${this.steeringAngle}deg)`;
        }
        */
    }

    // 更新视觉效果
    updateVisualEffects() {
        // 获取所有引擎（包括已分离的）以确保正确关闭火焰
        const allEngines = this.assembly.parts.filter(part => part.data.type === 'engine');
        const activeEngines = allEngines.filter(engine => !this.separatedPartIds.has(engine.id));
        
        // console.log(`更新视觉效果: 总引擎数量 ${allEngines.length}, 当前级引擎数量 ${activeEngines.length}, 已分离部件 ${this.separatedPartIds.size}`);
        
        // 首先关闭所有引擎火焰
        allEngines.forEach(engine => {
            const flameElement = document.getElementById(`flame-${engine.id}`);
            if (flameElement) {
                flameElement.classList.remove('active');
            }
        });
        
        // 然后只为当前级有效的引擎开启火焰
        activeEngines.forEach(engine => {
            const flameElement = document.getElementById(`flame-${engine.id}`);
            if (flameElement) {
                // 检查引擎是否应该显示火焰和计算推力：
                // 1. 必须有足够的燃料
                // 2. 节流阀必须大于0%
                // 3. 引擎后面（底部）不能有组件阻挡
                const hasEnoughFuel = this.hasEnoughFuel(engine);
                const hasThrottle = this.throttle > 0;
                const hasBlockedExhaust = this.isEngineExhaustBlocked(engine);
                
                // console.log(`引擎 ${engine.data.name} (ID: ${engine.id}): 燃料=${hasEnoughFuel}, 节流阀=${hasThrottle}, 排气阻挡=${hasBlockedExhaust}, 火焰显示=${hasEnoughFuel && hasThrottle && !hasBlockedExhaust}`);
                
                if (hasEnoughFuel && hasThrottle && !hasBlockedExhaust) {
                    flameElement.classList.add('active');
                    // 根据推力和节流阀调整火焰大小
                    const baseThrust = engine.data.thrust || 0;
                    const actualThrust = baseThrust * this.throttle; // 考虑节流阀
                    const thrustRatio = actualThrust / 100; // 归一化到0-1
                    const flameHeight = 20 + thrustRatio * 60; // 20-80px，基于实际推力
                    flameElement.style.height = `${flameHeight}px`;
                }
            }
        });
    }
    
    // 检查引擎排气是否被阻挡
    isEngineExhaustBlocked(engine) {
        if (!engine || engine.data.type !== 'engine') return false;
        
        // 找到引擎底部连接点连接的组件
        const engineBottomConnections = this.assembly.connections.filter(conn => 
            (conn.partA === engine.id && conn.attachPointA === 'bottom') ||
            (conn.partB === engine.id && conn.attachPointB === 'bottom')
        );
        
        // 如果引擎底部有连接的组件，且该组件未分离，则排气被阻挡
        for (const connection of engineBottomConnections) {
            const connectedPartId = connection.partA === engine.id ? connection.partB : connection.partA;
            
            // 检查连接的组件是否还存在且未分离
            if (!this.separatedPartIds.has(connectedPartId)) {
                const connectedPart = this.assembly.parts.find(p => p.id === connectedPartId);
                if (connectedPart) {
                    // console.log(`引擎 ${engine.data.name} 的排气被组件 ${connectedPart.data.name} 阻挡`);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // 检查轨道状态
    checkOrbitalStatus() {
        // 计算轨道参数
        const orbitalVelocity = this.radialDistance * Math.abs(this.angularVelocity); // 轨道速度
        const escapeVelocity = Math.sqrt(2 * this.gravitationalConstant * this.earthMass / this.radialDistance); // 逃逸速度
        const circularVelocity = Math.sqrt(this.gravitationalConstant * this.earthMass / this.radialDistance); // 圆轨道速度
        
        // 计算轨道能量（比能量，单位质量的能量）
        const kineticEnergy = 0.5 * (this.radialVelocity * this.radialVelocity + orbitalVelocity * orbitalVelocity);
        const potentialEnergy = -this.gravitationalConstant * this.earthMass / this.radialDistance;
        const specificEnergy = kineticEnergy + potentialEnergy;
        
        // 计算轨道离心率
        const angularMomentum = this.radialDistance * orbitalVelocity; // 简化：假设径向速度为0时的角动量
        const eccentricity = Math.sqrt(1 + (2 * specificEnergy * angularMomentum * angularMomentum) / 
                                      Math.pow(this.gravitationalConstant * this.earthMass, 2));
        
        // 判断轨道类型
        let orbitType = '';
        if (specificEnergy < 0) {
            if (eccentricity < 1) {
                orbitType = specificEnergy < -1e6 ? '椭圆轨道' : '不稳定轨道';
            } else {
                orbitType = '抛物线轨道';
            }
        } else {
            orbitType = '双曲线轨道（逃逸）';
        }
        
        // 检查是否成功入轨
        const minOrbitAltitude = 100000; // 100km最低轨道高度
        const isInOrbit = this.altitude > minOrbitAltitude && 
                         specificEnergy < 0 && 
                         eccentricity < 0.9 && 
                         Math.abs(this.radialVelocity) < orbitalVelocity * 0.1; // 径向速度相对较小
        
        // 存储轨道信息用于显示
        this.orbitalData = {
            altitude: this.altitude,
            orbitalVelocity: orbitalVelocity,
            circularVelocity: circularVelocity,
            escapeVelocity: escapeVelocity,
            specificEnergy: specificEnergy,
            eccentricity: eccentricity,
            orbitType: orbitType,
            isInOrbit: isInOrbit,
            angularMomentum: angularMomentum
        };
        
        // 如果成功入轨且之前未入轨，显示祝贺信息
        if (isInOrbit && !this.hasReachedOrbit) {
            this.hasReachedOrbit = true;
            console.log(`🎉 成功入轨！`);
            console.log(`轨道类型: ${orbitType}`);
            console.log(`轨道高度: ${(this.altitude/1000).toFixed(1)}km`);
            console.log(`轨道速度: ${(orbitalVelocity/1000).toFixed(2)}km/s`);
            console.log(`离心率: ${eccentricity.toFixed(3)}`);
        }
        
        return isInOrbit;
    }

    // 更新分级UI
    updateStagingUI() {
        const stageItems = document.querySelectorAll('.stage-item');
        stageItems.forEach((item, index) => {
            item.classList.remove('active');
            if (index < this.currentStage) {
                item.classList.add('used');
            } else if (index === this.currentStage) {
                item.classList.add('active');
            }
        });
    }

    // 检查部件是否在当前级
    isPartInCurrentStage(part) {
        // 对于没有分离器的单级火箭，所有部件都在当前级
        if (this.stages.length === 1 && !this.stages[0].decoupler) {
            return true;
        }
        
        // 对于多级火箭，检查部件是否属于当前激活的级
        if (this.currentStage < this.stages.length) {
            const currentStage = this.stages[this.currentStage];
            
            // 如果当前级有明确的部件列表
            if (currentStage.stageParts) {
                return currentStage.stageParts.some(stagePart => stagePart.id === part.id);
            }
            
            // 如果是引擎，检查引擎列表
            if (part.data.type === 'engine' && currentStage.engines) {
                return currentStage.engines.some(engine => engine.id === part.id);
            }
            
            // 如果是单级火箭的所有部件列表
            if (currentStage.allParts) {
                return currentStage.allParts.some(stagePart => stagePart.id === part.id);
            }
        }
        
        // 默认逻辑：第一级包含所有部件，后续级别需要明确定义
        return this.currentStage === 0;
    }

    // 检查引擎是否有足够燃料
    hasEnoughFuel(engine) {
        // 如果引擎不需要燃料（例如：固体燃料发动机），直接返回true
        if (!engine.data.fuel_consumption) {
            console.log(`引擎 ${engine.data.name} 不需要燃料`);
            return true; 
        }
        
        if (!engine.fuelStatus) {
            // console.log(`引擎 ${engine.data.name} 没有燃料状态，检查活跃燃料罐`);
            // 只检查未分离的燃料罐的燃料总量
            const activeFuelTanks = this.assembly.parts.filter(p => 
                p.data.fuel_capacity && !this.separatedPartIds.has(p.id)
            );
            
            if (activeFuelTanks.length > 0) {
                let totalLiquidFuel = 0;
                let totalOxidizer = 0;
                
                activeFuelTanks.forEach(tank => {
                    if (tank.fuelStatus) {
                        totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                        totalOxidizer += tank.fuelStatus.oxidizer || 0;
                    }
                });
                
                const consumption = engine.data.fuel_consumption;
                const hasEnoughLiquid = !consumption.liquid_fuel || totalLiquidFuel > 0;
                const hasEnoughOxidizer = !consumption.oxidizer || totalOxidizer > 0;
                
                // console.log(`活跃燃料罐检查: 液体燃料=${totalLiquidFuel.toFixed(1)}, 氧化剂=${totalOxidizer.toFixed(1)}`);
                return hasEnoughLiquid && hasEnoughOxidizer;
            }
            return false;
        }
        
        const consumption = engine.data.fuel_consumption;
        const hasLiquidFuel = !consumption.liquid_fuel || 
                             (engine.fuelStatus.liquid_fuel > 0);
        const hasOxidizer = !consumption.oxidizer || 
                           (engine.fuelStatus.oxidizer > 0);
        
        const hasFuel = hasLiquidFuel && hasOxidizer;
        // console.log(`引擎 ${engine.data.name} 燃料检查: 液体燃料=${engine.fuelStatus.liquid_fuel}, 氧化剂=${engine.fuelStatus.oxidizer}, 有燃料=${hasFuel}`);
        
        return hasFuel;
    }

    // 处理着陆
    handleLanding() {
        const landingSpeed = Math.abs(this.velocity); // 着陆速度（取绝对值）
        const safeSpeed = 10.0; // 安全着陆速度阈值 (m/s)
        
        console.log(`着陆速度: ${landingSpeed.toFixed(2)} m/s`);
        
        if (landingSpeed <= safeSpeed) {
            // 安全着陆
            this.handleSafeLanding();
        } else {
            // 高速撞击，坠毁
            this.handleCrash();
        }
    }
    
    // 处理安全着陆
    handleSafeLanding() {
        // 不停止模拟，允许重新起飞
        this.velocity = 0;
        
        // 如果之前没有着陆过，才显示通知和更新状态
        if (!this.landed) {
            this.landed = true; // 标记火箭已着陆
            console.log('火箭成功着陆！');
            
            // 显示成功着陆通知（只在第一次着陆时显示）
            if (typeof showNotification === 'function' && !this.landingNotificationShown) {
                const title = window.i18n ? window.i18n.t('launchPad.notifications.landing.title') : '任务成功';
                const message = window.i18n ? window.i18n.t('launchPad.notifications.landing.message') : '火箭成功着陆！';
                showNotification(title, message, 'success');
                this.landingNotificationShown = true; // 标记通知已显示
            }
            
            // 更新状态显示
            this.updateLandingStatus();
        }
    }
    
    // 更新着陆状态显示
    updateLandingStatus() {
        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');
        
        if (countdownText) {
            countdownText.textContent = window.i18n ? window.i18n.t('launchPad.status.landed') : '已着陆';
        }
        if (countdownNumber) {
            countdownNumber.textContent = '✅';
        }
    }
    
    // 更新重新起飞状态显示
    updateTakeoffStatus() {
        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');
        
        if (countdownText) {
            countdownText.textContent = window.i18n ? window.i18n.t('launchPad.status.flying') : '飞行中';
        }
        if (countdownNumber) {
            countdownNumber.textContent = '🚀';
        }
    }

    // 处理撞毁
    handleCrash() {
        this.stop();
        this.crashed = true; // 标记火箭已坠毁
        console.log('火箭撞毁！');
        
        // 隐藏火箭
        this.hideRocket();
        
        // 显示爆炸效果
        this.showExplosion();
        
        // 显示撞毁通知
        if (typeof showNotification === 'function') {
            const title = window.i18n ? window.i18n.t('launchPad.notifications.crash.title') : '任务失败';
            const message = window.i18n ? window.i18n.t('launchPad.notifications.crash.message') : '火箭撞毁了！';
            showNotification(title, message, 'error');
        }
    }
    
    // 隐藏火箭
    hideRocket() {
        const rocketContainer = document.querySelector('.rocket-container');
        if (rocketContainer) {
            rocketContainer.classList.add('rocket-crashed');
        }
        
        // 也隐藏发射台上的火箭显示
        const rocketDisplay = document.getElementById('rocketDisplay');
        if (rocketDisplay) {
            const container = rocketDisplay.querySelector('.rocket-container');
            if (container) {
                container.classList.add('rocket-crashed');
            }
        }
    }
    
    // 显示爆炸效果
    showExplosion() {
        // 在火箭显示区域创建爆炸效果
        const rocketDisplay = document.getElementById('rocketDisplay');
        if (!rocketDisplay) return;
        
        // 创建爆炸容器
        const explosionContainer = document.createElement('div');
        explosionContainer.className = 'explosion-container';
        
        // 创建爆炸效果
        const explosion = document.createElement('div');
        explosion.className = 'explosion-effect';
        
        // 创建粒子效果
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'explosion-particles';
        
        // 生成粒子
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'explosion-particle';
            particle.style.animationDelay = `${Math.random() * 0.2}s`;
            particlesContainer.appendChild(particle);
        }
        
        explosionContainer.appendChild(explosion);
        explosionContainer.appendChild(particlesContainer);
        rocketDisplay.appendChild(explosionContainer);
        
        // 播放爆炸音效（如果有的话）
        this.playExplosionSound();
        
        // 2秒后移除爆炸效果
        setTimeout(() => {
            if (explosionContainer.parentNode) {
                explosionContainer.parentNode.removeChild(explosionContainer);
            }
        }, 2000);
    }
    
    // 播放爆炸音效
    playExplosionSound() {
        // 可以在这里添加音效播放逻辑
        try {
            // 创建一个简单的音效（使用 Web Audio API）
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 爆炸音效：低频噪音
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(60, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            // 如果音频API不可用，静默忽略
            console.log('音频播放不可用');
        }
    }
    
    // 设置节流阀
    setThrottle(throttleValue) {
        this.throttle = Math.max(0, Math.min(1, throttleValue));
        console.log(`节流阀设置为: ${Math.round(this.throttle * 100)}%`);
        
        // 更新引擎火焰视觉效果
        if (this.isRunning) {
            this.updateVisualEffects();
        }
    }
    
    // 获取当前节流阀设置
    getThrottle() {
        return this.throttle;
    }
    
    // 设置时间加速
    setTimeAcceleration(multiplier) {
        this.timeAcceleration = multiplier;
        // 不再修改deltaTime，保持基础时间步长的稳定性
        // this.deltaTime = this.baseDeltaTime * multiplier;
        
        console.log(`物理仿真时间加速设置为 ×${multiplier}，将每次更新进行${multiplier}次物理计算`);
    }
    
    // 获取当前时间加速
    getTimeAcceleration() {
        return this.timeAcceleration;
    }
    
    // 设置转向角度（无限制）
    setSteering(angle) {
        this.steeringAngle = angle; // 移除角度限制
        console.log(`转向角度设置为: ${this.steeringAngle.toFixed(1)}°`);
        
        // 更新导航条显示
        this.updateSteeringDisplay();
    }
    
    // 调整转向角度（相对变化）
    adjustSteering(delta) {
        this.steeringAngle += delta;
        console.log(`转向角度调整: ${delta.toFixed(2)}°, 当前角度: ${this.steeringAngle.toFixed(1)}°`);
        
        // 更新导航条显示
        this.updateSteeringDisplay();
    }
    
    // 向左转向
    steerLeft() {
        this.setSteering(this.steeringAngle - this.steeringStep);
    }
    
    // 向右转向
    steerRight() {
        this.setSteering(this.steeringAngle + this.steeringStep);
    }
    
    // 重置转向
    resetSteering() {
        this.setSteering(0);
    }
    
    // 更新转向显示（无角度限制）
    updateSteeringDisplay() {
        const steeringAngleElement = document.getElementById('steeringAngle');
        const navPointer = document.getElementById('navPointer');
        
        if (steeringAngleElement) {
            steeringAngleElement.textContent = `${this.steeringAngle.toFixed(0)}°`;
        }
        
        if (navPointer) {
            // 计算导航指针位置，以90°为导航条的满刻度范围
            const maxDisplayAngle = 90; // 导航条显示范围为±90°
            const maxOffset = 70; // 导航条半宽
            const clampedAngle = Math.max(-maxDisplayAngle, Math.min(maxDisplayAngle, this.steeringAngle));
            const offset = (clampedAngle / maxDisplayAngle) * maxOffset;
            navPointer.style.left = `calc(50% + ${offset}px)`;
            
            // 根据转向角度改变指针颜色（仅用于视觉提示，不限制功能）
            if (Math.abs(this.steeringAngle) > 90) {
                navPointer.style.background = '#FF6B6B'; // 大角度时显示红色提示
                navPointer.style.borderColor = '#FF4444';
            } else if (Math.abs(this.steeringAngle) > 15) {
                navPointer.style.background = '#FFE66D'; // 中等角度时显示黄色
                navPointer.style.borderColor = '#FFD700';
            } else {
                navPointer.style.background = '#87CEEB'; // 小角度时显示蓝色
                navPointer.style.borderColor = 'white';
            }
        }
    }
}

// 导出供其他模块使用
window.LaunchSimulation = LaunchSimulation;
