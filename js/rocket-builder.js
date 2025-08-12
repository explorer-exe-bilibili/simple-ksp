// 火箭装配器主类
class RocketBuilder {
    constructor() {
        this.assembly = new RocketAssembly();
        this.selectedPart = null;
        this.draggedPart = null;
        this.canvas = null;
        this.canvasOffset = { x: 0, y: 0 };
        this.canvasZoom = 1.0;
        this.snapToGrid = true;
        this.gridSize = 20;
        this.showAttachmentPoints = false; // 是否显示连接点
        
        this.init();
    }

    // 初始化装配器
    init() {
        this.canvas = document.getElementById('assemblyCanvas');
        if (!this.canvas) {
            console.error('找不到装配画布元素');
            return;
        }

        this.setupCanvas();
        this.setupEventListeners();
        this.setupAttachmentPointsControl();
        this.loadPartsPanel();
        this.updateUI();
    }

    // 设置连接点控制
    setupAttachmentPointsControl() {
        const showAttachmentPointsCheckbox = document.getElementById('showAttachmentPointsCheckbox');
        if (showAttachmentPointsCheckbox) {
            showAttachmentPointsCheckbox.addEventListener('change', (e) => {
                this.showAttachmentPoints = e.target.checked;
                this.toggleAttachmentPointsVisibility();
                if (typeof showNotification === 'function') {
                    showNotification('连接点显示', `连接点显示已${this.showAttachmentPoints ? '开启' : '关闭'}`, 'info');
                }
            });
        }
    }

    // 设置画布
    setupCanvas() {
        // 设置画布大小
        this.canvas.style.width = '800px';
        this.canvas.style.height = '600px';
        
        // 添加网格背景
        this.canvas.innerHTML = `
            <div class="canvas-grid"></div>
            <div class="rocket-assembly" id="rocketAssembly"></div>
        `;
        
        // 初始化画布变换
        this.updateCanvasTransform();
    }

    // 设置事件监听器
    setupEventListeners() {
        // 画布拖拽和缩放
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasZoom(e));
        this.canvas.addEventListener('drop', (e) => this.handleCanvasDrop(e));
        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        
        // 画布平移功能
        this.setupCanvasPanning();
        
        // 部件分类过滤
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterParts(e.target.dataset.category));
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // 右键菜单
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // 加载部件面板
    async loadPartsPanel() {
        const partsList = document.getElementById('partsList');
        if (!partsList) return;

        const allParts = RocketParts.getAllParts();
        partsList.innerHTML = '';

        for (const part of allParts) {
            const partElement = await this.createPartElement(part);
            partsList.appendChild(partElement);
        }
    }

    // 创建部件元素
    async createPartElement(part) {
        const partDiv = document.createElement('div');
        partDiv.className = 'part-item';
        partDiv.dataset.partId = part.id;
        partDiv.draggable = true;

        // 加载SVG
        const svgContent = await RocketParts.loadPartSVG(part);
        
        partDiv.innerHTML = `
            <div class="part-icon">
                ${svgContent}
            </div>
            <div class="part-info">
                <div class="part-name">${part.name}</div>
                <div class="part-stats">
                    质量: ${part.mass}t | 
                    ${part.thrust ? `推力: ${part.thrust}kN` : `载员: ${part.crew_capacity || 0}`}
                </div>
            </div>
        `;

        // 添加拖拽事件
        partDiv.addEventListener('dragstart', (e) => this.handlePartDragStart(e, part));
        partDiv.addEventListener('click', () => this.selectPartType(part));

        return partDiv;
    }

    // 处理部件拖拽开始
    handlePartDragStart(e, part) {
        this.draggedPart = part;
        e.dataTransfer.setData('text/plain', JSON.stringify(part));
        
        // 添加拖拽样式
        e.target.classList.add('dragging');
        setTimeout(() => e.target.classList.remove('dragging'), 100);
    }

    // 处理画布拖放
    handleCanvasDrop(e) {
        e.preventDefault();
        
        if (!this.draggedPart) return;

        // 保存鼠标位置，因为延迟调用时事件对象可能失效
        const canvasRect = this.canvas.getBoundingClientRect();
        const mousePosition = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top
        };

        // 每次放置新部件时都重置视图到默认状态
        if (this.canvasZoom !== 1.0 || this.canvasOffset.x !== 0 || this.canvasOffset.y !== 0) {
            // 先重置视图
            this.resetCanvasView();
            
            // 显示提示信息
            if (typeof showNotification === 'function') {
                const isFirstPart = this.assembly.getPartCount() === 0;
                showNotification('视图重置', 
                    isFirstPart ? '已重置画布缩放以便放置根部件' : '已重置画布缩放以便放置新部件', 'info');
            }
            
            // 等待动画完成后再放置部件
            setTimeout(() => {
                this.placePartAtMousePosition(mousePosition);
            }, 350); // 稍微超过CSS动画时间
        } else {
            // 直接放置部件
            this.placePartAtMousePosition(mousePosition);
        }
    }

    // 在指定位置放置部件的辅助函数
    placePartAtPosition(e) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const mousePosition = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top
        };
        this.placePartAtMousePosition(mousePosition);
    }

    // 在鼠标位置放置部件
    placePartAtMousePosition(mousePosition) {
        if (!this.draggedPart) return;

        let position;
        let autoConnection = null;

        console.log('开始放置部件:', this.draggedPart.name, '鼠标位置:', mousePosition);

        // 如果是第一个部件（根部件），放置在画布中心
        if (this.assembly.getPartCount() === 0) {
            // 画布中心位置 (画布是800x600)
            position = { x: 400, y: 300 };
            
            // 调整到部件的中心点
            const partWidth = this.draggedPart.dimensions.width * 40;
            const partHeight = this.draggedPart.dimensions.height * 40;
            position.x -= partWidth / 2;
            position.y -= partHeight / 2;
            
            // 网格吸附
            if (this.snapToGrid) {
                position.x = Math.round(position.x / this.gridSize) * this.gridSize;
                position.y = Math.round(position.y / this.gridSize) * this.gridSize;
            }

            console.log('根部件放置位置:', position);

            if (typeof showNotification === 'function') {
                showNotification('根部件', '根部件已放置在中心位置，现在可以添加其他部件', 'info');
            }
        } else {
            // 后续部件需要考虑连接点和当前的缩放/平移状态
            // 应用逆变换得到实际坐标
            let x = (mousePosition.x - this.canvasOffset.x) / this.canvasZoom;
            let y = (mousePosition.y - this.canvasOffset.y) / this.canvasZoom;
            
            // 让部件中心对准鼠标位置
            const partWidth = this.draggedPart.dimensions.width * 40;
            const partHeight = this.draggedPart.dimensions.height * 40;
            x -= partWidth / 2;
            y -= partHeight / 2;
            
            // 网格吸附
            position = { x, y };
            if (this.snapToGrid) {
                position.x = Math.round(position.x / this.gridSize) * this.gridSize;
                position.y = Math.round(position.y / this.gridSize) * this.gridSize;
            }

            console.log('计算出的部件位置:', position);
            console.log('当前画布状态 - 缩放:', this.canvasZoom, '偏移:', this.canvasOffset);

            // 尝试自动连接到最近的兼容连接点
            autoConnection = this.attemptAutoConnect(position, this.draggedPart);
            if (autoConnection) {
                // 如果找到了连接点，调整部件位置
                console.log('自动连接成功，调整位置从', position, '到', autoConnection.adjustedPosition);
                position = autoConnection.adjustedPosition;
            } else {
                console.log('未找到自动连接');
            }
        }

        // 添加部件到组装中
        console.log('最终部件位置:', position);
        const assemblyPart = this.assembly.addPart(this.draggedPart, position);
        
        // 如果有自动连接，创建连接记录
        if (autoConnection) {
            const connectionResult = this.assembly.connectParts(
                autoConnection.existingPart.id, 
                autoConnection.existingPoint,
                assemblyPart.id, 
                autoConnection.newPoint
            );
            console.log('创建连接记录结果:', connectionResult);
            console.log('已创建连接记录:', autoConnection.existingPart.data.name, '<->', this.draggedPart.name);
        }
        
        this.addPartToCanvas(assemblyPart);
        this.updateUI();
        this.updateConnectionLines(); // 更新连接线显示
        
        this.draggedPart = null;
    }

    // 尝试自动连接到最近的兼容连接点
    attemptAutoConnect(newPartPosition, newPartData) {
        if (this.assembly.parts.length === 0) return null; // 没有现有部件可连接
        
        const connectionRange = 120; // 连接检测范围（像素）
        let bestConnection = null;
        let minDistance = connectionRange;

        console.log('=== 自动连接检测开始 ===');
        console.log('新部件:', newPartData.name, '位置:', newPartPosition);
        console.log('现有部件数量:', this.assembly.parts.length);
        console.log('连接检测范围:', connectionRange, 'px');

        // 遍历所有已存在的部件
        this.assembly.parts.forEach(existingPart => {
            console.log('\n检查现有部件:', existingPart.data.name, '位置:', existingPart.position);
            
            if (!existingPart.data.attachment_points) {
                console.log('  - 该部件没有连接点');
                return;
            }

            // 计算现有部件的连接点位置
            Object.entries(existingPart.data.attachment_points).forEach(([pointName, pointData]) => {
                // 现有部件的连接点在世界坐标系中的位置
                const existingPartCenterX = existingPart.position.x + (existingPart.data.dimensions.width * 20);
                const existingPartCenterY = existingPart.position.y + (existingPart.data.dimensions.height * 20);
                const existingPointX = existingPartCenterX + (pointData.x * 40);
                const existingPointY = existingPartCenterY + (pointData.y * 40);

                console.log(`  现有连接点 ${pointName}: 中心(${existingPartCenterX}, ${existingPartCenterY}) + 偏移(${pointData.x * 40}, ${pointData.y * 40}) = (${existingPointX}, ${existingPointY})`);

                // 检查新部件的连接点
                if (newPartData.attachment_points) {
                    Object.entries(newPartData.attachment_points).forEach(([newPointName, newPointData]) => {
                        // 计算如果新部件放置在当前位置，其连接点的位置
                        const newPartCenterX = newPartPosition.x + (newPartData.dimensions.width * 20);
                        const newPartCenterY = newPartPosition.y + (newPartData.dimensions.height * 20);
                        const newPointX = newPartCenterX + (newPointData.x * 40);
                        const newPointY = newPartCenterY + (newPointData.y * 40);

                        // 计算连接点之间的距离
                        const distance = Math.sqrt(
                            Math.pow(existingPointX - newPointX, 2) + 
                            Math.pow(existingPointY - newPointY, 2)
                        );

                        console.log(`    新连接点 ${newPointName}: 中心(${newPartCenterX}, ${newPartCenterY}) + 偏移(${newPointData.x * 40}, ${newPointData.y * 40}) = (${newPointX}, ${newPointY})`);
                        console.log(`    距离: ${distance.toFixed(2)}px (阈值: ${minDistance.toFixed(2)}px)`);

                        if (distance < minDistance) {
                            console.log(`    检查连接兼容性: ${pointData.size} vs ${newPointData.size}`);
                            // 检查连接兼容性（简化版：相同尺寸可以连接）
                            if (Math.abs(pointData.size - newPointData.size) < 0.1) {
                                console.log('    ✓ 连接点兼容！');
                                
                                // 计算新部件应该放置的位置，使两个连接点重合
                                const offsetX = existingPointX - newPointX;
                                const offsetY = existingPointY - newPointY;
                                
                                const adjustedPosition = {
                                    x: newPartPosition.x + offsetX,
                                    y: newPartPosition.y + offsetY
                                };

                                console.log(`    调整偏移: (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
                                console.log('    调整后位置:', adjustedPosition);

                                minDistance = distance;
                                bestConnection = {
                                    existingPart: existingPart,
                                    existingPoint: pointName,
                                    newPoint: newPointName,
                                    distance: distance,
                                    adjustedPosition: adjustedPosition
                                };
                            } else {
                                console.log(`    ✗ 连接点尺寸不兼容: ${pointData.size} vs ${newPointData.size}`);
                            }
                        }
                    });
                }
            });
        });

        // 如果找到了好的连接点，显示提示
        if (bestConnection) {
            console.log('\n=== 自动连接成功！===');
            console.log('最佳连接:', bestConnection);
            if (typeof showNotification === 'function') {
                showNotification('自动连接', 
                    `部件已自动连接到 ${bestConnection.existingPart.data.name}`, 'success');
            }
        } else {
            console.log('\n=== 未找到合适的连接点 ===');
        }

        return bestConnection;
    }

    // 添加部件到画布
    addPartToCanvas(assemblyPart) {
        const rocketAssembly = document.getElementById('rocketAssembly');
        if (!rocketAssembly) return;

        const partElement = document.createElement('div');
        partElement.className = 'assembly-part';
        partElement.dataset.partId = assemblyPart.id;
        partElement.style.left = `${assemblyPart.position.x}px`;
        partElement.style.top = `${assemblyPart.position.y}px`;
        partElement.style.position = 'absolute';
        partElement.style.cursor = 'pointer';
        partElement.style.width = `${assemblyPart.data.dimensions.width * 40}px`;
        partElement.style.height = `${assemblyPart.data.dimensions.height * 40}px`;

        // 加载并显示SVG
        RocketParts.loadPartSVG(assemblyPart.data).then(svg => {
            partElement.innerHTML = svg;
            partElement.querySelector('svg').style.width = '100%';
            partElement.querySelector('svg').style.height = '100%';
            
            // 添加连接点显示
            this.addAttachmentPointsToElement(partElement, assemblyPart);
        });

        // 添加右键删除功能
        partElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.removeAssemblyPart(assemblyPart.id);
        });

        // 添加拖拽移动功能
        this.makePartDraggable(partElement, assemblyPart);

        rocketAssembly.appendChild(partElement);
    }

    // 为部件元素添加连接点显示
    addAttachmentPointsToElement(partElement, assemblyPart) {
        if (!assemblyPart.data.attachment_points) return;

        const partWidth = assemblyPart.data.dimensions.width * 40;
        const partHeight = assemblyPart.data.dimensions.height * 40;

        Object.entries(assemblyPart.data.attachment_points).forEach(([pointName, pointData]) => {
            const pointElement = document.createElement('div');
            pointElement.className = 'attachment-point';
            pointElement.dataset.pointName = pointName;
            
            // 计算连接点相对于部件中心的位置
            const pointX = (partWidth / 2) + (pointData.x * 40);
            const pointY = (partHeight / 2) + (pointData.y * 40);
            
            pointElement.style.position = 'absolute';
            pointElement.style.left = `${pointX - 6}px`; // 减去一半的宽度来居中
            pointElement.style.top = `${pointY - 6}px`;
            pointElement.style.width = '12px';
            pointElement.style.height = '12px';
            pointElement.style.borderRadius = '50%';
            pointElement.style.border = '2px solid #00ff00';
            pointElement.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
            pointElement.style.pointerEvents = 'none';
            pointElement.style.zIndex = '1000';
            pointElement.style.opacity = '0.7';
            
            partElement.appendChild(pointElement);
        });
    }

    // 使部件可拖拽移动
    makePartDraggable(partElement, assemblyPart) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        let startPosition = { x: 0, y: 0 };
        let hasMoved = false;

        // 鼠标按下开始拖拽
        const handleMouseDown = (e) => {
            if (e.button !== 0) return; // 只响应左键

            isDragging = true;
            hasMoved = false;
            partElement.classList.add('dragging');
            
            // 计算鼠标相对于画布的位置
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseCanvasX = e.clientX - canvasRect.left;
            const mouseCanvasY = e.clientY - canvasRect.top;
            
            // 计算部件在变换后的实际显示位置
            const partCanvasX = (assemblyPart.position.x * this.canvasZoom) + this.canvasOffset.x;
            const partCanvasY = (assemblyPart.position.y * this.canvasZoom) + this.canvasOffset.y;
            
            dragOffset.x = mouseCanvasX - partCanvasX;
            dragOffset.y = mouseCanvasY - partCanvasY;
            
            startPosition.x = assemblyPart.position.x;
            startPosition.y = assemblyPart.position.y;
            
            e.preventDefault();
            e.stopPropagation();
        };

        // 鼠标移动更新位置
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            hasMoved = true;
            const canvasRect = this.canvas.getBoundingClientRect();
            
            // 计算鼠标相对于画布的位置
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;
            
            // 应用逆变换来计算新位置
            let newX = (mouseX - this.canvasOffset.x - dragOffset.x) / this.canvasZoom;
            let newY = (mouseY - this.canvasOffset.y - dragOffset.y) / this.canvasZoom;

            // 网格吸附
            if (this.snapToGrid) {
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }

            // 更新部件位置
            assemblyPart.position.x = newX;
            assemblyPart.position.y = newY;
            
            partElement.style.left = `${newX}px`;
            partElement.style.top = `${newY}px`;
        };

        // 鼠标释放结束拖拽
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                partElement.classList.remove('dragging');
                
                // 如果没有移动，则视为点击选择
                if (!hasMoved) {
                    this.selectAssemblyPart(assemblyPart);
                } else {
                    // 如果移动了部件，显示详细调试信息并检查连接
                    this.logPartMovementDebugInfo(assemblyPart, startPosition);
                    
                    // 检查是否有连接因距离过远而需要断开
                    const brokenConnections = this.assembly.checkAndBreakInvalidConnections();
                    if (brokenConnections.length > 0 && typeof showNotification === 'function') {
                        showNotification('连接断开', 
                            `${brokenConnections.length}个连接因距离过远而自动断开`, 'warning');
                    }
                    
                    // 尝试在移动后建立新的自动连接
                    const newConnection = this.attemptAutoConnectForMovedPart(assemblyPart);
                    if (newConnection && typeof showNotification === 'function') {
                        showNotification('自动连接', 
                            `部件移动后自动连接到 ${newConnection.targetPart.data.name}`, 'success');
                    }
                    
                    // 更新连接线显示
                    this.updateConnectionLines();
                }
                
                // 更新组装数据
                this.assembly.modified = new Date();
                this.updateUI();
            }
        };

        // 添加事件监听器
        partElement.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    // 选择组装中的部件
    selectAssemblyPart(assemblyPart) {
        // 清除之前的选中状态
        document.querySelectorAll('.assembly-part').forEach(el => {
            el.classList.remove('part-selected');
        });

        // 选中当前部件
        const partElement = document.querySelector(`[data-part-id="${assemblyPart.id}"]`);
        if (partElement) {
            partElement.classList.add('part-selected');
        }

        this.selectedPart = assemblyPart;
        this.updatePartInfo();
    }

    // 移除组装部件
    removeAssemblyPart(partId) {
        this.assembly.removePart(partId);
        
        const partElement = document.querySelector(`[data-part-id="${partId}"]`);
        if (partElement) {
            partElement.remove();
        }

        if (this.selectedPart && this.selectedPart.id === partId) {
            this.selectedPart = null;
        }

        this.updateUI();
        this.updateConnectionLines(); // 更新连接线显示
    }

    // 更新部件信息面板
    updatePartInfo() {
        const infoPanel = document.getElementById('selectedPartInfo');
        if (!infoPanel) return;

        if (!this.selectedPart) {
            infoPanel.innerHTML = '<p class="no-selection">未选中任何部件</p>';
            return;
        }

        const part = this.selectedPart.data;
        let fuelControlsHtml = '';
        
        // 如果是燃料罐，添加燃料控制界面
        if (part.type === 'fuel-tank' && this.selectedPart.fuelStatus) {
            const liquidFuelMax = part.fuel_capacity.liquid_fuel;
            const oxidizerMax = part.fuel_capacity.oxidizer;
            const currentLiquid = this.selectedPart.fuelStatus.liquid_fuel;
            const currentOxidizer = this.selectedPart.fuelStatus.oxidizer;
            
            fuelControlsHtml = `
                <div class="fuel-controls">
                    <h5>燃料控制</h5>
                    <div class="fuel-type">
                        <label>液体燃料: ${currentLiquid.toFixed(1)} / ${liquidFuelMax} 单位</label>
                        <input type="range" 
                               id="liquidFuelSlider" 
                               min="0" 
                               max="${liquidFuelMax}" 
                               step="0.1"
                               value="${currentLiquid}"
                               oninput="rocketBuilder.updateFuelAmount('liquid_fuel', this.value)">
                        <div class="fuel-percentage">${((currentLiquid / liquidFuelMax) * 100).toFixed(1)}%</div>
                    </div>
                    <div class="fuel-type">
                        <label>氧化剂: ${currentOxidizer.toFixed(1)} / ${oxidizerMax} 单位</label>
                        <input type="range" 
                               id="oxidizerSlider" 
                               min="0" 
                               max="${oxidizerMax}" 
                               step="0.1"
                               value="${currentOxidizer}"
                               oninput="rocketBuilder.updateFuelAmount('oxidizer', this.value)">
                        <div class="fuel-percentage">${((currentOxidizer / oxidizerMax) * 100).toFixed(1)}%</div>
                    </div>
                    <div class="fuel-quick-actions">
                        <button onclick="rocketBuilder.setFuelLevel(1.0)" class="fuel-action-btn">满载</button>
                        <button onclick="rocketBuilder.setFuelLevel(0.5)" class="fuel-action-btn">半载</button>
                        <button onclick="rocketBuilder.setFuelLevel(0.0)" class="fuel-action-btn">空载</button>
                    </div>
                </div>
            `;
        }
        
        infoPanel.innerHTML = `
            <div class="selected-part-details">
                <h4>${part.name}</h4>
                <p class="part-description">${part.description}</p>
                <div class="part-properties">
                    <div class="property-item">
                        <label>质量:</label>
                        <span>${this.getPartCurrentMass().toFixed(2)} t</span>
                    </div>
                    <div class="property-item">
                        <label>成本:</label>
                        <span>${part.cost} √</span>
                    </div>
                    ${part.thrust ? `
                        <div class="property-item">
                            <label>推力:</label>
                            <span>${part.thrust} kN</span>
                        </div>
                        <div class="property-item">
                            <label>比冲 (真空):</label>
                            <span>${part.isp_vacuum} s</span>
                        </div>
                    ` : ''}
                    ${part.crew_capacity ? `
                        <div class="property-item">
                            <label>载员容量:</label>
                            <span>${part.crew_capacity} 人</span>
                        </div>
                    ` : ''}
                    <div class="property-item">
                        <label>尺寸:</label>
                        <span>${part.dimensions.width}m × ${part.dimensions.height}m</span>
                    </div>
                </div>
                ${fuelControlsHtml}
                <button class="remove-part-btn" onclick="rocketBuilder.removeAssemblyPart('${this.selectedPart.id}')">
                    移除此部件
                </button>
            </div>
        `;
    }

    // 更新UI统计信息
    updateUI() {
        // 更新载具统计
        document.getElementById('totalMass').textContent = `${this.assembly.getTotalMass().toFixed(2)} t`;
        document.getElementById('partCount').textContent = this.assembly.getPartCount();
        document.getElementById('totalThrust').textContent = `${this.assembly.getTotalThrust().toFixed(1)} kN`;
        document.getElementById('deltaV').textContent = `${this.assembly.estimateDeltaV().toFixed(0)} m/s`;

        // 更新部件信息
        this.updatePartInfo();
    }

    // 获取当前选中部件的实际质量（包含燃料）
    getPartCurrentMass() {
        if (!this.selectedPart) return 0;
        
        let mass = this.selectedPart.data.mass; // 干重
        
        // 如果是燃料罐，加上燃料质量
        if (this.selectedPart.fuelStatus) {
            // 假设燃料密度：液体燃料 0.005 t/单位，氧化剂 0.0055 t/单位
            const fuelMass = (this.selectedPart.fuelStatus.liquid_fuel * 0.005) + 
                           (this.selectedPart.fuelStatus.oxidizer * 0.0055);
            mass += fuelMass;
        }
        
        return mass;
    }

    // 更新燃料量
    updateFuelAmount(fuelType, amount) {
        if (!this.selectedPart || !this.selectedPart.fuelStatus) return;
        
        this.selectedPart.fuelStatus[fuelType] = parseFloat(amount);
        this.assembly.modified = new Date();
        
        // 更新显示
        this.updatePartInfo();
        this.updateUI();
    }

    // 设置燃料级别（0.0 - 1.0）
    setFuelLevel(ratio) {
        if (!this.selectedPart || !this.selectedPart.fuelStatus) return;
        
        const part = this.selectedPart.data;
        if (part.fuel_capacity) {
            this.selectedPart.fuelStatus.liquid_fuel = part.fuel_capacity.liquid_fuel * ratio;
            this.selectedPart.fuelStatus.oxidizer = part.fuel_capacity.oxidizer * ratio;
            
            this.assembly.modified = new Date();
            
            // 更新滑块和显示
            const liquidSlider = document.getElementById('liquidFuelSlider');
            const oxidizerSlider = document.getElementById('oxidizerSlider');
            if (liquidSlider) liquidSlider.value = this.selectedPart.fuelStatus.liquid_fuel;
            if (oxidizerSlider) oxidizerSlider.value = this.selectedPart.fuelStatus.oxidizer;
            
            this.updatePartInfo();
            this.updateUI();
        }
    }

    // 处理画布缩放
    handleCanvasZoom(e) {
        if (!e.ctrlKey) return;
        
        e.preventDefault();
        
        // 获取鼠标相对于画布的位置（与拖拽处理使用相同的坐标系）
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
        // 计算缩放前鼠标在内容坐标系中的位置
        const beforeZoomX = (mouseX - this.canvasOffset.x) / this.canvasZoom;
        const beforeZoomY = (mouseY - this.canvasOffset.y) / this.canvasZoom;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.3, Math.min(3.0, this.canvasZoom * zoomFactor));
        
        // 计算新的偏移量，使鼠标位置保持不变
        this.canvasOffset.x = mouseX - beforeZoomX * newZoom;
        this.canvasOffset.y = mouseY - beforeZoomY * newZoom;
        this.canvasZoom = newZoom;
        
        this.updateCanvasTransform();
    }

    // 设置画布平移功能
    setupCanvasPanning() {
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        let panOffset = { x: 0, y: 0 };

        // 鼠标按下开始平移
        this.canvas.addEventListener('mousedown', (e) => {
            // 只在空白区域（非部件）响应，且只响应左键或中键
            if (e.target === this.canvas || e.target.classList.contains('canvas-grid') || 
                e.target.classList.contains('rocket-assembly')) {
                
                if (e.button === 0 || e.button === 1) { // 左键或中键
                    isPanning = true;
                    panStart.x = e.clientX;
                    panStart.y = e.clientY;
                    panOffset.x = this.canvasOffset.x;
                    panOffset.y = this.canvasOffset.y;
                    
                    this.canvas.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            }
        });

        // 鼠标移动更新平移
        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;

            const deltaX = e.clientX - panStart.x;
            const deltaY = e.clientY - panStart.y;
            
            this.canvasOffset.x = panOffset.x + deltaX;
            this.canvasOffset.y = panOffset.y + deltaY;
            
            this.updateCanvasTransform();
        });

        // 鼠标释放结束平移
        document.addEventListener('mouseup', (e) => {
            if (isPanning) {
                isPanning = false;
                this.canvas.style.cursor = '';
            }
        });

        // 双击重置视图
        this.canvas.addEventListener('dblclick', (e) => {
            if (e.target === this.canvas || e.target.classList.contains('canvas-grid') || 
                e.target.classList.contains('rocket-assembly')) {
                this.resetCanvasView();
            }
        });

        // 中键点击重置视图
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // 中键
                e.preventDefault();
            }
        });
    }

    // 更新画布变换
    updateCanvasTransform() {
        // 限制平移范围，防止画布完全移出视图
        this.constrainCanvasOffset();
        
        const rocketAssembly = document.getElementById('rocketAssembly');
        if (rocketAssembly) {
            rocketAssembly.style.transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px) scale(${this.canvasZoom})`;
        }
        
        // 更新网格位置
        const canvasGrid = this.canvas.querySelector('.canvas-grid');
        if (canvasGrid) {
            canvasGrid.style.transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px) scale(${this.canvasZoom})`;
        }
    }

    // 限制画布偏移范围
    constrainCanvasOffset() {
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const canvasWidth = 800 * this.canvasZoom;  // 画布实际宽度 * 缩放比例
        const canvasHeight = 600 * this.canvasZoom; // 画布实际高度 * 缩放比例
        
        // 计算最大允许的偏移量（保证至少有1/4的画布可见）
        const minVisibleSize = 200; // 最小可见区域
        const maxOffsetX = containerWidth - minVisibleSize;
        const minOffsetX = -(canvasWidth - minVisibleSize);
        const maxOffsetY = containerHeight - minVisibleSize;
        const minOffsetY = -(canvasHeight - minVisibleSize);
        
        // 限制偏移范围
        this.canvasOffset.x = Math.max(minOffsetX, Math.min(maxOffsetX, this.canvasOffset.x));
        this.canvasOffset.y = Math.max(minOffsetY, Math.min(maxOffsetY, this.canvasOffset.y));
    }

    // 重置画布视图
    resetCanvasView() {
        this.canvasOffset = { x: 0, y: 0 };
        this.canvasZoom = 1.0;
        this.updateCanvasTransform();
        
        // 显示提示
        if (typeof showNotification === 'function') {
            showNotification('视图重置', '画布视图已重置到默认位置', 'info');
        }
    }

    // 处理键盘快捷键
    handleKeyboard(e) {
        switch(e.key) {
            case 'Delete':
                if (this.selectedPart) {
                    this.removeAssemblyPart(this.selectedPart.id);
                }
                break;
            case 'Escape':
                this.selectedPart = null;
                document.querySelectorAll('.assembly-part').forEach(el => {
                    el.classList.remove('part-selected');
                });
                this.updateUI();
                break;
            case 'g':
                this.snapToGrid = !this.snapToGrid;
                console.log(`网格吸附: ${this.snapToGrid ? '开启' : '关闭'}`);
                if (typeof showNotification === 'function') {
                    showNotification('网格吸附', `网格吸附已${this.snapToGrid ? '开启' : '关闭'}`, 'info');
                }
                break;
            case 'r':
                this.resetCanvasView();
                break;
            case 'a':
                // 切换连接点显示
                this.showAttachmentPoints = !this.showAttachmentPoints;
                const checkbox = document.getElementById('showAttachmentPointsCheckbox');
                if (checkbox) {
                    checkbox.checked = this.showAttachmentPoints;
                }
                this.toggleAttachmentPointsVisibility();
                if (typeof showNotification === 'function') {
                    showNotification('连接点显示', `连接点显示已${this.showAttachmentPoints ? '开启' : '关闭'}`, 'info');
                }
                break;
        }
    }

    // 切换连接点可见性
    toggleAttachmentPointsVisibility() {
        const rocketAssembly = document.getElementById('rocketAssembly');
        if (!rocketAssembly) return;

        if (this.showAttachmentPoints) {
            rocketAssembly.classList.add('show-attachment-points');
        } else {
            rocketAssembly.classList.remove('show-attachment-points');
        }
    }

    // 显示连接线
    updateConnectionLines() {
        const rocketAssembly = document.getElementById('rocketAssembly');
        if (!rocketAssembly) return;

        // 移除现有的连接线
        rocketAssembly.querySelectorAll('.connection-line').forEach(line => line.remove());

        // 为每个连接创建连接线
        this.assembly.connections.forEach(connection => {
            const partA = this.assembly.parts.find(p => p.id === connection.partA);
            const partB = this.assembly.parts.find(p => p.id === connection.partB);
            
            if (!partA || !partB) return;

            // 计算连接点位置
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

            // 创建连接线元素
            const line = document.createElement('div');
            line.className = 'connection-line';
            line.dataset.connectionId = connection.id;
            
            // 计算线的长度和角度
            const deltaX = pointBX - pointAX;
            const deltaY = pointBY - pointAY;
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            // 设置线的位置和样式
            line.style.left = `${pointAX}px`;
            line.style.top = `${pointAY}px`;
            line.style.width = `${length}px`;
            line.style.transform = `rotate(${angle}deg)`;
            
            rocketAssembly.appendChild(line);
        });
    }

    // 记录部件移动的调试信息
    logPartMovementDebugInfo(assemblyPart, startPosition) {
        console.log('\n=== 部件移动调试信息 ===');
        console.log(`部件: ${assemblyPart.data.name} (ID: ${assemblyPart.id})`);
        console.log(`起始位置: (${startPosition.x.toFixed(2)}, ${startPosition.y.toFixed(2)})`);
        console.log(`结束位置: (${assemblyPart.position.x.toFixed(2)}, ${assemblyPart.position.y.toFixed(2)})`);
        
        const deltaX = assemblyPart.position.x - startPosition.x;
        const deltaY = assemblyPart.position.y - startPosition.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        console.log(`移动距离: (${deltaX.toFixed(2)}, ${deltaY.toFixed(2)}) = ${distance.toFixed(2)}px`);
        
        // 显示画布状态
        console.log(`画布缩放: ${this.canvasZoom.toFixed(2)}`);
        console.log(`画布偏移: (${this.canvasOffset.x.toFixed(2)}, ${this.canvasOffset.y.toFixed(2)})`);
        console.log(`网格吸附: ${this.snapToGrid ? '开启' : '关闭'}`);
        
        // 显示部件的连接点信息
        if (assemblyPart.data.attachment_points) {
            console.log('\n连接点信息:');
            const partCenterX = assemblyPart.position.x + (assemblyPart.data.dimensions.width * 20);
            const partCenterY = assemblyPart.position.y + (assemblyPart.data.dimensions.height * 20);
            
            Object.entries(assemblyPart.data.attachment_points).forEach(([pointName, pointData]) => {
                const pointX = partCenterX + (pointData.x * 40);
                const pointY = partCenterY + (pointData.y * 40);
                console.log(`  ${pointName}: (${pointX.toFixed(2)}, ${pointY.toFixed(2)}) [尺寸: ${pointData.size}]`);
            });
        } else {
            console.log('该部件没有连接点');
        }
        
        // 显示与该部件相关的现有连接
        const relatedConnections = this.assembly.connections.filter(conn => 
            conn.partA === assemblyPart.id || conn.partB === assemblyPart.id
        );
        
        if (relatedConnections.length > 0) {
            console.log('\n相关连接:');
            relatedConnections.forEach(connection => {
                const otherPartId = connection.partA === assemblyPart.id ? connection.partB : connection.partA;
                const otherPart = this.assembly.parts.find(p => p.id === otherPartId);
                const thisPoint = connection.partA === assemblyPart.id ? connection.attachPointA : connection.attachPointB;
                const otherPoint = connection.partA === assemblyPart.id ? connection.attachPointB : connection.attachPointA;
                
                console.log(`  连接到 ${otherPart?.data.name || '未知部件'}`);
                console.log(`    本部件连接点: ${thisPoint}`);
                console.log(`    对方连接点: ${otherPoint}`);
                console.log(`    连接ID: ${connection.id}`);
                
                // 计算连接点间的当前距离
                if (otherPart && assemblyPart.data.attachment_points && otherPart.data.attachment_points) {
                    const thisAttach = assemblyPart.data.attachment_points[thisPoint];
                    const otherAttach = otherPart.data.attachment_points[otherPoint];
                    
                    if (thisAttach && otherAttach) {
                        const thisCenterX = assemblyPart.position.x + (assemblyPart.data.dimensions.width * 20);
                        const thisCenterY = assemblyPart.position.y + (assemblyPart.data.dimensions.height * 20);
                        const thisPointX = thisCenterX + (thisAttach.x * 40);
                        const thisPointY = thisCenterY + (thisAttach.y * 40);
                        
                        const otherCenterX = otherPart.position.x + (otherPart.data.dimensions.width * 20);
                        const otherCenterY = otherPart.position.y + (otherPart.data.dimensions.height * 20);
                        const otherPointX = otherCenterX + (otherAttach.x * 40);
                        const otherPointY = otherCenterY + (otherAttach.y * 40);
                        
                        const connDistance = Math.sqrt(
                            Math.pow(thisPointX - otherPointX, 2) + 
                            Math.pow(thisPointY - otherPointY, 2)
                        );
                        
                        console.log(`    当前连接点距离: ${connDistance.toFixed(2)}px (阈值: 50px)`);
                        console.log(`    连接状态: ${connDistance <= 50 ? '✓ 有效' : '✗ 将断开'}`);
                    }
                }
            });
        } else {
            console.log('该部件没有相关连接');
        }
        
        // 显示附近的其他部件
        console.log('\n附近部件检测:');
        const nearbyParts = this.assembly.parts.filter(part => {
            if (part.id === assemblyPart.id) return false; // 排除自身
            
            const distance = Math.sqrt(
                Math.pow(part.position.x - assemblyPart.position.x, 2) + 
                Math.pow(part.position.y - assemblyPart.position.y, 2)
            );
            return distance <= 200; // 200像素范围内
        });
        
        if (nearbyParts.length > 0) {
            nearbyParts.forEach(nearbyPart => {
                const distance = Math.sqrt(
                    Math.pow(nearbyPart.position.x - assemblyPart.position.x, 2) + 
                    Math.pow(nearbyPart.position.y - assemblyPart.position.y, 2)
                );
                console.log(`  ${nearbyPart.data.name}: ${distance.toFixed(2)}px`);
                
                // 检查是否有潜在的连接机会
                if (assemblyPart.data.attachment_points && nearbyPart.data.attachment_points) {
                    let minConnectionDistance = Infinity;
                    let potentialConnection = null;
                    
                    Object.entries(assemblyPart.data.attachment_points).forEach(([thisPointName, thisPointData]) => {
                        Object.entries(nearbyPart.data.attachment_points).forEach(([otherPointName, otherPointData]) => {
                            if (Math.abs(thisPointData.size - otherPointData.size) < 0.1) {
                                const thisCenterX = assemblyPart.position.x + (assemblyPart.data.dimensions.width * 20);
                                const thisCenterY = assemblyPart.position.y + (assemblyPart.data.dimensions.height * 20);
                                const thisPointX = thisCenterX + (thisPointData.x * 40);
                                const thisPointY = thisCenterY + (thisPointData.y * 40);
                                
                                const otherCenterX = nearbyPart.position.x + (nearbyPart.data.dimensions.width * 20);
                                const otherCenterY = nearbyPart.position.y + (nearbyPart.data.dimensions.height * 20);
                                const otherPointX = otherCenterX + (otherPointData.x * 40);
                                const otherPointY = otherCenterY + (otherPointData.y * 40);
                                
                                const connDistance = Math.sqrt(
                                    Math.pow(thisPointX - otherPointX, 2) + 
                                    Math.pow(thisPointY - otherPointY, 2)
                                );
                                
                                if (connDistance < minConnectionDistance) {
                                    minConnectionDistance = connDistance;
                                    potentialConnection = {
                                        thisPoint: thisPointName,
                                        otherPoint: otherPointName,
                                        distance: connDistance
                                    };
                                }
                            }
                        });
                    });
                    
                    if (potentialConnection && minConnectionDistance <= 120) {
                        console.log(`    潜在连接: ${potentialConnection.thisPoint} <-> ${potentialConnection.otherPoint} (${minConnectionDistance.toFixed(2)}px)`);
                    }
                }
            });
        } else {
            console.log('  附近200px范围内没有其他部件');
        }
        
        console.log('=== 部件移动调试信息结束 ===\n');
    }

    // 为移动后的部件尝试自动连接
    attemptAutoConnectForMovedPart(movedPart) {
        console.log('\n=== 移动后自动连接检测 ===');
        console.log(`检测部件: ${movedPart.data.name} (ID: ${movedPart.id})`);
        
        if (!movedPart.data.attachment_points) {
            console.log('该部件没有连接点，无法连接');
            return null;
        }
        
        const connectionRange = 25; // 移动后的连接检测范围更小，要求更精确
        let bestConnection = null;
        let minDistance = connectionRange;
        
        // 计算移动部件的连接点位置
        const movedPartCenterX = movedPart.position.x + (movedPart.data.dimensions.width * 20);
        const movedPartCenterY = movedPart.position.y + (movedPart.data.dimensions.height * 20);
        
        // 遍历移动部件的每个连接点
        Object.entries(movedPart.data.attachment_points).forEach(([movedPointName, movedPointData]) => {
            const movedPointX = movedPartCenterX + (movedPointData.x * 40);
            const movedPointY = movedPartCenterY + (movedPointData.y * 40);
            
            console.log(`检查移动部件连接点 ${movedPointName}: (${movedPointX.toFixed(2)}, ${movedPointY.toFixed(2)})`);
            
            // 检查该连接点是否已经有连接
            const existingConnection = this.assembly.connections.find(conn => 
                (conn.partA === movedPart.id && conn.attachPointA === movedPointName) ||
                (conn.partB === movedPart.id && conn.attachPointB === movedPointName)
            );
            
            if (existingConnection) {
                console.log(`  连接点 ${movedPointName} 已有连接，跳过`);
                return;
            }
            
            // 检查其他部件的连接点
            this.assembly.parts.forEach(targetPart => {
                if (targetPart.id === movedPart.id || !targetPart.data.attachment_points) return;
                
                const targetPartCenterX = targetPart.position.x + (targetPart.data.dimensions.width * 20);
                const targetPartCenterY = targetPart.position.y + (targetPart.data.dimensions.height * 20);
                
                Object.entries(targetPart.data.attachment_points).forEach(([targetPointName, targetPointData]) => {
                    // 检查目标连接点是否已有连接
                    const targetExistingConnection = this.assembly.connections.find(conn => 
                        (conn.partA === targetPart.id && conn.attachPointA === targetPointName) ||
                        (conn.partB === targetPart.id && conn.attachPointB === targetPointName)
                    );
                    
                    if (targetExistingConnection) {
                        return; // 目标连接点已占用
                    }
                    
                    const targetPointX = targetPartCenterX + (targetPointData.x * 40);
                    const targetPointY = targetPartCenterY + (targetPointData.y * 40);
                    
                    // 计算连接点之间的距离
                    const distance = Math.sqrt(
                        Math.pow(movedPointX - targetPointX, 2) + 
                        Math.pow(movedPointY - targetPointY, 2)
                    );
                    
                    console.log(`    与 ${targetPart.data.name} 的 ${targetPointName} 距离: ${distance.toFixed(2)}px`);
                    
                    if (distance < minDistance) {
                        // 检查连接兼容性
                        if (Math.abs(movedPointData.size - targetPointData.size) < 0.1) {
                            console.log(`    ✓ 找到兼容连接点！距离: ${distance.toFixed(2)}px`);
                            
                            minDistance = distance;
                            bestConnection = {
                                movedPart: movedPart,
                                movedPoint: movedPointName,
                                targetPart: targetPart,
                                targetPoint: targetPointName,
                                distance: distance
                            };
                        } else {
                            console.log(`    ✗ 连接点尺寸不兼容: ${movedPointData.size} vs ${targetPointData.size}`);
                        }
                    }
                });
            });
        });
        
        if (bestConnection) {
            console.log('\n✓ 建立移动后自动连接:');
            console.log(`  ${bestConnection.movedPart.data.name}.${bestConnection.movedPoint} <-> ${bestConnection.targetPart.data.name}.${bestConnection.targetPoint}`);
            console.log(`  连接距离: ${bestConnection.distance.toFixed(2)}px`);
            
            // 创建连接记录
            const connectionResult = this.assembly.connectParts(
                bestConnection.movedPart.id,
                bestConnection.movedPoint,
                bestConnection.targetPart.id,
                bestConnection.targetPoint
            );
            
            console.log('连接创建结果:', connectionResult ? '成功' : '失败');
            console.log('=== 移动后自动连接检测结束 ===\n');
            
            return bestConnection;
        } else {
            console.log('\n✗ 未找到合适的连接点');
            console.log('=== 移动后自动连接检测结束 ===\n');
            return null;
        }
    }

    // 过滤部件
    filterParts(category) {
        // 更新按钮状态
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');

        // 过滤部件列表
        const parts = RocketParts.getPartsByCategory(category);
        this.displayParts(parts);
    }

    // 显示部件列表
    async displayParts(parts) {
        const partsList = document.getElementById('partsList');
        if (!partsList) return;

        partsList.innerHTML = '';
        
        for (const part of parts) {
            const partElement = await this.createPartElement(part);
            partsList.appendChild(partElement);
        }
    }

    // 选择部件类型（用于显示信息）
    selectPartType(part) {
        console.log('选中部件类型:', part.name);
        // 可以在这里显示部件详情
    }

    // 清空组装
    clearAssembly() {
        if (confirm('确定要清空当前载具设计吗？')) {
            this.assembly.clear();
            document.getElementById('rocketAssembly').innerHTML = '';
            this.selectedPart = null;
            this.updateUI();
        }
    }

    // 保存设计
    saveRocket() {
        const designData = this.assembly.toJSON();
        const dataStr = JSON.stringify(designData, null, 2);
        
        // 创建下载链接
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${designData.name || '未命名载具'}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert('设计已保存到下载文件夹');
    }

    // 发射火箭
    launchRocket() {
        if (this.assembly.getPartCount() === 0) {
            alert('请先设计一个载具！');
            return;
        }

        if (this.assembly.getTotalThrust() === 0) {
            alert('载具需要至少一个引擎才能发射！');
            return;
        }

        alert(`准备发射 "${this.assembly.name}"！\n\n` +
              `总质量: ${this.assembly.getTotalMass().toFixed(2)} t\n` +
              `推力: ${this.assembly.getTotalThrust().toFixed(1)} kN\n` +
              `预估 Delta-V: ${this.assembly.estimateDeltaV().toFixed(0)} m/s\n\n` +
              `发射功能开发中...`);
    }
}

// 装配大楼相关的全局函数
function goBack() {
    if (confirm('确定要返回主页吗？未保存的设计将丢失。')) {
        window.location.href = 'index.html';
    }
}

function clearAssembly() {
    if (window.rocketBuilder) {
        window.rocketBuilder.clearAssembly();
    }
}

function saveRocket() {
    if (window.rocketBuilder) {
        window.rocketBuilder.saveRocket();
    }
}

function launchRocket() {
    if (window.rocketBuilder) {
        window.rocketBuilder.launchRocket();
    }
}

// 页面加载完成后初始化装配器
document.addEventListener('DOMContentLoaded', () => {
    console.log('载具装配大楼已加载');
    window.rocketBuilder = new RocketBuilder();
    
    // 添加欢迎提示
    setTimeout(() => {
        if (typeof showNotification === 'function') {
            showNotification('装配大楼', '欢迎来到载具装配大楼！先选择一个根部件，然后逐步构建载具。', 'welcome');
        }
    }, 500);
});
