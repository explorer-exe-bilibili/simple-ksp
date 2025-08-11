#!/bin/bash

echo "Simple KSP - 网页版坎巴拉太空计划"
echo "================================"
echo
echo "正在启动本地HTTP服务器..."
echo "游戏地址: http://localhost:8000"
echo "测试页面: http://localhost:8000/test.html"
echo
echo "按 Ctrl+C 停止服务器"
echo

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "错误: 未找到Python。请安装Python 3.x。"
        exit 1
    else
        PYTHON_CMD="python"
    fi
else
    PYTHON_CMD="python3"
fi

# 进入脚本所在目录
cd "$(dirname "$0")"

# 启动HTTP服务器
$PYTHON_CMD -m http.server 8000
