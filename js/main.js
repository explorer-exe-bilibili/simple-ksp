// 主菜单处理函数
function handleMenuClick(menuType) {
    console.log(`点击了 ${menuType} 菜单`);
    
    // 添加点击动画效果
    const clickedButton = event.target.closest('.menu-item');
    if (clickedButton) {
        clickedButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
            clickedButton.style.transform = '';
        }, 150);
    }
    
    // 根据菜单类型处理不同逻辑
    switch(menuType) {
        case 'rocket-builder':
            showNotification('main.rocketBuilder.title', 'rocketBuilder.notifications.launched', 'rocket');
            // 跳转到火箭建造页面
            setTimeout(() => {
                window.location.href = 'rocket-builder.html';
            }, 1000);
            break;
            
        case 'tracking-station':
            showNotification('main.trackingStation.title', 'main.comingSoon', 'tracking');
            // TODO: 跳转到追踪站页面
            setTimeout(() => {
                const message = window.i18n ? window.i18n.t('main.comingSoon') : '即将推出！';
                alert(message);
            }, 1000);
            break;
            
        default:
            console.log('未知菜单类型:', menuType);
    }
}

// 显示通知函数
function showNotification(titleKey, messageKey, type) {
    // 获取翻译文本
    const title = window.i18n ? window.i18n.t(titleKey) : titleKey;
    const message = window.i18n ? window.i18n.t(messageKey) : messageKey;
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
    
    // 添加通知样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(79, 195, 247, 0.9)',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        zIndex: '9999',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        minWidth: '300px',
        maxWidth: '400px'
    });
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// 添加键盘支持
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case '1':
            handleMenuClick('rocket-builder');
            break;
        case '2':
            handleMenuClick('tracking-station');
            break;
        case 'Escape':
            // 可以用于返回或退出
            console.log('按下了 Escape 键');
            break;
    }
});

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('KSP Web 游戏已加载');
    
    // 添加鼠标跟踪效果（可选）
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // 为星星添加视差效果
        const stars = document.querySelectorAll('.star');
        stars.forEach((star, index) => {
            const speed = (index % 3 + 1) * 0.01;
            const x = (mouseX * speed);
            const y = (mouseY * speed);
            star.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
    
    // 添加页面可见性检测，页面不可见时暂停动画
    document.addEventListener('visibilitychange', () => {
        const stars = document.querySelectorAll('.star');
        const planets = document.querySelectorAll('.planet');
        
        if (document.hidden) {
            // 页面不可见时暂停动画
            stars.forEach(star => {
                star.style.animationPlayState = 'paused';
            });
            planets.forEach(planet => {
                planet.style.animationPlayState = 'paused';
            });
        } else {
            // 页面可见时恢复动画
            stars.forEach(star => {
                star.style.animationPlayState = 'running';
            });
            planets.forEach(planet => {
                planet.style.animationPlayState = 'running';
            });
        }
    });
    
    // 显示欢迎信息
    setTimeout(() => {
        showNotification('notifications.welcome.title', 'notifications.welcome.message', 'welcome');
    }, 500);
});

// 防止右键菜单（可选，增强游戏体验）
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// 添加全屏支持（可选）
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// 可以通过 F11 或 Ctrl+F 切换全屏
document.addEventListener('keydown', (e) => {
    if (e.key === 'F11' || (e.ctrlKey && e.key === 'f')) {
        e.preventDefault();
        toggleFullscreen();
    }
});
