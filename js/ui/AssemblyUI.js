// 载具装配厂UI管理器
class AssemblyUI {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.currentVehicle = null;
        this.selectedPart = null;
        this.draggedPart = null;
        this.attachmentPreview = null;
        
        this.initialize();
    }
    
    initialize() {
        this.setupPartsPanel();
        this.setupAssemblyArea();
        this.setupEventListeners();
        this.updatePartsLibrary();
    }
    
    setupPartsPanel() {
        const partsPanel = document.querySelector('.parts-panel');
        if (!partsPanel) return;
        
        // 创建部件分类
        const categories = [
            { id: 'command', name: '指令舱', icon: '🚀' },
            { id: 'fuel', name: '燃料罐', icon: '⛽' },
            { id: 'engine', name: '引擎', icon: '🔥' },
            { id: 'structure', name: '结构件', icon: '🔧' },
            { id: 'utility', name: '实用部件', icon: '⚙️' }
        ];
        
        const categoriesContainer = partsPanel.querySelector('.parts-categories');
        if (categoriesContainer) {
            categoriesContainer.innerHTML = '';
            
            categories.forEach(category => {
                const categoryButton = document.createElement('button');
                categoryButton.className = 'category-btn';
                categoryButton.dataset.category = category.id;
                categoryButton.innerHTML = `${category.icon} ${category.name}`;
                categoryButton.addEventListener('click', () => this.showPartsCategory(category.id));
                categoriesContainer.appendChild(categoryButton);
            });
            
            // 默认显示指令舱
            this.showPartsCategory('command');
        }
    }
    
    setupAssemblyArea() {
        const assemblyArea = document.querySelector('.assembly-area');
        if (!assemblyArea) return;
        
        // 创建装配画布
        const canvas = document.createElement('canvas');
        canvas.id = 'assembly-canvas';
        canvas.width = assemblyArea.clientWidth;
        canvas.height = assemblyArea.clientHeight;
        assemblyArea.appendChild(canvas);
        
        // 监听画布大小变化
        const resizeObserver = new ResizeObserver(() => {
            canvas.width = assemblyArea.clientWidth;
            canvas.height = assemblyArea.clientHeight;
            this.renderAssembly();
        });
        resizeObserver.observe(assemblyArea);
    }
    
    setupEventListeners() {
        // 保存载具按钮
        const saveBtn = document.getElementById('save-vehicle');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveVehicle());
        }
        
        // 加载载具按钮
        const loadBtn = document.getElementById('load-vehicle');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadVehicle());
        }
        
        // 发射载具按钮
        const launchBtn = document.getElementById('launch-vehicle');
        if (launchBtn) {
            launchBtn.addEventListener('click', () => this.launchVehicle());
        }
        
        // 画布事件
        const canvas = document.getElementById('assembly-canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
            canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.handleCanvasRightClick(e);
            });
        }
    }
    
    showPartsCategory(category) {
        const partsGrid = document.querySelector('.parts-grid');
        if (!partsGrid) return;
        
        // 移除所有分类按钮的活动状态
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 激活当前分类按钮
        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // 获取该分类的部件
        const parts = this.getPartsByCategory(category);
        
        // 清空并重新填充部件网格
        partsGrid.innerHTML = '';
        
        parts.forEach(part => {
            const partElement = document.createElement('div');
            partElement.className = 'part-item';
            partElement.dataset.partType = part.type;
            partElement.innerHTML = `
                <div class="part-icon">${part.icon}</div>
                <div class="part-name">${part.name}</div>
                <div class="part-cost">💰${part.cost}</div>
            `;
            
            // 添加拖拽功能
            partElement.draggable = true;
            partElement.addEventListener('dragstart', (e) => this.handlePartDragStart(e, part));
            partElement.addEventListener('click', () => this.selectPart(part));
            
            partsGrid.appendChild(partElement);
        });
    }
    
    getPartsByCategory(category) {
        const allParts = {
            command: [
                { type: 'mk1-command-pod', name: 'Mk1指令舱', icon: '🚀', cost: 600, description: '单人指令舱' },
                { type: 'mk2-command-pod', name: 'Mk2指令舱', icon: '🛸', cost: 1200, description: '双人指令舱' }
            ],
            fuel: [
                { type: 'fl-t100', name: 'FL-T100燃料罐', icon: '⛽', cost: 150, description: '小型燃料罐' },
                { type: 'fl-t200', name: 'FL-T200燃料罐', icon: '🛢️', cost: 300, description: '中型燃料罐' },
                { type: 'fl-t400', name: 'FL-T400燃料罐', icon: '🛢️', cost: 600, description: '大型燃料罐' }
            ],
            engine: [
                { type: 'lv-t30', name: 'LV-T30引擎', icon: '🔥', cost: 1100, description: '中等推力液体燃料引擎' },
                { type: 'lv-t45', name: 'LV-T45引擎', icon: '🚀', cost: 1200, description: '可矢量推力引擎' },
                { type: 'lv-909', name: 'LV-909引擎', icon: '⭐', cost: 390, description: '高效真空引擎' }
            ],
            structure: [
                { type: 'tr-18a', name: 'TR-18A分离器', icon: '⚡', cost: 400, description: '分离器/对接口' },
                { type: 'strut', name: '支撑杆', icon: '🔗', cost: 42, description: '结构支撑' }
            ],
            utility: [
                { type: 'mk16-parachute', name: 'Mk16降落伞', icon: '🪂', cost: 422, description: '标准降落伞' },
                { type: 'solar-panel', name: '太阳能板', icon: '☀️', cost: 300, description: '发电设备' }
            ]
        };
        
        return allParts[category] || [];
    }
    
    handlePartDragStart(event, part) {
        this.draggedPart = part;
        event.dataTransfer.setData('text/plain', JSON.stringify(part));
    }
    
    handleCanvasClick(event) {
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.draggedPart) {
            this.addPartToVehicle(this.draggedPart, x, y);
            this.draggedPart = null;
        } else {
            // 选择部件
            const clickedPart = this.getPartAtPosition(x, y);
            this.selectPart(clickedPart);
        }
    }
    
    handleCanvasMouseMove(event) {
        // 预览部件附着点
        if (this.draggedPart) {
            this.showAttachmentPreview(event);
        }
    }
    
    handleCanvasRightClick(event) {
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const clickedPart = this.getPartAtPosition(x, y);
        if (clickedPart) {
            this.showPartContextMenu(clickedPart, event.clientX, event.clientY);
        }
    }
    
    addPartToVehicle(partData, x, y) {
        if (!this.currentVehicle) {
            this.currentVehicle = new Vehicle();
        }
        
        try {
            const part = new Part(partData.type, x, y);
            part.name = partData.name;
            part.cost = partData.cost;
            
            this.currentVehicle.addPart(part);
            this.renderAssembly();
            
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage(`已添加 ${partData.name}`, 'success', 2000);
            }
        } catch (error) {
            console.error('添加部件失败:', error);
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage('添加部件失败', 'error', 3000);
            }
        }
    }
    
    getPartAtPosition(x, y) {
        if (!this.currentVehicle) return null;
        
        // 遍历载具的所有部件，检查点击位置
        for (let part of this.currentVehicle.parts) {
            const size = 30; // 部件显示大小
            if (x >= part.x - size/2 && x <= part.x + size/2 &&
                y >= part.y - size/2 && y <= part.y + size/2) {
                return part;
            }
        }
        
        return null;
    }
    
    selectPart(part) {
        this.selectedPart = part;
        this.renderAssembly();
        this.updatePartInfo(part);
    }
    
    updatePartInfo(part) {
        const infoPanel = document.querySelector('.part-info');
        if (!infoPanel) return;
        
        if (part) {
            infoPanel.innerHTML = `
                <h3>${part.name || part.type}</h3>
                <p><strong>类型:</strong> ${part.type}</p>
                <p><strong>质量:</strong> ${part.mass}t</p>
                <p><strong>成本:</strong> 💰${part.cost}</p>
                <div class="part-actions">
                    <button onclick="assemblyUI.deletePart('${part.id}')">删除</button>
                    <button onclick="assemblyUI.duplicatePart('${part.id}')">复制</button>
                </div>
            `;
        } else {
            infoPanel.innerHTML = '<p>选择一个部件以查看详情</p>';
        }
    }
    
    renderAssembly() {
        const canvas = document.getElementById('assembly-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制网格
        this.drawGrid(ctx, canvas.width, canvas.height);
        
        if (this.currentVehicle) {
            // 绘制部件连接线
            this.drawConnections(ctx);
            
            // 绘制部件
            this.drawParts(ctx);
        }
        
        // 绘制选中部件的高亮
        if (this.selectedPart) {
            this.drawPartHighlight(ctx, this.selectedPart);
        }
    }
    
    drawGrid(ctx, width, height) {
        const gridSize = 20;
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        
        // 垂直线
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 中心线
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
        ctx.stroke();
    }
    
    drawParts(ctx) {
        if (!this.currentVehicle) return;
        
        this.currentVehicle.parts.forEach(part => {
            // 绘制部件图标/形状
            ctx.fillStyle = this.getPartColor(part.type);
            ctx.fillRect(part.x - 15, part.y - 15, 30, 30);
            
            // 绘制部件边框
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(part.x - 15, part.y - 15, 30, 30);
            
            // 绘制部件名称
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(part.name || part.type, part.x, part.y + 25);
        });
    }
    
    drawConnections(ctx) {
        if (!this.currentVehicle) return;
        
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        
        this.currentVehicle.parts.forEach(part => {
            if (part.parent) {
                ctx.beginPath();
                ctx.moveTo(part.x, part.y);
                ctx.lineTo(part.parent.x, part.parent.y);
                ctx.stroke();
            }
        });
    }
    
    drawPartHighlight(ctx, part) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(part.x - 18, part.y - 18, 36, 36);
        ctx.setLineDash([]);
    }
    
    getPartColor(partType) {
        const colorMap = {
            'mk1-command-pod': '#4CAF50',
            'mk2-command-pod': '#8BC34A',
            'fl-t100': '#FF9800',
            'fl-t200': '#F57C00',
            'fl-t400': '#E65100',
            'lv-t30': '#F44336',
            'lv-t45': '#E91E63',
            'lv-909': '#9C27B0',
            'tr-18a': '#607D8B',
            'strut': '#795548',
            'mk16-parachute': '#2196F3',
            'solar-panel': '#FFEB3B'
        };
        
        return colorMap[partType] || '#666';
    }
    
    saveVehicle() {
        if (!this.currentVehicle) {
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage('没有载具可保存', 'warning', 3000);
            }
            return;
        }
        
        const vehicleName = prompt('请输入载具名称:', 'My Rocket');
        if (vehicleName) {
            try {
                const vehicleData = this.currentVehicle.serialize();
                localStorage.setItem(`vehicle_${vehicleName}`, JSON.stringify(vehicleData));
                
                if (this.gameEngine && this.gameEngine.ui) {
                    this.gameEngine.ui.showMessage(`载具 "${vehicleName}" 已保存`, 'success', 3000);
                }
            } catch (error) {
                console.error('保存载具失败:', error);
                if (this.gameEngine && this.gameEngine.ui) {
                    this.gameEngine.ui.showMessage('保存载具失败', 'error', 3000);
                }
            }
        }
    }
    
    loadVehicle() {
        const vehicleName = prompt('请输入要加载的载具名称:', 'My Rocket');
        if (vehicleName) {
            try {
                const vehicleData = localStorage.getItem(`vehicle_${vehicleName}`);
                if (vehicleData) {
                    const data = JSON.parse(vehicleData);
                    this.currentVehicle = Vehicle.deserialize(data);
                    this.renderAssembly();
                    
                    if (this.gameEngine && this.gameEngine.ui) {
                        this.gameEngine.ui.showMessage(`载具 "${vehicleName}" 已加载`, 'success', 3000);
                    }
                } else {
                    if (this.gameEngine && this.gameEngine.ui) {
                        this.gameEngine.ui.showMessage(`未找到载具 "${vehicleName}"`, 'warning', 3000);
                    }
                }
            } catch (error) {
                console.error('加载载具失败:', error);
                if (this.gameEngine && this.gameEngine.ui) {
                    this.gameEngine.ui.showMessage('加载载具失败', 'error', 3000);
                }
            }
        }
    }
    
    launchVehicle() {
        if (!this.currentVehicle || this.currentVehicle.parts.length === 0) {
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage('请先创建一个载具', 'warning', 3000);
            }
            return;
        }
        
        // 验证载具
        const validation = this.currentVehicle.validateForLaunch();
        if (!validation.valid) {
            if (this.gameEngine && this.gameEngine.ui) {
                this.gameEngine.ui.showMessage(`载具验证失败: ${validation.issues.join(', ')}`, 'error', 5000);
            }
            return;
        }
        
        // 切换到飞行场景
        if (this.gameEngine) {
            this.gameEngine.setActiveVehicle(this.currentVehicle);
            this.gameEngine.ui.switchScreen('flight');
        }
    }
    
    deletePart(partId) {
        if (this.currentVehicle) {
            this.currentVehicle.removePart(partId);
            this.selectedPart = null;
            this.renderAssembly();
            this.updatePartInfo(null);
        }
    }
    
    duplicatePart(partId) {
        if (this.currentVehicle) {
            const part = this.currentVehicle.getPart(partId);
            if (part) {
                const newPart = new Part(part.type, part.x + 50, part.y + 50);
                newPart.name = part.name;
                newPart.cost = part.cost;
                this.currentVehicle.addPart(newPart);
                this.renderAssembly();
            }
        }
    }
    
    // 更新部件库显示
    updatePartsLibrary() {
        // 默认显示指令舱分类
        setTimeout(() => {
            const firstCategory = document.querySelector('.category-btn');
            if (firstCategory) {
                firstCategory.click();
            }
        }, 100);
    }
    
    // 清除当前载具
    clearVehicle() {
        this.currentVehicle = null;
        this.selectedPart = null;
        this.renderAssembly();
        this.updatePartInfo(null);
    }
}

// 全局装配UI实例
let assemblyUI = null;
