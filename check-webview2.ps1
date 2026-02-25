# 检查 WebView2 运行时状态
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WebView2 运行时检查工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 方法1：检查 Appx 包
Write-Host "[1] 检查 Appx WebView2 包..." -ForegroundColor Yellow
try {
    $webview2 = Get-AppxPackage -Name *WebView2* -ErrorAction SilentlyContinue
    if ($webview2) {
        Write-Host "    找到 WebView2:" -ForegroundColor Green
        $webview2 | ForEach-Object {
            Write-Host "    - 名称: $($_.Name)" -ForegroundColor White
            Write-Host "      版本: $($_.Version)" -ForegroundColor White
            Write-Host "      路径: $($_.InstallLocation)" -ForegroundColor White
        }
    } else {
        Write-Host "    未找到 Appx WebView2 包（这是正常的，使用独立安装版）" -ForegroundColor Gray
    }
} catch {
    Write-Host "    检查失败: $_" -ForegroundColor Red
}
Write-Host ""

# 方法2：检查注册表（独立安装版）
Write-Host "[2] 检查注册表中的 WebView2..." -ForegroundColor Yellow
$paths = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
$found = $false
foreach ($path in $paths) {
    if (Test-Path $path) {
        $version = (Get-ItemProperty $path -ErrorAction SilentlyContinue).pv
        if ($version) {
            Write-Host "    找到独立安装版:" -ForegroundColor Green
            Write-Host "    版本: $version" -ForegroundColor White
            $found = $true
        }
    }
}
if (-not $found) {
    Write-Host "    注册表中未找到 WebView2" -ForegroundColor Red
}
Write-Host ""

# 方法3：检查核心 DLL 文件
Write-Host "[3] 检查 WebView2 核心 DLL..." -ForegroundColor Yellow
$dllPaths = @(
    "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application\*\msedgewebview2.exe",
    "${env:ProgramFiles}\Microsoft\EdgeWebView\Application\*\msedgewebview2.exe"
)
$dllFound = $false
foreach ($path in $dllPaths) {
    $files = Get-Item $path -ErrorAction SilentlyContinue
    if ($files) {
        Write-Host "    找到 WebView2 可执行文件:" -ForegroundColor Green
        $files | ForEach-Object {
            Write-Host "    - $($_.FullName)" -ForegroundColor White
            $dllFound = $true
        }
    }
}
if (-not $dllFound) {
    Write-Host "    未找到 WebView2 文件" -ForegroundColor Red
}
Write-Host ""

# 总结
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "检查结果" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
if ($webview2 -or $found -or $dllFound) {
    Write-Host "状态: WebView2 已安装" -ForegroundColor Green
    Write-Host ""
    Write-Host "如果仍然无法安装应用，可能是以下原因：" -ForegroundColor Yellow
    Write-Host "1. Windows 10 版本过低（需要 1809 或更高版本）" -ForegroundColor White
    Write-Host "2. 应用在 Win11 上构建时使用了不兼容的 API" -ForegroundColor White
    Write-Host "3. 建议在当前 Win10 电脑上重新构建应用" -ForegroundColor White
} else {
    Write-Host "状态: WebView2 未安装" -ForegroundColor Red
    Write-Host ""
    Write-Host "请下载并安装 WebView2 运行时：" -ForegroundColor Yellow
    Write-Host "https://developer.microsoft.com/en-us/microsoft-edge/webview2/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "或使用以下 PowerShell 命令下载（需要 winget）：" -ForegroundColor Yellow
    Write-Host "winget install Microsoft.EdgeWebView2Runtime" -ForegroundColor Cyan
}
Write-Host "========================================" -ForegroundColor Cyan
