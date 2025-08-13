// 发射台主控制器
class LaunchPad {
    constructor() {
        this.rocketData = null;
        this.assembly = null;
        this.simulation = null;
        this.isLaunched = false;
        this.countdown = -1;
        this.countdownTimer = null;
        
        this.initializeUI();
        this.loadRocketData();
    }

    // 初始化UI
    initializeUI() {
        // 隐藏加载覆盖层
        this.hideLoading();
        
        // 初始化控制按钮状态
        this.updateControlButtons();
    }

    // 从localStorage加载火箭数据
    loadRocketData() {
        try {
            const savedRocket = localStorage.getItem('launchRocket');
            if (!savedRocket) {
                this.showError('没有找到火箭数据，请先在装配厂创建火箭');
                return;
            }

            this.rocketData = JSON.parse(savedRocket);
            console.log('加载火箭数据:', this.rocketData);

            // 重建火箭装配
            this.assembly = new RocketAssembly();
            this.assembly.name = this.rocketData.name || '未命名载具';
            
            // 重建部件和连接
            if (this.rocketData.parts && this.rocketData.parts.length > 0) {
                this.rebuildRocket();
                this.displayRocket();
                this.updateFlightData();
                this.updateStagingInfo();
            } else {
                this.showError('火箭数据无效，请重新加载');
            }

        } catch (error) {
            console.error('加载火箭数据失败:', error);
            this.showError('加载火箭数据失败: ' + error.message);
        }
    }

    // 重建火箭装配
    rebuildRocket() {
        // 添加所有部件
        this.rocketData.parts.forEach(partData => {
            const part = this.assembly.addPart(partData.data, partData.position);
            part.id = partData.id;
            
            // 恢复燃料状态
            if (partData.fuelStatus) {
                part.fuelStatus = { ...partData.fuelStatus };
            } else if (part.data.fuel_capacity) {
                // 如果没有燃料状态但部件有燃料容量，初始化为满油
                part.fuelStatus = {
                    liquid_fuel: part.data.fuel_capacity.liquid_fuel || 0,
                    oxidizer: part.data.fuel_capacity.oxidizer || 0
                };
                console.log(`初始化燃料状态 ${part.data.name}:`, part.fuelStatus);
            }
        });

        // 重建连接关系
        if (this.rocketData.connections) {
            this.assembly.connections = [...this.rocketData.connections];
        }

        // 设置根部件
        if (this.rocketData.rootPartId) {
            this.assembly.rootPart = this.assembly.parts.find(p => p.id === this.rocketData.rootPartId);
        }

        console.log('火箭重建完成，部件数量:', this.assembly.parts.length);
        console.log('引擎数量:', this.assembly.parts.filter(p => p.data.type === 'engine').length);
        console.log('燃料罐数量:', this.assembly.parts.filter(p => p.data.fuel_capacity).length);
    }

    // 在发射台显示火箭
    displayRocket() {
        const display = document.getElementById('rocketDisplay');
        const rocketName = document.getElementById('rocketName');
        
        if (!display) return;
        
        // 清空显示区域
        display.innerHTML = '';
        
        // 设置火箭名称
        if (rocketName) {
            rocketName.textContent = this.assembly.name;
        }

        // 计算火箭尺寸和位置
        const bounds = this.calculateRocketBounds();
        const scale = this.calculateDisplayScale(bounds);
        
        // 创建火箭容器
        const rocketContainer = document.createElement('div');
        rocketContainer.className = 'rocket-container';
        rocketContainer.style.position = 'relative';
        rocketContainer.style.transform = `scale(${scale})`;
        
        // 渲染所有部件
        this.assembly.parts.forEach(part => {
            this.renderRocketPart(rocketContainer, part, bounds, scale);
        });

        display.appendChild(rocketContainer);
    }

    // 计算火箭边界
    calculateRocketBounds() {
        if (this.assembly.parts.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        this.assembly.parts.forEach(part => {
            const partWidth = part.data.dimensions.width * 40;
            const partHeight = part.data.dimensions.height * 40;
            
            const left = part.position.x;
            const right = part.position.x + partWidth;
            const top = part.position.y;
            const bottom = part.position.y + partHeight;

            minX = Math.min(minX, left);
            maxX = Math.max(maxX, right);
            minY = Math.min(minY, top);
            maxY = Math.max(maxY, bottom);
        });

        return { minX, maxX, minY, maxY };
    }

    // 计算显示缩放
    calculateDisplayScale(bounds) {
        const maxWidth = 300;  // 最大显示宽度
        const maxHeight = 400; // 最大显示高度
        
        const rocketWidth = bounds.maxX - bounds.minX;
        const rocketHeight = bounds.maxY - bounds.minY;
        
        const scaleX = rocketWidth > 0 ? maxWidth / rocketWidth : 1;
        const scaleY = rocketHeight > 0 ? maxHeight / rocketHeight : 1;
        
        return Math.min(scaleX, scaleY, 1); // 不超过原始大小
    }

    // 渲染单个火箭部件
    renderRocketPart(container, part, bounds, scale) {
        const partElement = document.createElement('div');
        partElement.className = 'rocket-part';
        partElement.id = `launch-part-${part.id}`;
        
        // 计算相对位置（相对于火箭中心）
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        const relativeX = part.position.x - centerX;
        const relativeY = part.position.y - centerY;
        
        partElement.style.left = `${relativeX}px`;
        partElement.style.top = `${relativeY}px`;
        partElement.style.width = `${part.data.dimensions.width * 40}px`;
        partElement.style.height = `${part.data.dimensions.height * 40}px`;
        
        // 加载SVG
        if (part.data.svg_path) {
            fetch(part.data.svg_path)
                .then(response => response.text())
                .then(svgContent => {
                    partElement.innerHTML = svgContent;
                    
                    // 如果是引擎，添加火焰效果容器
                    if (part.data.type === 'engine') {
                        const flame = document.createElement('div');
                        flame.className = 'engine-flame';
                        flame.id = `flame-${part.id}`;
                        partElement.appendChild(flame);
                    }
                })
                .catch(error => {
                    console.error('加载部件SVG失败:', error);
                    partElement.style.backgroundColor = '#666';
                    partElement.style.border = '1px solid #999';
                });
        }
        
        container.appendChild(partElement);
    }

    // 更新飞行数据显示
    updateFlightData() {
        const totalMass = this.assembly.getTotalMass();
        const stagingInfo = this.assembly.getStagingInfo();
        const totalDeltaV = stagingInfo.reduce((sum, stage) => sum + stage.deltaV, 0);
        
        // 计算推重比
        const engines = this.assembly.parts.filter(p => p.data.type === 'engine');
        const totalThrust = engines.reduce((sum, engine) => sum + (engine.data.thrust || 0), 0);
        const twr = totalMass > 0 ? (totalThrust / (totalMass * 9.81)) : 0;

        // 计算总燃料量
        const fuelTanks = this.assembly.parts.filter(p => p.data.fuel_capacity);
        let totalLiquidFuel = 0;
        let totalOxidizer = 0;
        
        fuelTanks.forEach(tank => {
            if (tank.fuelStatus) {
                totalLiquidFuel += tank.fuelStatus.liquid_fuel || 0;
                totalOxidizer += tank.fuelStatus.oxidizer || 0;
            }
        });

        // 更新显示
        document.getElementById('altitude').textContent = '0 m';
        document.getElementById('velocity').textContent = '0 m/s';
        document.getElementById('acceleration').textContent = '0 m/s²';
        document.getElementById('mass').textContent = `${totalMass.toFixed(2)} t`;
        document.getElementById('twr').textContent = twr.toFixed(2);
        document.getElementById('deltaV').textContent = `${totalDeltaV.toFixed(0)} m/s`;
        
        // 更新燃料显示
        if (document.getElementById('liquidFuel')) {
            document.getElementById('liquidFuel').textContent = totalLiquidFuel.toFixed(1);
        }
        if (document.getElementById('oxidizer')) {
            document.getElementById('oxidizer').textContent = totalOxidizer.toFixed(1);
        }
        
        console.log(`燃料状态 - 液体燃料: ${totalLiquidFuel.toFixed(1)}, 氧化剂: ${totalOxidizer.toFixed(1)}, 燃料罐数量: ${fuelTanks.length}`);
    }

    // 更新分级信息
    updateStagingInfo() {
        const stageList = document.getElementById('stageList');
        if (!stageList) return;

        const stagingInfo = this.assembly.getStagingInfo();
        stageList.innerHTML = '';

        console.log('发射台分级信息:', stagingInfo);

        if (stagingInfo.length === 0) {
            stageList.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">单级火箭<br>无分级信息</div>';
            return;
        }

        // 创建一个完整的分级列表，包括最后一级（没有分离器的级）
        const completeStages = [...stagingInfo];
        
        // 如果有分级，最后一级是剩余的所有部件
        if (stagingInfo.length > 0) {
            const lastStageInfo = stagingInfo[stagingInfo.length - 1];
            if (lastStageInfo.upperStage && lastStageInfo.upperStage.length > 0) {
                const finalStageEngines = lastStageInfo.upperStage.filter(p => p.data.type === 'engine');
                const finalStageMass = this.calculateFinalStageMass(lastStageInfo.upperStage);
                
                completeStages.push({
                    stage: stagingInfo.length + 1,
                    decoupler: null,
                    partsCount: lastStageInfo.upperStage.length,
                    mass: finalStageMass,
                    deltaV: 0, // 最后一级的Delta-V需要单独计算
                    engines: finalStageEngines,
                    upperStage: lastStageInfo.upperStage,
                    lowerStage: []
                });
            }
        }

        completeStages.forEach((stage, index) => {
            const stageElement = document.createElement('div');
            stageElement.className = `stage-item ${index === 0 ? 'active' : ''}`;
            stageElement.id = `stage-${index}`;
            
            // 计算引擎数量 - 每级显示其自己的引擎
            const engineCount = stage.engines ? stage.engines.length : 0;
            
            stageElement.innerHTML = `
                <div class="stage-header">
                    <span>第 ${stage.stage} 级</span>
                    <span>${stage.partsCount} 部件</span>
                </div>
                <div class="stage-info">
                    <span>质量: ${stage.mass.toFixed(1)}t</span>
                    <span>ΔV: ${stage.deltaV.toFixed(0)}m/s</span>
                </div>
                <div class="stage-engines">
                    <span>引擎: ${engineCount}</span>
                    <span>${stage.decoupler ? '有分离器' : '无分离器'}</span>
                </div>
            `;
            
            stageList.appendChild(stageElement);
        });
    }

    // 计算最终级的质量
    calculateFinalStageMass(parts) {
        let totalMass = 0;
        parts.forEach(part => {
            totalMass += part.data.mass;
            // 添加燃料质量
            if (part.fuelStatus) {
                totalMass += (part.fuelStatus.liquid_fuel * 0.005) + 
                           (part.fuelStatus.oxidizer * 0.0055);
            }
        });
        return totalMass;
    }

    // 更新控制按钮状态
    updateControlButtons() {
        const launchBtn = document.getElementById('launchBtn');
        const abortBtn = document.getElementById('abortBtn');
        const stageBtn = document.getElementById('stageBtn');

        if (launchBtn) {
            launchBtn.disabled = this.isLaunched || this.countdown >= 0;
            if (this.countdown >= 0) {
                launchBtn.textContent = '倒计时中...';
            } else if (this.isLaunched) {
                launchBtn.textContent = '已发射';
            } else {
                launchBtn.textContent = '点火发射';
            }
        }

        if (stageBtn) {
            stageBtn.disabled = !this.isLaunched;
        }

        if (abortBtn) {
            abortBtn.disabled = !this.isLaunched && this.countdown < 0;
        }
    }

    // 开始发射倒计时
    startCountdown() {
        if (this.countdown >= 0 || this.isLaunched) return;

        this.countdown = 3; // 3秒倒计时
        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');

        if (countdownText) countdownText.textContent = '发射倒计时';
        
        this.updateControlButtons();

        this.countdownTimer = setInterval(() => {
            if (countdownNumber) {
                countdownNumber.textContent = this.countdown;
            }

            if (this.countdown <= 0) {
                this.executeLaunch();
                return;
            }

            this.countdown--;
        }, 1000);
    }

    // 执行发射
    executeLaunch() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        this.countdown = -1;
        this.isLaunched = true;

        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');

        if (countdownText) countdownText.textContent = '发射！';
        if (countdownNumber) countdownNumber.textContent = '🚀';

        // 启动物理模拟
        this.simulation = new LaunchSimulation(this.assembly);
        this.simulation.start();

        this.updateControlButtons();

        setTimeout(() => {
            if (countdownText) countdownText.textContent = '飞行中';
            if (countdownNumber) countdownNumber.textContent = '';
        }, 3000);
    }

    // 中止发射
    abortLaunch() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }

        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        this.countdown = -1;
        this.isLaunched = false;

        const countdownText = document.getElementById('countdownText');
        const countdownNumber = document.getElementById('countdownNumber');

        if (countdownText) countdownText.textContent = '任务中止';
        if (countdownNumber) countdownNumber.textContent = '⚠️';

        this.updateControlButtons();

        setTimeout(() => {
            if (countdownText) countdownText.textContent = '准备发射';
            if (countdownNumber) countdownNumber.textContent = '';
        }, 3000);
    }

    // 显示错误信息
    showError(message) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 2em; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 1.2em; color: #ff6666; margin-bottom: 20px;">${message}</div>
                    <button onclick="goBackToAssembly()" style="
                        padding: 10px 20px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1em;
                    ">返回装配厂</button>
                </div>
            `;
            loadingOverlay.style.display = 'flex';
        }
    }

    // 隐藏加载覆盖层
    hideLoading() {
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }, 1000); // 1秒后隐藏
    }
}

// 全局函数
function goBackToAssembly() {
    window.location.href = 'rocket-builder.html';
}

function startLaunch() {
    if (window.launchPad) {
        window.launchPad.startCountdown();
    }
}

function abortLaunch() {
    if (window.launchPad) {
        window.launchPad.abortLaunch();
    }
}

function activateNextStage() {
    if (window.launchPad && window.launchPad.simulation) {
        const success = window.launchPad.simulation.activateNextStage();
        
        if (!success) {
            if (typeof showNotification === 'function') {
                showNotification('分级失败', '没有更多分级可以激活', 'warning');
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('分级失败', '火箭尚未发射', 'warning');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.launchPad = new LaunchPad();
});

// 导出供其他模块使用
window.LaunchPad = LaunchPad;
