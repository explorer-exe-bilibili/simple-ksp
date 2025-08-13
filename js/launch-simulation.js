// 发射模拟核心类
class LaunchSimulation {
    constructor(assembly) {
        this.assembly = assembly;
        this.isRunning = false;
        this.isPaused = false;
        
        // 物理状态
        this.altitude = 0;          // 高度 (米)
        this.velocity = 0;          // 垂直速度 (米/秒)
        this.acceleration = 0;      // 加速度 (米/秒²)
        this.mass = 0;              // 当前质量 (吨)
        
        // 环境参数
        this.gravity = 9.81;        // 重力加速度
        this.airDensity = 1.225;    // 海平面空气密度
        this.dragCoefficient = 0.5; // 阻力系数
        
        // 时间步长
        this.deltaTime = 0.1;       // 100ms per step
        this.simulationTimer = null;
        this.lastDebugTime = 0;     // 调试输出时间控制
        
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
                engines: this.assembly.parts.filter(p => p.data.type === 'engine')
            }];
        }
        
        console.log('初始化分级:', this.stages);
        console.log('初始质量:', this.mass, 'tons');
    }

    // 开始模拟
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        
        // 重置状态
        this.altitude = 0;
        this.velocity = 0;
        this.acceleration = 0;
        
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
        // 计算当前推力
        const thrust = this.calculateThrust();
        
        // 计算空气阻力
        const drag = this.calculateDrag();
        
        // 计算重力
        const gravityForce = this.mass * 1000 * this.gravity; // 转换为牛顿
        
        // 计算净力
        const netForce = thrust - gravityForce - drag;
        
        // 计算加速度 (m/s²)
        this.acceleration = netForce / (this.mass * 1000); // 质量转换为kg
        
        // 调试输出（每秒输出一次）
        if (Math.floor(Date.now() / 1000) !== this.lastDebugTime) {
            this.lastDebugTime = Math.floor(Date.now() / 1000);
            console.log(`物理状态 - 推力: ${(thrust/1000).toFixed(1)}kN, 重力: ${(gravityForce/1000).toFixed(1)}kN, 净力: ${(netForce/1000).toFixed(1)}kN, 加速度: ${this.acceleration.toFixed(2)}m/s²`);
        }
        
        // 更新速度和位置
        this.velocity += this.acceleration * this.deltaTime;
        this.altitude += this.velocity * this.deltaTime;
        
        // 地面检查
        if (this.altitude < 0) {
            this.altitude = 0;
            this.velocity = 0;
            this.handleCrash();
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
                totalThrust += currentThrust;
                console.log(`引擎 ${engine.data.name} 推力: ${currentThrust.toFixed(1)} kN`);
            }
        });
        
        console.log(`总推力: ${totalThrust.toFixed(1)} kN`);
        return totalThrust * 1000; // 转换为牛顿
    }

    // 计算空气阻力
    calculateDrag() {
        // 简化的阻力模型
        const atmosphericDensity = this.airDensity * Math.exp(-this.altitude / 8000);
        const crossSectionArea = 1.0; // 简化：假设1平方米截面积
        
        // F_drag = 0.5 * ρ * v² * Cd * A
        const drag = 0.5 * atmosphericDensity * (this.velocity * this.velocity) * 
                    this.dragCoefficient * crossSectionArea;
        
        return Math.max(0, drag);
    }

    // 更新质量（燃料消耗）
    updateMass() {
        const engines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && this.isPartInCurrentStage(part)
        );
        
        engines.forEach(engine => {
            if (this.hasEnoughFuel(engine) && engine.data.fuel_consumption) {
                const consumption = engine.data.fuel_consumption;
                
                // 优先从引擎自身消耗燃料
                if (engine.fuelStatus) {
                    if (consumption.liquid_fuel) {
                        engine.fuelStatus.liquid_fuel = Math.max(0, 
                            engine.fuelStatus.liquid_fuel - consumption.liquid_fuel * this.deltaTime
                        );
                    }
                    if (consumption.oxidizer) {
                        engine.fuelStatus.oxidizer = Math.max(0, 
                            engine.fuelStatus.oxidizer - consumption.oxidizer * this.deltaTime
                        );
                    }
                } else {
                    // 从燃料罐中消耗燃料
                    const fuelTanks = this.assembly.parts.filter(p => p.data.fuel_capacity && p.fuelStatus);
                    if (fuelTanks.length > 0) {
                        const tank = fuelTanks[0]; // 使用第一个燃料罐
                        if (consumption.liquid_fuel) {
                            tank.fuelStatus.liquid_fuel = Math.max(0, 
                                tank.fuelStatus.liquid_fuel - consumption.liquid_fuel * this.deltaTime
                            );
                        }
                        if (consumption.oxidizer) {
                            tank.fuelStatus.oxidizer = Math.max(0, 
                                tank.fuelStatus.oxidizer - consumption.oxidizer * this.deltaTime
                            );
                        }
                    }
                }
            }
        });
        
        // 重新计算总质量
        this.mass = this.assembly.getTotalMass();
    }

    // 检查分级条件
    checkStaging() {
        if (this.currentStage >= this.stages.length) return;
        
        // 检查当前级是否燃料耗尽
        const currentStageEngines = this.assembly.parts.filter(part => 
            part.data.type === 'engine' && this.isPartInCurrentStage(part)
        );
        
        const hasActiveFuel = currentStageEngines.some(engine => this.hasEnoughFuel(engine));
        
        if (!hasActiveFuel && currentStageEngines.length > 0) {
            console.log('当前级燃料耗尽，准备分离');
            setTimeout(() => {
                this.activateNextStage();
            }, 1000); // 1秒后自动分离
        }
    }

    // 激活下一级
    activateNextStage() {
        if (this.currentStage >= this.stages.length - 1) {
            console.log('没有更多分级');
            return false;
        }
        
        const currentStage = this.stages[this.currentStage];
        if (currentStage && currentStage.decoupler) {
            // 触发分离动画
            this.showSeparationEffect(currentStage.decoupler);
            
            // 更新分级状态
            this.currentStage++;
            
            // 更新UI
            this.updateStagingUI();
            
            console.log(`激活第 ${this.currentStage + 1} 级`);
            return true;
        }
        
        return false;
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
        document.getElementById('acceleration').textContent = `${this.acceleration.toFixed(1)} m/s²`;
        document.getElementById('mass').textContent = `${this.mass.toFixed(2)} t`;
        
        // 计算当前推重比
        const thrust = this.calculateThrust() / 1000; // 转换为kN
        const twr = this.mass > 0 ? (thrust / (this.mass * 9.81)) : 0;
        document.getElementById('twr').textContent = twr.toFixed(2);
        
        // 计算剩余Delta-V
        const remainingDeltaV = this.calculateRemainingDeltaV();
        document.getElementById('deltaV').textContent = `${Math.round(remainingDeltaV)} m/s`;
        
        // 更新火箭位置
        this.updateRocketPosition();
    }

    // 更新火箭视觉位置
    updateRocketPosition() {
        const rocketDisplay = document.getElementById('rocketDisplay');
        if (rocketDisplay) {
            // 根据高度调整火箭位置（视觉效果）
            const maxVisualHeight = 300; // 最大视觉移动距离
            const visualHeight = Math.min(this.altitude / 1000 * 50, maxVisualHeight);
            
            const baseBottom = 200; // 基础底部位置
            const newBottom = baseBottom + visualHeight;
            
            rocketDisplay.style.bottom = `${newBottom}px`;
            rocketDisplay.style.transform = `translateX(-50%) scale(${Math.max(0.3, 1 - visualHeight / 1000)})`;
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
        
        // 对于多级火箭，需要更复杂的逻辑来确定部件所属的级
        // 简化实现：假设所有部件都在第一级，直到分离
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
            console.log(`引擎 ${engine.data.name} 没有燃料状态，检查周围燃料罐`);
            // 检查是否有燃料罐连接
            const fuelTanks = this.assembly.parts.filter(p => p.data.fuel_capacity);
            if (fuelTanks.length > 0) {
                // 使用第一个找到的燃料罐
                const tank = fuelTanks[0];
                if (tank.fuelStatus) {
                    return tank.fuelStatus.liquid_fuel > 0 && tank.fuelStatus.oxidizer > 0;
                }
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

    // 处理撞毁
    handleCrash() {
        this.stop();
        console.log('火箭撞毁！');
        
        // 显示撞毁效果
        if (typeof showNotification === 'function') {
            showNotification('任务失败', '火箭撞毁了！', 'error');
        }
    }
}

// 导出供其他模块使用
window.LaunchSimulation = LaunchSimulation;
