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
                top: { x: 0, y: -0.5, size: 1.25 }
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

    // 计算总质量
    getTotalMass() {
        return this.parts.reduce((total, part) => total + part.data.mass, 0);
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

    // 计算估算Delta-V（简化版）
    estimateDeltaV() {
        const engines = this.parts.filter(part => part.data.type === 'engine');
        if (engines.length === 0) return 0;

        const totalMass = this.getTotalMass();
        const avgIsp = engines.reduce((sum, engine) => sum + (engine.data.isp_vacuum || 300), 0) / engines.length;
        
        // 简化计算：假设50%的质量是燃料
        const fuelFraction = 0.5;
        const dryMass = totalMass * (1 - fuelFraction);
        const wetMass = totalMass;

        if (wetMass <= dryMass) return 0;

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
