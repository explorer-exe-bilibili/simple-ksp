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
        
        this.init();
    }

    // 初始化装配器
    async init() {
        this.canvas = document.getElementById('assemblyCanvas');
        if (!this.canvas) {
            console.error('找不到装配画布元素');
            return;
        }

        this.setupCanvas();
        this.setupEventListeners();
        this.setupUIControls();
        
        // 等待翻译系统就绪后加载部件面板
        await this.loadPartsPanel();
        
        this.updateUI();
    }

    // 获取统一的事件坐标（支持鼠标和触屏）
    getEventCoordinates(e) {
        if (e.touches && e.touches.length > 0) {
            return {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY
            };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return {
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY
            };
        } else {
            return {
                clientX: e.clientX,
                clientY: e.clientY
            };
        }
    }

    // 添加鼠标和触屏事件监听器
    addPointerEventListeners(element, onStart, onMove, onEnd) {
        // 鼠标事件
        element.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        
        // 触屏事件
        element.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 防止页面滚动
            onStart(e);
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            e.preventDefault(); // 防止页面滚动
            onMove(e);
        }, { passive: false });
        
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
    }

    // 设置UI控制
    setupUIControls() {
        // 网格吸附控制
        const snapToGridCheckbox = document.getElementById('snapToGridCheckbox');
        if (snapToGridCheckbox) {
            // 设置初始状态
            snapToGridCheckbox.checked = this.snapToGrid;
            
            snapToGridCheckbox.addEventListener('change', (e) => {
                this.snapToGrid = e.target.checked;
                if (typeof showNotification === 'function') {
                    const titleKey = 'notifications.gridSnap.title';
                    const messageKey = this.snapToGrid ? 
                        'notifications.gridSnap.enabled' : 
                        'notifications.gridSnap.disabled';
                    showNotification(titleKey, messageKey, 'info');
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
        
        // 语言切换事件
        document.addEventListener('languageChanged', () => {
            // 重新加载部件面板以更新翻译
            this.loadPartsPanel();
            // 更新UI中的其他文本
            this.updateUI();
        });
        
        // 移动端面板切换
        this.setupMobilePanelToggle();
    }

    // 设置移动端面板切换
    setupMobilePanelToggle() {
        const toggleButtons = document.querySelectorAll('.panel-toggle-btn');
        const partsPanel = document.getElementById('partsPanel');
        const infoPanel = document.getElementById('infoPanel');
        const assemblyArea = document.querySelector('.assembly-area');

        toggleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetPanel = e.target.dataset.panel;
                
                // 更新按钮状态
                toggleButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // 隐藏所有面板
                partsPanel.classList.remove('active');
                infoPanel.classList.remove('active');
                assemblyArea.classList.remove('mobile-hidden');
                
                // 显示选中的面板
                switch(targetPanel) {
                    case 'parts':
                        partsPanel.classList.add('active');
                        assemblyArea.classList.add('mobile-hidden');
                        break;
                    case 'info':
                        infoPanel.classList.add('active');
                        assemblyArea.classList.add('mobile-hidden');
                        break;
                    case 'assembly':
                    default:
                        // 装配区默认显示，不需要额外操作
                        break;
                }
                
                // 显示通知
                if (typeof showNotification === 'function') {
                    const panelNameKeys = {
                        'assembly': 'notifications.panelSwitch.assembly',
                        'parts': 'notifications.panelSwitch.parts',
                        'info': 'notifications.panelSwitch.info'
                    };
                    showNotification('notifications.panelSwitch.title', panelNameKeys[targetPanel], 'info');
                }
            });
        });
    }

    // 加载部件面板
    async loadPartsPanel() {
        const partsList = document.getElementById('partsList');
        if (!partsList) return;

        // 确保翻译系统已初始化
        if (!window.i18n.isInitialized()) {
            await new Promise(resolve => {
                document.addEventListener('i18nReady', resolve, { once: true });
            });
        }

        const allParts = RocketParts.getAllParts();
        
        // 更新所有部件的翻译
        allParts.forEach(part => {
            if (part.nameKey && window.i18n) {
                const translatedName = window.i18n.t(part.nameKey);
                if (translatedName !== part.nameKey) {
                    part.name = translatedName;
                }
            }
            if (part.descriptionKey && window.i18n) {
                const translatedDesc = window.i18n.t(part.descriptionKey);
                if (translatedDesc !== part.descriptionKey) {
                    part.description = translatedDesc;
                }
            }
        });
        
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
        
        // 确保部件名称和描述是最新的翻译
        let displayName = part.name;
        if (part.nameKey && window.i18n) {
            const translatedName = window.i18n.t(part.nameKey);
            if (translatedName !== part.nameKey) {
                displayName = translatedName;
            }
        }
        
        // 获取国际化文本
        const massLabel = window.i18n ? window.i18n.t('rocketBuilder.partsPanel.mass') : 'Mass';
        const thrustLabel = window.i18n ? window.i18n.t('rocketBuilder.partsPanel.thrust') : 'Thrust';
        const crewLabel = window.i18n ? window.i18n.t('rocketBuilder.partsPanel.crew') : 'Crew';
        
        partDiv.innerHTML = `
            <div class="part-icon">
                ${svgContent}
            </div>
            <div class="part-info">
                <div class="part-name">${displayName}</div>
                <div class="part-stats">
                    ${massLabel}: ${part.mass}t | 
                    ${part.thrust ? `${thrustLabel}: ${part.thrust}kN` : `${crewLabel}: ${part.crew_capacity || 0}`}
                </div>
            </div>
        `;

        // 添加拖拽事件（桌面端）
        partDiv.addEventListener('dragstart', (e) => this.handlePartDragStart(e, part));
        partDiv.addEventListener('click', () => this.selectPartType(part));

        // 添加移动端触屏拖拽支持
        this.setupPartTouchDrag(partDiv, part);

        return partDiv;
    }

    // 设置部件的触屏拖拽
    setupPartTouchDrag(partElement, part) {
        let isDragging = false;
        let dragClone = null;
        let startPos = { x: 0, y: 0 };

        const handleTouchStart = (e) => {
            if (e.touches.length !== 1) return;
            
            isDragging = true;
            const coords = this.getEventCoordinates(e);
            startPos = { x: coords.clientX, y: coords.clientY };
            
            // 设置当前拖拽的部件
            this.draggedPart = part;
            
            // 创建拖拽预览
            dragClone = partElement.cloneNode(true);
            dragClone.style.position = 'fixed';
            dragClone.style.zIndex = '10000';
            dragClone.style.pointerEvents = 'none';
            dragClone.style.opacity = '0.8';
            dragClone.style.transform = 'scale(0.8)';
            dragClone.style.left = (coords.clientX - 40) + 'px';
            dragClone.style.top = (coords.clientY - 40) + 'px';
            document.body.appendChild(dragClone);
            
            partElement.classList.add('dragging');
        };

        const handleTouchMove = (e) => {
            if (!isDragging || !dragClone) return;
            
            const coords = this.getEventCoordinates(e);
            dragClone.style.left = (coords.clientX - 40) + 'px';
            dragClone.style.top = (coords.clientY - 40) + 'px';
        };

        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            partElement.classList.remove('dragging');
            
            if (dragClone) {
                dragClone.remove();
                dragClone = null;
            }
            
            // 检查是否拖拽到了装配区
            const coords = this.getEventCoordinates(e);
            const elementAtPoint = document.elementFromPoint(coords.clientX, coords.clientY);
            
            if (elementAtPoint && (elementAtPoint.closest('.assembly-canvas') || elementAtPoint.closest('.rocket-assembly'))) {
                // 模拟拖放到装配区
                const canvasRect = this.canvas.getBoundingClientRect();
                const fakeEvent = {
                    preventDefault: () => {},
                    clientX: coords.clientX,
                    clientY: coords.clientY
                };
                this.handleCanvasDrop(fakeEvent);
            }
            
            this.draggedPart = null;
        };

        // 只在移动端添加触屏事件
        if ('ontouchstart' in window) {
            partElement.addEventListener('touchstart', handleTouchStart, { passive: false });
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
            document.addEventListener('touchcancel', handleTouchEnd);
        }
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

        // 每次放置新部件时只重置缩放（保持画布位置）
        if (this.canvasZoom !== 1.0) {
            // 只重置缩放
            this.resetCanvasZoom();
            
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
                showNotification('notifications.rootPart.title', 'notifications.rootPart.message', 'info');
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
                const title = window.i18n ? window.i18n.t('notifications.autoConnect.title') : '自动连接';
                const message = window.i18n ? 
                    window.i18n.t('notifications.autoConnect.message', { partName: bestConnection.existingPart.data.name }) :
                    `部件已自动连接到 ${bestConnection.existingPart.data.name}`;
                showNotification(title, message, 'success');
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

    // 使部件可拖拽移动
    makePartDraggable(partElement, assemblyPart) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        let startPosition = { x: 0, y: 0 };
        let hasMoved = false;
        let initialPointerPosition = { x: 0, y: 0 };
        const MOVE_THRESHOLD = 5; // 像素，超过这个距离才认为是拖拽

        // 统一的开始拖拽处理
        const handlePointerDown = (e) => {
            // 对于鼠标事件，只响应左键
            if (e.type === 'mousedown' && e.button !== 0) return;

            isDragging = true;
            hasMoved = false;
            partElement.classList.add('dragging');
            
            const coords = this.getEventCoordinates(e);
            
            // 记录初始指针位置，用于计算移动距离
            initialPointerPosition.x = coords.clientX;
            initialPointerPosition.y = coords.clientY;
            
            // 计算指针相对于画布的位置
            const canvasRect = this.canvas.getBoundingClientRect();
            const pointerCanvasX = coords.clientX - canvasRect.left;
            const pointerCanvasY = coords.clientY - canvasRect.top;
            
            // 计算部件在变换后的实际显示位置
            const partCanvasX = (assemblyPart.position.x * this.canvasZoom) + this.canvasOffset.x;
            const partCanvasY = (assemblyPart.position.y * this.canvasZoom) + this.canvasOffset.y;
            
            dragOffset.x = pointerCanvasX - partCanvasX;
            dragOffset.y = pointerCanvasY - partCanvasY;
            
            startPosition.x = assemblyPart.position.x;
            startPosition.y = assemblyPart.position.y;
            
            e.preventDefault();
            e.stopPropagation();
        };

        // 统一的移动处理
        const handlePointerMove = (e) => {
            if (!isDragging) return;

            const coords = this.getEventCoordinates(e);
            
            // 计算从初始位置的移动距离
            const moveDistance = Math.sqrt(
                Math.pow(coords.clientX - initialPointerPosition.x, 2) + 
                Math.pow(coords.clientY - initialPointerPosition.y, 2)
            );
            
            // 只有当移动距离超过阈值时才认为是真正的拖拽
            if (moveDistance > MOVE_THRESHOLD) {
                hasMoved = true;
            }
            
            // 如果还没有超过移动阈值，就不执行拖拽操作
            if (!hasMoved) return;

            const canvasRect = this.canvas.getBoundingClientRect();
            
            // 计算指针相对于画布的位置
            const pointerX = coords.clientX - canvasRect.left;
            const pointerY = coords.clientY - canvasRect.top;
            
            // 应用逆变换来计算新位置
            let newX = (pointerX - this.canvasOffset.x - dragOffset.x) / this.canvasZoom;
            let newY = (pointerY - this.canvasOffset.y - dragOffset.y) / this.canvasZoom;

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

        // 统一的结束拖拽处理
        const handlePointerUp = () => {
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
                        const title = window.i18n ? window.i18n.t('notifications.connectionBroken.title') : '连接断开';
                        const message = window.i18n ? 
                            window.i18n.t('notifications.connectionBroken.message', { count: brokenConnections.length }) :
                            `${brokenConnections.length}个连接因距离过远而自动断开`;
                        showNotification(title, message, 'warning');
                    }
                    
                    // 尝试在移动后建立新的自动连接
                    const newConnection = this.attemptAutoConnectForMovedPart(assemblyPart);
                    if (newConnection && typeof showNotification === 'function') {
                        const title = window.i18n ? window.i18n.t('notifications.autoConnect.title') : '自动连接';
                        const message = window.i18n ? 
                            window.i18n.t('notifications.autoConnect.afterMove', { partName: newConnection.targetPart.data.name }) :
                            `部件移动后自动连接到 ${newConnection.targetPart.data.name}`;
                        showNotification(title, message, 'success');
                    }
                    
                    // 更新连接线显示
                    this.updateConnectionLines();
                }
                
                // 更新组装数据
                this.assembly.modified = new Date();
                this.updateUI();
            }
        };

        // 添加鼠标事件监听器
        partElement.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('mousemove', handlePointerMove);
        document.addEventListener('mouseup', handlePointerUp);

        // 添加触屏事件监听器
        partElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handlePointerDown(e);
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                handlePointerMove(e);
            }
        }, { passive: false });
        
        document.addEventListener('touchend', handlePointerUp);
        document.addEventListener('touchcancel', handlePointerUp);
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
        
        // 在移动端自动切换到信息面板以显示部件详情
        if (window.innerWidth <= 768) {
            this.switchToInfoPanel();
            
            // 显示选中通知
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('notifications.partSelected.title') : '部件选中';
                const message = window.i18n ? 
                    window.i18n.t('notifications.partSelected.message', { partName: assemblyPart.data.name }) :
                    `已选中 ${assemblyPart.data.name}，自动切换到信息面板`;
                showNotification(title, message, 'info');
            }
        }
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
            const noSelectionText = window.i18n ? window.i18n.t('rocketBuilder.selectedPart.none') : '未选中任何部件';
            infoPanel.innerHTML = `<p class="no-selection">${noSelectionText}</p>`;
            return;
        }

        const part = this.selectedPart.data;
        let fuelControlsHtml = '';
        
        // 获取国际化文本
        const fuelControlTitle = window.i18n ? window.i18n.t('rocketBuilder.partInfo.fuelControls') : '燃料控制';
        const liquidFuelLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.liquidFuel') : '液体燃料';
        const oxidizerLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.oxidizer') : '氧化剂';
        const unitsLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.units') : '单位';
        const fullLoadBtn = window.i18n ? window.i18n.t('rocketBuilder.partInfo.fullLoad') : '满载';
        const halfLoadBtn = window.i18n ? window.i18n.t('rocketBuilder.partInfo.halfLoad') : '半载';
        const emptyLoadBtn = window.i18n ? window.i18n.t('rocketBuilder.partInfo.emptyLoad') : '空载';
        
        // 如果是燃料罐，添加燃料控制界面
        if (part.type === 'fuel-tank' && this.selectedPart.fuelStatus) {
            const liquidFuelMax = part.fuel_capacity.liquid_fuel;
            const oxidizerMax = part.fuel_capacity.oxidizer;
            const currentLiquid = this.selectedPart.fuelStatus.liquid_fuel;
            const currentOxidizer = this.selectedPart.fuelStatus.oxidizer;
            
            fuelControlsHtml = `
                <div class="fuel-controls">
                    <h5>${fuelControlTitle}</h5>
                    <div class="fuel-type">
                        <label>${liquidFuelLabel}: ${currentLiquid.toFixed(1)} / ${liquidFuelMax} ${unitsLabel}</label>
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
                        <label>${oxidizerLabel}: ${currentOxidizer.toFixed(1)} / ${oxidizerMax} ${unitsLabel}</label>
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
                        <button onclick="rocketBuilder.setFuelLevel(1.0)" class="fuel-action-btn">${fullLoadBtn}</button>
                        <button onclick="rocketBuilder.setFuelLevel(0.5)" class="fuel-action-btn">${halfLoadBtn}</button>
                        <button onclick="rocketBuilder.setFuelLevel(0.0)" class="fuel-action-btn">${emptyLoadBtn}</button>
                    </div>
                </div>
            `;
        }
        
        // 获取分离器控制相关文本
        const decouplerControlTitle = window.i18n ? window.i18n.t('rocketBuilder.partInfo.decouplerControls') : '分离器控制';
        const separationForceLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.separationForce') : '分离力';
        const upperStageLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.upperStage') : '上级部件';
        const lowerStageLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.lowerStage') : '下级部件';
        const testSeparationBtn = window.i18n ? window.i18n.t('rocketBuilder.partInfo.testSeparation') : '测试分离';
        const stagingInfoBtn = window.i18n ? window.i18n.t('rocketBuilder.partInfo.stagingInfo') : '分级信息';
        const countUnit = window.i18n ? window.i18n.t('rocketBuilder.partInfo.countUnit') : '个';
        
        // 如果是分离器，添加分离控制界面
        let decouplerControlsHtml = '';
        if (part.type === 'decoupler' && part.decoupler_properties?.can_separate) {
            const separationGroups = this.assembly.getDecouplerSeparationGroups(this.selectedPart.id);
            if (separationGroups) {
                decouplerControlsHtml = `
                    <div class="decoupler-controls">
                        <h5>${decouplerControlTitle}</h5>
                        <div class="decoupler-info">
                            <div class="property-item">
                                <label>${separationForceLabel}:</label>
                                <span>${part.separation_force || 2500} N</span>
                            </div>
                            <div class="property-item">
                                <label>${upperStageLabel}:</label>
                                <span>${separationGroups.upperStage.length} ${countUnit}</span>
                            </div>
                            <div class="property-item">
                                <label>${lowerStageLabel}:</label>
                                <span>${separationGroups.lowerStage.length} ${countUnit}</span>
                            </div>
                        </div>
                        <div class="decoupler-actions">
                            <button onclick="rocketBuilder.testDecouplerSeparation('${this.selectedPart.id}')" class="decoupler-action-btn">
                                ${testSeparationBtn}
                            </button>
                            <button onclick="rocketBuilder.showStagingInfo()" class="decoupler-action-btn">
                                ${stagingInfoBtn}
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        
        // 获取部件属性相关文本
        const massLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.mass') : '质量';
        const costLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.cost') : '成本';
        const thrustLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.thrust') : '推力';
        const vacuumIspLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.vacuumIsp') : '比冲 (真空)';
        const crewCapacityLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.crewCapacity') : '载员容量';
        const peopleUnit = window.i18n ? window.i18n.t('rocketBuilder.partInfo.peopleUnit') : '人';
        const dimensionsLabel = window.i18n ? window.i18n.t('rocketBuilder.partInfo.dimensions') : '尺寸';
        const removePartBtn = window.i18n ? window.i18n.t('rocketBuilder.partInfo.removePart') : '移除此部件';
        
        infoPanel.innerHTML = `
            <div class="selected-part-details">
                <h4>${part.name}</h4>
                <p class="part-description">${part.description}</p>
                <div class="part-properties">
                    <div class="property-item">
                        <label>${massLabel}:</label>
                        <span>${this.getPartCurrentMass().toFixed(2)} t</span>
                    </div>
                    <div class="property-item">
                        <label>${costLabel}:</label>
                        <span>${part.cost} √</span>
                    </div>
                    ${part.thrust ? `
                        <div class="property-item">
                            <label>${thrustLabel}:</label>
                            <span>${part.thrust} kN</span>
                        </div>
                        <div class="property-item">
                            <label>${vacuumIspLabel}:</label>
                            <span>${part.isp_vacuum} s</span>
                        </div>
                    ` : ''}
                    ${part.crew_capacity ? `
                        <div class="property-item">
                            <label>${crewCapacityLabel}:</label>
                            <span>${part.crew_capacity} ${peopleUnit}</span>
                        </div>
                    ` : ''}
                    <div class="property-item">
                        <label>${dimensionsLabel}:</label>
                        <span>${part.dimensions.width}m × ${part.dimensions.height}m</span>
                    </div>
                </div>
                ${fuelControlsHtml}
                ${decouplerControlsHtml}
                <button class="remove-part-btn" onclick="rocketBuilder.removeAssemblyPart('${this.selectedPart.id}')">
                    ${removePartBtn}
                </button>
            </div>
        `;
    }

    // 更新UI统计信息
    updateUI() {
        // 更新载具统计 - 使用连通部件统计
        document.getElementById('totalMass').textContent = `${this.assembly.getConnectedMass().toFixed(2)} t`;
        document.getElementById('partCount').textContent = `${this.assembly.getConnectedPartCount()}/${this.assembly.getPartCount()}`;
        document.getElementById('totalThrust').textContent = `${this.assembly.getConnectedThrust().toFixed(1)} kN`;
        document.getElementById('deltaV').textContent = `${this.assembly.estimateConnectedDeltaV().toFixed(0)} m/s`;

        // 更新部件信息
        this.updatePartInfo();
        
        // 更新部件连通性视觉状态
        this.updatePartConnectivityVisuals();
    }

    // 更新部件连通性视觉状态
    updatePartConnectivityVisuals() {
        if (this.assembly.parts.length === 0) return;

        // 获取连通和未连通的部件ID列表
        const connectedPartIds = this.assembly.getConnectedParts();
        const disconnectedPartIds = this.assembly.getDisconnectedParts();

        console.log('连通部件:', connectedPartIds);
        console.log('未连通部件:', disconnectedPartIds);

        // 更新所有部件的视觉状态
        document.querySelectorAll('.assembly-part').forEach(partElement => {
            const partId = partElement.dataset.partId;
            const svg = partElement.querySelector('svg');
            
            if (!svg) return;

            if (disconnectedPartIds.includes(partId)) {
                // 未连通部件设为半透明
                partElement.style.opacity = '0.4';
                partElement.classList.add('disconnected');
                partElement.classList.remove('connected');
                const disconnectedTitle = window.i18n ? 
                    window.i18n.t('rocketBuilder.connectivity.disconnected') : 
                    '未连接到根部件的部件（不参与计算）';
                partElement.title = disconnectedTitle;
            } else {
                // 连通部件设为正常显示
                partElement.style.opacity = '1.0';
                partElement.classList.add('connected');
                partElement.classList.remove('disconnected');
                const connectedTitle = window.i18n ? 
                    window.i18n.t('rocketBuilder.connectivity.connected') : 
                    '已连接到根部件的部件';
                partElement.title = connectedTitle;
            }
        });

        // 如果有根部件，为其添加特殊标识
        if (this.assembly.rootPart) {
            const rootElement = document.querySelector(`.assembly-part[data-part-id="${this.assembly.rootPart}"]`);
            if (rootElement) {
                rootElement.classList.add('root-part');
                const rootTitle = window.i18n ? window.i18n.t('rocketBuilder.rootPart.title') : '根部件';
                rootElement.title = rootTitle;
                // 根部件添加特殊边框或标识
                rootElement.style.border = '2px solid #ffff00';
                rootElement.style.borderRadius = '4px';
            }
        }
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

        // 统一的平移开始处理
        const handlePanStart = (e) => {
            // 只在空白区域（非部件）响应
            if (e.target === this.canvas || e.target.classList.contains('canvas-grid') || 
                e.target.classList.contains('rocket-assembly')) {
                
                // 对于鼠标事件，只响应左键或中键
                if (e.type === 'mousedown' && e.button !== 0 && e.button !== 1) return;
                
                isPanning = true;
                const coords = this.getEventCoordinates(e);
                panStart.x = coords.clientX;
                panStart.y = coords.clientY;
                panOffset.x = this.canvasOffset.x;
                panOffset.y = this.canvasOffset.y;
                
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
        };

        // 统一的平移处理
        const handlePanMove = (e) => {
            if (!isPanning) return;

            const coords = this.getEventCoordinates(e);
            const deltaX = coords.clientX - panStart.x;
            const deltaY = coords.clientY - panStart.y;
            
            this.canvasOffset.x = panOffset.x + deltaX;
            this.canvasOffset.y = panOffset.y + deltaY;
            
            this.updateCanvasTransform();
        };

        // 统一的平移结束处理
        const handlePanEnd = () => {
            if (isPanning) {
                isPanning = false;
                this.canvas.style.cursor = '';
            }
        };

        // 添加鼠标事件
        this.canvas.addEventListener('mousedown', handlePanStart);
        document.addEventListener('mousemove', handlePanMove);
        document.addEventListener('mouseup', handlePanEnd);

        // 添加触屏事件
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                handlePanStart(e);
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isPanning && e.touches.length === 1) {
                e.preventDefault();
                handlePanMove(e);
            }
        }, { passive: false });

        document.addEventListener('touchend', handlePanEnd);
        document.addEventListener('touchcancel', handlePanEnd);

        // 双击重置视图（桌面端）
        this.canvas.addEventListener('dblclick', (e) => {
            if (e.target === this.canvas || e.target.classList.contains('canvas-grid') || 
                e.target.classList.contains('rocket-assembly')) {
                this.resetCanvasView();
            }
        });

        // 移动端双指缩放支持
        let lastTouchDistance = 0;
        let initialZoom = 1.0;

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                lastTouchDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                initialZoom = this.canvasZoom;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                const scale = currentDistance / lastTouchDistance;
                const newZoom = initialZoom * scale;
                
                // 限制缩放范围
                this.canvasZoom = Math.max(0.1, Math.min(3.0, newZoom));
                this.updateCanvasTransform();
            }
        }, { passive: false });

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
            const title = window.i18n ? window.i18n.t('notifications.viewReset.title') : '视图重置';
            const message = window.i18n ? window.i18n.t('notifications.viewReset.message') : '画布视图已重置到默认位置';
            showNotification(title, message, 'info');
        }
    }

    // 只重置画布缩放，保持位置不变
    resetCanvasZoom() {
        this.canvasZoom = 1.0;
        this.updateCanvasTransform();
        
        // 显示提示
        if (typeof showNotification === 'function') {
            const title = window.i18n ? window.i18n.t('notifications.zoomReset.title') : '缩放重置';
            const message = window.i18n ? window.i18n.t('notifications.zoomReset.message') : '画布缩放已重置，位置保持不变';
            showNotification(title, message, 'info');
        }
    }

    // 重置视图 - 提供给外部调用
    resetView() {
        this.resetCanvasView();
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
                    const title = window.i18n ? window.i18n.t('notifications.gridSnap.title') : '网格吸附';
                    const message = window.i18n ? 
                        window.i18n.t(`notifications.gridSnap.${this.snapToGrid ? 'enabled' : 'disabled'}`) :
                        `网格吸附已${this.snapToGrid ? '开启' : '关闭'}`;
                    showNotification(title, message, 'info');
                }
                break;
            case 'r':
                this.resetCanvasView();
                break;
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

        // 确保翻译系统已初始化
        if (!window.i18n.isInitialized()) {
            await new Promise(resolve => {
                document.addEventListener('i18nReady', resolve, { once: true });
            });
        }

        // 更新所有部件的翻译
        parts.forEach(part => {
            if (part.nameKey && window.i18n) {
                const translatedName = window.i18n.t(part.nameKey);
                if (translatedName !== part.nameKey) {
                    part.name = translatedName;
                }
            }
            if (part.descriptionKey && window.i18n) {
                const translatedDesc = window.i18n.t(part.descriptionKey);
                if (translatedDesc !== part.descriptionKey) {
                    part.description = translatedDesc;
                }
            }
        });

        partsList.innerHTML = '';
        
        for (const part of parts) {
            const partElement = await this.createPartElement(part);
            partsList.appendChild(partElement);
        }
    }

    // 选择部件类型（用于显示信息）
    selectPartType(part) {
        console.log('选中部件类型:', part.name);
        
        // 在移动设备上自动添加部件到装配区中心
        if (window.innerWidth <= 768) {
            this.autoAddPartToCenter(part);
            this.switchToAssemblyPanel();
        }
    }

    // 自动添加部件到装配区中心
    autoAddPartToCenter(part) {
        // 计算画布中心位置
        const centerPosition = { x: 400, y: 300 }; // 画布中心 (800x600)
        
        // 调整到部件的中心点
        const partWidth = part.dimensions.width * 40;
        const partHeight = part.dimensions.height * 40;
        centerPosition.x -= partWidth / 2;
        centerPosition.y -= partHeight / 2;
        
        // 网格吸附
        if (this.snapToGrid) {
            centerPosition.x = Math.round(centerPosition.x / this.gridSize) * this.gridSize;
            centerPosition.y = Math.round(centerPosition.y / this.gridSize) * this.gridSize;
        }

        // 添加部件到装配清单（使用正确的参数格式）
        const assemblyPart = this.assembly.addPart(part, centerPosition);
        
        // 添加部件到画布（这是关键！）
        this.addPartToCanvas(assemblyPart);
        
        // 重置缩放确保部件可见（保持画布位置不变）
        this.resetCanvasZoom();
        
        // 更新UI和连接线
        this.updateUI();
        this.updateConnectionLines();
        
        // 显示通知
        if (typeof showNotification === 'function') {
            const title = window.i18n ? window.i18n.t('rocketBuilder.alerts.partAdded') : '部件添加';
            const message = window.i18n ? 
                window.i18n.t('rocketBuilder.alerts.partAddedMessage', { name: part.name }) :
                `${part.name}已添加到装配区中心`;
            showNotification(title, message, 'success');
        }
        
        console.log('自动添加部件到中心:', part.name, '位置:', centerPosition);
    }

    // 切换到装配区面板
    switchToAssemblyPanel() {
        const assemblyButton = document.querySelector('.panel-toggle-btn[data-panel="assembly"]');
        const toggleButtons = document.querySelectorAll('.panel-toggle-btn');
        const partsPanel = document.getElementById('partsPanel');
        const infoPanel = document.getElementById('infoPanel');
        const assemblyArea = document.querySelector('.assembly-area');
        
        if (assemblyButton && toggleButtons.length > 0) {
            // 更新按钮状态
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            assemblyButton.classList.add('active');
            
            // 隐藏其他面板，显示装配区
            partsPanel.classList.remove('active');
            infoPanel.classList.remove('active');
            assemblyArea.classList.remove('mobile-hidden');
            
            console.log('自动切换到装配区');
        }
    }

    // 切换到信息面板
    switchToInfoPanel() {
        const infoButton = document.querySelector('.panel-toggle-btn[data-panel="info"]');
        const toggleButtons = document.querySelectorAll('.panel-toggle-btn');
        const partsPanel = document.getElementById('partsPanel');
        const infoPanel = document.getElementById('infoPanel');
        const assemblyArea = document.querySelector('.assembly-area');
        
        if (infoButton && toggleButtons.length > 0) {
            // 更新按钮状态
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            infoButton.classList.add('active');
            
            // 隐藏其他面板，显示信息面板
            partsPanel.classList.remove('active');
            infoPanel.classList.add('active');
            assemblyArea.classList.add('mobile-hidden');
            
            console.log('自动切换到信息面板');
        }
    }

    // 清空组装
    clearAssembly() {
        const confirmMessage = window.i18n ? 
            window.i18n.t('rocketBuilder.confirmations.clearAssembly') : 
            '确定要清空当前载具设计吗？';
        if (confirm(confirmMessage)) {
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

        const saveMessage = window.i18n ? window.i18n.t('rocketBuilder.alerts.designSaved') : '设计已保存到下载文件夹';
        alert(saveMessage);
    }

    // 测试分离器分离功能
    testDecouplerSeparation(decouplerId) {
        const result = this.assembly.activateDecoupler(decouplerId);
        
        if (result) {
            const message = `分离器测试成功！\n\n` +
                          `分离器: ${result.decoupler.data.name}\n` +
                          `分离力: ${result.separationForce} N\n` +
                          `断开连接数: ${result.brokenConnections.length}\n` +
                          `上级部件: ${result.upperStage.length} 个\n` +
                          `下级部件: ${result.lowerStage.length} 个\n\n` +
                          `注意: 这只是测试，实际发射时分离器会在指定时机自动激活。`;
            
            alert(message);
            
            // 更新UI以反映断开的连接
            this.updateConnectionLines();
            this.updateUI();
            
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('rocketBuilder.alerts.decouplerTest') : '分离器测试';
                const message = window.i18n ? 
                    window.i18n.t('rocketBuilder.alerts.decouplerTestComplete', { name: result.decoupler.data.name }) :
                    `${result.decoupler.data.name} 分离测试完成`;
                showNotification(title, message, 'success');
            }
        } else {
            const failMessage = window.i18n ? 
                window.i18n.t('rocketBuilder.alerts.decouplerTestFailed') : 
                '分离器测试失败！请检查分离器是否正确连接。';
            alert(failMessage);
        }
    }

    // 显示分级信息
    showStagingInfo() {
        const stagingInfo = this.assembly.getStagingInfo();
        
        if (stagingInfo.length === 0) {
            const noDecouplerMsg = window.i18n ? 
                window.i18n.t('rocketBuilder.staging.noDecoupler') : 
                '当前载具没有检测到分离器，无法进行分级。\n\n添加分离器部件可以创建多级火箭设计。';
            alert(noDecouplerMsg);
            return;
        }

        const stagingTitle = window.i18n ? window.i18n.t('rocketBuilder.staging.title') : '火箭分级信息';
        const stageLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.stage') : '第';
        const stageUnit = window.i18n ? window.i18n.t('rocketBuilder.staging.stageUnit') : '级';
        const decouplerLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.decoupler') : '分离器';
        const partCountLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.partCount') : '部件数量';
        const totalMassLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.totalMass') : '总质量';
        const deltaVLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.deltaV') : '预估ΔV';
        const totalStagesLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.totalStages') : '总级数';
        const noteLabel = window.i18n ? window.i18n.t('rocketBuilder.staging.note') : '注意: 发射时分离器将按优先级顺序激活。';
        
        let infoMessage = `${stagingTitle}:\n\n`;
        stagingInfo.forEach((stage, index) => {
            infoMessage += `${stageLabel} ${stage.stage} ${stageUnit}:\n`;
            infoMessage += `  ${decouplerLabel}: ${stage.decoupler.data.name}\n`;
            infoMessage += `  ${partCountLabel}: ${stage.partsCount}\n`;
            infoMessage += `  ${totalMassLabel}: ${stage.mass.toFixed(2)} t\n`;
            infoMessage += `  ${deltaVLabel}: ${stage.deltaV.toFixed(0)} m/s\n\n`;
        });

        infoMessage += `${totalStagesLabel}: ${stagingInfo.length}\n`;
        infoMessage += `\n${noteLabel}`;

        alert(infoMessage);
    }

    // 发射火箭
    launchRocket() {
        if (this.assembly.getPartCount() === 0) {
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('rocketBuilder.alerts.cannotLaunch') : '无法发射';
                const message = window.i18n ? window.i18n.t('rocketBuilder.alerts.noVehicle') : '请先设计一个载具！';
                showNotification(title, message, 'error');
            } else {
                const noVehicleMessage = window.i18n ? 
                    window.i18n.t('rocketBuilder.alerts.noVehicle') : 
                    '请先设计一个载具！';
                alert(noVehicleMessage);
            }
            return;
        }

        const engines = this.assembly.parts.filter(p => p.data.type === 'engine');
        if (engines.length === 0) {
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('rocketBuilder.alerts.cannotLaunch') : '无法发射';
                const message = window.i18n ? window.i18n.t('rocketBuilder.alerts.noEngine') : '载具需要至少一个引擎才能发射！';
                showNotification(title, message, 'error');
            } else {
                const noEngineMessage = window.i18n ? 
                    window.i18n.t('rocketBuilder.alerts.noEngine') : 
                    '载具需要至少一个引擎才能发射！';
                alert(noEngineMessage);
            }
            return;
        }

        // 准备火箭数据
        const rocketData = {
            name: this.assembly.name,
            parts: this.assembly.parts.map(part => ({
                id: part.id,
                data: part.data,
                position: part.position,
                fuelStatus: part.fuelStatus || null
            })),
            connections: this.assembly.connections,
            rootPartId: this.assembly.rootPart ? this.assembly.rootPart.id : null,
            totalMass: this.assembly.getTotalMass(),
            totalThrust: this.assembly.getTotalThrust(),
            estimatedDeltaV: this.assembly.estimateDeltaV(),
            timestamp: new Date().toISOString()
        };

        try {
            // 保存到localStorage
            localStorage.setItem('launchRocket', JSON.stringify(rocketData));
            
            // 显示准备发射的信息
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('rocketBuilder.alerts.prepareLaunch') : '准备发射';
                const message = window.i18n ? 
                    window.i18n.t('rocketBuilder.alerts.vehicleReady', { name: this.assembly.name }) :
                    `载具 "${this.assembly.name}" 已准备就绪！正在前往发射台...`;
                showNotification(title, message, 'success');
            }
            
            // 短暂延迟后跳转到发射页面
            setTimeout(() => {
                window.location.href = 'launch-pad.html';
            }, 1500);
            
        } catch (error) {
            console.error('保存火箭数据失败:', error);
            if (typeof showNotification === 'function') {
                const title = window.i18n ? window.i18n.t('rocketBuilder.alerts.saveFailed') : '保存失败';
                const message = window.i18n ? window.i18n.t('rocketBuilder.alerts.saveDataFailed') : '无法保存火箭数据，请重试';
                showNotification(title, message, 'error');
            } else {
                const saveFailedMessage = window.i18n ? 
                    window.i18n.t('rocketBuilder.alerts.saveDataFailed') : 
                    '保存火箭数据失败，请重试';
                alert(saveFailedMessage);
            }
        }
    }
}

// 装配大楼相关的全局函数
function goBack() {
    const confirmMessage = window.i18n ? 
        window.i18n.t('rocketBuilder.confirmations.goBack') : 
        '确定要返回主页吗？未保存的设计将丢失。';
    if (confirm(confirmMessage)) {
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('载具装配大楼已加载');
    
    // 等待国际化系统初始化完成
    if (!window.i18n.isInitialized()) {
        await new Promise(resolve => {
            document.addEventListener('i18nReady', resolve, { once: true });
        });
    }
    
    window.rocketBuilder = new RocketBuilder();
    
    // 添加欢迎提示
    setTimeout(() => {
        if (typeof showNotification === 'function') {
            const title = window.i18n ? window.i18n.t('rocketBuilder.welcome.title') : '装配大楼';
            const message = window.i18n ? window.i18n.t('rocketBuilder.welcome.message') : '欢迎来到载具装配大楼！先选择一个根部件，然后逐步构建载具。';
            showNotification(title, message, 'welcome');
        }
    }, 500);
});
