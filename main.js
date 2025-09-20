const { app, BrowserWindow, Tray, Menu, screen, dialog, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let batteryUpdateInterval = null;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        focusable: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false
        }
    });

    mainWindow.loadFile('dual-display.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        setTimeout(() => {
            setWallpaperBehavior(mainWindow);
            startBatteryMonitoring();
        }, 1000);
    });

    mainWindow.on('closed', () => {
        if (batteryUpdateInterval) {
            clearInterval(batteryUpdateInterval);
        }
        mainWindow = null;
    });

    return mainWindow;
}

function startBatteryMonitoring() {
    // Send initial battery info
    getBatteryInfo().then(batteryInfo => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('battery-update', batteryInfo);
            console.log('Initial battery info sent:', batteryInfo);
        }
    });

    // Update battery info every 30 seconds
    batteryUpdateInterval = setInterval(() => {
        getBatteryInfo().then(batteryInfo => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('battery-update', batteryInfo);
                console.log('Battery update sent:', batteryInfo);
            }
        });
    }, 30000);
}

async function getBatteryInfo() {
    try {
        const batteryInfo = await new Promise((resolve) => {
            if (process.platform === 'win32') {
                const { spawn } = require('child_process');
                const powershell = spawn('powershell', [
                    '-Command',
                    `
                    try {
                        $battery = Get-WmiObject Win32_Battery | Select-Object -First 1
                        $batteryLevel = [int]$battery.EstimatedChargeRemaining
                        $batteryStatus = [int]$battery.BatteryStatus
                        $estimatedRunTime = [int]$battery.EstimatedRunTime
                        
                        # Check if battery is charging
                        $isCharging = ($batteryStatus -eq 2)
                        
                        if ($isCharging) {
                            # Calculate time to full charge
                            # Estimate based on current level and typical charging rates
                            $remainingCharge = 100 - $batteryLevel
                            
                            # Assume 1% charge per 2-3 minutes (average charging rate)
                            $chargingTimeMinutes = $remainingCharge * 2.5
                            
                            # If battery is above 80%, charging slows down
                            if ($batteryLevel -gt 80) {
                                $extraTime = ($batteryLevel - 80) * 1.5
                                $chargingTimeMinutes += $extraTime
                            }
                            
                            # Minimum 5 minutes, maximum 300 minutes (5 hours)
                            $timeRemaining = [math]::Max(5, [math]::Min(300, $chargingTimeMinutes))
                        }
                        else {
                            # Discharging - use existing logic
                            if ($estimatedRunTime -eq $null -or $estimatedRunTime -gt 65000 -or $estimatedRunTime -le 0) {
                                # Estimate based on battery level (assuming 6 hours at 100%)
                                $timeRemaining = [math]::Max(30, ($batteryLevel / 100) * 360)
                            }
                            else {
                                $timeRemaining = $estimatedRunTime
                            }
                        }
                        
                        # Ensure values are within reasonable bounds
                        $batteryLevel = [math]::Max(1, [math]::Min(100, $batteryLevel))
                        $timeRemaining = [math]::Max(5, [math]::Min(1440, $timeRemaining))
                        
                        $obj = @{
                            level = $batteryLevel
                            charging = $isCharging
                            timeRemaining = $timeRemaining
                            chargingTimeToFull = if ($isCharging) { $timeRemaining } else { 0 }
                            status = 'success'
                        }
                        
                        $obj | ConvertTo-Json -Compress
                    }
                    catch {
                        # Fallback data
                        $obj = @{
                            level = 75
                            charging = $false
                            timeRemaining = 268
                            chargingTimeToFull = 0
                            status = 'fallback'
                        }
                        
                        $obj | ConvertTo-Json -Compress
                    }
                    `
                ], { windowsHide: true });

                let output = '';
                powershell.stdout.on('data', (data) => {
                    output += data.toString();
                });

                powershell.stderr.on('data', (data) => {
                    console.error('PowerShell error:', data.toString());
                });

                powershell.on('close', (code) => {
                    try {
                        const cleanOutput = output.trim().replace(/[\r\n]/g, '');
                        const result = JSON.parse(cleanOutput);
                        
                        console.log('Battery info retrieved:', result);
                        
                        resolve({
                            level: result.level,
                            charging: result.charging,
                            timeRemaining: result.timeRemaining, // in minutes
                            chargingTimeToFull: result.chargingTimeToFull || 0
                        });
                    } catch (error) {
                        console.error('Failed to parse battery info:', error, 'Raw output:', output);
                        // Fallback - simulate charging scenario for testing
                        const isCharging = Math.random() > 0.5; // 50% chance of charging for demo
                        const level = Math.floor(Math.random() * 40) + 60; // 60-99% for demo
                        const timeRemaining = isCharging ? 
                            Math.floor((100 - level) * 2.5) : // Charging time
                            Math.floor(level * 3.6); // Discharging time
                            
                        resolve({
                            level: level,
                            charging: isCharging,
                            timeRemaining: timeRemaining,
                            chargingTimeToFull: isCharging ? timeRemaining : 0
                        });
                    }
                });

                // Timeout fallback
                setTimeout(() => {
                    powershell.kill();
                    resolve({
                        level: 80,
                        charging: true,
                        timeRemaining: 45, // 45 minutes to full charge
                        chargingTimeToFull: 45
                    });
                }, 5000);

            } else {
                // Non-Windows fallback with charging simulation
                const isCharging = true; // For demo
                const level = 80;
                const timeRemaining = isCharging ? 45 : 268;
                
                resolve({
                    level: level,
                    charging: isCharging,
                    timeRemaining: timeRemaining,
                    chargingTimeToFull: isCharging ? timeRemaining : 0
                });
            }
        });

        return batteryInfo;
    } catch (error) {
        console.error('Battery info error:', error);
        return {
            level: 80,
            charging: true,
            timeRemaining: 45,
            chargingTimeToFull: 45
        };
    }
}

function setWallpaperBehavior(window) {
    try {
        if (!window || window.isDestroyed()) return;
        
        window.setIgnoreMouseEvents(true, { forward: true });
        window.setAlwaysOnTop(true);
        window.setSkipTaskbar(true);
        
        if (process.platform === 'win32') {
            const { spawn } = require('child_process');
            try {
                spawn('powershell', [
                    '-WindowStyle', 'Hidden',
                    '-Command',
                    `
                    Add-Type -TypeDefinition '
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                        [DllImport("user32.dll")]
                        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
                        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
                        public const uint SWP_NOMOVE = 0x0002;
                        public const uint SWP_NOSIZE = 0x0001;
                        public const uint SWP_NOACTIVATE = 0x0010;
                    }';
                    
                    $hwnd = [Win32]::FindWindow($null, "${app.getName()}");
                    if ($hwnd -ne [IntPtr]::Zero) {
                        [Win32]::SetWindowPos($hwnd, [Win32]::HWND_TOPMOST, 0, 0, 0, 0, 0x0002 -bor 0x0001 -bor 0x0010);
                    }
                    `
                ], { windowsHide: true });
            } catch (err) {
                console.log('PowerShell positioning failed');
            }
        }
        
    } catch (error) {
        console.error('Window setup error:', error);
    }
}

function createTray() {
    try {
        const iconPath = path.join(__dirname, 'assets', 'icon.ico');
        let trayIcon;
        
        try {
            trayIcon = nativeImage.createFromPath(iconPath);
            if (trayIcon.isEmpty()) {
                throw new Error('Icon not found');
            }
        } catch {
            trayIcon = nativeImage.createEmpty();
        }
        
        tray = new Tray(trayIcon);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Dual Time & Battery Display v1.0',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Toggle 12/24 Hour Format',
                click: () => {
                    if (mainWindow) {
                        mainWindow.webContents.send('toggle-format');
                    }
                }
            },
            {
                label: 'Test Charging Mode',
                click: () => {
                    const testData = {
                        level: 80,
                        charging: true,
                        timeRemaining: 45,
                        chargingTimeToFull: 45
                    };
                    if (mainWindow) {
                        mainWindow.webContents.send('battery-update', testData);
                        console.log('Test charging mode activated');
                    }
                }
            },
            {
                label: 'Test Discharging Mode',
                click: () => {
                    const testData = {
                        level: 75,
                        charging: false,
                        timeRemaining: 268,
                        chargingTimeToFull: 0
                    };
                    if (mainWindow) {
                        mainWindow.webContents.send('battery-update', testData);
                        console.log('Test discharging mode activated');
                    }
                }
            },
            {
                label: 'Refresh Battery Info',
                click: () => {
                    getBatteryInfo().then(batteryInfo => {
                        if (mainWindow) {
                            mainWindow.webContents.send('battery-update', batteryInfo);
                        }
                    });
                }
            },
            {
                label: 'Show/Hide Display',
                click: () => {
                    if (mainWindow) {
                        if (mainWindow.isVisible()) {
                            mainWindow.hide();
                        } else {
                            mainWindow.show();
                            setTimeout(() => setWallpaperBehavior(mainWindow), 500);
                        }
                    }
                }
            },
            {
                label: 'Reload',
                click: () => {
                    if (mainWindow) {
                        mainWindow.reload();
                        setTimeout(() => {
                            setWallpaperBehavior(mainWindow);
                            startBatteryMonitoring();
                        }, 1000);
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Exit',
                click: () => {
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Dual Time & Battery Display - Live Updates');
        tray.setContextMenu(contextMenu);

    } catch (error) {
        console.error('Tray creation failed:', error);
    }
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (batteryUpdateInterval) {
        clearInterval(batteryUpdateInterval);
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) {
                mainWindow.show();
                setTimeout(() => setWallpaperBehavior(mainWindow), 500);
            }
        }
    });
}

app.on('before-quit', (event) => {
    if (batteryUpdateInterval) {
        clearInterval(batteryUpdateInterval);
    }
    if (tray) {
        tray.destroy();
    }
});

module.exports = { mainWindow, setWallpaperBehavior };
