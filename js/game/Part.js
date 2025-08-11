// 部件基类
class Part {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.name = options.name || 'Unknown Part';
        this.type = options.type || 'structure';
        this.category = options.category || 'structure';
        
        // 物理属性
        this.mass = options.mass || 0.1; // kg
        this.cost = options.cost || 100; // 资金
        this.size = options.size || 1.25; // 直径 (m)
        this.height = options.height || 0.5; // 高度 (m)
        
        // 位置和旋转（相对于载具）
        this.position = options.position || { x: 0, y: 0, z: 0 };
        this.rotation = options.rotation || { x: 0, y: 0, z: 0 };
        
        // 连接点
        this.attachmentNodes = options.attachmentNodes || [];
        this.connectedParts = [];
        
        // 资源
        this.resources = options.resources || {};
        this.maxResources = options.maxResources || {};
        
        // 状态
        this.isActive = options.isActive || false;
        this.isDestroyed = false;
        this.temperature = 273.15; // K
        this.maxTemperature = options.maxTemperature || 2000;
        
        // 空气动力学
        this.dragCoefficient = options.dragCoefficient || 0.47;
        this.liftCoefficient = options.liftCoefficient || 0;
        this.crossSectionalArea = options.crossSectionalArea || this.calculateCrossSection();
        
        // 分级
        this.stage = options.stage || 0;
        this.activatesInStage = options.activatesInStage || -1;
        this.decouplesInStage = options.decouplesInStage || -1;
        
        // 动作组
        this.actionGroups = options.actionGroups || [];
        
        // 可视化
        this.color = options.color || '#ffffff';
        this.visible = options.visible !== false;
    }
    
    generateId() {
        return 'part_' + Math.random().toString(36).substr(2, 9);
    }
    
    calculateCrossSection() {
        // 简化的横截面积计算
        return Math.PI * Math.pow(this.size / 2, 2);
    }
    
    // 更新部件状态
    update(deltaTime, environment) {
        // 更新温度
        this.updateTemperature(deltaTime, environment);
        
        // 检查是否过热
        if (this.temperature > this.maxTemperature) {
            this.destroy();
        }
        
        // 子类特定的更新
        this.onUpdate(deltaTime, environment);
    }
    
    onUpdate(deltaTime, environment) {
        // 由子类重写
    }
    
    updateTemperature(deltaTime, environment) {
        // 简化的温度模型
        const ambientTemp = environment.atmosphericDensity > 0 ? 288.15 : 2.7; // 大气或太空温度
        const coolingRate = 0.1; // K/s
        
        // 向环境温度收敛
        const tempDiff = this.temperature - ambientTemp;
        this.temperature -= tempDiff * coolingRate * deltaTime;
    }
    
    // 激活部件
    activate() {
        this.isActive = true;
        this.onActivate();
    }
    
    // 停用部件
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
    }
    
    onActivate() {
        // 由子类重写
    }
    
    onDeactivate() {
        // 由子类重写
    }
    
    // 销毁部件
    destroy() {
        this.isDestroyed = true;
        this.onDestroy();
    }
    
    onDestroy() {
        // 由子类重写
    }
    
    // 连接到其他部件
    attachTo(otherPart, nodeIndex = 0) {
        if (!this.connectedParts.includes(otherPart)) {
            this.connectedParts.push(otherPart);
            otherPart.connectedParts.push(this);
        }
    }
    
    // 断开连接
    detachFrom(otherPart) {
        const index = this.connectedParts.indexOf(otherPart);
        if (index > -1) {
            this.connectedParts.splice(index, 1);
            const otherIndex = otherPart.connectedParts.indexOf(this);
            if (otherIndex > -1) {
                otherPart.connectedParts.splice(otherIndex, 1);
            }
        }
    }
    
    // 添加资源
    addResource(resourceName, amount, maxAmount = null) {
        this.resources[resourceName] = amount;
        if (maxAmount !== null) {
            this.maxResources[resourceName] = maxAmount;
        }
    }
    
    // 消耗资源
    consumeResource(resourceName, amount) {
        const current = this.resources[resourceName] || 0;
        const consumed = Math.min(amount, current);
        this.resources[resourceName] = current - consumed;
        return consumed;
    }
    
    // 转移资源
    transferResource(resourceName, targetPart, amount) {
        const available = this.resources[resourceName] || 0;
        const toTransfer = Math.min(amount, available);
        
        if (toTransfer > 0) {
            this.resources[resourceName] -= toTransfer;
            targetPart.resources[resourceName] = (targetPart.resources[resourceName] || 0) + toTransfer;
        }
        
        return toTransfer;
    }
    
    // 获取资源总量
    getTotalResourceMass() {
        let totalMass = 0;
        for (const [resourceName, amount] of Object.entries(this.resources)) {
            const density = RESOURCE_DENSITIES[resourceName] || 1;
            totalMass += amount * density;
        }
        return totalMass;
    }
    
    // 获取部件总质量
    getTotalMass() {
        return this.mass + this.getTotalResourceMass();
    }
    
    // 克隆部件
    clone() {
        return new this.constructor({
            name: this.name,
            type: this.type,
            category: this.category,
            mass: this.mass,
            cost: this.cost,
            size: this.size,
            height: this.height,
            maxTemperature: this.maxTemperature,
            dragCoefficient: this.dragCoefficient,
            liftCoefficient: this.liftCoefficient,
            resources: { ...this.resources },
            maxResources: { ...this.maxResources },
            color: this.color
        });
    }
    
    // 获取部件信息
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            category: this.category,
            mass: this.getTotalMass(),
            cost: this.cost,
            size: this.size,
            height: this.height,
            temperature: this.temperature,
            resources: { ...this.resources },
            maxResources: { ...this.maxResources },
            stage: this.stage,
            isActive: this.isActive,
            isDestroyed: this.isDestroyed
        };
    }
}

// 指令舱部件
class CommandPart extends Part {
    constructor(options = {}) {
        super({
            type: 'command',
            category: 'command',
            mass: 0.84,
            cost: 600,
            size: 1.25,
            height: 0.8,
            maxTemperature: 2400,
            ...options
        });
        
        this.crewCapacity = options.crewCapacity || 1;
        this.currentCrew = options.currentCrew || [];
        this.hasElectric = true;
        this.electricConsumption = 0.02; // 电力消耗 EC/s
        
        // 添加电力资源
        this.addResource('ElectricCharge', 150, 150);
        
        // SAS能力
        this.hasSAS = options.hasSAS !== false;
        this.sasLevel = options.sasLevel || 1;
        this.sasActive = false;
    }
    
    onUpdate(deltaTime, environment) {
        // 消耗电力
        if (this.isActive) {
            this.consumeResource('ElectricCharge', this.electricConsumption * deltaTime);
        }
        
        // SAS消耗额外电力
        if (this.sasActive) {
            this.consumeResource('ElectricCharge', 0.005 * deltaTime);
        }
    }
    
    toggleSAS() {
        if (this.hasSAS && this.resources.ElectricCharge > 0) {
            this.sasActive = !this.sasActive;
            return this.sasActive;
        }
        return false;
    }
}

// 燃料罐部件
class FuelTankPart extends Part {
    constructor(options = {}) {
        super({
            type: 'fuel',
            category: 'fuel',
            mass: 0.5,
            cost: 275,
            size: 1.25,
            height: 1.0,
            ...options
        });
        
        const fuelAmount = options.fuelAmount || 360;
        const oxidizerAmount = options.oxidizerAmount || 440;
        
        this.addResource('LiquidFuel', fuelAmount, fuelAmount);
        this.addResource('Oxidizer', oxidizerAmount, oxidizerAmount);
    }
}

// 引擎部件
class EnginePart extends Part {
    constructor(options = {}) {
        super({
            type: 'engine',
            category: 'engine',
            mass: 1.5,
            cost: 1100,
            size: 1.25,
            height: 1.2,
            maxTemperature: 2500,
            ...options
        });
        
        this.maxThrust = options.maxThrust || 215000; // N
        this.specificImpulse = options.specificImpulse || { vacuum: 345, seaLevel: 265 }; // s
        this.throttle = 0; // 0-1
        this.currentThrust = 0;
        
        this.fuelConsumption = options.fuelConsumption || {
            'LiquidFuel': 8.0, // kg/s at max throttle
            'Oxidizer': 9.8
        };
        
        this.thrustDirection = options.thrustDirection || { x: 0, y: 1, z: 0 };
        this.canGimbal = options.canGimbal || false;
        this.gimbalRange = options.gimbalRange || 0; // degrees
        
        this.ignited = false;
    }
    
    onUpdate(deltaTime, environment) {
        if (this.isActive && this.throttle > 0) {
            this.updateThrust(deltaTime, environment);
            this.consumeFuel(deltaTime);
            this.generateHeat(deltaTime);
        } else {
            this.currentThrust = 0;
        }
    }
    
    updateThrust(deltaTime, environment) {
        // 根据大气压力调整推力
        const atmospherePressure = environment.atmosphericPressure || 0;
        const thrustMultiplier = this.calculateThrustMultiplier(atmospherePressure);
        
        this.currentThrust = this.maxThrust * this.throttle * thrustMultiplier;
    }
    
    calculateThrustMultiplier(atmospherePressure) {
        // 简化的推力随大气压力变化模型
        const seaLevelPressure = 101325; // Pa
        const pressureRatio = atmospherePressure / seaLevelPressure;
        
        // 线性插值推力系数
        const seaLevelThrust = 1.0;
        const vacuumThrust = this.specificImpulse.vacuum / this.specificImpulse.seaLevel;
        
        return seaLevelThrust + (vacuumThrust - seaLevelThrust) * (1 - pressureRatio);
    }
    
    consumeFuel(deltaTime) {
        const consumptionRate = this.throttle;
        
        for (const [fuelType, rate] of Object.entries(this.fuelConsumption)) {
            const requiredAmount = rate * consumptionRate * deltaTime;
            const consumed = this.consumeResource(fuelType, requiredAmount);
            
            // 如果燃料不足，降低推力
            if (consumed < requiredAmount && requiredAmount > 0) {
                const fuelRatio = consumed / requiredAmount;
                this.currentThrust *= fuelRatio;
            }
        }
    }
    
    generateHeat(deltaTime) {
        // 引擎产生热量
        const heatGeneration = this.currentThrust * 0.001 * deltaTime; // 简化的热量模型
        this.temperature += heatGeneration;
    }
    
    setThrottle(throttle) {
        this.throttle = Math.max(0, Math.min(1, throttle));
    }
    
    ignite() {
        if (!this.ignited && this.hasRequiredResources()) {
            this.ignited = true;
            this.activate();
            return true;
        }
        return false;
    }
    
    shutdown() {
        this.ignited = false;
        this.deactivate();
        this.throttle = 0;
    }
    
    hasRequiredResources() {
        // 检查是否有足够的燃料
        for (const fuelType of Object.keys(this.fuelConsumption)) {
            if ((this.resources[fuelType] || 0) <= 0) {
                return false;
            }
        }
        return true;
    }
}

// 分离器部件
class DecouplerPart extends Part {
    constructor(options = {}) {
        super({
            type: 'decoupler',
            category: 'coupling',
            mass: 0.4,
            cost: 400,
            size: 1.25,
            height: 0.2,
            ...options
        });
        
        this.ejectionForce = options.ejectionForce || 15; // kN
        this.isDecoupled = false;
    }
    
    decouple() {
        if (!this.isDecoupled) {
            this.isDecoupled = true;
            this.onDecouple();
            return true;
        }
        return false;
    }
    
    onDecouple() {
        // 分离逻辑将在Vehicle类中处理
        console.log(`${this.name} 已分离`);
    }
}

// 降落伞部件
class ParachutePart extends Part {
    constructor(options = {}) {
        super({
            type: 'parachute',
            category: 'utility',
            mass: 0.1,
            cost: 422,
            size: 1.25,
            height: 0.3,
            ...options
        });
        
        this.deployed = false;
        this.deployAltitude = options.deployAltitude || 500; // m
        this.minPressure = options.minPressure || 0.01; // atm
        this.dragWhenDeployed = options.dragWhenDeployed || 500;
    }
    
    onUpdate(deltaTime, environment) {
        // 自动部署检查
        if (!this.deployed && this.shouldDeploy(environment)) {
            this.deploy();
        }
        
        // 更新阻力系数
        if (this.deployed) {
            this.dragCoefficient = this.dragWhenDeployed;
        }
    }
    
    shouldDeploy(environment) {
        return environment.altitude < this.deployAltitude && 
               environment.atmosphericPressure > this.minPressure;
    }
    
    deploy() {
        if (!this.deployed) {
            this.deployed = true;
            this.activate();
            console.log(`${this.name} 已部署`);
            return true;
        }
        return false;
    }
}

// 资源密度表
const RESOURCE_DENSITIES = {
    'LiquidFuel': 0.005, // t/L
    'Oxidizer': 0.005,
    'MonoPropellant': 0.004,
    'ElectricCharge': 0, // 无质量
    'Ore': 0.01,
    'XenonGas': 0.0001
};

// 部件工厂
const PART_LIBRARY = {
    // 指令舱
    'mk1-command-pod': () => new CommandPart({
        name: 'Mk1 指令舱',
        mass: 0.84,
        cost: 600,
        crewCapacity: 1,
        hasSAS: true
    }),
    
    // 燃料罐
    'fl-t400-fuel-tank': () => new FuelTankPart({
        name: 'FL-T400 燃料罐',
        mass: 0.25,
        cost: 275,
        fuelAmount: 180,
        oxidizerAmount: 220
    }),
    
    'fl-t800-fuel-tank': () => new FuelTankPart({
        name: 'FL-T800 燃料罐',
        mass: 0.5,
        cost: 500,
        fuelAmount: 360,
        oxidizerAmount: 440
    }),
    
    // 引擎
    'lv-t30-reliant': () => new EnginePart({
        name: 'LV-T30 "Reliant" 液体燃料引擎',
        mass: 1.25,
        cost: 1100,
        maxThrust: 215000,
        specificImpulse: { vacuum: 310, seaLevel: 280 }
    }),
    
    'lv-t45-swivel': () => new EnginePart({
        name: 'LV-T45 "Swivel" 液体燃料引擎',
        mass: 1.5,
        cost: 1200,
        maxThrust: 215000,
        specificImpulse: { vacuum: 320, seaLevel: 270 },
        canGimbal: true,
        gimbalRange: 3
    }),
    
    // 固体燃料火箭
    'rt-10-hammer': () => new EnginePart({
        name: 'RT-10 "Hammer" 固体燃料助推器',
        mass: 3.56,
        cost: 400,
        maxThrust: 227000,
        specificImpulse: { vacuum: 195, seaLevel: 170 },
        fuelConsumption: { 'SolidFuel': 7.3 }
    }),
    
    // 分离器
    'tt-38k-decoupler': () => new DecouplerPart({
        name: 'TT-38K 径向分离器',
        mass: 0.025,
        cost: 600,
        ejectionForce: 260
    }),
    
    // 降落伞
    'mk16-parachute': () => new ParachutePart({
        name: 'Mk16 降落伞',
        mass: 0.1,
        cost: 422,
        dragWhenDeployed: 500
    })
};

function createPart(partName) {
    const factory = PART_LIBRARY[partName];
    return factory ? factory() : null;
}

// 导出给其他模块使用
window.Part = Part;
window.CommandPart = CommandPart;
window.FuelTankPart = FuelTankPart;
window.EnginePart = EnginePart;
window.DecouplerPart = DecouplerPart;
window.ParachutePart = ParachutePart;
window.createPart = createPart;
window.PART_LIBRARY = PART_LIBRARY;
window.RESOURCE_DENSITIES = RESOURCE_DENSITIES;
