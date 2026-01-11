#!/bin/bash
# 白墨记账 - Tauri 完整开发环境启动脚本

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

PORT=14200

echo "🔍 检查端口 $PORT 是否被占用..."

PIDS=$(lsof -ti:$PORT 2>/dev/null)

if [ -n "$PIDS" ]; then
    echo "⚠️  端口 $PORT 被占用 (PID: $PIDS)"
    echo "🧹 正在清理..."
    kill $PIDS 2>/dev/null
    sleep 1
    echo "✅ 端口已释放"
else
    echo "✅ 端口 $PORT 可用"
fi

echo ""
echo "🚀 启动 Tauri 开发环境..."
echo "========================"
echo "📦 前端服务器启动中..."

# 后台启动前端开发服务器
cd "$PROJECT_ROOT/frontend" && npm run dev > /tmp/baimo-frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端服务器启动（最多等待 10 秒）
echo "⏳ 等待前端服务器就绪..."
for i in {1..10}; do
    if curl -s http://localhost:$PORT > /dev/null 2>&1; then
        echo "✅ 前端服务器已就绪 (PID: $FRONTEND_PID)"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 前端服务器启动超时，请检查 /tmp/baimo-frontend.log"
        exit 1
    fi
    sleep 1
done

echo ""
echo "🦀 启动 Tauri 后端..."
echo "===================="

# 启动 Tauri（前台运行）
cd "$PROJECT_ROOT/src-tauri" && cargo run

# Tauri 退出后清理前端进程
echo ""
echo "🧹 清理前端进程 (PID: $FRONTEND_PID)..."
kill $FRONTEND_PID 2>/dev/null
echo "✅ 开发环境已关闭"
