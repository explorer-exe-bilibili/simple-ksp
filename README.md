# Simple KSP - 网页版坎巴拉太空计划

一个基于HTML5/JavaScript的简化版坎巴拉太空计划（Kerbal Space Program），实现了火箭设计、发射、轨道力学等核心功能。

## 🚀 最新更新

- ✅ **完整的UI系统** - 新增装配厂UI和飞行UI组件
- ✅ **交互式载具装配** - 支持拖拽式部件装配和载具设计
- ✅ **完整的飞行控制** - 包含HUD、导航球、资源监控等
- ✅ **一键启动脚本** - 提供Windows和Linux启动脚本
- ✅ **功能测试页面** - 包含完整的功能测试和调试工具

## 🎮 快速开始

### 方法1: 使用启动脚本（推荐）

**Windows:**
```batch
双击 start.bat 文件
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

### 方法2: 手动启动

1. 确保已安装Python 3.x
2. 在项目目录中打开终端
3. 运行以下命令:

```bash
# Windows
python -m http.server 8000

# Linux/macOS
python3 -m http.server 8000
```

4. 打开浏览器访问 http://localhost:8000

## 🚀 功能特性

### 核心功能
- **载具装配厂 (VAB)** - 拖拽式载具设计系统
- **飞行模拟** - 真实的物理引擎和轨道力学
- **任务系统** - 多样化的太空任务和目标
- **跟踪站** - 太阳系视图和载具跟踪
- **多天体系统** - Kerbin、Mun、Minmus等天体

### 技术特性
- 纯HTML5 + JavaScript实现
- Canvas 2D渲染引擎
- 实时物理模拟
- 响应式UI设计
- 本地存储支持

## 🎮 游戏控制

### 飞行控制
- **WASD** - 载具姿态控制（俯仰/偏航）
- **QE** - 滚转控制
- **Shift/Ctrl** - 推力控制
- **Space** - 分离下一级
- **X** - 推力归零
- **Z** - 推力最大

### 系统控制
- **T** - 切换SAS稳定系统
- **R** - 切换RCS推进器
- **G** - 切换起落架
- **U** - 切换灯光
- **B** - 切换刹车

### 视图控制
- **M** - 切换地图/飞行视图
- **鼠标滚轮** - 缩放视角
- **鼠标右键拖拽** - 控制载具姿态

### 时间控制
- **,** - 减少时间加速
- **.** - 增加时间加速  
- **/** - 停止时间加速

## 📁 项目结构

```
simple-ksp/
├── index.html              # 主HTML文件
├── css/
│   ├── style.css           # 主样式文件
│   └── ui.css              # UI组件样式
├── js/
│   ├── core/              # 核心引擎
│   │   ├── GameEngine.js   # 游戏引擎
│   │   ├── Physics.js      # 物理引擎
│   │   ├── Renderer.js     # 渲染引擎
│   │   └── Input.js        # 输入管理
│   ├── game/              # 游戏逻辑
│   │   ├── CelestialBody.js # 天体系统
│   │   ├── Part.js         # 部件系统
│   │   ├── Vehicle.js      # 载具系统
│   │   └── Mission.js      # 任务系统
│   ├── ui/               # 用户界面
│   │   └── UIManager.js    # UI管理器
│   └── main.js            # 主入口文件
└── README.md              # 项目说明
```

## 🛠️ 开发说明

### 技术栈
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **渲染**: Canvas 2D API
- **存储**: localStorage API
- **架构**: 模块化设计

### 核心系统

#### 1. 游戏引擎 (GameEngine)
- 游戏循环管理
- 场景切换
- 状态管理
- 时间控制

#### 2. 物理引擎 (PhysicsEngine)  
- 万有引力模拟
- 大气阻力计算
- 轨道力学
- 碰撞检测

#### 3. 渲染引擎 (RenderEngine)
- Canvas绘图
- 摄像机系统
- 场景渲染
- UI绘制

#### 4. 部件系统 (Part)
- 指令舱、燃料罐、引擎等
- 资源管理
- 分级系统
- 部件连接

#### 5. 载具系统 (Vehicle)
- 部件组装
- 飞行控制
- 系统管理
- 状态监控

#### 6. 任务系统 (Mission)
- 目标设定
- 进度跟踪
- 奖励系统
- 成就解锁

## 🎯 游戏目标

### 初级任务
1. **第一次飞行** - 到达10,000米高度
2. **突破大气层** - 到达70,000米太空边界
3. **进入轨道** - 建立稳定的Kerbin轨道

### 中级任务
4. **登陆Mun** - 成功登陆Kerbin的卫星
5. **Mun往返** - 登陆并返回Kerbin
6. **探索Minmus** - 访问薄荷绿卫星

### 高级任务
7. **建设空间站** - 在轨道建造空间站
8. **星际探索** - 前往其他行星
9. **载人任务** - 完成载人往返任务

## 🚀 快速开始

1. **下载项目文件**
2. **打开index.html** - 使用现代浏览器打开
3. **开始游戏** - 点击"载具装配厂"开始设计火箭

### 系统要求
- 现代浏览器 (Chrome 70+, Firefox 65+, Safari 12+, Edge 79+)
- 支持HTML5 Canvas
- 支持ES6 JavaScript
- 支持localStorage API

## 🔧 调试功能

在URL中添加 `?debug` 参数或在本地主机运行时，可使用调试命令：

```javascript
// 设置载具高度
debugCommands.setAltitude(100000);

// 设置载具速度
debugCommands.setVelocity(0, 100, 0);

// 添加燃料
debugCommands.addFuel(1000);

// 设置时间加速
debugCommands.setTimeScale(10);

// 完成所有任务目标
debugCommands.completeAllObjectives();

// 查看性能统计
debugCommands.getPerformanceStats();

// 显示帮助
debugCommands.help();
```

## 📝 更新日志

### v1.0.0 (2024-12-11)
- ✨ 初始版本发布
- 🚀 基础载具装配功能
- 🌍 物理引擎和轨道模拟
- 🎯 任务系统
- 📱 响应式UI设计

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进游戏！

### 开发建议
1. 保持代码整洁和注释清晰
2. 遵循现有的代码风格
3. 测试新功能的兼容性
4. 更新相关文档

## 📄 许可证

本项目基于MIT许可证开源。

## 🙏 致谢

- 感谢Squad开发的原版Kerbal Space Program
- 感谢所有太空探索爱好者的灵感
- 感谢Web技术社区的支持

## 🌟 路线图

### 短期计划
- [ ] 更多部件类型
- [ ] 改进物理模拟
- [ ] 音效和音乐
- [ ] 移动端适配

### 长期计划
- [ ] 多人模式
- [ ] Mod支持
- [ ] 3D渲染
- [ ] 更多天体

---

**开始你的太空之旅吧！** 🚀✨

如有问题或建议，请提交Issue或联系开发者。

祝飞行愉快！- Kerbal太空计划团队
