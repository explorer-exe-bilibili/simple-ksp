// 测试新组件的脚本
// 在浏览器控制台中运行此脚本来检验新组件是否正确添加

console.log("=== 新组件测试脚本 ===");

// 1. 检查新组件是否在部件库中
const newPartId = 'ix-6315-ion-engine';
const newPart = RocketParts.parts[newPartId];

if (newPart) {
    console.log("✅ 新组件已成功添加到部件库");
    console.log("组件信息:", newPart);
} else {
    console.log("❌ 新组件未找到，请检查添加是否正确");
}

// 2. 检查组件的基础属性
if (newPart) {
    console.log("\n=== 组件属性检查 ===");
    
    const requiredProperties = ['id', 'name', 'type', 'category', 'mass', 'dimensions'];
    const missingProperties = requiredProperties.filter(prop => !newPart[prop]);
    
    if (missingProperties.length === 0) {
        console.log("✅ 所有必需属性都已定义");
    } else {
        console.log("❌ 缺少以下属性:", missingProperties);
    }
    
    // 检查引擎特有属性
    if (newPart.type === 'engine') {
        const engineProperties = ['thrust', 'isp_vacuum', 'fuel_consumption'];
        const missingEngineProps = engineProperties.filter(prop => !newPart[prop]);
        
        if (missingEngineProps.length === 0) {
            console.log("✅ 引擎特有属性都已定义");
        } else {
            console.log("❌ 缺少引擎属性:", missingEngineProps);
        }
    }
}

// 3. 检查组件是否可以被正确实例化
try {
    console.log("\n=== 组件实例化测试 ===");
    
    // 模拟创建一个火箭装配
    const assembly = new RocketAssembly();
    assembly.name = "测试火箭";
    
    // 尝试添加新组件
    const addedPart = assembly.addPart(newPart, { x: 0, y: 0 });
    
    if (addedPart) {
        console.log("✅ 组件可以正确添加到装配中");
        console.log("添加的部件:", addedPart);
        
        // 检查燃料状态（如果是引擎或燃料罐）
        if (addedPart.fuelStatus) {
            console.log("✅ 燃料状态已正确初始化:", addedPart.fuelStatus);
        }
    } else {
        console.log("❌ 组件无法添加到装配中");
    }
    
} catch (error) {
    console.log("❌ 实例化测试失败:", error.message);
}

// 4. 检查组件在部件库UI中的显示
console.log("\n=== UI显示测试 ===");

// 检查部件分类
const category = newPart.category;
console.log(`组件分类: ${category}`);

// 检查是否有对应的CSS类
const hasCSS = document.querySelector('style') || 
              Array.from(document.styleSheets).some(sheet => {
                  try {
                      return Array.from(sheet.cssRules).some(rule => 
                          rule.selectorText && rule.selectorText.includes(newPartId)
                      );
                  } catch (e) {
                      return false;
                  }
              });

if (hasCSS) {
    console.log("✅ 找到了相关的CSS样式");
} else {
    console.log("⚠️ 未找到CSS样式，组件可能显示不正确");
    console.log("建议添加以下CSS类:");
    console.log(`.rocket-part.${newPartId}, .part-thumbnail.${newPartId}`);
}

// 5. 模拟测试
console.log("\n=== 模拟行为测试 ===");

if (newPart.type === 'engine') {
    console.log("引擎推力:", newPart.thrust, "kN");
    console.log("比冲:", newPart.isp_vacuum, "秒");
    console.log("燃料消耗:", newPart.fuel_consumption);
    
    // 检查特殊属性
    if (newPart.ion_properties) {
        console.log("✅ 离子引擎特殊属性已定义");
        console.log("最低工作高度:", newPart.ion_properties.min_altitude, "米");
    }
}

// 6. 生成使用建议
console.log("\n=== 使用建议 ===");
console.log("1. 在火箭编辑器中查找该组件");
console.log("2. 将组件拖拽到火箭上进行连接测试");
console.log("3. 在发射台检查组件显示是否正确");
console.log("4. 启动模拟测试组件功能");

if (newPart.type === 'engine' && newPart.ion_properties) {
    console.log("\n⚠️ 离子引擎特别注意:");
    console.log("- 只能在高度70km以上工作");
    console.log("- 需要电力供应");
    console.log("- 推力很小，适合长期推进");
}

console.log("\n=== 测试完成 ===");
