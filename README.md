# KSP Web - 坎巴拉太空计划网页版

一个基于网页技术实现的坎巴拉太空计划（Kerbal Space Program）游戏。

## 功能特性

- 🚀 **载具装配大楼** - 设计和建造火箭载具
- 🛰️ **追踪站** - 监控任务和载具状态
- 🌍 **多语言支持** - 支持中文和英文界面切换
- ⭐ **美观UI** - 深蓝色星空背景与动画效果
- 📱 **响应式设计** - 支持各种设备尺寸
- ⌨️ **键盘支持** - 支持快捷键操作

## 技术栈

- HTML5
- CSS3 (动画、网格布局、响应式设计)
- 原生JavaScript
- SVG图标

## 当前进度

✅ 主页面设计完成  
✅ 多语言支持系统 (中文/英文)
🔄 载具装配功能开发中  
🔄 追踪站功能开发中  

## 多语言功能

项目支持完整的国际化功能：

- 🇨🇳 **简体中文** - 完整的中文界面
- 🇺🇸 **English** - Full English interface
- 🔄 **实时切换** - 无需刷新页面即可切换语言
- 💾 **记忆设置** - 自动保存并恢复语言选择
- 🎯 **智能检测** - 自动检测浏览器语言设置

访问 [多语言演示页面](demo-i18n.html) 查看详细功能展示。

## 快捷键

- `1` - 进入载具装配大楼
- `2` - 进入追踪站
- `F11` - 切换全屏模式
- `Esc` - 返回/退出

## 浏览器支持

- Chrome/Edge 80+
- Firefox 70+
- Safari 13+

## 开发说明

项目结构：

```text
simple-ksp/
├── index.html              # 主页面
├── rocket-builder.html     # 载具装配页面
├── launch-pad.html        # 发射台页面
├── demo-i18n.html         # 多语言演示页面
├── css/
│   ├── style.css          # 主样式文件
│   ├── rocket-builder.css # 装配页面样式
│   ├── launch-pad.css     # 发射台样式
│   └── i18n.css          # 国际化样式
├── js/
│   ├── main.js           # 主要脚本
│   ├── rocket-builder.js # 装配功能
│   ├── rocket-parts.js   # 部件数据
│   ├── launch-pad.js     # 发射功能
│   └── i18n/            # 国际化系统
│       ├── i18n.js      # 核心国际化库
│       ├── language-switcher.js # 语言切换组件
│       ├── i18n-parts.js # 部件数据国际化
│       └── locales/      # 语言包
│           ├── zh-CN.js  # 中文语言包
│           └── en-US.js  # 英文语言包
├── svg/                  # SVG图标文件
├── INTERNATIONALIZATION.md # 国际化使用指南
└── README.md            # 项目说明
```

## 未来计划

- [ ] 火箭零件系统
- [ ] 物理引擎集成
- [ ] 轨道计算
- [ ] 3D渲染支持
- [ ] 保存/加载功能
- [ ] 多人游戏支持
