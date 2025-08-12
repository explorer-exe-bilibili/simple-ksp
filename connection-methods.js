// 移动部件时的连接检测和处理方法

// 在 RocketBuilder 类中添加这些方法：

// 处理移动部件时的连接逻辑
handleMovingPartConnections(movingPart) {
    console.log('\n🔄 处理移动部件连接逻辑:', movingPart.data.name);
    
    // 1. 检查现有连接是否需要断开
    const brokenConnections = this.assembly.checkAndBreakInvalidConnections();
    if (brokenConnections.length > 0) {
        console.log(`📢 断开了 ${brokenConnections.length} 个连接:`, brokenConnections);
        if (typeof showNotification === 'function') {
            showNotification('连接断开', 
                `${brokenConnections.length}个连接因距离过远而自动断开`, 'warning');
        }
    }
    
    // 2. 检查是否有新的连接机会
    const newConnection = this.checkMovingPartConnections(movingPart);
    if (newConnection) {
        console.log('🔗 发现连接机会，自动对齐');
        
        // 自动对齐到连接点
        movingPart.position = newConnection.adjustedPosition;
        
        // 更新DOM元素位置
        const partElement = document.querySelector(`[data-part-id="${movingPart.id}"]`);
        if (partElement) {
            partElement.style.left = `${newConnection.adjustedPosition.x}px`;
            partElement.style.top = `${newConnection.adjustedPosition.y}px`;
        }
        
        // 创建连接
        const connectionResult = this.assembly.connectParts(
            newConnection.otherPart.id,
            newConnection.otherPoint,
            newConnection.movingPart.id,
            newConnection.movingPoint
        );
        
        if (connectionResult) {
            console.log('✅ 创建新连接成功:', connectionResult.id);
            if (typeof showNotification === 'function') {
                showNotification('自动连接', 
                    `${movingPart.data.name} 已连接到 ${newConnection.otherPart.data.name}`, 'success');
            }
        }
    }
    
    // 3. 更新连接线显示
    this.updateConnectionLines();
}

// 检测移动部件的连接机会
checkMovingPartConnections(movingPart) {
    console.log('\n=== 检测移动部件的连接机会 ===');
    console.log('移动部件:', movingPart.data.name, '当前位置:', movingPart.position);
    
    const connectionRange = 80; // 移动时的连接检测范围
    const autoConnections = [];

    // 遍历所有其他部件
    this.assembly.parts.forEach(otherPart => {
        if (otherPart.id === movingPart.id) return; // 跳过自己
        if (!otherPart.data.attachment_points || !movingPart.data.attachment_points) return;
        
        console.log(`\n检查与部件 ${otherPart.data.name} 的连接可能性:`);
        
        // 检查移动部件的每个连接点与其他部件的每个连接点
        Object.entries(movingPart.data.attachment_points).forEach(([movingPointName, movingPointData]) => {
            Object.entries(otherPart.data.attachment_points).forEach(([otherPointName, otherPointData]) => {
                
                // 检查连接兼容性
                if (Math.abs(movingPointData.size - otherPointData.size) >= 0.1) {
                    console.log(`  ✗ ${movingPointName} <-> ${otherPointName}: 尺寸不兼容`);
                    return;
                }
                
                // 计算连接点位置
                const movingPartCenterX = movingPart.position.x + (movingPart.data.dimensions.width * 20);
                const movingPartCenterY = movingPart.position.y + (movingPart.data.dimensions.height * 20);
                const movingPointX = movingPartCenterX + (movingPointData.x * 40);
                const movingPointY = movingPartCenterY + (movingPointData.y * 40);
                
                const otherPartCenterX = otherPart.position.x + (otherPart.data.dimensions.width * 20);
                const otherPartCenterY = otherPart.position.y + (otherPart.data.dimensions.height * 20);
                const otherPointX = otherPartCenterX + (otherPointData.x * 40);
                const otherPointY = otherPartCenterY + (otherPointData.y * 40);
                
                // 计算距离
                const distance = Math.sqrt(
                    Math.pow(movingPointX - otherPointX, 2) + 
                    Math.pow(movingPointY - otherPointY, 2)
                );
                
                console.log(`  ${movingPointName} <-> ${otherPointName}: 距离 ${distance.toFixed(2)}px`);
                
                if (distance <= connectionRange) {
                    // 检查是否已经连接
                    const existingConnection = this.assembly.connections.find(conn => 
                        (conn.partA === movingPart.id && conn.partB === otherPart.id && 
                         conn.attachPointA === movingPointName && conn.attachPointB === otherPointName) ||
                        (conn.partA === otherPart.id && conn.partB === movingPart.id && 
                         conn.attachPointA === otherPointName && conn.attachPointB === movingPointName)
                    );
                    
                    if (!existingConnection) {
                        console.log(`  ★ 发现新连接机会! 距离: ${distance.toFixed(2)}px`);
                        
                        // 计算对齐后的位置
                        const offsetX = otherPointX - movingPointX;
                        const offsetY = otherPointY - movingPointY;
                        const adjustedPosition = {
                            x: movingPart.position.x + offsetX,
                            y: movingPart.position.y + offsetY
                        };
                        
                        autoConnections.push({
                            movingPart: movingPart,
                            otherPart: otherPart,
                            movingPoint: movingPointName,
                            otherPoint: otherPointName,
                            distance: distance,
                            adjustedPosition: adjustedPosition
                        });
                    } else {
                        console.log(`  ✓ 已存在连接: ${existingConnection.id}`);
                    }
                }
            });
        });
    });
    
    // 选择最佳连接机会（距离最近的）
    if (autoConnections.length > 0) {
        const bestConnection = autoConnections.reduce((best, current) => 
            current.distance < best.distance ? current : best
        );
        
        console.log('\n=== 选择最佳连接 ===');
        console.log('最佳连接:', bestConnection);
        
        return bestConnection;
    }
    
    console.log('\n=== 无连接机会 ===');
    return null;
}
