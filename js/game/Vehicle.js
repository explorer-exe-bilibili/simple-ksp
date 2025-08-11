// 载具类
class Vehicle {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.name = options.name || 'Untitled Craft';
        this.description = options.description || '';
        
        // 部件列表
        this.parts = options.parts || [];
        this.rootPart = null;
        
        // 物理属性
        this.physics = {
            position: options.position || { x: 0, y: 0, z: 0 },
            velocity: options.velocity || { x: 0, y: 0, z: 0 },
            acceleration: { x: 0, y: 0, z: 0 },
            rotation: options.rotation || { x: 0, y: 0, z: 0 },
            angularVelocity: options.angularVelocity || { x: 0, y: 0, z: 0 },
            mass: 0
        };
        
        // 飞行状态
        this.throttle = 0; // 0-1
        this.stage = 0;
        this.stages = [];
        
        // 系统状态
        this.sas = false;
        this.rcs = false;
        this.gear = false;
        this.lights = false;
        this.brakes = false;
        
        // 控制输入
        this.controlInput = {
            pitch: 0, // -1 to 1
            yaw: 0,
            roll: 0,
            throttle: 0
        };
        
        // 飞行数据
        this.altitude = 0;
        this.velocity = 0;
        this.accelerationMagnitude = 0;
        this.orbitInfo = null;
        
        // 引擎列表（缓存）
        this.engines = [];
        this.activeEngines = [];
        
        // 资源总量
        this.totalResources = {};
        
        // 初始化
        this.initialize();
    }
    
    generateId() {
        return 'vehicle_' + Math.random().toString(36).substr(2, 9);
    }
    
    initialize() {
        this.updatePartsCache();
        this.calculateMass();
        this.buildStages();
        
        // 设置根部件
        if (this.parts.length > 0 && !this.rootPart) {
            this.rootPart = this.parts.find(part => part.type === 'command') || this.parts[0];
        }
    }
    
    // 添加部件
    addPart(part, attachToPart = null, nodeIndex = 0) {
        if (!this.parts.includes(part)) {
            this.parts.push(part);
            
            if (attachToPart) {
                part.attachTo(attachToPart, nodeIndex);
            }
            
            // 如果是第一个部件或指令舱，设为根部件
            if (!this.rootPart || part.type === 'command') {
                this.rootPart = part;
            }
            
            this.updatePartsCache();
            this.calculateMass();
            this.buildStages();
        }
    }
    
    // 移除部件
    removePart(part) {
        const index = this.parts.indexOf(part);
        if (index > -1) {
            this.parts.splice(index, 1);
            
            // 断开所有连接
            part.connectedParts.forEach(connectedPart => {
                part.detachFrom(connectedPart);
            });
            
            // 如果是根部件，重新选择根部件
            if (this.rootPart === part) {
                this.rootPart = this.parts.find(p => p.type === 'command') || 
                                (this.parts.length > 0 ? this.parts[0] : null);
            }
            
            this.updatePartsCache();
            this.calculateMass();
            this.buildStages();
        }
    }
    
    // 更新部件缓存
    updatePartsCache() {
        this.engines = this.parts.filter(part => part.type === 'engine');
        this.activeEngines = this.engines.filter(engine => engine.isActive);
        
        // 更新资源总量
        this.totalResources = {};
        this.parts.forEach(part => {
            for (const [resourceName, amount] of Object.entries(part.resources)) {
                this.totalResources[resourceName] = (this.totalResources[resourceName] || 0) + amount;
            }
        });
    }
    
    // 计算总质量
    calculateMass() {
        this.physics.mass = this.parts.reduce((total, part) => {
            return total + part.getTotalMass();
        }, 0);
        
        return this.physics.mass;
    }
    
    // 构建分级
    buildStages() {
        this.stages = [];
        
        // 找出所有分级编号
        const stageNumbers = [...new Set(this.parts.map(part => part.stage))].sort((a, b) => b - a);
        
        stageNumbers.forEach(stageNum => {
            const stageParts = this.parts.filter(part => 
                part.stage === stageNum || 
                part.activatesInStage === stageNum || 
                part.decouplesInStage === stageNum
            );
            
            if (stageParts.length > 0) {
                this.stages.push({
                    number: stageNum,
                    parts: stageParts,
                    engines: stageParts.filter(part => part.type === 'engine'),
                    decouplers: stageParts.filter(part => part.type === 'decoupler')
                });
            }
        });
        
        this.stage = this.stages.length > 0 ? this.stages[0].number : 0;
    }
    
    // 激活下一级
    activateNextStage() {
        const currentStageIndex = this.stages.findIndex(stage => stage.number === this.stage);
        
        if (currentStageIndex >= 0) {
            const currentStage = this.stages[currentStageIndex];
            
            // 激活引擎
            currentStage.engines.forEach(engine => {
                engine.ignite();
            });
            
            // 激活分离器
            currentStage.decouplers.forEach(decoupler => {
                decoupler.decouple();
                // 分离部件逻辑
                this.handleDecoupling(decoupler);
            });
            
            // 激活其他部件
            currentStage.parts.forEach(part => {
                if (part.activatesInStage === this.stage) {
                    part.activate();
                }
            });
            
            // 切换到下一级
            if (currentStageIndex < this.stages.length - 1) {
                this.stage = this.stages[currentStageIndex + 1].number;
            }
            
            this.updatePartsCache();
            
            console.log(`激活分级 ${currentStage.number}`);
            return true;
        }
        
        return false;
    }
    
    // 处理分离逻辑
    handleDecoupling(decoupler) {
        // 简化版分离逻辑
        // 在实际实现中，这里需要创建新的载具对象
        const connectedParts = decoupler.connectedParts;
        
        connectedParts.forEach(part => {
            // 移除分离的部件
            this.removePart(part);
            
            // 给被分离的部件一个推力
            if (part.physics) {
                const ejectionForce = decoupler.ejectionForce || 15;
                part.physics.velocity.y -= ejectionForce * 0.1; // 简化的分离速度
            }
        });
    }
    
    // 更新载具状态
    update(deltaTime) {
        // 更新所有部件
        const environment = this.getCurrentEnvironment();
        
        this.parts.forEach(part => {
            if (!part.isDestroyed) {
                part.update(deltaTime, environment);
            }
        });
        
        // 移除被摧毁的部件
        this.parts = this.parts.filter(part => !part.isDestroyed);
        
        // 更新缓存和质量
        this.updatePartsCache();
        this.calculateMass();
        
        // 更新引擎推力
        this.updateEngines(deltaTime);
        
        // 应用控制输入
        this.applyControlInput(deltaTime);
        
        // SAS辅助
        if (this.sas) {
            this.applySAS(deltaTime);
        }
    }
    
    getCurrentEnvironment() {
        // 获取当前环境信息（由物理引擎提供）
        return {
            altitude: this.altitude,
            atmosphericDensity: gameEngine && gameEngine.physics ? 
                gameEngine.physics.getAtmosphereDensity(this.altitude) : 0,
            atmosphericPressure: gameEngine && gameEngine.physics ? 
                gameEngine.physics.getAtmospherePressure(this.altitude) : 0,
            temperature: 288.15 - this.altitude * 0.0065 // 简化的温度模型
        };
    }
    
    // 更新引擎
    updateEngines(deltaTime) {
        this.engines.forEach(engine => {
            engine.setThrottle(this.throttle);
        });
    }
    
    // 应用控制输入
    applyControlInput(deltaTime) {
        // 简化的姿态控制
        const torqueStrength = 10; // Nm
        
        if (Math.abs(this.controlInput.pitch) > 0.01) {
            this.physics.angularVelocity.x += this.controlInput.pitch * torqueStrength * deltaTime / this.physics.mass;
        }
        
        if (Math.abs(this.controlInput.yaw) > 0.01) {
            this.physics.angularVelocity.y += this.controlInput.yaw * torqueStrength * deltaTime / this.physics.mass;
        }
        
        if (Math.abs(this.controlInput.roll) > 0.01) {
            this.physics.angularVelocity.z += this.controlInput.roll * torqueStrength * deltaTime / this.physics.mass;
        }
        
        // 逐渐减小控制输入
        this.controlInput.pitch *= 0.9;
        this.controlInput.yaw *= 0.9;
        this.controlInput.roll *= 0.9;
    }
    
    // SAS稳定辅助系统
    applySAS(deltaTime) {
        const dampingFactor = 2.0;
        
        // 减小角速度（稳定姿态）
        this.physics.angularVelocity.x *= (1 - dampingFactor * deltaTime);
        this.physics.angularVelocity.y *= (1 - dampingFactor * deltaTime);
        this.physics.angularVelocity.z *= (1 - dampingFactor * deltaTime);
        
        // 回正姿态（简化版）
        const correctionStrength = 1.0;
        this.physics.angularVelocity.x -= this.physics.rotation.x * correctionStrength * deltaTime;
        this.physics.angularVelocity.z -= this.physics.rotation.z * correctionStrength * deltaTime;
    }
    
    // 控制方法
    setThrottle(throttle) {
        this.throttle = Math.max(0, Math.min(1, throttle));
        this.controlInput.throttle = this.throttle;
    }
    
    adjustThrottle(delta) {
        this.setThrottle(this.throttle + delta);
    }
    
    applyRotation(axis, value) {
        switch (axis) {
            case 'pitch':
                this.controlInput.pitch += value;
                break;
            case 'yaw':
                this.controlInput.yaw += value;
                break;
            case 'roll':
                this.controlInput.roll += value;
                break;
        }
        
        // 限制输入范围
        this.controlInput.pitch = Math.max(-1, Math.min(1, this.controlInput.pitch));
        this.controlInput.yaw = Math.max(-1, Math.min(1, this.controlInput.yaw));
        this.controlInput.roll = Math.max(-1, Math.min(1, this.controlInput.roll));
    }
    
    applyMouseInput(deltaX, deltaY) {
        const sensitivity = 0.5;
        this.applyRotation('yaw', deltaX * sensitivity);
        this.applyRotation('pitch', -deltaY * sensitivity);
    }
    
    // 系统切换
    toggleSAS() {
        const commandPod = this.parts.find(part => part.type === 'command' && part.hasSAS);
        if (commandPod && commandPod.resources.ElectricCharge > 0) {
            this.sas = !this.sas;
            commandPod.sasActive = this.sas;
            return this.sas;
        }
        return false;
    }
    
    toggleRCS() {
        this.rcs = !this.rcs;
        // 激活/停用RCS推进器
        this.parts.filter(part => part.type === 'rcs').forEach(rcs => {
            if (this.rcs) {
                rcs.activate();
            } else {
                rcs.deactivate();
            }
        });
        return this.rcs;
    }
    
    toggleGear() {
        this.gear = !this.gear;
        this.parts.filter(part => part.type === 'gear').forEach(gear => {
            gear.deployed = this.gear;
        });
        return this.gear;
    }
    
    toggleLights() {
        this.lights = !this.lights;
        this.parts.filter(part => part.type === 'light').forEach(light => {
            if (this.lights) {
                light.activate();
            } else {
                light.deactivate();
            }
        });
        return this.lights;
    }
    
    toggleBrakes() {
        this.brakes = !this.brakes;
        this.parts.filter(part => part.type === 'wheel').forEach(wheel => {
            wheel.braking = this.brakes;
        });
        return this.brakes;
    }
    
    // 激活动作组
    activateActionGroup(groupNumber) {
        this.parts.forEach(part => {
            if (part.actionGroups.includes(groupNumber)) {
                part.activate();
            }
        });
    }
    
    // 重置为发射状态
    resetForLaunch() {
        this.throttle = 0;
        this.stage = this.stages.length > 0 ? this.stages[0].number : 0;
        
        this.physics.velocity = { x: 0, y: 0, z: 0 };
        this.physics.angularVelocity = { x: 0, y: 0, z: 0 };
        this.physics.rotation = { x: 0, y: 0, z: 0 };
        
        this.controlInput = { pitch: 0, yaw: 0, roll: 0, throttle: 0 };
        
        // 重置部件状态
        this.parts.forEach(part => {
            part.isDestroyed = false;
            part.temperature = 273.15;
            
            if (part.type === 'engine') {
                part.ignited = false;
                part.throttle = 0;
                part.deactivate();
            }
            
            if (part.type === 'parachute') {
                part.deployed = false;
                part.deactivate();
            }
        });
        
        this.updatePartsCache();
    }
    
    // 设置位置
    setPosition(x, y, z) {
        this.physics.position.x = x;
        this.physics.position.y = y;
        this.physics.position.z = z;
        
        // 更新部件位置
        this.parts.forEach(part => {
            if (!part.position) part.position = { x: 0, y: 0, z: 0 };
        });
    }
    
    // 获取载具统计信息
    getStats() {
        const totalMass = this.calculateMass();
        const dryMass = this.parts.reduce((total, part) => total + part.mass, 0);
        const fuelMass = totalMass - dryMass;
        
        // 计算推重比
        const maxThrust = this.engines.reduce((total, engine) => total + engine.maxThrust, 0);
        const twr = maxThrust / (totalMass * 9.81);
        
        // 计算Delta-V（火箭方程）
        let deltaV = 0;
        if (fuelMass > 0) {
            const avgIsp = this.engines.length > 0 ? 
                this.engines.reduce((sum, e) => sum + e.specificImpulse.vacuum, 0) / this.engines.length : 0;
            if (avgIsp > 0) {
                deltaV = avgIsp * 9.81 * Math.log(totalMass / dryMass);
            }
        }
        
        return {
            totalMass,
            dryMass,
            fuelMass,
            twr,
            deltaV,
            partCount: this.parts.length,
            stageCount: this.stages.length,
            engineCount: this.engines.length
        };
    }
    
    // 获取载具信息
    getInfo() {
        const stats = this.getStats();
        
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            partCount: this.parts.length,
            mass: stats.totalMass,
            deltaV: stats.deltaV,
            twr: stats.twr,
            altitude: this.altitude,
            velocity: this.velocity,
            acceleration: this.accelerationMagnitude,
            throttle: this.throttle,
            stage: this.stage,
            sas: this.sas,
            rcs: this.rcs,
            resources: { ...this.totalResources }
        };
    }
    
    // 保存载具设计
    saveDesign() {
        return {
            name: this.name,
            description: this.description,
            parts: this.parts.map(part => ({
                id: part.id,
                name: part.name,
                type: part.type,
                position: { ...part.position },
                rotation: { ...part.rotation },
                stage: part.stage,
                resources: { ...part.resources },
                maxResources: { ...part.maxResources }
            })),
            connections: this.parts.map(part => ({
                partId: part.id,
                connectedTo: part.connectedParts.map(p => p.id)
            }))
        };
    }
    
    // 从设计数据加载载具
    static loadFromDesign(designData) {
        const vehicle = new Vehicle({
            name: designData.name,
            description: designData.description
        });
        
        // 重建部件
        const partMap = new Map();
        
        designData.parts.forEach(partData => {
            const part = createPart(partData.name) || new Part(partData);
            part.id = partData.id;
            part.position = partData.position;
            part.rotation = partData.rotation;
            part.stage = partData.stage;
            part.resources = partData.resources;
            part.maxResources = partData.maxResources;
            
            vehicle.addPart(part);
            partMap.set(part.id, part);
        });
        
        // 重建连接
        designData.connections.forEach(connectionData => {
            const part = partMap.get(connectionData.partId);
            if (part) {
                connectionData.connectedTo.forEach(connectedId => {
                    const connectedPart = partMap.get(connectedId);
                    if (connectedPart) {
                        part.attachTo(connectedPart);
                    }
                });
            }
        });
        
        vehicle.initialize();
        return vehicle;
    }
}

// 载具模板
const VEHICLE_TEMPLATES = {
    'basic-rocket': {
        name: '基础火箭',
        description: '简单的单级火箭，适合初学者',
        parts: [
            { type: 'mk1-command-pod', position: { x: 0, y: 2, z: 0 }, stage: 1 },
            { type: 'mk16-parachute', position: { x: 0, y: 2.5, z: 0 }, stage: 1 },
            { type: 'fl-t400-fuel-tank', position: { x: 0, y: 0, z: 0 }, stage: 1 },
            { type: 'lv-t30-reliant', position: { x: 0, y: -1.2, z: 0 }, stage: 1 }
        ]
    },
    
    'two-stage-rocket': {
        name: '两级火箭',
        description: '两级火箭，能够到达轨道',
        parts: [
            // 第二级（顶部）
            { type: 'mk1-command-pod', position: { x: 0, y: 4, z: 0 }, stage: 2 },
            { type: 'mk16-parachute', position: { x: 0, y: 4.5, z: 0 }, stage: 2 },
            { type: 'fl-t400-fuel-tank', position: { x: 0, y: 2.5, z: 0 }, stage: 2 },
            { type: 'lv-t45-swivel', position: { x: 0, y: 1.3, z: 0 }, stage: 2 },
            // 分离器
            { type: 'tt-38k-decoupler', position: { x: 0, y: 1, z: 0 }, decouplesInStage: 2 },
            // 第一级（底部）
            { type: 'fl-t800-fuel-tank', position: { x: 0, y: -0.5, z: 0 }, stage: 1 },
            { type: 'lv-t30-reliant', position: { x: 0, y: -1.7, z: 0 }, stage: 1 }
        ]
    }
};

function createVehicleFromTemplate(templateName) {
    const template = VEHICLE_TEMPLATES[templateName];
    if (!template) return null;
    
    const vehicle = new Vehicle({
        name: template.name,
        description: template.description
    });
    
    template.parts.forEach(partData => {
        const part = createPart(partData.type);
        if (part) {
            part.position = partData.position;
            part.stage = partData.stage || 0;
            part.activatesInStage = partData.activatesInStage || -1;
            part.decouplesInStage = partData.decouplesInStage || -1;
            
            vehicle.addPart(part);
        }
    });
    
    return vehicle;
}

// 导出给其他模块使用
window.Vehicle = Vehicle;
window.createVehicleFromTemplate = createVehicleFromTemplate;
window.VEHICLE_TEMPLATES = VEHICLE_TEMPLATES;
