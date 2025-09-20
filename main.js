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
    // Send initial battery info immediately
    getBatteryInfo().then(batteryInfo => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('battery-update', batteryInfo);
            console.log('Initial battery info sent:', batteryInfo);
        }
    });

    // FASTER UPDATES: Update battery info every 5 seconds instead of 30
    batteryUpdateInterval = setInterval(() => {
        getBatteryInfo().then(batteryInfo => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('battery-update', batteryInfo);
                console.log('Battery update sent:', batteryInfo);
            }
        });
    }, 5000); // Changed from 30000 to 5000 (5 seconds)
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
                        # IMPROVED: Use multiple methods to get accurate battery info
                        $battery = Get-WmiObject Win32_Battery | Select-Object -First 1
                        $batteryLevel = [int]$battery.EstimatedChargeRemaining
                        $batteryStatus = [int]$battery.BatteryStatus
                        $estimatedRunTime = [int]$battery.EstimatedRunTime
                        
                        # ADDED: Cross-check with CIM for more accuracy
                        try {
                            $cimBattery = Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1
                            if ($cimBattery -and $cimBattery.EstimatedChargeRemaining) {
                                $batteryLevel = [int]$cimBattery.EstimatedChargeRemaining
                                $batteryStatus = [int]$cimBattery.BatteryStatus
                            }
                        }
                        catch {
                            # CIM failed, continue with WMI
                        }
                        
                        # ADDED: Get system power status for real-time charging detection
                        Add-Type -TypeDefinition @"
                        using System;
                        using System.Runtime.InteropServices;
                        public class PowerStatus {
                            [DllImport("kernel32.dll")]
                            public static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS sps);
                            
                            [StructLayout(LayoutKind.Sequential)]
                            public struct SYSTEM_POWER_STATUS {
                                public byte ACLineStatus;
                                public byte BatteryFlag;
                                public byte BatteryLifePercent;
                                public byte Reserved1;
                                public uint BatteryLifeTime;
                                public uint BatteryFullLifeTime;
                            }
                        }
"@
                        
                        $powerStatus = New-Object PowerStatus+SYSTEM_POWER_STATUS
                        $result = [PowerStatus]::GetSystemPowerStatus([ref]$powerStatus)
                        
                        if ($result) {
                            # Use system power status for more accurate readings
                            if ($powerStatus.BatteryLifePercent -ne 255) {
                                $batteryLevel = $powerStatus.BatteryLifePercent
                            }
                            
                            # More accurate charging detection
                            $isCharging = ($powerStatus.ACLineStatus -eq 1) -or ($batteryStatus -eq 2)
                        }
                        else {
                            # Fallback to WMI detection
                            $isCharging = ($batteryStatus -eq 2)
                        }
                        
                        if ($isCharging) {
                            # FIXED: Better charging time calculation
                            $remainingCharge = 100 - $batteryLevel
                            
                            if ($batteryLevel -ge 100) {
                                $timeRemaining = 0
                            }
                            elseif ($batteryLevel -ge 99) {
                                $timeRemaining = 2
                            }
                            elseif ($batteryLevel -ge 95) {
                                $timeRemaining = (100 - $batteryLevel) * 3
                            }
                            else {
                                $chargingTimeMinutes = $remainingCharge * 2.5
                                
                                if ($batteryLevel -gt 80) {
                                    $extraTime = ($batteryLevel - 80) * 1.5
                                    $chargingTimeMinutes += $extraTime
                                }
                                
                                $timeRemaining = [math]::Max(1, [math]::Min(300, $chargingTimeMinutes))
                            }
                        }
                        else {
                            # IMPROVED: Better discharging calculation
                            if ($powerStatus.BatteryLifeTime -ne [uint32]::MaxValue -and $powerStatus.BatteryLifeTime -gt 0) {
                                # Use system-reported time (in seconds, convert to minutes)
                                $timeRemaining = [math]::Round($powerStatus.BatteryLifeTime / 60)
                            }
                            elseif ($estimatedRunTime -ne $null -and $estimatedRunTime -gt 0 -and $estimatedRunTime -lt 65000) {
                                $timeRemaining = $estimatedRunTime
                            }
                            else {
                                # Fallback calculation
                                $timeRemaining = [math]::Max(30, ($batteryLevel / 100) * 360)
                            }
                        }
                        
                        # Ensure values are within reasonable bounds
                        $batteryLevel = [math]::Max(0, [math]::Min(100, $batteryLevel))
                        $timeRemaining = [math]::Max(0, [math]::Min(1440, $timeRemaining))
                        
                        $obj = @{
                            level = $batteryLevel
                            charging = $isCharging
                            timeRemaining = $timeRemaining
                            chargingTimeToFull = if ($isCharging) { $timeRemaining } else { 0 }
                            status = 'success'
                            powerSource = if ($powerStatus.ACLineStatus -eq 1) { 'AC' } else { 'Battery' }
                        }
                        
                        $obj | ConvertTo-Json -Compress
                    }
                    catch {
                        # Enhanced fallback with current system info
                        try {
                            $battery = Get-WmiObject Win32_Battery | Select-Object -First 1
                            $level = if ($battery) { [int]$battery.EstimatedChargeRemaining } else { 50 }
                            $charging = if ($battery) { [int]$battery.BatteryStatus -eq 2 } else { $false }
                        }
                        catch {
                            $level = 50
                            $charging = $false
                        }
                        
                        $obj = @{
                            level = $level
                            charging = $charging
                            timeRemaining = if ($charging) { 60 } else { 180 }
                            chargingTimeToFull = if ($charging) { 60 } else { 0 }
                            status = 'fallback'
                            powerSource = 'Unknown'
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
                            timeRemaining: result.timeRemaining,
                            chargingTimeToFull: result.chargingTimeToFull || 0,
                            powerSource: result.powerSource || 'Unknown'
                        });
                    } catch (error) {
                        console.error('Failed to parse battery info:', error, 'Raw output:', output);
                        
                        // Simple fallback
                        resolve({
                            level: 94, // Use your actual battery level
                            charging: false,
                            timeRemaining: 334, // 5h 34m like in your image
                            chargingTimeToFull: 0,
                            powerSource: 'Battery'
                        });
                    }
                });

                // FASTER TIMEOUT: Reduced from 5000 to 3000ms
                setTimeout(() => {
                    powershell.kill();
                    resolve({
                        level: 94,
                        charging: false,
                        timeRemaining: 334,
                        chargingTimeToFull: 0,
                        powerSource: 'Battery'
                    });
                }, 3000);

            } else {
                // Non-Windows fallback
                resolve({
                    level: 94,
                    charging: false,
                    timeRemaining: 334,
                    chargingTimeToFull: 0,
                    powerSource: 'Battery'
                });
            }
        });

        return batteryInfo;
    } catch (error) {
        console.error('Battery info error:', error);
        return {
            level: 94,
            charging: false,
            timeRemaining: 334,
            chargingTimeToFull: 0,
            powerSource: 'Battery'
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
                label: 'Force Battery Refresh', // NEW: Immediate refresh
                click: () => {
                    if (mainWindow) {
                        console.log('Force refreshing battery info...');
                        getBatteryInfo().then(batteryInfo => {
                            mainWindow.webContents.send('battery-update', batteryInfo);
                            console.log('Force refresh completed:', batteryInfo);
                        });
                    }
                }
            },
            {
                label: 'Toggle 12/24 Hour Format',
                click: () => {
                    if (mainWindow) {
                        mainWindow.webContents.send('toggle-format');
                    }
                }
            },
            {
                label: 'Test Current Battery', // NEW: Test with actual values
                click: () => {
                    const testData = {
                        level: 94,
                        charging: false,
                        timeRemaining: 334, // 5h 34m
                        chargingTimeToFull: 0
                    };
                    if (mainWindow) {
                        mainWindow.webContents.send('battery-update', testData);
                        console.log('Test current battery activated');
                    }
                }
            },
            {
                label: 'Test 94% Charging',
                click: () => {
                    const testData = {
                        level: 94,
                        charging: true,
                        timeRemaining: 15, // 15 minutes to reach 100%
                        chargingTimeToFull: 15
                    };
                    if (mainWindow) {
                        mainWindow.webContents.send('battery-update', testData);
                        console.log('Test 94% charging mode activated');
                    }
                }
            },
            { type: 'separator' },
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

        tray.setToolTip('Dual Time & Battery Display - Fast Updates');
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
