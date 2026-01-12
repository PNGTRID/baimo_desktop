#!/bin/bash
# 在打包前复制数据库文件到资源目录

PROJECT_DIR="$(dirname "$(dirname "$0")")/.."
mkdir -p "$PROJECT_DIR/target/release/bundle/resources"
cp "$PROJECT_DIR/prisma/dev.db" "$PROJECT_DIR/target/release/bundle/resources/dev.db" 2>/dev/null || echo "No dev.db found"
