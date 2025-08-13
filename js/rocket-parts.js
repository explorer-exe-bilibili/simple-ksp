// 火箭部件数据库
class RocketParts {
    static parts = {
        // 指令舱类部件
        'command-pod-mk1': {
            id: 'command-pod-mk1',
            name: 'Mk1 指令舱',
            category: 'command',
            type: 'command',
            mass: 0.84, // 吨
            cost: 600,
            crew_capacity: 1,
            dimensions: { width: 1.25, height: 1.5 }, // 米
            attachment_points: {
                top: { x: 0, y: -0.75, size: 1.25 },
                bottom: { x: 0, y: 0.75, size: 1.25 }
            },
            svg_path: 'svg/command-pod.svg',
            description: '单人指令舱，用于控制载具',
            stats: {
                electric_capacity: 150,
                torque: 5.0,
                impact_tolerance: 14,
                max_temp: 2400
            }
        },
        
        // 液体燃料引擎
        'lv-909-engine': {
            id: 'lv-909-engine',
            name: 'LV-909 液体燃料引擎',
            category: 'propulsion',
            type: 'engine',
            mass: 0.5, // 吨
            cost: 390,
            thrust: 60, // kN (真空)
            thrust_atm: 50, // kN (海平面)
            isp_vacuum: 345, // 秒
            isp_atm: 300, // 秒
            dimensions: { width: 1.25, height: 1.0 },
            attachment_points: {
                top: { x: 0, y: -0.5, size: 1.25 },
                bottom: { x: 0, y: 0.5, size: 1.25 }
            },
            svg_path: 'svg/liquid-engine.svg',
            description: '高效真空引擎，适合上面级使用',
            fuel_consumption: {
                liquid_fuel: 2.8, // 单位/秒
                oxidizer: 3.4 // 单位/秒
            },
            stats: {
                max_temp: 2000,
                gimbal_range: 4.0,
                throttle_range: { min: 0.0, max: 1.0 }
            }
        },
        
        // 新增燃料罐示例
        'fl-t100-fuel-tank': {
            id: 'fl-t100-fuel-tank',
            name: 'FL-T100 燃料罐',
            category: 'propulsion',
            type: 'fuel-tank',
            mass: 0.56, // 吨 (干重)
            cost: 150,
            fuel_capacity: {
                liquid_fuel: 45, // 单位
                oxidizer: 55 // 单位
            },
            dimensions: { width: 1.25, height: 1.1 },
            attachment_points: {
                top: { x: 0, y: -0.55, size: 1.25 },
                bottom: { x: 0, y: 0.55, size: 1.25 },
                left: { x: -0.625, y: 0, size: 0.625 },
                right: { x: 0.625, y: 0, size: 0.625 }
            },
            svg_path: 'svg/fuel-tank.svg',
            description: '小型液体燃料罐，适合轻型载具。支持顶部、底部和侧面连接。',
            stats: {
                max_temp: 2000,
                impact_tolerance: 6
            }
        },

        // 大型燃料罐
        'fl-t400-fuel-tank': {
            id: 'fl-t400-fuel-tank',
            name: 'FL-T400 燃料罐',
            category: 'propulsion',
            type: 'fuel-tank',
            mass: 2.25, // 吨 (干重)
            cost: 500,
            fuel_capacity: {
                liquid_fuel: 180, // 单位
                oxidizer: 220 // 单位
            },
            dimensions: { width: 1.25, height: 3.75 },
            attachment_points: {
                top: { x: 0, y: -1.875, size: 1.25 },
                bottom: { x: 0, y: 1.875, size: 1.25 },
                left: { x: -0.625, y: 0, size: 0.625 },
                right: { x: 0.625, y: 0, size: 0.625 }
            },
            svg_path: 'svg/fl-t400-fuel-tank.svg',
            description: '大型液体燃料罐，提供充足的燃料储存。支持顶部、底部和侧面连接。',
            stats: {
                max_temp: 2000,
                impact_tolerance: 6
            }
        },

        // 结构部件 - 分离器/连接器
        'td-12-decoupler': {
            id: 'td-12-decoupler',
            name: 'TD-12 分离连接器',
            category: 'structural',
            type: 'decoupler',
            mass: 0.4, // 吨
            cost: 400,
            dimensions: { width: 1.25, height: 0.8 },
            attachment_points: {
                top: { x: 0, y: -0.4, size: 1.25 },
                bottom: { x: 0, y: 0.4, size: 1.25 }
            },
            svg_path: 'svg/decoupler.svg',
            description: '用于火箭分级的分离连接器。可在指定时机分离上下两级火箭，实现多级火箭设计。分离时会产生一定的分离力。',
            separation_force: 2500, // 分离力 (牛顿)
            stats: {
                max_temp: 2000,
                impact_tolerance: 9,
                ejection_force: 25 // kN，分离时的推力
            },
            // 分离器特殊属性
            decoupler_properties: {
                can_separate: true, // 是否可以分离
                separation_direction: 'both', // 分离方向: 'up', 'down', 'both'
                staged: true, // 是否受分级控制
                stage_priority: 1 // 分级优先级，数字越小越先执行
            }
        }
    };

    // 获取所有部件
    static getAllParts() {
        return Object.values(this.parts);
    }

    // 根据类别获取部件
    static getPartsByCategory(category) {
        if (category === 'all') {
            return this.getAllParts();
        }
        return Object.values(this.parts).filter(part => part.category === category);
    }

    // 根据ID获取部件
    static getPartById(id) {
        return this.parts[id] || null;
    }

    // 获取部件类别列表
    static getCategories() {
        const categories = new Set();
        Object.values(this.parts).forEach(part => {
            categories.add(part.category);
        });
        return Array.from(categories);
    }

    // 计算部件的拖拽成本（Delta-V计算用）
    static calculatePartDeltaV(part, fuelMass = 0) {
        if (part.type !== 'engine') {
            return 0;
        }
        
        const dryMass = part.mass;
        const wetMass = dryMass + fuelMass;
        const isp = part.isp_vacuum || 300;
        const g = 9.81; // 重力加速度
        
        if (wetMass <= dryMass) return 0;
        
        return isp * g * Math.log(wetMass / dryMass);
    }

    // 加载SVG内容
    static async loadPartSVG(part) {
        try {
            const response = await fetch(part.svg_path);
            const svgText = await response.text();
            return svgText;
        } catch (error) {
            console.error(`无法加载部件SVG: ${part.svg_path}`, error);
            // 返回默认的占位符SVG
            return this.getPlaceholderSVG(part);
        }
    }

    // 获取占位符SVG
    static getPlaceholderSVG(part) {
        const color = part.category === 'command' ? '#4ade80' : '#ff6b35';
        return `
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="20" width="60" height="60" rx="5" fill="${color}" stroke="#fff" stroke-width="2"/>
                <text x="50" y="50" text-anchor="middle" fill="#fff" font-size="10">${part.name}</text>
            </svg>
        `;
    }

    // 验证连接点兼容性
    static canConnect(partA, attachPointA, partB, attachPointB) {
        if (!partA || !partB || !attachPointA || !attachPointB) {
            return false;
        }

        // 检查尺寸是否兼容（允许一定误差）
        const sizeA = attachPointA.size;
        const sizeB = attachPointB.size;
        const tolerance = 0.1;

        return Math.abs(sizeA - sizeB) <= tolerance;
    }

    // 添加新部件（用于扩展）
    static addPart(partData) {
        if (!partData.id) {
            console.error('部件必须有唯一ID');
            return false;
        }

        if (this.parts[partData.id]) {
            console.warn(`部件ID ${partData.id} 已存在，将被覆盖`);
        }

        // 验证必需字段
        const requiredFields = ['name', 'category', 'type', 'mass', 'dimensions', 'svg_path'];
        for (const field of requiredFields) {
            if (!(field in partData)) {
                console.error(`部件缺少必需字段: ${field}`);
                return false;
            }
        }

        this.parts[partData.id] = partData;
        return true;
    }

    // 删除部件
    static removePart(partId) {
        if (this.parts[partId]) {
            delete this.parts[partId];
            return true;
        }
        return false;
    }
}

// 火箭组装数据结构
class RocketAssembly {
    constructor() {
        this.parts = []; // 已组装的部件
        this.connections = []; // 连接关系
        this.rootPart = null; // 根部件
        this.name = '未命名载具';
        this.created = new Date();
        this.modified = new Date();
    }

    // 添加部件到组装中
    addPart(partData, position = { x: 0, y: 0 }) {
        const assemblyPart = {
            id: this.generatePartId(),
            partId: partData.id,
            position: position,
            rotation: 0,
            data: partData,
            connections: []
        };

        // 如果是燃料罐，初始化燃料状态
        if (partData.type === 'fuel-tank' && partData.fuel_capacity) {
            assemblyPart.fuelStatus = {
                liquid_fuel: partData.fuel_capacity.liquid_fuel || 0,
                oxidizer: partData.fuel_capacity.oxidizer || 0
            };
        }

        this.parts.push(assemblyPart);
        
        // 如果这是第一个部件，设为根部件
        if (this.parts.length === 1) {
            this.rootPart = assemblyPart.id;
        }

        this.modified = new Date();
        return assemblyPart;
    }

    // 生成唯一的部件ID
    generatePartId() {
        return `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 移除部件
    removePart(partId) {
        const index = this.parts.findIndex(p => p.id === partId);
        if (index === -1) return false;

        // 移除所有相关连接
        this.connections = this.connections.filter(conn => 
            conn.partA !== partId && conn.partB !== partId
        );

        // 如果移除的是根部件，选择新的根部件
        if (this.rootPart === partId && this.parts.length > 1) {
            this.rootPart = this.parts.find(p => p.id !== partId)?.id || null;
        }

        this.parts.splice(index, 1);
        this.modified = new Date();
        return true;
    }

    // 连接两个部件
    connectParts(partAId, attachPointA, partBId, attachPointB) {
        const partA = this.parts.find(p => p.id === partAId);
        const partB = this.parts.find(p => p.id === partBId);

        if (!partA || !partB) return false;

        // 验证连接点是否存在
        const attachA = partA.data.attachment_points[attachPointA];
        const attachB = partB.data.attachment_points[attachPointB];

        if (!attachA || !attachB) return false;

        // 验证连接兼容性
        if (!RocketParts.canConnect(partA.data, attachA, partB.data, attachB)) {
            return false;
        }

        // 创建连接
        const connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            partA: partAId,
            attachPointA: attachPointA,
            partB: partBId,
            attachPointB: attachPointB,
            created: new Date()
        };

        this.connections.push(connection);
        
        // 更新部件的连接信息
        partA.connections.push(connection.id);
        partB.connections.push(connection.id);

        this.modified = new Date();
        return connection;
    }

    // 断开连接
    disconnectParts(connectionId) {
        const connectionIndex = this.connections.findIndex(conn => conn.id === connectionId);
        if (connectionIndex === -1) return false;

        const connection = this.connections[connectionIndex];
        
        // 从连接列表中移除
        this.connections.splice(connectionIndex, 1);
        
        // 从部件的连接列表中移除
        const partA = this.parts.find(p => p.id === connection.partA);
        const partB = this.parts.find(p => p.id === connection.partB);
        
        if (partA) {
            partA.connections = partA.connections.filter(id => id !== connectionId);
        }
        if (partB) {
            partB.connections = partB.connections.filter(id => id !== connectionId);
        }

        this.modified = new Date();
        return true;
    }

    // 检查并断开由于位置移动而失效的连接
    checkAndBreakInvalidConnections() {
        const disconnectionTolerance = 50; // 连接断开的距离容忍度（像素）
        const brokenConnections = [];

        this.connections.forEach(connection => {
            const partA = this.parts.find(p => p.id === connection.partA);
            const partB = this.parts.find(p => p.id === connection.partB);
            
            if (!partA || !partB) return;

            // 计算连接点的当前位置
            const attachA = partA.data.attachment_points[connection.attachPointA];
            const attachB = partB.data.attachment_points[connection.attachPointB];
            
            if (!attachA || !attachB) return;

            // 计算部件A的连接点位置
            const partACenterX = partA.position.x + (partA.data.dimensions.width * 20);
            const partACenterY = partA.position.y + (partA.data.dimensions.height * 20);
            const pointAX = partACenterX + (attachA.x * 40);
            const pointAY = partACenterY + (attachA.y * 40);

            // 计算部件B的连接点位置
            const partBCenterX = partB.position.x + (partB.data.dimensions.width * 20);
            const partBCenterY = partB.position.y + (partB.data.dimensions.height * 20);
            const pointBX = partBCenterX + (attachB.x * 40);
            const pointBY = partBCenterY + (attachB.y * 40);

            // 计算连接点之间的距离
            const distance = Math.sqrt(
                Math.pow(pointAX - pointBX, 2) + 
                Math.pow(pointAY - pointBY, 2)
            );

            // 如果距离超过容忍度，标记为需要断开
            if (distance > disconnectionTolerance) {
                console.log(`连接 ${connection.id} 因距离过远而断开 (距离: ${distance.toFixed(2)}px)`);
                brokenConnections.push(connection.id);
            }
        });

        // 断开失效的连接
        brokenConnections.forEach(connectionId => {
            this.disconnectParts(connectionId);
        });

        return brokenConnections;
    }

    // 计算总质量
    getTotalMass() {
        return this.parts.reduce((total, part) => {
            let partMass = part.data.mass; // 干重
            
            // 如果是燃料罐，加上燃料质量
            if (part.fuelStatus) {
                // 假设燃料密度：液体燃料 0.005 t/单位，氧化剂 0.0055 t/单位
                const fuelMass = (part.fuelStatus.liquid_fuel * 0.005) + 
                               (part.fuelStatus.oxidizer * 0.0055);
                partMass += fuelMass;
            }
            
            return total + partMass;
        }, 0);
    }

    // 计算总推力
    getTotalThrust() {
        return this.parts
            .filter(part => part.data.type === 'engine')
            .reduce((total, part) => total + (part.data.thrust || 0), 0);
    }

    // 获取部件数量
    getPartCount() {
        return this.parts.length;
    }

    // 获取所有与根部件连通的部件
    getConnectedParts() {
        if (!this.rootPart) return [];
        
        const connectedParts = new Set();
        const visited = new Set();
        
        // 深度优先搜索找到所有连通的部件
        const dfs = (partId) => {
            if (visited.has(partId)) return;
            visited.add(partId);
            connectedParts.add(partId);
            
            // 查找所有与当前部件相连的其他部件
            this.connections.forEach(connection => {
                let connectedPartId = null;
                if (connection.partA === partId) {
                    connectedPartId = connection.partB;
                } else if (connection.partB === partId) {
                    connectedPartId = connection.partA;
                }
                
                if (connectedPartId && !visited.has(connectedPartId)) {
                    dfs(connectedPartId);
                }
            });
        };
        
        // 从根部件开始搜索
        dfs(this.rootPart);
        
        return Array.from(connectedParts);
    }

    // 获取未连通的部件
    getDisconnectedParts() {
        const connectedParts = this.getConnectedParts();
        return this.parts.filter(part => !connectedParts.includes(part.id)).map(part => part.id);
    }

    // 检查部件是否与根部件连通
    isPartConnectedToRoot(partId) {
        return this.getConnectedParts().includes(partId);
    }

    // 计算只包含连通部件的总质量
    getConnectedMass() {
        const connectedPartIds = this.getConnectedParts();
        
        return this.parts
            .filter(part => connectedPartIds.includes(part.id))
            .reduce((total, part) => {
                let partMass = part.data.mass; // 干重
                
                // 如果是燃料罐，加上燃料质量
                if (part.fuelStatus) {
                    // 假设燃料密度：液体燃料 0.005 t/单位，氧化剂 0.0055 t/单位
                    const fuelMass = (part.fuelStatus.liquid_fuel * 0.005) + 
                                   (part.fuelStatus.oxidizer * 0.0055);
                    partMass += fuelMass;
                }
                
                return total + partMass;
            }, 0);
    }

    // 计算只包含连通部件的推力
    getConnectedThrust() {
        const connectedPartIds = this.getConnectedParts();
        
        return this.parts
            .filter(part => connectedPartIds.includes(part.id) && part.data.type === 'engine')
            .reduce((total, part) => total + (part.data.thrust || 0), 0);
    }

    // 获取连通部件数量
    getConnectedPartCount() {
        return this.getConnectedParts().length;
    }

    // 计算只包含连通部件的Delta-V
    estimateConnectedDeltaV() {
        const connectedPartIds = this.getConnectedParts();
        
        // 只计算连通的引擎
        const connectedEngines = this.parts.filter(part => 
            connectedPartIds.includes(part.id) && part.data.type === 'engine'
        );
        
        if (connectedEngines.length === 0) return 0;

        const avgIsp = connectedEngines.reduce((sum, engine) => 
            sum + (engine.data.isp_vacuum || 300), 0
        ) / connectedEngines.length;
        
        // 计算连通部件的实际燃料质量和干重
        let totalFuelMass = 0;
        let dryMass = 0;
        
        this.parts
            .filter(part => connectedPartIds.includes(part.id))
            .forEach(part => {
                dryMass += part.data.mass;
                
                // 如果是燃料罐，计算燃料质量
                if (part.fuelStatus) {
                    totalFuelMass += (part.fuelStatus.liquid_fuel * 0.005) + 
                                   (part.fuelStatus.oxidizer * 0.0055);
                }
            });
        
        const wetMass = dryMass + totalFuelMass;

        if (wetMass <= dryMass || totalFuelMass <= 0) return 0;

        const g = 9.81;
        return avgIsp * g * Math.log(wetMass / dryMass);
    }

    // 计算估算Delta-V（保留原方法，但建议使用estimateConnectedDeltaV）
    estimateDeltaV() {
        const engines = this.parts.filter(part => part.data.type === 'engine');
        if (engines.length === 0) return 0;

        const avgIsp = engines.reduce((sum, engine) => sum + (engine.data.isp_vacuum || 300), 0) / engines.length;
        
        // 计算实际燃料质量和干重
        let totalFuelMass = 0;
        let dryMass = 0;
        
        this.parts.forEach(part => {
            dryMass += part.data.mass;
            
            // 如果是燃料罐，计算燃料质量
            if (part.fuelStatus) {
                totalFuelMass += (part.fuelStatus.liquid_fuel * 0.005) + 
                               (part.fuelStatus.oxidizer * 0.0055);
            }
        });
        
        const wetMass = dryMass + totalFuelMass;

        if (wetMass <= dryMass || totalFuelMass <= 0) return 0;

        const g = 9.81;
        return avgIsp * g * Math.log(wetMass / dryMass);
    }

    // 导出为JSON
    toJSON() {
        return {
            name: this.name,
            parts: this.parts,
            connections: this.connections,
            rootPart: this.rootPart,
            created: this.created,
            modified: this.modified
        };
    }

    // 从JSON导入
    fromJSON(data) {
        this.name = data.name || '未命名载具';
        this.parts = data.parts || [];
        this.connections = data.connections || [];
        this.rootPart = data.rootPart || null;
        this.created = new Date(data.created) || new Date();
        this.modified = new Date(data.modified) || new Date();
    }

    // 获取所有分离器部件
    getDecouplers() {
        return this.parts.filter(part => 
            part.data.type === 'decoupler' && 
            part.data.decoupler_properties?.can_separate
        );
    }

    // 检查部件是否在分离器上方
    isPartAboveDecoupler(partId, decouplerId) {
        const part = this.parts.find(p => p.id === partId);
        const decoupler = this.parts.find(p => p.id === decouplerId);
        
        if (!part || !decoupler) return false;
        
        return part.position.y < decoupler.position.y;
    }

    // 获取分离器连接的上级和下级部件组
    getDecouplerSeparationGroups(decouplerId) {
        const decoupler = this.parts.find(p => p.id === decouplerId);
        if (!decoupler || decoupler.data.type !== 'decoupler') return null;

        // 获取分离器的连接
        const decouplerConnections = this.connections.filter(conn => 
            conn.partA === decouplerId || conn.partB === decouplerId
        );

        const upperParts = new Set();
        const lowerParts = new Set();

        // 遍历每个连接，确定上级和下级部件
        decouplerConnections.forEach(connection => {
            const otherPartId = connection.partA === decouplerId ? connection.partB : connection.partA;
            const otherPart = this.parts.find(p => p.id === otherPartId);
            
            if (otherPart) {
                if (this.isPartAboveDecoupler(otherPartId, decouplerId)) {
                    upperParts.add(otherPartId);
                    // 递归获取所有上级连接的部件
                    this.getConnectedPartsRecursive(otherPartId, upperParts, [decouplerId]);
                } else {
                    lowerParts.add(otherPartId);
                    // 递归获取所有下级连接的部件
                    this.getConnectedPartsRecursive(otherPartId, lowerParts, [decouplerId]);
                }
            }
        });

        return {
            decoupler: decoupler,
            upperStage: Array.from(upperParts).map(id => this.parts.find(p => p.id === id)),
            lowerStage: Array.from(lowerParts).map(id => this.parts.find(p => p.id === id))
        };
    }

    // 递归获取连接的部件（排除特定部件）
    getConnectedPartsRecursive(partId, resultSet, excludeIds = []) {
        if (excludeIds.includes(partId)) return;

        const directConnections = this.connections.filter(conn => 
            (conn.partA === partId || conn.partB === partId) && 
            !excludeIds.includes(conn.partA) && !excludeIds.includes(conn.partB)
        );

        directConnections.forEach(connection => {
            const otherPartId = connection.partA === partId ? connection.partB : connection.partA;
            
            if (!resultSet.has(otherPartId) && !excludeIds.includes(otherPartId)) {
                resultSet.add(otherPartId);
                this.getConnectedPartsRecursive(otherPartId, resultSet, excludeIds);
            }
        });
    }

    // 模拟分离器激活（断开连接，但保留部件用于显示分离效果）
    activateDecoupler(decouplerId) {
        const separationGroups = this.getDecouplerSeparationGroups(decouplerId);
        if (!separationGroups) return null;

        // 断开分离器的所有连接
        const decouplerConnections = this.connections.filter(conn => 
            conn.partA === decouplerId || conn.partB === decouplerId
        );

        const brokenConnections = [];
        decouplerConnections.forEach(connection => {
            if (this.disconnectParts(connection.id)) {
                brokenConnections.push(connection);
            }
        });

        console.log(`分离器 ${separationGroups.decoupler.data.name} 已激活`);
        console.log(`分离了 ${separationGroups.upperStage.length} 个上级部件和 ${separationGroups.lowerStage.length} 个下级部件`);
        
        return {
            ...separationGroups,
            brokenConnections: brokenConnections,
            separationForce: separationGroups.decoupler.data.separation_force || 2500
        };
    }

    // 获取火箭的分级信息
    getStagingInfo() {
        const decouplers = this.getDecouplers();
        const stages = [];

        // 按分级优先级排序
        decouplers.sort((a, b) => {
            const priorityA = a.data.decoupler_properties?.stage_priority || 999;
            const priorityB = b.data.decoupler_properties?.stage_priority || 999;
            return priorityA - priorityB;
        });

        decouplers.forEach((decoupler, index) => {
            const groups = this.getDecouplerSeparationGroups(decoupler.id);
            if (groups) {
                // 计算各级的引擎数量
                const upperStageEngines = groups.upperStage.filter(part => part.data.type === 'engine');
                const lowerStageEngines = groups.lowerStage.filter(part => part.data.type === 'engine');
                
                // 对于第一级，显示下级部件（被抛弃的部件）
                // 对于后续级别，显示上级部件（保留的部件）
                const isFirstStage = index === 0;
                const stagePartsCount = isFirstStage ? 
                    groups.lowerStage.length + 1 : // 下级部件 + 分离器
                    groups.upperStage.length; // 上级部件
                    
                const stageEngines = isFirstStage ? lowerStageEngines : upperStageEngines;
                
                stages.push({
                    stage: index + 1,
                    decoupler: groups.decoupler,
                    partsCount: stagePartsCount,
                    mass: this.calculateStageMass(groups),
                    deltaV: this.calculateStageDeltaV(groups),
                    engines: stageEngines, // 当前级的引擎
                    upperStageEngines: upperStageEngines, // 上级引擎（分离后保留的引擎）
                    lowerStageEngines: lowerStageEngines, // 下级引擎（分离掉的引擎）
                    upperStage: groups.upperStage,
                    lowerStage: groups.lowerStage
                });
            }
        });

        return stages;
    }

    // 计算单级质量
    calculateStageMass(stageGroups) {
        let totalMass = 0;
        const allParts = [...stageGroups.upperStage, ...stageGroups.lowerStage, stageGroups.decoupler];
        
        allParts.forEach(part => {
            totalMass += part.data.mass;
            // 添加燃料质量
            if (part.fuelStatus) {
                totalMass += (part.fuelStatus.liquid_fuel * 0.005) + 
                           (part.fuelStatus.oxidizer * 0.0055);
            }
        });

        return totalMass;
    }

    // 计算单级Delta-V
    calculateStageDeltaV(stageGroups) {
        // 简化计算：假设主要推力来自下级
        const engines = stageGroups.lowerStage.filter(part => part.data.type === 'engine');
        if (engines.length === 0) return 0;

        const totalThrust = engines.reduce((sum, engine) => sum + (engine.data.thrust || 0), 0);
        const avgIsp = engines.reduce((sum, engine) => sum + (engine.data.isp_vacuum || 300), 0) / engines.length;

        const wetMass = this.calculateStageMass(stageGroups);
        const dryMass = wetMass * 0.3; // 简化：假设燃料质量占70%

        if (wetMass <= dryMass) return 0;

        const g = 9.81;
        return avgIsp * g * Math.log(wetMass / dryMass);
    }

    // 清空组装
    clear() {
        this.parts = [];
        this.connections = [];
        this.rootPart = null;
        this.name = '未命名载具';
        this.modified = new Date();
    }
}

// 导出给其他模块使用
window.RocketParts = RocketParts;
window.RocketAssembly = RocketAssembly;
