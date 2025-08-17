# 如何添加新组件到 Simple KSP

本指南将详细说明如何向 Simple KSP 火箭模拟器添加新的组件。

## 组件系统概述

Simple KSP 的组件系统基于以下几个核心文件：
- `js/rocket-parts.js` - 定义所有组件的数据和基础功能
- `js/rocket-builder.js` - 处理组件的拖拽和装配
- `js/launch-simulation.js` - 处理组件在模拟中的行为
- `css/` - 组件的视觉样式

## 示例：添加一个新的燃料罐组件

我们将添加一个新的大型燃料罐作为示例。

### 步骤 1: 在 rocket-parts.js 中定义组件数据

```javascript
// 在 rocketParts 数组中添加新组件
{
    id: 'fuel-tank-large',
    name: '大型燃料罐',
    name_en: 'Large Fuel Tank',
    type: 'fuel-tank',           // 组件类型
    category: 'propulsion',      // 分类：propulsion, control, structural, utility
    description: '大容量液体燃料储存罐，适用于长程任务',
    description_en: 'High-capacity liquid fuel storage tank for long-range missions',
    
    // 物理属性
    mass: 2.5,                   // 空重（吨）
    cost: 1800,                  // 成本
    dimensions: {                // 尺寸（用于渲染和碰撞检测）
        width: 2.5,              // 宽度
        height: 4.0              // 高度
    },
    
    // 连接点定义
    attachmentNodes: [
        { type: 'top', position: { x: 0, y: -2.0 } },    // 顶部连接点
        { type: 'bottom', position: { x: 0, y: 2.0 } }   // 底部连接点
    ],
    
    // 燃料容量
    fuel_capacity: {
        liquid_fuel: 2880,       // 液体燃料容量
        oxidizer: 3520          // 氧化剂容量
    },
    
    // 高级属性
    maxTemp: 2000,              // 最高温度
    crashTolerance: 6,          // 碰撞容差
    
    // 视觉属性
    color: '#silver',           // 默认颜色
    texture: 'fuel-tank-large', // 纹理标识符（对应CSS类）
    
    // 标签和特性
    tags: ['fuel', 'storage', 'large'],
    
    // 技术要求（可选）
    techRequired: 'advancedRocketry',
    
    // 特殊属性（如果有）
    special: {
        // 例如：可以存储特殊燃料类型等
    }
}
```

### 步骤 2: 添加 CSS 样式

在适当的 CSS 文件中添加组件的视觉样式：

```css
/* 在 css/rocket-builder.css 或相关文件中 */

/* 基础样式 */
.rocket-part.fuel-tank-large {
    background: linear-gradient(135deg, #c0c0c0 0%, #808080 100%);
    border: 2px solid #404040;
    border-radius: 8px;
    position: relative;
    
    /* 添加燃料罐特有的视觉元素 */
    background-image: 
        linear-gradient(90deg, transparent 45%, rgba(255,255,255,0.1) 50%, transparent 55%),
        radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 50%);
}

/* 燃料指示器 */
.rocket-part.fuel-tank-large::before {
    content: "FUEL";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    color: #333;
    font-weight: bold;
    pointer-events: none;
}

/* 连接点样式 */
.rocket-part.fuel-tank-large .attachment-point {
    width: 20px;
    height: 20px;
    background: #666;
    border: 2px solid #333;
    border-radius: 50%;
}

/* 部件库中的缩略图 */
.part-thumbnail.fuel-tank-large {
    width: 50px;
    height: 80px;
    background: linear-gradient(135deg, #c0c0c0 0%, #808080 100%);
    border: 1px solid #666;
    border-radius: 4px;
    margin: 5px;
    cursor: grab;
}

.part-thumbnail.fuel-tank-large:hover {
    background: linear-gradient(135deg, #d0d0d0 0%, #909090 100%);
    border-color: #4CAF50;
}

/* 发射台上的样式 */
.launch-part.fuel-tank-large {
    background: linear-gradient(135deg, #c0c0c0 0%, #808080 100%);
    border: 2px solid #404040;
    border-radius: 8px;
}
```

### 步骤 3: 添加组件到部件库 UI

如果需要在部件库界面中显示新组件，确保它被正确分类：

```javascript
// 在 rocket-builder.js 中，确保组件被包含在相应分类中
// 这通常是自动的，基于组件的 category 属性

// 如果需要特殊处理，可以在 filterPartsByCategory 函数中添加逻辑
```

### 步骤 4: 添加特殊行为（如果需要）

如果组件有特殊的模拟行为，在 `launch-simulation.js` 中添加处理逻辑：

```javascript
// 例如，如果燃料罐有特殊的燃料消耗或传输逻辑

// 在适当的方法中添加检查
updateMass() {
    // 处理燃料消耗时的特殊逻辑
    const largeFuelTanks = this.assembly.parts.filter(part => 
        part.data.id === 'fuel-tank-large' && !this.separatedPartIds.has(part.id)
    );
    
    largeFuelTanks.forEach(tank => {
        // 特殊的燃料处理逻辑
        if (tank.fuelStatus) {
            // 例如：大型燃料罐可能有燃料传输能力
            this.handleFuelTransfer(tank);
        }
    });
    
    // 继续正常的质量更新流程...
}

// 添加特殊的处理方法
handleFuelTransfer(largeTank) {
    // 实现燃料传输逻辑
    console.log(`处理大型燃料罐 ${largeTank.id} 的燃料传输`);
}
```

## 高级组件示例：固体火箭推进器

这里是一个更复杂的组件示例 - 固体火箭推进器：

```javascript
{
    id: 'srb-large',
    name: '大型固体火箭推进器',
    name_en: 'Large Solid Rocket Booster',
    type: 'engine',              // 引擎类型
    category: 'propulsion',
    description: '高推力固体燃料火箭推进器，燃烧时间固定',
    
    mass: 4.2,
    cost: 3200,
    dimensions: { width: 2.5, height: 6.0 },
    
    attachmentNodes: [
        { type: 'top', position: { x: 0, y: -3.0 } },
        { type: 'bottom', position: { x: 0, y: 3.0 } },
        { type: 'side', position: { x: 1.25, y: 0 } },
        { type: 'side', position: { x: -1.25, y: 0 } }
    ],
    
    // 引擎特有属性
    thrust: 650,                 // 推力 (kN)
    thrust_atm: 650,            // 大气中推力
    isp: 230,                   // 比冲
    isp_atm: 230,               // 大气中比冲
    
    // 固体燃料特有属性
    fuel_capacity: {
        solid_fuel: 1800        // 固体燃料
    },
    
    fuel_consumption: {
        solid_fuel: 8.2         // 固体燃料消耗率
    },
    
    // 特殊属性
    special: {
        engine_type: 'solid',    // 固体火箭标识
        burn_time: 85,          // 燃烧时间（秒）
        throttleable: false,    // 不可调节推力
        restart: false          // 不可重启
    },
    
    maxTemp: 2500,
    crashTolerance: 8,
    color: '#white',
    texture: 'srb-large',
    tags: ['engine', 'solid', 'booster']
}
```

对应的特殊处理逻辑：

```javascript
// 在 launch-simulation.js 中添加固体火箭的特殊处理

hasEnoughFuel(engine) {
    // 原有的液体燃料检查...
    
    // 添加固体燃料检查
    if (engine.data.special && engine.data.special.engine_type === 'solid') {
        return engine.fuelStatus && engine.fuelStatus.solid_fuel > 0;
    }
    
    // 原有的返回逻辑...
}

calculateThrust() {
    const activeEngines = this.assembly.parts.filter(part => 
        part.data.type === 'engine' && !this.separatedPartIds.has(part.id)
    );
    
    let totalThrust = 0;
    activeEngines.forEach(engine => {
        if (this.hasEnoughFuel(engine)) {
            let currentThrust = engine.data.thrust || 0;
            
            // 固体火箭特殊处理
            if (engine.data.special && engine.data.special.engine_type === 'solid') {
                // 固体火箭不受节流阀控制
                // 可以添加燃烧曲线逻辑
                const burnCurve = this.calculateSolidBurnCurve(engine);
                currentThrust *= burnCurve;
            } else {
                // 液体火箭受节流阀控制
                currentThrust *= this.throttle;
            }
            
            totalThrust += currentThrust;
        }
    });
    
    return totalThrust * 1000;
}

calculateSolidBurnCurve(engine) {
    // 实现固体火箭的燃烧曲线
    // 通常开始和结束时推力较低，中间推力最高
    const remainingFuel = engine.fuelStatus.solid_fuel;
    const totalFuel = engine.data.fuel_capacity.solid_fuel;
    const burnProgress = 1 - (remainingFuel / totalFuel);
    
    // 简单的燃烧曲线：开始慢，中间快，结束慢
    if (burnProgress < 0.1) {
        return 0.6 + (burnProgress / 0.1) * 0.4; // 0.6 到 1.0
    } else if (burnProgress < 0.9) {
        return 1.0; // 满推力
    } else {
        return 1.0 - ((burnProgress - 0.9) / 0.1) * 0.3; // 1.0 到 0.7
    }
}
```

## 组件类型说明

### 支持的组件类型

1. **engine** - 引擎
   - 需要：thrust, fuel_consumption, isp
   - 特殊处理：推力计算、燃料消耗、火焰效果

2. **fuel-tank** - 燃料罐
   - 需要：fuel_capacity
   - 特殊处理：燃料存储、质量计算

3. **command** - 指挥舱
   - 需要：crew_capacity
   - 特殊处理：控制逻辑、乘员支持

4. **structural** - 结构件
   - 基础属性即可
   - 主要用于连接其他组件

5. **utility** - 功能件
   - 根据具体功能定制属性

### 连接点类型

- **top** - 顶部连接点
- **bottom** - 底部连接点
- **side** - 侧面连接点
- **radial** - 径向连接点

## 测试新组件

1. 在火箭编辑器中测试组件的拖拽和连接
2. 检查组件在发射台上的显示
3. 测试组件在模拟中的行为
4. 验证分级系统对新组件的处理

## 最佳实践

1. **命名规范**：使用清晰的ID和名称
2. **属性完整**：确保所有必要属性都已定义
3. **视觉一致**：保持与现有组件风格一致
4. **性能考虑**：避免过于复杂的计算
5. **测试覆盖**：充分测试各种使用场景

## 常见问题

**Q: 新组件不显示在部件库中？**
A: 检查组件的 `category` 属性是否正确设置

**Q: 组件连接有问题？**
A: 验证 `attachmentNodes` 的定义是否正确

**Q: 模拟中行为异常？**
A: 检查 `launch-simulation.js` 中是否正确处理了新组件类型

**Q: 样式显示不正确？**
A: 确保 CSS 选择器与组件ID匹配，并且样式文件已加载

这个指南应该能帮助您成功添加新的组件到 Simple KSP 模拟器中！
