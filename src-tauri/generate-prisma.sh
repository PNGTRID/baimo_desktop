#!/bin/bash
# prisma-client-rust 生成脚本
# 这是一个包装脚本，用于调用 prisma-client-rust 生成器

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRISMA_CLI="$SCRIPT_DIR/target/debug/prisma"

if [ ! -f "$PRISMA_CLI" ]; then
    echo "Error: prisma CLI not found at $PRISMA_CLI"
    echo "Please run: cargo build --bin prisma --features prisma-cli"
    exit 1
fi

"$PRISMA_CLI" generate "$@"
