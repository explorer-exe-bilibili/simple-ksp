@echo off
echo Simple KSP - 网页版坎巴拉太空计划
echo ================================
echo.
echo 正在启动本地HTTP服务器...
echo 游戏地址: http://localhost:8000
echo 测试页面: http://localhost:8000/test.html
echo.
echo 按 Ctrl+C 停止服务器
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python。请安装Python 3.x并将其添加到PATH中。
    pause
    exit /b 1
)

REM 启动HTTP服务器
cd /d "%~dp0"
python -m http.server 8000
