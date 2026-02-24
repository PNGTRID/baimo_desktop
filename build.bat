@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" arm64
set PATH=C:\Program Files\LLVM\bin;%PATH%
cd /d C:\Users\Ruiqin\Desktop\baimo_desktop
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
frontend\node_modules\.bin\tauri.cmd build
