// 天体类
class CelestialBody {
    constructor(options = {}) {
        this.name = options.name || 'Unknown';
        this.mass = options.mass || 1e20;
        this.radius = options.radius || 100000;
        this.position = options.position || { x: 0, y: 0, z: 0 };
        
        // 大气参数
        this.hasAtmosphere = options.hasAtmosphere || false;
        this.atmosphereHeight = options.atmosphereHeight || 0;
        this.atmosphereDensity = options.atmosphereDensity || 1.225;
        
        // 轨道参数
        this.orbitRadius = options.orbitRadius || null;
        this.orbitSpeed = options.orbitSpeed || 0;
        this.orbitAngle = options.orbitAngle || 0;
        
        // 渲染参数
        this.color = options.color || '#4a90e2';
        this.atmosphereColor = options.atmosphereColor || 'rgba(135, 206, 235, 0.3)';
        
        // 表面特征
        this.surfaceGravity = this.calculateSurfaceGravity();
        this.escapeVelocity = this.calculateEscapeVelocity();
    }
    
    calculateSurfaceGravity() {
        const G = 6.67430e-11;
        return (G * this.mass) / (this.radius * this.radius);
    }
    
    calculateEscapeVelocity() {
        const G = 6.67430e-11;
        return Math.sqrt(2 * G * this.mass / this.radius);
    }
    
    // 获取指定高度的重力加速度
    getGravityAt(altitude) {
        const r = this.radius + altitude;
        const G = 6.67430e-11;
        return (G * this.mass) / (r * r);
    }
    
    // 获取指定高度的大气密度
    getAtmosphericDensityAt(altitude) {
        if (!this.hasAtmosphere || altitude > this.atmosphereHeight) {
            return 0;
        }
        
        // 指数大气模型
        const scaleHeight = this.atmosphereHeight / 5; // 简化
        return this.atmosphereDensity * Math.exp(-altitude / scaleHeight);
    }
    
    // 获取指定高度的大气压力
    getAtmosphericPressureAt(altitude) {
        if (!this.hasAtmosphere || altitude > this.atmosphereHeight) {
            return 0;
        }
        
        const seaLevelPressure = 101325; // Pa
        const scaleHeight = this.atmosphereHeight / 5;
        return seaLevelPressure * Math.exp(-altitude / scaleHeight);
    }
    
    // 检查点是否在天体表面以下
    isUnderground(position) {
        const dx = position.x - this.position.x;
        const dy = position.y - this.position.y;
        const dz = position.z - this.position.z;
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        return distance < this.radius;
    }
    
    // 获取到表面的距离
    getAltitudeAt(position) {
        const dx = position.x - this.position.x;
        const dy = position.y - this.position.y;
        const dz = position.z - this.position.z;
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        return Math.max(0, distance - this.radius);
    }
    
    // 获取表面法线（用于着陆）
    getSurfaceNormal(position) {
        const dx = position.x - this.position.x;
        const dy = position.y - this.position.y;
        const dz = position.z - this.position.z;
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (distance === 0) return { x: 0, y: 1, z: 0 };
        
        return {
            x: dx / distance,
            y: dy / distance,
            z: dz / distance
        };
    }
    
    // 计算轨道速度
    getOrbitalVelocityAt(altitude) {
        const r = this.radius + altitude;
        const G = 6.67430e-11;
        return Math.sqrt((G * this.mass) / r);
    }
    
    // 更新天体位置（用于轨道运动）
    update(deltaTime) {
        if (this.orbitRadius && this.orbitSpeed) {
            this.orbitAngle += (this.orbitSpeed * deltaTime) / this.orbitRadius;
            this.position.x = this.orbitRadius * Math.cos(this.orbitAngle);
            this.position.z = this.orbitRadius * Math.sin(this.orbitAngle);
        }
    }
    
    // 获取天体信息
    getInfo() {
        return {
            name: this.name,
            mass: this.mass,
            radius: this.radius,
            surfaceGravity: this.surfaceGravity,
            escapeVelocity: this.escapeVelocity,
            hasAtmosphere: this.hasAtmosphere,
            atmosphereHeight: this.atmosphereHeight,
            position: { ...this.position }
        };
    }
}

// 预定义的天体数据
const CELESTIAL_BODIES_DATA = {
    kerbin: {
        name: 'Kerbin',
        mass: 5.2915158e22,
        radius: 600000,
        surfaceGravity: 9.81,
        hasAtmosphere: true,
        atmosphereHeight: 70000,
        color: '#4a90e2',
        description: 'Kerbal的母星，一颗蓝绿色的行星，拥有厚厚的大气层。'
    },
    
    mun: {
        name: 'Mun',
        mass: 9.7599066e20,
        radius: 200000,
        orbitRadius: 12000000,
        orbitSpeed: 542.5,
        hasAtmosphere: false,
        color: '#888888',
        description: 'Kerbin的较大卫星，灰色多坑的表面，是理想的登陆目标。'
    },
    
    minmus: {
        name: 'Minmus',
        mass: 2.6457580e19,
        radius: 60000,
        orbitRadius: 47000000,
        orbitSpeed: 274.74,
        hasAtmosphere: false,
        color: '#aaffaa',
        description: 'Kerbin的较小卫星，薄荷绿色的表面，重力极低。'
    },
    
    sun: {
        name: 'Kerbol',
        mass: 1.7565459e28,
        radius: 261600000,
        hasAtmosphere: true,
        atmosphereHeight: 600000,
        color: '#ffaa00',
        description: '太阳系的中心恒星，巨大而炽热。'
    },
    
    duna: {
        name: 'Duna',
        mass: 4.5154270e21,
        radius: 320000,
        orbitRadius: 20726155264,
        orbitSpeed: 142.02,
        hasAtmosphere: true,
        atmosphereHeight: 50000,
        color: '#cc4444',
        description: '红色行星，拥有稀薄的大气层和极地冰帽。'
    },
    
    eve: {
        name: 'Eve',
        mass: 1.2243980e23,
        radius: 700000,
        orbitRadius: 9832684544,
        orbitSpeed: 222.86,
        hasAtmosphere: true,
        atmosphereHeight: 90000,
        color: '#9944cc',
        description: '紫色行星，拥有极厚的大气层，着陆容易但起飞困难。'
    }
};

// 工厂方法创建天体
function createCelestialBody(bodyName) {
    const data = CELESTIAL_BODIES_DATA[bodyName.toLowerCase()];
    if (!data) {
        console.warn(`未找到天体数据: ${bodyName}`);
        return null;
    }
    
    return new CelestialBody(data);
}

// 创建太阳系
function createKerbalSystem() {
    const system = [];
    
    // 创建主要天体
    const kerbin = createCelestialBody('kerbin');
    const mun = createCelestialBody('mun');
    const minmus = createCelestialBody('minmus');
    const sun = createCelestialBody('sun');
    
    // 设置位置
    if (kerbin) {
        kerbin.position = { x: 0, y: 0, z: 0 };
        system.push(kerbin);
    }
    
    if (mun) {
        mun.position = { x: 12000000, y: 0, z: 0 };
        system.push(mun);
    }
    
    if (minmus) {
        minmus.position = { x: 47000000, y: 0, z: 0 };
        system.push(minmus);
    }
    
    if (sun) {
        sun.position = { x: -13599840256, y: 0, z: 0 };
        system.push(sun);
    }
    
    return system;
}

// 导出给其他模块使用
window.CelestialBody = CelestialBody;
window.createCelestialBody = createCelestialBody;
window.createKerbalSystem = createKerbalSystem;
window.CELESTIAL_BODIES_DATA = CELESTIAL_BODIES_DATA;
