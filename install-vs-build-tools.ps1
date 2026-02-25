@echo off
chcp 65001 >nul
echo ==========================================
echo Visual Studio Build Tools 2022 安装
echo ==========================================
echo.
echo 这是构建 Tauri 应用所需的 C++ 编译工具链
echo 下载大小约 4-5 MB，安装后约 2-3 GB
echo.
echo 安装完成后请重新运行构建命令
echo ==========================================
echo.

powershell -Command "
# Visual Studio Build Tools 下载链接
\$url = 'https://aka.ms/vs/17/release/vs_buildtools.exe'
\$output = '\$env:TEMP\vs_buildtools.exe'

Write-Host '正在下载 Visual Studio Build Tools...'
Invoke-WebRequest -Uri \$url -OutFile \$output -UseBasicParsing

Write-Host '下载完成!'
Write-Host ''
Write-Host '安装程序已保存到: ' \$output
Write-Host ''
Write-Host '正在启动安装程序...'
Write-Host ''
Write-Host '请勾选以下组件:'
Write-Host '  - 使用 C++ 的桌面开发'
Write-Host '  - MSVC v143 - VS 2022 C++ x64/x86 生成工具 (最新)'
Write-Host '  - Windows 11 SDK (或 Windows 10 SDK)'
Write-Host ''

Start-Process \$output -ArgumentList '--quiet', '--wait', '--norestart', '--nocache', '--add', 'Microsoft.VisualStudio.Workload.VCTools', '--includeRecommended'
"

echo.
echo ==========================================
echo 安装程序正在后台运行...
echo 请等待安装完成后再运行构建
echo ==========================================
pause
