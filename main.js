const { app, BrowserWindow, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

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
        transparent: true,  // ✅ FIXED: Enable transparency
        backgroundColor: 'rgba(0,0,0,0)',  // ✅ FIXED: Fully transparent background
        alwaysOnTop: false,
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
        console.log('Window ready, setting up transparent desktop wallpaper...');
        mainWindow.show();
        
        // ✅ IMPORTANT: Proper window setup for wallpaper mode
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setSkipTaskbar(true);
        
        setTimeout(() => {
            setAsWorkingDesktopWallpaper();
            startBatteryMonitoring();
        }, 2000);
    });

    mainWindow.on('closed', () => {
        if (batteryUpdateInterval) {
            clearInterval(batteryUpdateInterval);
        }
        mainWindow = null;
    });

    return mainWindow;
}

function setAsWorkingDesktopWallpaper() {
    try {
        console.log('Setting as transparent desktop wallpaper behind icons...');
        
        // Make window ignore mouse but forward to desktop
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setSkipTaskbar(true);
        
        if (process.platform === 'win32') {
            const powershell = spawn('powershell', [
                '-WindowStyle', 'Hidden',
                '-ExecutionPolicy', 'Bypass',
                '-Command',
                `
                # Enhanced transparent desktop wallpaper solution
                Add-Type -TypeDefinition '
                using System;
                using System.Runtime.InteropServices;

                public class TransparentWallpaper {
                    [DllImport("user32.dll")]
                    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                    
                    [DllImport("user32.dll")]
                    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
                    
                    [DllImport("user32.dll")]
                    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
                    
                    [DllImport("user32.dll")]
                    public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
                    
                    [DllImport("user32.dll")]
                    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                    
                    [DllImport("user32.dll")]
                    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
                    
                    [DllImport("user32.dll")]
                    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
                    
                    [DllImport("user32.dll")]
                    public static extern bool IsWindowVisible(IntPtr hWnd);
                    
                    [DllImport("user32.dll")]
                    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                    
                    [DllImport("user32.dll")]
                    public static extern long SetWindowLong(IntPtr hWnd, int nIndex, long dwNewLong);
                    
                    [DllImport("user32.dll")]
                    public static extern long GetWindowLong(IntPtr hWnd, int nIndex);
                    
                    [DllImport("user32.dll")]
                    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

                    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
                    
                    public static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
                    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
                    public static readonly IntPtr HWND_TOP = new IntPtr(0);
                    
                    public const uint SWP_NOMOVE = 0x0002;
                    public const uint SWP_NOSIZE = 0x0001;
                    public const uint SWP_NOACTIVATE = 0x0010;
                    public const uint SWP_SHOWWINDOW = 0x0040;
                    public const uint SWP_NOOWNERZORDER = 0x0200;
                    public const uint SWP_NOZORDER = 0x0004;
                    
                    public const int SW_SHOW = 5;
                    public const int SW_SHOWNOACTIVATE = 4;
                    public const int SW_HIDE = 0;
                    
                    public const int GWL_EXSTYLE = -20;
                    public const long WS_EX_LAYERED = 0x00080000L;
                    public const long WS_EX_TOOLWINDOW = 0x00000080L;
                    public const long WS_EX_NOACTIVATE = 0x08000000L;
                    public const long WS_EX_TRANSPARENT = 0x00000020L;
                    
                    public const uint LWA_ALPHA = 0x00000002;
                    public const uint LWA_COLORKEY = 0x00000001;
                }';

                try {
                    Write-Host "=== TRANSPARENT DESKTOP WALLPAPER SETUP ==="
                    
                    # Find electron window
                    $clockWindow = $null
                    $electronProcesses = Get-Process -Name "electron" -ErrorAction SilentlyContinue
                    
                    foreach ($proc in $electronProcesses) {
                        [TransparentWallpaper]::EnumWindows({
                            param($hwnd, $lParam)
                            
                            $processId = 0
                            [TransparentWallpaper]::GetWindowThreadProcessId($hwnd, [ref]$processId)
                            
                            if ($processId -eq $proc.Id) {
                                $visible = [TransparentWallpaper]::IsWindowVisible($hwnd)
                                if ($visible) {
                                    $script:clockWindow = $hwnd
                                    Write-Host "Clock window found: $hwnd"
                                    return $false
                                }
                            }
                            return $true
                        }, [IntPtr]::Zero)
                        
                        if ($script:clockWindow) { break }
                    }

                    if ($script:clockWindow) {
                        Write-Host "Setting up transparent desktop wallpaper integration..."
                        
                        # Set window extended styles for transparency and no activation
                        $currentStyle = [TransparentWallpaper]::GetWindowLong($script:clockWindow, [TransparentWallpaper]::GWL_EXSTYLE)
                        $newStyle = $currentStyle -bor [TransparentWallpaper]::WS_EX_TOOLWINDOW -bor [TransparentWallpaper]::WS_EX_NOACTIVATE
                        [TransparentWallpaper]::SetWindowLong($script:clockWindow, [TransparentWallpaper]::GWL_EXSTYLE, $newStyle) | Out-Null
                        
                        # Get desktop components
                        $progman = [TransparentWallpaper]::FindWindow("Progman", "Program Manager")
                        Write-Host "Progman: $progman"
                        
                        if ($progman -ne [IntPtr]::Zero) {
                            # Send message to spawn WorkerW for wallpaper hosting
                            [TransparentWallpaper]::SendMessage($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
                            Start-Sleep -Milliseconds 500
                            
                            # Find the WorkerW that will host our transparent wallpaper
                            $wallpaperWorker = $null
                            $worker = [IntPtr]::Zero
                            
                            do {
                                $worker = [TransparentWallpaper]::FindWindowEx([IntPtr]::Zero, $worker, "WorkerW", $null)
                                if ($worker -ne [IntPtr]::Zero) {
                                    $defView = [TransparentWallpaper]::FindWindowEx($worker, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                                    if ($defView -eq [IntPtr]::Zero) {
                                        $wallpaperWorker = $worker
                                        Write-Host "Found wallpaper WorkerW: $wallpaperWorker"
                                        break
                                    }
                                }
                            } while ($worker -ne [IntPtr]::Zero)
                            
                            if ($wallpaperWorker -ne $null) {
                                # Set as child of wallpaper WorkerW
                                Write-Host "Setting transparent clock as wallpaper child..."
                                $parentResult = [TransparentWallpaper]::SetParent($script:clockWindow, $wallpaperWorker)
                                
                                if ($parentResult -ne [IntPtr]::Zero) {
                                    Write-Host "SUCCESS: Transparent clock is now desktop wallpaper!"
                                    
                                    # Position at bottom layer but visible
                                    [TransparentWallpaper]::SetWindowPos($script:clockWindow, [TransparentWallpaper]::HWND_BOTTOM, 0, 0, 0, 0, 
                                        [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW -bor [TransparentWallpaper]::SWP_NOOWNERZORDER) | Out-Null
                                    
                                    [TransparentWallpaper]::ShowWindow($script:clockWindow, [TransparentWallpaper]::SW_SHOWNOACTIVATE) | Out-Null
                                    
                                    # Ensure desktop icons are visible on top
                                    $iconWorker = [IntPtr]::Zero
                                    do {
                                        $iconWorker = [TransparentWallpaper]::FindWindowEx([IntPtr]::Zero, $iconWorker, "WorkerW", $null)
                                        if ($iconWorker -ne [IntPtr]::Zero -and $iconWorker -ne $wallpaperWorker) {
                                            $desktopIcons = [TransparentWallpaper]::FindWindowEx($iconWorker, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                                            if ($desktopIcons -ne [IntPtr]::Zero) {
                                                Write-Host "Desktop icons found: $desktopIcons - ensuring visibility on top"
                                                [TransparentWallpaper]::SetWindowPos($desktopIcons, [TransparentWallpaper]::HWND_TOP, 0, 0, 0, 0, 
                                                    [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW) | Out-Null
                                                [TransparentWallpaper]::ShowWindow($desktopIcons, [TransparentWallpaper]::SW_SHOW) | Out-Null
                                                
                                                # Show icon list view
                                                $iconList = [TransparentWallpaper]::FindWindowEx($desktopIcons, [IntPtr]::Zero, "SysListView32", "FolderView")
                                                if ($iconList -ne [IntPtr]::Zero) {
                                                    [TransparentWallpaper]::ShowWindow($iconList, [TransparentWallpaper]::SW_SHOW) | Out-Null
                                                    [TransparentWallpaper]::SetWindowPos($iconList, [TransparentWallpaper]::HWND_TOP, 0, 0, 0, 0, 
                                                        [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW) | Out-Null
                                                    Write-Host "Desktop icon list made visible on top"
                                                }
                                                break
                                            }
                                        }
                                    } while ($iconWorker -ne [IntPtr]::Zero)
                                    
                                    # Also ensure Progman icons are visible
                                    $progmanIcons = [TransparentWallpaper]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                                    if ($progmanIcons -ne [IntPtr]::Zero) {
                                        [TransparentWallpaper]::SetWindowPos($progmanIcons, [TransparentWallpaper]::HWND_TOP, 0, 0, 0, 0, 
                                            [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW) | Out-Null
                                        [TransparentWallpaper]::ShowWindow($progmanIcons, [TransparentWallpaper]::SW_SHOW) | Out-Null
                                        
                                        $progmanIconList = [TransparentWallpaper]::FindWindowEx($progmanIcons, [IntPtr]::Zero, "SysListView32", "FolderView")
                                        if ($progmanIconList -ne [IntPtr]::Zero) {
                                            [TransparentWallpaper]::ShowWindow($progmanIconList, [TransparentWallpaper]::SW_SHOW) | Out-Null
                                            [TransparentWallpaper]::SetWindowPos($progmanIconList, [TransparentWallpaper]::HWND_TOP, 0, 0, 0, 0, 
                                                [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW) | Out-Null
                                            Write-Host "Progman icon list made visible on top"
                                        }
                                    }
                                    
                                    Write-Host "COMPLETE: Transparent desktop wallpaper with icons visible on top!"
                                } else {
                                    Write-Host "FAILED: Could not set as wallpaper child, using fallback positioning"
                                    # Fallback: Position at bottom
                                    [TransparentWallpaper]::SetWindowPos($script:clockWindow, [TransparentWallpaper]::HWND_BOTTOM, 0, 0, 0, 0, 
                                        [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW) | Out-Null
                                    [TransparentWallpaper]::ShowWindow($script:clockWindow, [TransparentWallpaper]::SW_SHOWNOACTIVATE) | Out-Null
                                    Write-Host "Fallback transparent positioning complete"
                                }
                            } else {
                                Write-Host "No suitable WorkerW found, using bottom positioning"
                                [TransparentWallpaper]::SetWindowPos($script:clockWindow, [TransparentWallpaper]::HWND_BOTTOM, 0, 0, 0, 0, 
                                    [TransparentWallpaper]::SWP_NOMOVE -bor [TransparentWallpaper]::SWP_NOSIZE -bor [TransparentWallpaper]::SWP_NOACTIVATE -bor [TransparentWallpaper]::SWP_SHOWWINDOW) | Out-Null
                                [TransparentWallpaper]::ShowWindow($script:clockWindow, [TransparentWallpaper]::SW_SHOWNOACTIVATE) | Out-Null
                                Write-Host "Simple transparent positioning complete"
                            }
                        } else {
                            Write-Host "ERROR: Progman not found"
                        }
                    } else {
                        Write-Host "ERROR: Clock window not found"
                    }
                }
                catch {
                    Write-Host "ERROR: $_"
                }
                `
            ], { windowsHide: true });

            powershell.stdout.on('data', (data) => {
                console.log('Transparent wallpaper setup:', data.toString().trim());
            });

            powershell.stderr.on('data', (data) => {
                console.error('Transparent wallpaper setup error:', data.toString().trim());
            });

            powershell.on('close', (code) => {
                console.log(`Transparent wallpaper setup completed with code: ${code}`);
            });
        }
        
    } catch (error) {
        console.error('Transparent wallpaper setup error:', error);
    }
}

function startBatteryMonitoring() {
    getBatteryInfo().then(batteryInfo => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('battery-update', batteryInfo);
            console.log('Initial battery info sent:', batteryInfo);
        }
    });

    batteryUpdateInterval = setInterval(() => {
        getBatteryInfo().then(batteryInfo => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('battery-update', batteryInfo);
            }
        });
    }, 5000);
}

async function getBatteryInfo() {
    try {
        const batteryInfo = await new Promise((resolve) => {
            if (process.platform === 'win32') {
                const powershell = spawn('powershell', [
                    '-Command',
                    `
                    try {
                        $battery = Get-WmiObject Win32_Battery | Select-Object -First 1
                        $batteryLevel = [int]$battery.EstimatedChargeRemaining
                        $batteryStatus = [int]$battery.BatteryStatus
                        $estimatedRunTime = [int]$battery.EstimatedRunTime
                        
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
                            if ($powerStatus.BatteryLifePercent -ne 255) {
                                $batteryLevel = $powerStatus.BatteryLifePercent
                            }
                            $isCharging = ($powerStatus.ACLineStatus -eq 1) -or ($batteryStatus -eq 2)
                        }
                        else {
                            $isCharging = ($batteryStatus -eq 2)
                        }
                        
                        if ($isCharging) {
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
                            if ($powerStatus.BatteryLifeTime -ne [uint32]::MaxValue -and $powerStatus.BatteryLifeTime -gt 0) {
                                $timeRemaining = [math]::Round($powerStatus.BatteryLifeTime / 60)
                            }
                            elseif ($estimatedRunTime -ne $null -and $estimatedRunTime -gt 0 -and $estimatedRunTime -lt 65000) {
                                $timeRemaining = $estimatedRunTime
                            }
                            else {
                                $timeRemaining = [math]::Max(30, ($batteryLevel / 100) * 360)
                            }
                        }
                        
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
                        $obj = @{
                            level = 35
                            charging = $false
                            timeRemaining = 126
                            chargingTimeToFull = 0
                            status = 'fallback'
                            powerSource = 'Battery'
                        }
                        $obj | ConvertTo-Json -Compress
                    }
                    `
                ], { windowsHide: true });

                let output = '';
                powershell.stdout.on('data', (data) => {
                    output += data.toString();
                });

                powershell.on('close', (code) => {
                    try {
                        const cleanOutput = output.trim().replace(/[\r\n]/g, '');
                        const result = JSON.parse(cleanOutput);
                        
                        resolve({
                            level: result.level,
                            charging: result.charging,
                            timeRemaining: result.timeRemaining,
                            chargingTimeToFull: result.chargingTimeToFull || 0,
                            powerSource: result.powerSource || 'Unknown'
                        });
                    } catch (error) {
                        resolve({
                            level: 35,
                            charging: false,
                            timeRemaining: 126,
                            chargingTimeToFull: 0,
                            powerSource: 'Battery'
                        });
                    }
                });

                setTimeout(() => {
                    powershell.kill();
                    resolve({
                        level: 35,
                        charging: false,
                        timeRemaining: 126,
                        chargingTimeToFull: 0,
                        powerSource: 'Battery'
                    });
                }, 3000);

            } else {
                resolve({
                    level: 35,
                    charging: false,
                    timeRemaining: 126,
                    chargingTimeToFull: 0,
                    powerSource: 'Battery'
                });
            }
        });

        return batteryInfo;
    } catch (error) {
        console.error('Battery info error:', error);
        return {
            level: 35,
            charging: false,
            timeRemaining: 126,
            chargingTimeToFull: 0,
            powerSource: 'Battery'
        };
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
                label: 'Transparent Desktop Wallpaper v17.0',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Reset Wallpaper Position',
                click: () => {
                    console.log('=== RESETTING TRANSPARENT WALLPAPER POSITION ===');
                    if (mainWindow) {
                        setAsWorkingDesktopWallpaper();
                    }
                }
            },
            {
                label: 'Force Desktop Icons Refresh',
                click: () => {
                    console.log('=== FORCING DESKTOP ICONS REFRESH ===');
                    const refresh = spawn('powershell', [
                        '-Command',
                        `
                        # Force refresh desktop icons and desktop
                        try {
                            $shell = New-Object -ComObject Shell.Application
                            $shell.Windows() | ForEach-Object { $_.Refresh() }
                            
                            # Also refresh desktop using Win32 API
                            Add-Type -TypeDefinition '
                            using System;
                            using System.Runtime.InteropServices;
                            public class DesktopRefresh {
                                [DllImport("user32.dll")]
                                public static extern bool InvalidateRect(IntPtr hWnd, IntPtr lpRect, bool bErase);
                                [DllImport("user32.dll")]  
                                public static extern IntPtr GetDesktopWindow();
                                [DllImport("user32.dll")]
                                public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                                [DllImport("user32.dll")]
                                public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
                                [DllImport("user32.dll")]
                                public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                                [DllImport("user32.dll")]
                                public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
                                
                                public static readonly IntPtr HWND_TOP = new IntPtr(0);
                                public const uint SWP_NOMOVE = 0x0002;
                                public const uint SWP_NOSIZE = 0x0001;
                                public const uint SWP_NOACTIVATE = 0x0010;
                                public const uint SWP_SHOWWINDOW = 0x0040;
                                public const int SW_SHOW = 5;
                            }';
                            
                            $desktop = [DesktopRefresh]::GetDesktopWindow()
                            [DesktopRefresh]::InvalidateRect($desktop, [IntPtr]::Zero, $true)
                            
                            # Find and refresh desktop icons
                            $progman = [DesktopRefresh]::FindWindow("Progman", "Program Manager")
                            if ($progman -ne [IntPtr]::Zero) {
                                $icons = [DesktopRefresh]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                                if ($icons -ne [IntPtr]::Zero) {
                                    [DesktopRefresh]::SetWindowPos($icons, [DesktopRefresh]::HWND_TOP, 0, 0, 0, 0, 0x0002 -bor 0x0001 -bor 0x0010 -bor 0x0040)
                                    [DesktopRefresh]::ShowWindow($icons, 5)
                                    Write-Host "Progman desktop icons refreshed and brought to top"
                                }
                                
                                # Also check WorkerW windows for icons
                                $worker = [IntPtr]::Zero
                                do {
                                    $worker = [DesktopRefresh]::FindWindowEx([IntPtr]::Zero, $worker, "WorkerW", $null)
                                    if ($worker -ne [IntPtr]::Zero) {
                                        $workerIcons = [DesktopRefresh]::FindWindowEx($worker, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                                        if ($workerIcons -ne [IntPtr]::Zero) {
                                            [DesktopRefresh]::SetWindowPos($workerIcons, [DesktopRefresh]::HWND_TOP, 0, 0, 0, 0, 0x0002 -bor 0x0001 -bor 0x0010 -bor 0x0040)
                                            [DesktopRefresh]::ShowWindow($workerIcons, 5)
                                            
                                            $iconList = [DesktopRefresh]::FindWindowEx($workerIcons, [IntPtr]::Zero, "SysListView32", "FolderView")
                                            if ($iconList -ne [IntPtr]::Zero) {
                                                [DesktopRefresh]::ShowWindow($iconList, 5)
                                                [DesktopRefresh]::SetWindowPos($iconList, [DesktopRefresh]::HWND_TOP, 0, 0, 0, 0, 0x0002 -bor 0x0001 -bor 0x0010 -bor 0x0040)
                                                Write-Host "WorkerW desktop icons refreshed and brought to top"
                                            }
                                        }
                                    }
                                } while ($worker -ne [IntPtr]::Zero)
                            }
                            
                            Write-Host "Desktop icons forcefully refreshed and brought to foreground"
                        }
                        catch {
                            Write-Host "Error refreshing desktop: $_"
                        }
                        `
                    ], { windowsHide: true });
                    
                    refresh.stdout.on('data', (data) => {
                        console.log('Desktop refresh:', data.toString().trim());
                    });
                }
            },
            {
                label: 'Show Desktop Icons',
                click: () => {
                    console.log('=== SHOWING DESKTOP ICONS ===');
                    const show = spawn('powershell', [
                        '-Command',
                        `
                        Add-Type -TypeDefinition '
                        using System;
                        using System.Runtime.InteropServices;
                        public class IconShow {
                            [DllImport("user32.dll")]
                            public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                            [DllImport("user32.dll")]
                            public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
                            [DllImport("user32.dll")]
                            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                            [DllImport("user32.dll")]
                            public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
                            public static readonly IntPtr HWND_TOP = new IntPtr(0);
                            public const uint SWP_NOMOVE = 0x0002;
                            public const uint SWP_NOSIZE = 0x0001;
                            public const uint SWP_NOACTIVATE = 0x0010;
                            public const uint SWP_SHOWWINDOW = 0x0040;
                            public const int SW_SHOW = 5;
                        }';
                        
                        $progman = [IconShow]::FindWindow("Progman", "Program Manager")
                        $icons = [IconShow]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                        
                        if ($icons -ne [IntPtr]::Zero) {
                            [IconShow]::SetWindowPos($icons, [IconShow]::HWND_TOP, 0, 0, 0, 0, 0x0002 -bor 0x0001 -bor 0x0010 -bor 0x0040)
                            [IconShow]::ShowWindow($icons, 5)
                            Write-Host "Desktop icons shown and brought to top"
                        } else {
                            # Try in WorkerW
                            $worker = [IntPtr]::Zero
                            do {
                                $worker = [IconShow]::FindWindowEx([IntPtr]::Zero, $worker, "WorkerW", $null)
                                if ($worker -ne [IntPtr]::Zero) {
                                    $icons = [IconShow]::FindWindowEx($worker, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
                                    if ($icons -ne [IntPtr]::Zero) {
                                        [IconShow]::SetWindowPos($icons, [IconShow]::HWND_TOP, 0, 0, 0, 0, 0x0002 -bor 0x0001 -bor 0x0010 -bor 0x0040)
                                        [IconShow]::ShowWindow($icons, 5)
                                        Write-Host "Desktop icons found in WorkerW and shown on top"
                                        break
                                    }
                                }
                            } while ($worker -ne [IntPtr]::Zero)
                        }
                        `
                    ], { windowsHide: true });
                }
            },
            {
                label: 'Force Battery Refresh',
                click: () => {
                    if (mainWindow) {
                        getBatteryInfo().then(batteryInfo => {
                            mainWindow.webContents.send('battery-update', batteryInfo);
                            console.log('Battery refresh:', batteryInfo);
                        });
                    }
                }
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
            { type: 'separator' },
            {
                label: 'Exit',
                click: () => {
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Transparent Desktop Wallpaper Clock - v17.0');
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

module.exports = { mainWindow, setAsWorkingDesktopWallpaper };