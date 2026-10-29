@echo off
chcp 932 > nul
title 消耗品補充ワンタップメモ 起動ランチャー

echo ========================================================
echo   消耗品補充ワンタップメモを起動しています...
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Python の確認と起動（推奨）
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo ローカルサーバーを起動しています（ポート 8080）...
    echo ブラウザで http://localhost:8080 を開きます。
    start "" "http://localhost:8080"
    python -m http.server 8080
    pause
    exit /b 0
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    echo ローカルサーバーを起動しています（ポート 8080）...
    echo ブラウザで http://localhost:8080 を開きます。
    start "" "http://localhost:8080"
    py -m http.server 8080
    pause
    exit /b 0
)

:: 2. Node.js の確認と起動（Pythonがない場合のフォールバック）
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo ローカルサーバーを起動しています（ポート 8080）...
    echo ブラウザで http://localhost:8080 を開きます。
    start "" "http://localhost:8080"
    node -e "const http=require('http'),fs=require('fs'),path=require('path'),types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png'};http.createServer((req,res)=>{let f=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(err,data)=>{if(err){res.writeHead(404);res.end('Not Found');return;}res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(data);});}).listen(8080);"
    pause
    exit /b 0
)

:: 3. どちらも見つからない場合のエラー案内
echo [エラー] Python または Node.js が見つかりません。
echo 本アプリ（ES Modules / Service Worker）の動作にはローカルサーバー環境が必要です。
echo Python（https://www.python.org/）または Node.js（https://nodejs.org/）をインストールしてください。
echo.
pause
exit /b 1
