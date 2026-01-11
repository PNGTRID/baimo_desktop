#!/bin/bash
# 白墨记账 - 自动清理端口并启动开发服务器

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
echo "🚀 启动开发服务器..."
echo "===================="

cd frontend && npm run dev
