// 简单的移动调试补丁 - 添加到现有的 handleMouseMove 函数中

// 在部件位置更新后添加以下调试代码：

console.log(`🚀 部件移动: ${assemblyPart.data.name} -> (${newX.toFixed(1)}, ${newY.toFixed(1)})`);

// 检查现有连接状态
const currentConnections = this.assembly.connections.filter(conn => 
    conn.partA === assemblyPart.id || conn.partB === assemblyPart.id
);
console.log(`📎 当前连接数: ${currentConnections.length}`);

// 检查是否有连接断开
const disconnectionTolerance = 50;
let brokenCount = 0;

this.assembly.connections.forEach(connection => {
    if (connection.partA !== assemblyPart.id && connection.partB !== assemblyPart.id) return;
    
    const partA = this.assembly.parts.find(p => p.id === connection.partA);
    const partB = this.assembly.parts.find(p => p.id === connection.partB);
    
    if (partA && partB) {
        const attachA = partA.data.attachment_points[connection.attachPointA];
        const attachB = partB.data.attachment_points[connection.attachPointB];
        
        if (attachA && attachB) {
            // 计算连接点距离
            const partACenterX = partA.position.x + (partA.data.dimensions.width * 20);
            const partACenterY = partA.position.y + (partA.data.dimensions.height * 20);
            const pointAX = partACenterX + (attachA.x * 40);
            const pointAY = partACenterY + (attachA.y * 40);

            const partBCenterX = partB.position.x + (partB.data.dimensions.width * 20);
            const partBCenterY = partB.position.y + (partB.data.dimensions.height * 20);
            const pointBX = partBCenterX + (attachB.x * 40);
            const pointBY = partBCenterY + (attachB.y * 40);

            const distance = Math.sqrt(
                Math.pow(pointAX - pointBX, 2) + 
                Math.pow(pointAY - pointBY, 2)
            );

            console.log(`  连接 ${connection.id}: 距离 ${distance.toFixed(2)}px (阈值: ${disconnectionTolerance}px)`);
            
            if (distance > disconnectionTolerance) {
                console.log(`  ⚠️ 连接 ${connection.id} 即将断开!`);
                brokenCount++;
            }
        }
    }
});

// 检查新连接机会
let nearbyParts = [];
this.assembly.parts.forEach(otherPart => {
    if (otherPart.id === assemblyPart.id) return;
    
    const dx = newX - otherPart.position.x;
    const dy = newY - otherPart.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 120) {
        nearbyParts.push({
            part: otherPart,
            distance: distance.toFixed(1)
        });
    }
});

if (nearbyParts.length > 0) {
    console.log(`🔍 附近的部件 (${nearbyParts.length}个):`);
    nearbyParts.forEach(nearby => {
        console.log(`  - ${nearby.part.data.name}: ${nearby.distance}px`);
    });
} else {
    console.log('🔍 附近无其他部件');
}
