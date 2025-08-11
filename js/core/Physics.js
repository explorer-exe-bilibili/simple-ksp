// 物理引擎类
class PhysicsEngine {
    constructor() {
        // 物理常量
        this.GRAVITY_CONSTANT = 6.67430e-11; // 万有引力常数
        this.KERBIN_MASS = 5.2915158e22; // Kerbin质量 (kg)
        this.KERBIN_RADIUS = 600000; // Kerbin半径 (m)
        this.SURFACE_GRAVITY = 9.81; // 表面重力 (m/s²)
        this.ATMOSPHERE_HEIGHT = 70000; // 大气层高度 (m)
        
        // 物理对象列表
        this.physicsObjects = [];
        this.celestialBodies = [];
        
        // 大气模型
        this.atmosphereModel = {
            seaLevelPressure: 101325, // Pa
            scaleHeight: 5000, // m
            temperature: 288.15 // K
        };
        
        this.initialized = false;
    }
    
    async initialize() {
        console.log('初始化物理引擎...');
        
        // 创建天体
        this.createCelestialBodies();
        
        this.initialized = true;
        console.log('物理引擎初始化完成');
    }
    
    createCelestialBodies() {
        // 创建Kerbin
        const kerbin = new CelestialBody({
            name: 'Kerbin',
            mass: this.KERBIN_MASS,
            radius: this.KERBIN_RADIUS,
            position: { x: 0, y: 0, z: 0 },
            atmosphereHeight: this.ATMOSPHERE_HEIGHT,
            hasAtmosphere: true
        });
        
        this.celestialBodies.push(kerbin);
        
        // 创建Mun（月球）
        const mun = new CelestialBody({
            name: 'Mun',
            mass: 9.7599066e20,
            radius: 200000,
            position: { x: 12000000, y: 0, z: 0 },
            atmosphereHeight: 0,
            hasAtmosphere: false,
            orbitRadius: 12000000,
            orbitSpeed: 542.5
        });
        
        this.celestialBodies.push(mun);
        
        // 创建Minmus
        const minmus = new CelestialBody({
            name: 'Minmus',
            mass: 2.6457580e19,
            radius: 60000,
            position: { x: 47000000, y: 0, z: 0 },
            atmosphereHeight: 0,
            hasAtmosphere: false,
            orbitRadius: 47000000,
            orbitSpeed: 274.74
        });
        
        this.celestialBodies.push(minmus);
    }
    
    update(deltaTime) {
        if (!this.initialized) return;
        
        // 更新天体轨道
        this.updateCelestialBodies(deltaTime);
        
        // 更新所有物理对象
        this.physicsObjects.forEach(obj => {
            this.updatePhysicsObject(obj, deltaTime);
        });
    }
    
    updateCelestialBodies(deltaTime) {
        this.celestialBodies.forEach(body => {
            if (body.orbitRadius && body.orbitSpeed) {
                // 简单的圆形轨道
                body.orbitAngle = (body.orbitAngle || 0) + (body.orbitSpeed * deltaTime) / body.orbitRadius;
                body.position.x = body.orbitRadius * Math.cos(body.orbitAngle);
                body.position.z = body.orbitRadius * Math.sin(body.orbitAngle);
            }
        });
    }
    
    updatePhysicsObject(obj, deltaTime) {
        if (!obj.physics) return;
        
        // 计算重力
        const gravityForce = this.calculateGravity(obj);
        
        // 计算大气阻力
        const dragForce = this.calculateDrag(obj);
        
        // 计算推力
        const thrustForce = this.calculateThrust(obj);
        
        // 合力
        const totalForce = {
            x: gravityForce.x + dragForce.x + thrustForce.x,
            y: gravityForce.y + dragForce.y + thrustForce.y,
            z: gravityForce.z + dragForce.z + thrustForce.z
        };
        
        // 应用力（F = ma, 所以 a = F/m）
        if (obj.physics.mass > 0) {
            const acceleration = {
                x: totalForce.x / obj.physics.mass,
                y: totalForce.y / obj.physics.mass,
                z: totalForce.z / obj.physics.mass
            };
            
            // 更新速度（欧拉积分）
            obj.physics.velocity.x += acceleration.x * deltaTime;
            obj.physics.velocity.y += acceleration.y * deltaTime;
            obj.physics.velocity.z += acceleration.z * deltaTime;
            
            // 更新位置
            obj.physics.position.x += obj.physics.velocity.x * deltaTime;
            obj.physics.position.y += obj.physics.velocity.y * deltaTime;
            obj.physics.position.z += obj.physics.velocity.z * deltaTime;
            
            // 存储加速度供显示使用
            obj.physics.acceleration = acceleration;
        }
        
        // 更新高度和速度信息
        this.updateObjectMetrics(obj);
    }
    
    calculateGravity(obj) {
        const kerbin = this.celestialBodies[0]; // Kerbin是第一个天体
        
        // 计算到Kerbin中心的距离
        const dx = obj.physics.position.x - kerbin.position.x;
        const dy = obj.physics.position.y - kerbin.position.y;
        const dz = obj.physics.position.z - kerbin.position.z;
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // 避免除以零
        if (distance < 1) return { x: 0, y: 0, z: 0 };
        
        // 重力加速度 g = GM/r²
        const gravityMagnitude = (this.GRAVITY_CONSTANT * kerbin.mass) / (distance * distance);
        
        // 重力方向（指向天体中心）
        const gravityDirection = {
            x: -dx / distance,
            y: -dy / distance,
            z: -dz / distance
        };
        
        return {
            x: gravityDirection.x * gravityMagnitude * obj.physics.mass,
            y: gravityDirection.y * gravityMagnitude * obj.physics.mass,
            z: gravityDirection.z * gravityMagnitude * obj.physics.mass
        };
    }
    
    calculateDrag(obj) {
        const altitude = this.getAltitude(obj);
        
        // 如果超出大气层，没有阻力
        if (altitude > this.ATMOSPHERE_HEIGHT) {
            return { x: 0, y: 0, z: 0 };
        }
        
        // 大气密度随高度衰减
        const density = this.getAtmosphereDensity(altitude);
        
        // 速度
        const velocity = obj.physics.velocity;
        const speed = Math.sqrt(velocity.x*velocity.x + velocity.y*velocity.y + velocity.z*velocity.z);
        
        if (speed < 0.1) return { x: 0, y: 0, z: 0 };
        
        // 阻力系数（简化）
        const dragCoefficient = obj.dragCoefficient || 0.47; // 球体的阻力系数
        const crossSectionalArea = obj.crossSectionalArea || 1.0; // m²
        
        // 阻力 = 0.5 * ρ * v² * Cd * A
        const dragMagnitude = 0.5 * density * speed * speed * dragCoefficient * crossSectionalArea;
        
        // 阻力方向与速度相反
        const dragDirection = {
            x: -velocity.x / speed,
            y: -velocity.y / speed,
            z: -velocity.z / speed
        };
        
        return {
            x: dragDirection.x * dragMagnitude,
            y: dragDirection.y * dragMagnitude,
            z: dragDirection.z * dragMagnitude
        };
    }
    
    calculateThrust(obj) {
        if (!obj.engines || obj.engines.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        
        let totalThrust = { x: 0, y: 0, z: 0 };
        
        obj.engines.forEach(engine => {
            if (engine.isActive && engine.throttle > 0) {
                // 简化的推力计算
                const thrust = engine.maxThrust * engine.throttle;
                
                // 推力方向（相对于载具坐标系）
                const thrustDirection = engine.thrustDirection || { x: 0, y: 1, z: 0 };
                
                totalThrust.x += thrustDirection.x * thrust;
                totalThrust.y += thrustDirection.y * thrust;
                totalThrust.z += thrustDirection.z * thrust;
            }
        });
        
        return totalThrust;
    }
    
    getAltitude(obj) {
        const kerbin = this.celestialBodies[0];
        
        const dx = obj.physics.position.x - kerbin.position.x;
        const dy = obj.physics.position.y - kerbin.position.y;
        const dz = obj.physics.position.z - kerbin.position.z;
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        return Math.max(0, distance - kerbin.radius);
    }
    
    getAtmosphereDensity(altitude) {
        // 指数大气模型
        const seaLevelDensity = 1.225; // kg/m³
        return seaLevelDensity * Math.exp(-altitude / this.atmosphereModel.scaleHeight);
    }
    
    getAtmospherePressure(altitude) {
        if (altitude > this.ATMOSPHERE_HEIGHT) return 0;
        
        return this.atmosphereModel.seaLevelPressure * 
               Math.exp(-altitude / this.atmosphereModel.scaleHeight);
    }
    
    updateObjectMetrics(obj) {
        // 更新高度
        obj.altitude = this.getAltitude(obj);
        
        // 更新速度
        const vel = obj.physics.velocity;
        obj.velocity = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
        
        // 更新加速度大小
        if (obj.physics.acceleration) {
            const acc = obj.physics.acceleration;
            obj.accelerationMagnitude = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
        }
        
        // 更新轨道信息（简化）
        this.updateOrbitInfo(obj);
    }
    
    updateOrbitInfo(obj) {
        const kerbin = this.celestialBodies[0];
        
        // 计算轨道速度和高度
        const position = obj.physics.position;
        const velocity = obj.physics.velocity;
        
        // 距离中心的距离
        const r = Math.sqrt(position.x*position.x + position.y*position.y + position.z*position.z);
        
        // 速度大小
        const v = Math.sqrt(velocity.x*velocity.x + velocity.y*velocity.y + velocity.z*velocity.z);
        
        // 比能量
        const specificEnergy = (v*v)/2 - (this.GRAVITY_CONSTANT * kerbin.mass)/r;
        
        // 如果比能量为负，则是椭圆轨道
        if (specificEnergy < 0) {
            // 半长轴
            const semiMajorAxis = -(this.GRAVITY_CONSTANT * kerbin.mass)/(2 * specificEnergy);
            
            // 远地点和近地点高度
            obj.orbitInfo = {
                apoapsis: semiMajorAxis * 2 - r - kerbin.radius,
                periapsis: 2 * semiMajorAxis - r - kerbin.radius,
                eccentricity: 0, // 简化
                period: 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / (this.GRAVITY_CONSTANT * kerbin.mass))
            };
        } else {
            // 双曲线轨道或抛物线轨道
            obj.orbitInfo = {
                apoapsis: Infinity,
                periapsis: r - kerbin.radius,
                eccentricity: 1,
                period: Infinity
            };
        }
    }
    
    // 添加物理对象
    addPhysicsObject(obj) {
        if (!this.physicsObjects.includes(obj)) {
            this.physicsObjects.push(obj);
        }
    }
    
    // 移除物理对象
    removePhysicsObject(obj) {
        const index = this.physicsObjects.indexOf(obj);
        if (index > -1) {
            this.physicsObjects.splice(index, 1);
        }
    }
    
    // 检查碰撞（地面）
    checkGroundCollision(obj) {
        if (obj.altitude <= 0) {
            return true;
        }
        return false;
    }
    
    // 获取重力加速度
    getGravityAcceleration(altitude) {
        const r = altitude + this.KERBIN_RADIUS;
        return (this.GRAVITY_CONSTANT * this.KERBIN_MASS) / (r * r);
    }
    
    // 计算轨道速度
    getOrbitalVelocity(altitude) {
        const r = altitude + this.KERBIN_RADIUS;
        return Math.sqrt((this.GRAVITY_CONSTANT * this.KERBIN_MASS) / r);
    }
    
    // 计算逃逸速度
    getEscapeVelocity(altitude) {
        const r = altitude + this.KERBIN_RADIUS;
        return Math.sqrt(2 * (this.GRAVITY_CONSTANT * this.KERBIN_MASS) / r);
    }
    
    // 工具方法：矢量运算
    static vectorAdd(v1, v2) {
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y,
            z: v1.z + v2.z
        };
    }
    
    static vectorSubtract(v1, v2) {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
            z: v1.z - v2.z
        };
    }
    
    static vectorMultiply(v, scalar) {
        return {
            x: v.x * scalar,
            y: v.y * scalar,
            z: v.z * scalar
        };
    }
    
    static vectorMagnitude(v) {
        return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    }
    
    static vectorNormalize(v) {
        const mag = PhysicsEngine.vectorMagnitude(v);
        if (mag === 0) return { x: 0, y: 0, z: 0 };
        return {
            x: v.x / mag,
            y: v.y / mag,
            z: v.z / mag
        };
    }
}

// 导出给其他模块使用
window.PhysicsEngine = PhysicsEngine;
