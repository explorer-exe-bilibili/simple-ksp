// 新组件示例：小型离子引擎
// 将此代码添加到 js/rocket-parts.js 文件的 rocketParts 数组中

{
    id: 'ion-engine-small',
    name: '小型离子引擎',
    name_en: 'Small Ion Engine',
    type: 'engine',
    category: 'propulsion',
    description: '高效率、低推力的离子推进系统，适用于深空任务',
    description_en: 'High-efficiency, low-thrust ion propulsion system for deep space missions',
    
    // 基础属性
    mass: 0.25,                    // 质量：250kg
    cost: 8000,                    // 成本较高
    dimensions: {
        width: 1.25,               // 宽度
        height: 1.5                // 高度
    },
    
    // 连接点
    attachmentNodes: [
        { 
            type: 'top', 
            position: { x: 0, y: -0.75 },
            size: 'small'          // 连接点大小
        }
    ],
    
    // 引擎性能参数
    thrust: 2,                     // 推力：2kN（很低）
    thrust_atm: 0,                 // 在大气中无推力
    isp: 4200,                     // 非常高的比冲
    isp_atm: 0,                    // 大气中比冲为0
    
    // 燃料消耗（使用电力和氙气）
    fuel_consumption: {
        xenon: 0.486,              // 氙气消耗率（很低）
        electric: 8.74             // 电力消耗率（高）
    },
    
    // 环境限制
    maxTemp: 2500,
    crashTolerance: 6,
    
    // 特殊属性
    special: {
        engine_type: 'ion',        // 离子引擎标识
        throttleable: true,        // 可调节推力
        restart: true,             // 可重启
        requires_power: true,      // 需要电力
        atmosphere_capable: false, // 不能在大气中工作
        min_throttle: 0.05        // 最小推力比例
    },
    
    // 视觉和分类
    color: '#4169E1',             // 皇家蓝色
    texture: 'ion-engine-small',
    tags: ['engine', 'ion', 'efficient', 'space'],
    
    // 技术要求
    techRequired: 'ionPropulsion',
    
    // 制造商信息（可选）
    manufacturer: 'Ionic Symphonic Protonic Electronics',
    
    // 部件描述的技术细节
    technicalSpecs: {
        powerRequirement: '8.74 EC/s',
        fuelType: 'Xenon Gas',
        optimalAltitude: 'Vacuum',
        thrustVectoringRange: '±0.5°'
    }
}

/* 
使用说明：

1. 将上述代码复制到 js/rocket-parts.js 文件中的 rocketParts 数组里
2. 添加对应的 CSS 样式（见下面的样式示例）
3. 如果需要特殊的模拟逻辑，在 js/launch-simulation.js 中添加处理

CSS 样式示例（添加到相应的 CSS 文件中）：
*/

/*
.rocket-part.ion-engine-small {
    background: linear-gradient(135deg, #4169E1 0%, #191970 100%);
    border: 2px solid #000080;
    border-radius: 6px;
    position: relative;
    box-shadow: inset 0 0 10px rgba(65, 105, 225, 0.3);
}

.rocket-part.ion-engine-small::before {
    content: "ION";
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 8px;
    color: #87CEEB;
    font-weight: bold;
}

.rocket-part.ion-engine-small::after {
    content: "";
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 10px;
    height: 5px;
    background: radial-gradient(ellipse, #87CEEB 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s;
}

.rocket-part.ion-engine-small.active::after {
    opacity: 1;
}

.part-thumbnail.ion-engine-small {
    width: 25px;
    height: 30px;
    background: linear-gradient(135deg, #4169E1 0%, #191970 100%);
    border: 1px solid #000080;
    border-radius: 3px;
    margin: 3px;
    cursor: grab;
}

.engine-flame.ion-engine-small {
    background: radial-gradient(ellipse, #87CEEB 0%, #4169E1 50%, transparent 100%);
    width: 15px;
    height: 20px;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    opacity: 0.8;
}
*/

/*
模拟逻辑示例（添加到 js/launch-simulation.js 中）：

在 hasEnoughFuel 方法中添加离子引擎检查：
*/
/*
hasEnoughFuel(engine) {
    const consumption = engine.data.fuel_consumption;
    if (!consumption) return true;

    // 离子引擎特殊检查
    if (engine.data.special && engine.data.special.engine_type === 'ion') {
        // 检查氙气和电力
        const hasXenon = consumption.xenon ? this.hasResourceAvailable('xenon', consumption.xenon) : true;
        const hasPower = consumption.electric ? this.hasResourceAvailable('electric', consumption.electric) : true;
        
        // 检查是否在真空中（离子引擎不能在大气中工作）
        const inVacuum = this.altitude > 70000; // 70km以上认为是真空
        
        return hasXenon && hasPower && inVacuum;
    }

    // 原有的燃料检查逻辑...
}

// 新增资源检查方法
hasResourceAvailable(resourceType, consumptionRate) {
    // 实现资源可用性检查
    // 这里需要根据你的资源系统来实现
    switch(resourceType) {
        case 'xenon':
            // 检查氙气储量
            return this.getXenonAmount() > consumptionRate * this.deltaTime;
        case 'electric':
            // 检查电力
            return this.getElectricCharge() > consumptionRate * this.deltaTime;
        default:
            return true;
    }
}
*/

/*
测试步骤：

1. 刷新页面，检查新组件是否出现在部件库中
2. 尝试将组件拖拽到火箭上
3. 测试组件的连接功能
4. 在发射台查看组件显示是否正确
5. 启动模拟，测试引擎是否正常工作

常见问题排查：

1. 组件不显示：检查语法错误，确保JSON格式正确
2. 样式不正确：检查CSS类名是否与组件ID匹配
3. 连接问题：检查attachmentNodes定义
4. 模拟异常：检查特殊属性和消耗定义
*/
