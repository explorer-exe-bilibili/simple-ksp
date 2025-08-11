// 渲染引擎类
class RenderEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        
        // 摄像机
        this.camera = {
            x: 0,
            y: 0,
            z: 1000,
            zoom: 1,
            rotation: 0,
            target: null // 跟踪目标
        };
        
        // 渲染设置
        this.showGrid = true;
        this.showOrbit = true;
        this.showAtmosphere = true;
        this.showVectors = false;
        
        // 颜色主题
        this.colors = {
            background: '#000814',
            grid: '#1a2332',
            atmosphere: 'rgba(135, 206, 235, 0.2)',
            orbit: '#00d4ff',
            velocity: '#00ff88',
            thrust: '#ff4444',
            planet: '#4a90e2',
            vehicle: '#ffffff',
            parts: {
                command: '#ffaa00',
                fuel: '#888888',
                engine: '#ff6666',
                structure: '#999999',
                aero: '#66aaff'
            }
        };
        
        this.initialized = false;
    }
    
    async initialize() {
        console.log('初始化渲染引擎...');
        
        // 根据当前场景获取对应的canvas
        this.switchCanvas('flight');
        
        this.initialized = true;
        console.log('渲染引擎初始化完成');
    }
    
    switchCanvas(scene) {
        let canvasId;
        
        switch (scene) {
            case 'assembly':
                canvasId = 'assembly-canvas';
                break;
            case 'flight':
                canvasId = 'flight-canvas';
                break;
            case 'tracking':
                canvasId = 'solar-system-canvas';
                break;
            default:
                canvasId = 'flight-canvas';
        }
        
        this.canvas = document.getElementById(canvasId);
        
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.updateCanvasSize();
        } else {
            console.warn(`Canvas元素未找到: ${canvasId}`);
        }
    }
    
    updateCanvasSize() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        // 设置canvas实际分辨率
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    handleResize() {
        this.updateCanvasSize();
    }
    
    render(gameState) {
        if (!this.initialized || !this.ctx) return;
        
        // 清空画布
        this.clearCanvas();
        
        // 根据当前场景渲染不同内容
        switch (gameState.currentScene) {
            case 'assembly':
                this.renderAssembly(gameState);
                break;
            case 'flight':
                this.renderFlight(gameState);
                break;
            case 'tracking':
                this.renderTracking(gameState);
                break;
        }
    }
    
    clearCanvas() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 添加星空背景
        this.drawStarfield();
    }
    
    drawStarfield() {
        this.ctx.fillStyle = '#ffffff';
        
        // 简单的静态星星
        const starCount = 100;
        const seed = 12345; // 固定种子确保星星位置不变
        
        for (let i = 0; i < starCount; i++) {
            const random1 = this.seededRandom(seed + i);
            const random2 = this.seededRandom(seed + i + starCount);
            const random3 = this.seededRandom(seed + i + starCount * 2);
            
            const x = random1 * this.width;
            const y = random2 * this.height;
            const opacity = 0.3 + random3 * 0.7;
            
            this.ctx.globalAlpha = opacity;
            this.ctx.fillRect(x, y, 1, 1);
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    
    renderAssembly(gameState) {
        this.ctx.save();
        
        // 移动到画布中心
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // 绘制网格
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // 绘制当前载具
        if (gameState.currentVehicle) {
            this.drawVehicle(gameState.currentVehicle);
        }
        
        this.ctx.restore();
    }
    
    renderFlight(gameState) {
        this.ctx.save();
        
        // 更新摄像机位置
        this.updateCamera(gameState);
        
        // 应用摄像机变换
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // 绘制Kerbin
        this.drawPlanet('Kerbin', 0, 0, 600000);
        
        // 绘制大气层
        if (this.showAtmosphere) {
            this.drawAtmosphere(0, 0, 600000, 70000);
        }
        
        // 绘制网格（可选）
        if (this.showGrid) {
            this.drawGrid(100000); // 100km间距
        }
        
        // 绘制当前载具
        if (gameState.currentVehicle) {
            this.drawVehicle(gameState.currentVehicle);
            
            // 绘制轨道预测
            if (this.showOrbit) {
                this.drawOrbitPrediction(gameState.currentVehicle);
            }
            
            // 绘制速度和推力向量
            if (this.showVectors) {
                this.drawVelocityVector(gameState.currentVehicle);
                this.drawThrustVector(gameState.currentVehicle);
            }
        }
        
        // 绘制其他载具
        gameState.activeVessels.forEach(vessel => {
            if (vessel !== gameState.currentVehicle) {
                this.drawVehicle(vessel, 0.5); // 半透明
            }
        });
        
        this.ctx.restore();
    }
    
    renderTracking(gameState) {
        this.ctx.save();
        
        // 太阳系视图
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(0.00005, 0.00005); // 极小缩放以显示整个太阳系
        
        // 绘制太阳系天体
        this.drawPlanet('Kerbin', 0, 0, 600000, '#4a90e2');
        this.drawPlanet('Mun', 12000000, 0, 200000, '#888888');
        this.drawPlanet('Minmus', 47000000, 0, 60000, '#aaffaa');
        
        // 绘制轨道
        this.drawOrbit(0, 0, 12000000, '#666666'); // Mun轨道
        this.drawOrbit(0, 0, 47000000, '#666666'); // Minmus轨道
        
        // 绘制载具位置
        gameState.activeVessels.forEach(vessel => {
            if (vessel.physics) {
                const pos = vessel.physics.position;
                this.drawVehicleMarker(pos.x, pos.z, vessel.name);
            }
        });
        
        this.ctx.restore();
    }
    
    updateCamera(gameState) {
        if (gameState.currentVehicle && gameState.currentVehicle.physics) {
            const vehicle = gameState.currentVehicle;
            const pos = vehicle.physics.position;
            
            // 摄像机跟随载具
            this.camera.x = pos.x;
            this.camera.y = pos.z; // 注意：y和z轴的映射
            
            // 根据高度调整缩放
            const altitude = vehicle.altitude || 0;
            if (altitude < 1000) {
                this.camera.zoom = 0.5; // 近地面
            } else if (altitude < 10000) {
                this.camera.zoom = 0.2; // 低空
            } else if (altitude < 70000) {
                this.camera.zoom = 0.05; // 大气层内
            } else {
                this.camera.zoom = 0.01; // 太空
            }
        }
    }
    
    drawGrid(spacing = 10000) {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1 / this.camera.zoom;
        this.ctx.globalAlpha = 0.3;
        
        const extent = Math.max(this.width, this.height) / this.camera.zoom;
        const centerX = this.camera.x;
        const centerY = this.camera.y;
        
        // 垂直线
        for (let x = Math.floor((centerX - extent) / spacing) * spacing; x <= centerX + extent; x += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, centerY - extent);
            this.ctx.lineTo(x, centerY + extent);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let y = Math.floor((centerY - extent) / spacing) * spacing; y <= centerY + extent; y += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - extent, y);
            this.ctx.lineTo(centerX + extent, y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    drawPlanet(name, x, y, radius, color = null) {
        this.ctx.fillStyle = color || this.colors.planet;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 绘制名称
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.max(12, radius / 100000)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(name, x, y + radius + 20);
    }
    
    drawAtmosphere(x, y, planetRadius, atmosphereHeight) {
        const totalRadius = planetRadius + atmosphereHeight;
        
        // 创建径向渐变
        const gradient = this.ctx.createRadialGradient(x, y, planetRadius, x, y, totalRadius);
        gradient.addColorStop(0, 'rgba(135, 206, 235, 0.3)');
        gradient.addColorStop(1, 'rgba(135, 206, 235, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, totalRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawVehicle(vehicle, alpha = 1) {
        if (!vehicle.physics) return;
        
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        
        const pos = vehicle.physics.position;
        
        // 移动到载具位置
        this.ctx.translate(pos.x, pos.z); // 注意坐标映射
        
        if (vehicle.parts && vehicle.parts.length > 0) {
            // 绘制各个部件
            vehicle.parts.forEach(part => {
                this.drawPart(part);
            });
        } else {
            // 简单的载具表示
            this.ctx.fillStyle = this.colors.vehicle;
            this.ctx.fillRect(-5, -10, 10, 20);
        }
        
        this.ctx.restore();
    }
    
    drawPart(part) {
        if (!part.position) return;
        
        this.ctx.save();
        
        // 移动到部件位置
        this.ctx.translate(part.position.x, part.position.z);
        
        // 设置颜色
        this.ctx.fillStyle = this.colors.parts[part.type] || this.colors.parts.structure;
        
        // 根据部件类型绘制不同形状
        switch (part.type) {
            case 'command':
                // 指令舱 - 圆形
                this.ctx.beginPath();
                this.ctx.arc(0, 0, part.size || 3, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            case 'fuel':
                // 燃料罐 - 矩形
                const width = part.size || 4;
                const height = part.height || 8;
                this.ctx.fillRect(-width/2, -height/2, width, height);
                break;
                
            case 'engine':
                // 引擎 - 梯形
                this.ctx.beginPath();
                this.ctx.moveTo(-3, -2);
                this.ctx.lineTo(3, -2);
                this.ctx.lineTo(2, 2);
                this.ctx.lineTo(-2, 2);
                this.ctx.closePath();
                this.ctx.fill();
                
                // 如果引擎在工作，绘制火焰效果
                if (part.isActive && part.throttle > 0) {
                    this.drawEngineFlame(part);
                }
                break;
                
            default:
                // 默认形状 - 小矩形
                this.ctx.fillRect(-2, -2, 4, 4);
        }
        
        this.ctx.restore();
    }
    
    drawEngineFlame(engine) {
        if (!engine.isActive || engine.throttle <= 0) return;
        
        this.ctx.save();
        
        // 火焰颜色和大小随推力变化
        const flameLength = (engine.throttle || 0) * 15;
        const gradient = this.ctx.createLinearGradient(0, 2, 0, 2 + flameLength);
        gradient.addColorStop(0, '#ffaa00');
        gradient.addColorStop(0.5, '#ff4444');
        gradient.addColorStop(1, 'rgba(255, 68, 68, 0)');
        
        this.ctx.fillStyle = gradient;
        
        // 绘制火焰形状
        this.ctx.beginPath();
        this.ctx.moveTo(-1, 2);
        this.ctx.lineTo(1, 2);
        this.ctx.lineTo(0, 2 + flameLength);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawOrbitPrediction(vehicle) {
        if (!vehicle.orbitInfo || !vehicle.physics) return;
        
        this.ctx.strokeStyle = this.colors.orbit;
        this.ctx.lineWidth = 2 / this.camera.zoom;
        this.ctx.globalAlpha = 0.7;
        
        // 简化的轨道绘制（圆形）
        const pos = vehicle.physics.position;
        const distance = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, distance, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1;
    }
    
    drawVelocityVector(vehicle) {
        if (!vehicle.physics) return;
        
        this.ctx.strokeStyle = this.colors.velocity;
        this.ctx.lineWidth = 3 / this.camera.zoom;
        
        const pos = vehicle.physics.position;
        const vel = vehicle.physics.velocity;
        const scale = 100; // 缩放因子
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.z);
        this.ctx.lineTo(pos.x + vel.x * scale, pos.z + vel.z * scale);
        this.ctx.stroke();
        
        // 箭头
        this.drawArrow(pos.x + vel.x * scale, pos.z + vel.z * scale, 
                      Math.atan2(vel.z, vel.x), 5 / this.camera.zoom);
    }
    
    drawThrustVector(vehicle) {
        if (!vehicle.engines || !vehicle.physics) return;
        
        this.ctx.strokeStyle = this.colors.thrust;
        this.ctx.lineWidth = 3 / this.camera.zoom;
        
        const pos = vehicle.physics.position;
        
        vehicle.engines.forEach(engine => {
            if (engine.isActive && engine.throttle > 0) {
                const thrust = engine.maxThrust * engine.throttle;
                const scale = thrust / 1000; // 缩放因子
                const thrustDir = engine.thrustDirection || { x: 0, y: 1, z: 0 };
                
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.z);
                this.ctx.lineTo(pos.x + thrustDir.x * scale, pos.z + thrustDir.z * scale);
                this.ctx.stroke();
                
                // 箭头
                this.drawArrow(pos.x + thrustDir.x * scale, pos.z + thrustDir.z * scale,
                              Math.atan2(thrustDir.z, thrustDir.x), 5 / this.camera.zoom);
            }
        });
    }
    
    drawArrow(x, y, angle, size) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-size, -size/2);
        this.ctx.lineTo(-size, size/2);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawOrbit(x, y, radius, color) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.5;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1;
    }
    
    drawVehicleMarker(x, y, name) {
        // 绘制载具标记
        this.ctx.fillStyle = '#00d4ff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 绘制名称
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(name, x, y - 10);
    }
    
    // 工具方法
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.camera.x) * this.camera.zoom + this.width / 2,
            y: (worldY - this.camera.y) * this.camera.zoom + this.height / 2
        };
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.width / 2) / this.camera.zoom + this.camera.x,
            y: (screenY - this.height / 2) / this.camera.zoom + this.camera.y
        };
    }
    
    // 设置渲染选项
    setRenderOption(option, value) {
        switch (option) {
            case 'showGrid':
                this.showGrid = value;
                break;
            case 'showOrbit':
                this.showOrbit = value;
                break;
            case 'showAtmosphere':
                this.showAtmosphere = value;
                break;
            case 'showVectors':
                this.showVectors = value;
                break;
        }
    }
}

// 导出给其他模块使用
window.RenderEngine = RenderEngine;
