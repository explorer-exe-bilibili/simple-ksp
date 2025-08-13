# 多语言支持 (i18n) 使用指南

## 概述

Web Space Program 项目现已支持多语言国际化，目前支持简体中文和英文两种语言。

## 文件结构

```
js/i18n/
├── i18n.js                 # 国际化核心库
├── language-switcher.js    # 语言切换组件
├── i18n-parts.js          # 部件数据国际化管理器
└── locales/
    ├── zh-CN.js            # 中文语言包
    └── en-US.js            # 英文语言包
```

## 快速开始

### 1. 在HTML页面中引入国际化支持

```html
<!-- 引入国际化CSS样式 -->
<link rel="stylesheet" href="css/i18n.css">

<!-- 在页面中添加语言切换器容器 -->
<div id="languageSwitcher" class="language-switcher top-right"></div>

<!-- 在页面底部引入JavaScript -->
<script src="js/i18n/i18n.js"></script>
<script src="js/i18n/language-switcher.js"></script>
<script src="js/i18n/i18n-parts.js"></script>

<!-- 初始化国际化 -->
<script>
document.addEventListener('DOMContentLoaded', async () => {
    await window.i18n.init();
    await window.i18nRocketParts.init();
    
    // 创建语言切换器
    new LanguageSwitcher('#languageSwitcher', {
        style: 'simple',
        showFlag: true,
        showText: false
    });
});
</script>
```

### 2. 在HTML中使用翻译标记

```html
<!-- 普通文本翻译 -->
<h1 data-i18n="main.gameTitle">网页太空计划</h1>

<!-- HTML内容翻译 -->
<p data-i18n-html="rocketBuilder.connectivity.rootConnected">
    💡 只有与<span class="root-part-highlight">根部件</span>连通的部件参与计算
</p>

<!-- 输入框占位符翻译 -->
<input type="text" data-i18n-placeholder="rocketBuilder.partsLibrary.searchPlaceholder">

<!-- 标题属性翻译 -->
<button data-i18n-title="common.help">帮助</button>

<!-- 页面标题翻译 -->
<html data-i18n-title="main.gameTitle">
```

### 3. 在JavaScript中使用翻译

```javascript
// 获取翻译文本
const title = window.i18n.t('main.gameTitle');

// 带参数的翻译
const message = window.i18n.t('notifications.partAdded', { partName: '引擎' });

// 格式化数字和日期
const formattedNumber = window.i18n.formatNumber(12345.67);
const formattedDate = window.i18n.formatDate(new Date());

// 获取当前语言
const currentLang = window.i18n.getCurrentLanguage();

// 切换语言
await window.i18n.setLanguage('en-US');
```

## 语言切换器

### 样式类型

1. **简单按钮** (默认)
```javascript
new LanguageSwitcher('#container', {
    style: 'simple',
    showFlag: true,
    showText: false
});
```

2. **下拉菜单**
```javascript
new LanguageSwitcher('#container', {
    style: 'dropdown',
    showFlag: true,
    showText: true
});
```

3. **按钮组**
```javascript
new LanguageSwitcher('#container', {
    style: 'buttons',
    showFlag: true,
    showText: true
});
```

### 定位选项

- `top-right` - 右上角 (默认)
- `top-left` - 左上角
- `bottom-right` - 右下角
- `bottom-left` - 左下角

## 添加新的翻译

### 1. 在语言包中添加翻译键

在 `locales/zh-CN.js` 中：
```javascript
export default {
    newSection: {
        title: '新标题',
        description: '新描述'
    }
};
```

在 `locales/en-US.js` 中：
```javascript
export default {
    newSection: {
        title: 'New Title',
        description: 'New Description'
    }
};
```

### 2. 在HTML或JavaScript中使用

```html
<h1 data-i18n="newSection.title">新标题</h1>
```

```javascript
const title = window.i18n.t('newSection.title');
```

## 部件数据国际化

火箭部件的名称和描述会自动根据当前语言进行翻译。部件数据的翻译在 `parts` 命名空间下定义：

```javascript
// 语言包中的部件翻译
parts: {
    commandPod: {
        name: 'Mk1 Command Pod',
        description: 'Basic crew capsule, holds 1 Kerbal'
    }
}
```

## 监听语言切换事件

```javascript
window.addEventListener('languageChanged', (event) => {
    const newLanguage = event.detail.language;
    console.log('语言已切换到:', newLanguage);
    
    // 更新自定义内容
    updateCustomContent();
});
```

## 支持的语言

- `zh-CN` - 简体中文
- `en-US` - English

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 性能考虑

- 语言包会根据需要按需加载
- 切换语言时，只更新页面中标记的元素
- 部件数据会在语言切换时自动更新

## 自定义样式

可以通过修改 `css/i18n.css` 来自定义语言切换器的外观：

```css
.language-switcher {
    /* 自定义样式 */
}
```

## 故障排除

1. **翻译不生效**
   - 检查是否正确引入了国际化脚本
   - 确认翻译键是否存在于语言包中
   - 查看浏览器控制台是否有错误

2. **语言切换器不显示**
   - 确认容器元素存在
   - 检查CSS样式是否正确加载
   - 确认JavaScript没有错误

3. **部件翻译不工作**
   - 确保 `i18n-parts.js` 已加载
   - 检查部件ID映射是否正确

## 贡献新语言

要添加新语言支持：

1. 在 `locales/` 目录下创建新的语言文件，如 `ja-JP.js`
2. 翻译所有文本内容
3. 在 `i18n.js` 中添加语言到支持列表
4. 在 `language-switcher.js` 中添加语言信息
5. 测试所有功能
