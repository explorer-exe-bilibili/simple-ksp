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
        this.gravity = 9.81;        // 重力加速度
        this.airDensity = 1.225;    // 海平面空气密度
        this.dragCoefficient = 0.3; // 阻力系数（火箭形状优化）
        this.crossSectionArea = 1.0; // 横截面积（平方米）
        
        // 时间步长
        this.deltaTime = 0.1;       // 100ms per step
        this.simulationTimer = null;
        this.lastDebugTime = 0;     // 调试输出时间控制
        this.lastFuelDebugTime = 0; // 燃料调试输出时间控制
        
        // 节流阀控制
        this.throttle = 1.0;        // 节流阀设置 (0.0-1.0)
        
        // 转向控制
        this.steeringAngle = 0;     // 转向角度 (-90° 到 +90°, 0°为垂直向上)
        this.maxSteeringAngle = 45; // 最大转向角度
        this.steeringStep = 1;      // 每次调整的转向步长（更小的步长实现平滑控制）
        
        // 当前激活的级
        this.currentStage = 0;
        this.stages = [];
        
        this.initializeStages();
    }

    // 初始化分级信息
    initializeStages() {
        this.stages = this.assembly.getStagingInfo();
        this.mass = this.assembly.getTotalMass();
        
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
        
        // 启动模拟循环
        this.simulationTimer = setInterval(() => {
            if (!this.isPaused) {
                this.updatePhysics();
                this.updateDisplay();
                this.checkStaging();
            }
        }, this.deltaTime * 1000);
        
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

    // 更新物理状态
    updatePhysics() {
        // 计算当前推力（总推力）
        const totalThrust = this.calculateThrust();
        
        // 将推力分解为水平和垂直分量
        // 转向角度：0°为垂直向上，正角度向右，负角度向左
        const steeringRadians = this.steeringAngle * Math.PI / 180;
        const verticalThrust = totalThrust * Math.cos(steeringRadians);   // 垂直分量
        const horizontalThrust = totalThrust * Math.sin(steeringRadians); // 水平分量
        
        // 计算空气阻力（垂直和水平分别计算）
        const verticalDrag = this.calculateDrag(this.velocity);
        const horizontalDrag = this.calculateDrag(this.horizontalVelocity);
        
        // 计算重力（只有垂直分量，向下为负）
        const gravityForce = -(this.mass * 1000 * this.gravity);
        
        // 计算净力
        const netVerticalForce = verticalThrust + gravityForce + verticalDrag;
        const netHorizontalForce = horizontalThrust + horizontalDrag;
        
        // 计算加速度 (m/s²)
        this.acceleration = netVerticalForce / (this.mass * 1000);
        this.horizontalAcceleration = netHorizontalForce / (this.mass * 1000);
        
        // 调试输出（每秒输出一次）
        if (Math.floor(Date.now() / 1000) !== this.lastDebugTime) {
            this.lastDebugTime = Math.floor(Date.now() / 1000);
            console.log(`物理状态:`);
            console.log(`  转向角度: ${this.steeringAngle.toFixed(1)}°`);
            console.log(`  总推力: ${(totalThrust/1000).toFixed(1)}kN`);
            console.log(`  垂直推力: ${(verticalThrust/1000).toFixed(1)}kN`);
            console.log(`  水平推力: ${(horizontalThrust/1000).toFixed(1)}kN`);
            console.log(`  重力: ${(Math.abs(gravityForce)/1000).toFixed(1)}kN (向下)`);
            console.log(`  垂直净力: ${(netVerticalForce/1000).toFixed(1)}kN, 加速度: ${this.acceleration.toFixed(2)}m/s²`);
            console.log(`  水平净力: ${(netHorizontalForce/1000).toFixed(1)}kN, 加速度: ${this.horizontalAcceleration.toFixed(2)}m/s²`);
            console.log(`  垂直速度: ${this.velocity.toFixed(1)}m/s, 高度: ${this.altitude.toFixed(1)}m`);
            console.log(`  水平速度: ${this.horizontalVelocity.toFixed(1)}m/s, 水平位置: ${this.horizontalPosition.toFixed(1)}m`);
        }
        
        // 更新速度和位置
        this.velocity += this.acceleration * this.deltaTime;
        this.horizontalVelocity += this.horizontalAcceleration * this.deltaTime;
        this.altitude += this.velocity * this.deltaTime;
        this.horizontalPosition += this.horizontalVelocity * this.deltaTime;
        
        // 地面检查
        if (this.altitude < 0) {
            this.altitude = 0;
            this.handleLanding();
        }
        
        // 重新起飞检查：如果火箭已着陆但有向上的推力，可以重新起飞
        if (this.landed && this.altitude === 0 && verticalThrust > 0) {
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
        
        // 更新质量（燃料消耗）
        this.updateMass();
        
        // 更新视觉效果
        this.updateVisualEffects();
    }

    // 计算推力
    calculateThrust() {
        if (this.currentStage >= this.stages.length) return 0;
        
        const stage = this.stages[this.currentStage];
        if (!stage) return 0;
        
        // 找到当前级的引擎
        let engines = [];
        if (stage.engines) {
            // 如果分级中有引擎列表，使用它
            engines = stage.engines;
        } else {
            // 否则查找所有引擎（适用于单级火箭）
            engines = this.assembly.parts.filter(part => 
                part.data.type === 'engine' && this.isPartInCurrentStage(part)
            );
        }
        
        let totalThrust = 0;
        engines.forEach(engine => {
            if (this.hasEnoughFuel(engine)) {
                // 根据高度调整推力（简化的大气效应）
                const atmosphericPressure = Math.exp(-this.altitude / 8000); // 简化大气模型
                const thrustAtm = engine.data.thrust_atm || engine.data.thrust;
                const thrustVac = engine.data.thrust || thrustAtm;
                
                const currentThrust = thrustAtm + (thrustVac - thrustAtm) * (1 - atmosphericPressure);
                // 应用节流阀设置
                const throttledThrust = currentThrust * this.throttle;
                totalThrust += throttledThrust;
                console.log(`引擎 ${engine.data.name} 推力: ${throttledThrust.toFixed(1)} kN (${Math.round(this.throttle * 100)}%)`);
            }
        });
        
        console.log(`总推力: ${totalThrust.toFixed(1)} kN`);
        return totalThrust * 1000; // 转换为牛顿
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
            part.data.type === 'engine' && this.isPartInCurrentStage(part)
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
                            engine.fuelStatus.liquid_fuel - consumption.liquid_fuel * this.deltaTime * throttleMultiplier
                        );
                    }
                    if (consumption.oxidizer) {
                        engine.fuelStatus.oxidizer = Math.max(0, 
                            engine.fuelStatus.oxidizer - consumption.oxidizer * this.deltaTime * throttleMultiplier
                        );
                    }
                } else {
                    // 只从当前级的燃料罐中消耗燃料
                    this.consumeFuelFromCurrentStageTanks(consumption, throttleMultiplier);
                }
            }
        });
        
        // 重新计算总质量
        this.mass = this.assembly.getTotalMass();
    }

    // 从当前级的燃料罐中消耗燃料的辅助方法
    consumeFuelFromCurrentStageTanks(consumption, throttleMultiplier = 1) {
        // 只获取当前级的燃料罐
        const currentStageFuelTanks = this.assembly.parts.filter(p => 
            p.data.fuel_capacity && p.fuelStatus && this.isPartInCurrentStage(p)
        );
        
        if (currentStageFuelTanks.length === 0) return;

        // 计算当前级燃料罐的总燃料量
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        currentStageFuelTanks.forEach(tank => {
            totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
            totalOxidizer += tank.fuelStatus.oxidizer || 0;
        });

        // 按比例从当前级的燃料罐消耗燃料
        if (consumption.liquid_fuel && totalLiquidFuel > 0) {
            const liquidFuelToConsume = consumption.liquid_fuel * this.deltaTime * throttleMultiplier;
            currentStageFuelTanks.forEach(tank => {
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
            const oxidizerToConsume = consumption.oxidizer * this.deltaTime * throttleMultiplier;
            currentStageFuelTanks.forEach(tank => {
                if (tank.fuelStatus.oxidizer > 0) {
                    const proportion = tank.fuelStatus.oxidizer / totalOxidizer;
                    const consumeFromThisTank = oxidizerToConsume * proportion;
                    tank.fuelStatus.oxidizer = Math.max(0, 
                        tank.fuelStatus.oxidizer - consumeFromThisTank
                    );
                }
            });
        }
        
        console.log(`当前级燃料消耗 (${Math.round(throttleMultiplier * 100)}% 节流阀): 液体燃料-${(consumption.liquid_fuel * this.deltaTime * throttleMultiplier).toFixed(2)}, 氧化剂-${(consumption.oxidizer * this.deltaTime * throttleMultiplier).toFixed(2)}`);
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
        const currentStageEngines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && this.isPartInCurrentStage(part)
        );
        
        if (currentStageEngines.length === 0) {
            console.log('当前级没有引擎，尝试分离');
            setTimeout(() => {
                this.activateNextStage();
            }, 500);
            return;
        }
        
        // 检查是否还有任何引擎有燃料
        const hasActiveFuel = currentStageEngines.some(engine => this.hasEnoughFuel(engine));
        
        // 额外检查：如果引擎依赖燃料罐，检查当前级的燃料罐总量
        if (!hasActiveFuel) {
            const currentStageFuelTanks = this.assembly.parts.filter(p => 
                p.data.fuel_capacity && p.fuelStatus && this.isPartInCurrentStage(p)
            );
            
            let totalLiquidFuel = 0;
            let totalOxidizer = 0;
            
            currentStageFuelTanks.forEach(tank => {
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
        
        // 如果当前级有分离器，触发分离效果
        if (currentStage && currentStage.decoupler) {
            this.showSeparationEffect(currentStage.decoupler);
        } else {
            console.log('注意：当前级没有分离器，但仍然执行分级');
        }
        
        // 更新分级状态
        this.currentStage++;
        
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

    // 显示分离特效
    showSeparationEffect(decoupler) {
        const partElement = document.getElementById(`launch-part-${decoupler.id}`);
        if (partElement) {
            // 添加分离动画
            partElement.style.animation = 'separationEffect 2s ease-out forwards';
            
            setTimeout(() => {
                partElement.style.opacity = '0.3';
                partElement.style.filter = 'grayscale(100%)';
            }, 2000);
        }
    }

    // 更新显示
    updateDisplay() {
        // 更新飞行数据
        document.getElementById('altitude').textContent = `${Math.round(this.altitude)} m`;
        document.getElementById('velocity').textContent = `${Math.round(this.velocity)} m/s`;
        document.getElementById('horizontalVelocity').textContent = `${Math.round(this.horizontalVelocity)} m/s`;
        document.getElementById('horizontalPosition').textContent = `${Math.round(this.horizontalPosition)} m`;
        document.getElementById('acceleration').textContent = `${this.acceleration.toFixed(1)} m/s²`;
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
        
        // 计算当前推重比
        const thrust = this.calculateThrust() / 1000; // 转换为kN
        const twr = this.mass > 0 ? (thrust / (this.mass * 9.81)) : 0;
        document.getElementById('twr').textContent = twr.toFixed(2);
        
        // 计算剩余Delta-V
        const remainingDeltaV = this.calculateRemainingDeltaV();
        document.getElementById('deltaV').textContent = `${Math.round(remainingDeltaV)} m/s`;
        
        // 更新燃料显示
        this.updateFuelDisplay();
        
        // 更新转向显示
        this.updateSteeringDisplay();
        
        // 更新火箭位置
        this.updateRocketPosition();
    }

    // 更新燃料显示
    updateFuelDisplay() {
        // 只显示当前级的燃料罐燃料
        const currentStageFuelTanks = this.assembly.parts.filter(p => 
            p.data.fuel_capacity && this.isPartInCurrentStage(p)
        );
        
        let currentStageLiquidFuel = 0;
        let currentStageOxidizer = 0;
        
        currentStageFuelTanks.forEach(tank => {
            if (tank.fuelStatus) {
                currentStageLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                currentStageOxidizer += tank.fuelStatus.oxidizer || 0;
            }
        });

        // 同时计算总燃料（用于显示在其他地方）
        const allFuelTanks = this.assembly.parts.filter(p => p.data.fuel_capacity);
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        
        allFuelTanks.forEach(tank => {
            if (tank.fuelStatus) {
                totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                totalOxidizer += tank.fuelStatus.oxidizer || 0;
            }
        });

        // 更新主要燃料显示（当前级）
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
            console.log(`第${this.currentStage + 1}级燃料 - 液体燃料: ${currentStageLiquidFuel.toFixed(1)}, 氧化剂: ${currentStageOxidizer.toFixed(1)}`);
            console.log(`总燃料 - 液体燃料: ${totalLiquidFuel.toFixed(1)}, 氧化剂: ${totalOxidizer.toFixed(1)}`);
        }
    }

    // 更新火箭视觉位置
    updateRocketPosition() {
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
    }

    // 更新视觉效果
    updateVisualEffects() {
        const engines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && this.isPartInCurrentStage(part)
        );
        
        engines.forEach(engine => {
            const flameElement = document.getElementById(`flame-${engine.id}`);
            if (flameElement) {
                if (this.hasEnoughFuel(engine)) {
                    flameElement.classList.add('active');
                    // 根据推力调整火焰大小
                    const thrustRatio = (engine.data.thrust || 0) / 100; // 归一化到0-1
                    const flameHeight = 40 + thrustRatio * 40; // 40-80px
                    flameElement.style.height = `${flameHeight}px`;
                } else {
                    flameElement.classList.remove('active');
                }
            }
        });
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
            console.log(`引擎 ${engine.data.name} 没有燃料状态，检查当前级燃料罐`);
            // 只检查当前级燃料罐的燃料总量
            const currentStageFuelTanks = this.assembly.parts.filter(p => 
                p.data.fuel_capacity && this.isPartInCurrentStage(p)
            );
            
            if (currentStageFuelTanks.length > 0) {
                let totalLiquidFuel = 0;
                let totalOxidizer = 0;
                
                currentStageFuelTanks.forEach(tank => {
                    if (tank.fuelStatus) {
                        totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                        totalOxidizer += tank.fuelStatus.oxidizer || 0;
                    }
                });
                
                const consumption = engine.data.fuel_consumption;
                const hasEnoughLiquid = !consumption.liquid_fuel || totalLiquidFuel > 0;
                const hasEnoughOxidizer = !consumption.oxidizer || totalOxidizer > 0;
                
                console.log(`当前级燃料检查: 液体燃料=${totalLiquidFuel.toFixed(1)}, 氧化剂=${totalOxidizer.toFixed(1)}`);
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
        console.log(`引擎 ${engine.data.name} 燃料检查: 液体燃料=${engine.fuelStatus.liquid_fuel}, 氧化剂=${engine.fuelStatus.oxidizer}, 有燃料=${hasFuel}`);
        
        return hasFuel;
    }

    // 计算剩余Delta-V
    calculateRemainingDeltaV() {
        let totalDeltaV = 0;
        
        for (let i = this.currentStage; i < this.stages.length; i++) {
            const stage = this.stages[i];
            if (stage && stage.deltaV) {
                totalDeltaV += stage.deltaV;
            }
        }
        
        return totalDeltaV;
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
    }
    
    // 获取当前节流阀设置
    getThrottle() {
        return this.throttle;
    }
    
    // 设置转向角度
    setSteering(angle) {
        this.steeringAngle = Math.max(-this.maxSteeringAngle, 
                                     Math.min(this.maxSteeringAngle, angle));
        console.log(`转向角度设置为: ${this.steeringAngle.toFixed(1)}°`);
        
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
    
    // 更新转向显示
    updateSteeringDisplay() {
        const steeringAngleElement = document.getElementById('steeringAngle');
        const navPointer = document.getElementById('navPointer');
        
        if (steeringAngleElement) {
            steeringAngleElement.textContent = `${this.steeringAngle.toFixed(0)}°`;
        }
        
        if (navPointer) {
            // 计算导航指针位置，140px宽的导航条，最大角度45°
            const maxOffset = 70; // 导航条半宽
            const offset = (this.steeringAngle / this.maxSteeringAngle) * maxOffset;
            navPointer.style.left = `calc(50% + ${offset}px)`;
            
            // 根据转向角度改变指针颜色
            if (Math.abs(this.steeringAngle) > 30) {
                navPointer.style.background = '#FF6B6B'; // 大角度时显示红色警告
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
