@echo off
REM Qually Testnet Deployment Script (Windows)
REM Run this after obtaining testnet SUI from the faucet

echo === Qually Testnet Deployment ===
echo.

REM Check sui is installed
where sui >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: sui CLI not found. Install from https://sui.io
    exit /b 1
)

REM Check active network
for /f "tokens=*" %%i in ('sui client active-env') do set ACTIVE_ENV=%%i
echo Active network: %ACTIVE_ENV%

if "%ACTIVE_ENV%" neq "testnet" (
    echo Switching to testnet...
    sui client switch --env testnet
)

REM Check balance
echo Checking balance...
sui client balance

echo.
echo Building contracts...
sui move build --path .

echo.
echo Publishing to testnet...
echo This will use ~1 SUI for gas and storage deposit.
echo.

sui client publish --gas-budget 100000000 .

echo.
echo === DEPLOYMENT COMPLETE ===
echo.
echo Next steps:
echo 1. Copy the Package ID from the output above
echo 2. Update FrontendIntegration.md with the address
echo 3. Verify on Sui Explorer: https://suiexplorer.com/network/testnet
echo.
echo Check the deploy output above for the Treasury object address.
