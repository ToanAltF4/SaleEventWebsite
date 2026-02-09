@echo off
title Săn Sale Cùng Kim Ngân - Server
echo ========================================
echo   Đang khởi động kimngan.site...
echo ========================================

:: Chạy Flask ở background
start "Flask Server" cmd /k "cd /d D:\web-ngan\SaleEventWebsite && python app.py"

:: Đợi Flask khởi động xong
timeout /t 5 /nobreak >nul

:: Chạy Cloudflared Tunnel
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run 4a1b7b96-8713-4861-8284-fe9c17688055"

echo ========================================
echo   kimngan.site đã online!
echo   Đừng tắt 2 cửa sổ terminal nhé.
echo ========================================
