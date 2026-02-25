@echo off
chcp 65001 >nul
echo ==========================================
echo WebView2 运行时 - 自动安装脚本
echo ==========================================
echo.
echo 正在下载 WebView2 运行时安装程序...
echo.

powershell -Command "
\$url = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'
\$installer = Join-Path \$env:TEMP 'MicrosoftEdgeWebview2Setup.exe'

Write-Host '下载中...'
Invoke-WebRequest -Uri \$url -OutFile \$installer -UseBasicParsing

Write-Host '下载完成!'
Write-Host '安装程序已保存到: ' \$installer
Write-Host ''
Write-Host '请运行以下命令安装（需要管理员权限）:'
Write-Host 'Start-Process -FilePath \"' \$installer '\" -ArgumentList \"/silent\",\"/install\" -Verb RunAs -Wait'
Write-Host ''
Write-Host '或者双击运行: ' \$installer
"

echo.
echo ==========================================
echo 按任意键退出...
pause >nul
