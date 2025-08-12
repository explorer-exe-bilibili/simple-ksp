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
    init() {
        this.canvas = document.getElementById('assemblyCanvas');
        if (!this.canvas) {
            console.error('找不到装配画布元素');
            return;
        }

        this.setupCanvas();
        this.setupEventListeners();
        this.loadPartsPanel();
        this.updateUI();
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

        // 计算放置位置
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.canvasOffset.x) / this.canvasZoom;
        const y = (e.clientY - rect.top - this.canvasOffset.y) / this.canvasZoom;
        
        // 网格吸附
        let position = { x, y };
        if (this.snapToGrid) {
            position.x = Math.round(position.x / this.gridSize) * this.gridSize;
            position.y = Math.round(position.y / this.gridSize) * this.gridSize;
        }

        // 添加部件到组装中
        const assemblyPart = this.assembly.addPart(this.draggedPart, position);
        this.addPartToCanvas(assemblyPart);
        this.updateUI();
        
        this.draggedPart = null;
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

        // 鼠标按下开始拖拽
        const handleMouseDown = (e) => {
            if (e.button !== 0) return; // 只响应左键

            isDragging = true;
            hasMoved = false;
            partElement.classList.add('dragging');
            
            // 计算鼠标相对于部件的偏移
            const rect = partElement.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
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
            let newX = (e.clientX - canvasRect.left - dragOffset.x) / this.canvasZoom;
            let newY = (e.clientY - canvasRect.top - dragOffset.y) / this.canvasZoom;

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
                }
                
                // 更新组装数据
                this.assembly.modified = new Date();
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
        infoPanel.innerHTML = `
            <div class="selected-part-details">
                <h4>${part.name}</h4>
                <p class="part-description">${part.description}</p>
                <div class="part-properties">
                    <div class="property-item">
                        <label>质量:</label>
                        <span>${part.mass} t</span>
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

    // 处理画布缩放
    handleCanvasZoom(e) {
        if (!e.ctrlKey) return;
        
        e.preventDefault();
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        this.canvasZoom = Math.max(0.3, Math.min(3.0, this.canvasZoom * zoomFactor));
        
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

function undoLastAction() {
    console.log('撤销功能开发中...');
    // TODO: 实现撤销功能
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
            showNotification('装配大楼', '欢迎来到载具装配大楼！拖拽左侧部件开始设计。', 'welcome');
        }
    }, 500);
});
