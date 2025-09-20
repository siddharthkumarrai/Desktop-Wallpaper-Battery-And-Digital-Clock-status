# Dual Time & Battery Display Wallpaper

A beautiful live wallpaper for Windows that displays current time and battery time remaining with flip-card style animations and millisecond precision.

![Dual Display Preview](https://via.placeholder.com/800x400/2a2a2a/ffffff?text=Dual+Time+%26+Battery+Display)

## ✨ Features

### 🕐 Current Time Display
- **Live Updates**: Real-time clock with millisecond precision
- **Flip Card Animation**: Smooth 3D flip transitions when numbers change
- **Format Options**: Toggle between 12-hour and 24-hour formats
- **Neon Styling**: Glowing red millisecond cards with pulse animations
- **Responsive Design**: Adapts to different screen resolutions

### 🔋 Battery Time Remaining
- **Discharging Mode**: Shows time until battery empty
- **Charging Mode**: Shows time until battery reaches 100%
- **Live Countdown**: Real-time decreasing with millisecond precision
- **Battery Status**: Visual indicators for charging/discharging states
- **Color Coding**: Green (normal), Blue (charging), Red (low battery)

### 🎨 Visual Effects
- **Glass Morphism**: Modern frosted glass card design
- **Animated Colons**: Blinking separator dots between time units
- **Gradient Background**: Subtle dark gradient overlay
- **Smooth Transitions**: Hardware-accelerated animations
- **Above Desktop Icons**: Appears over desktop without blocking interaction

### ⚙️ System Integration
- **Desktop Wallpaper**: True wallpaper behavior with click-through
- **System Tray**: Easy access to controls and settings
- **Auto-Start**: Optional startup with Windows
- **Performance Optimized**: Minimal CPU/RAM usage
- **Multi-Monitor Support**: Works on multiple displays

## 🚀 Quick Start

### Prerequisites
- **Windows 10/11** (Required for battery monitoring)
- **Node.js** (v16 or higher)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/dual-time-battery-display.git
   cd dual-time-battery-display
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
dual-time-battery-display/
├── main.js                 # Electron main process
├── dual-display.html       # Main UI layout
├── dual-display.js         # Clock and battery logic
├── dual-display.css        # Styling and animations
├── package.json            # Dependencies and scripts
├── assets/                 # Icons and resources
│   └── icon.ico           # System tray icon
├── dist/                   # Built application (after build)
└── README.md              # This file
```

## 🎮 Controls & Usage

### System Tray Menu
Right-click the system tray icon to access:
- **Toggle 12/24 Hour Format**: Switch time display format
- **Test Modes**: Test charging/discharging scenarios
- **Refresh Battery**: Update battery information
- **Show/Hide Display**: Toggle wallpaper visibility
- **Reload**: Refresh the application
- **Exit**: Close the application

### Keyboard Shortcuts (Development Mode)
- **Ctrl+T**: Toggle time format
- **F12**: Open developer tools

### Debug Console Commands
Open browser console (F12) and try:
```javascript
// Test different battery scenarios
displayDebug.testCharging()    // 45 minutes to full charge
displayDebug.testBattery()     // 4h 28m remaining
displayDebug.testLowBattery()  // 2 hours charging from 15%

// Custom battery settings
displayDebug.setBattery(level, charging, timeMinutes)
```

## ⚡ Performance

- **Update Frequency**: 50ms for smooth millisecond animation
- **Battery Refresh**: 30 seconds for live data
- **Memory Usage**: ~30-50MB typical
- **CPU Usage**: <1% on modern systems
- **Auto-Pause**: Pauses during fullscreen applications

## 🔧 Configuration

### Time Format
- Toggle via system tray or Ctrl+T
- Persists between application restarts
- Supports both 12-hour and 24-hour formats

### Battery Monitoring
- **Windows**: Uses WMI (Windows Management Instrumentation)
- **Charging Time**: Calculated based on current level and typical rates
- **Discharging Time**: Uses system estimates with fallbacks
- **Update Interval**: 30-second refresh cycles

### Display Options
- **Always On Top**: Appears above desktop icons
- **Click-Through**: Desktop interaction preserved
- **Multi-Monitor**: Displays on primary monitor
- **Responsive**: Scales for different resolutions

## 🛠️ Development

### Development Server
```bash
npm run dev    # Run with live reload and logging
npm start      # Run production build
```

### Code Structure
- **main.js**: Electron main process, system integration, battery monitoring
- **dual-display.js**: Clock logic, animations, state management
- **dual-display.html**: UI structure and layout
- **dual-display.css**: Styling, animations, responsive design

### Adding Features
1. **New Time Formats**: Modify `updateTimeDisplay()` in dual-display.js
2. **Custom Animations**: Add CSS animations in dual-display.css
3. **Battery Calculations**: Update PowerShell script in main.js
4. **UI Elements**: Add HTML elements and corresponding JavaScript logic

## 📦 Building & Distribution

### Build Commands
```bash
# Build for current platform
npm run build

# Build specifically for Windows
npm run build-win

# Build for all platforms
npm run build-all
```

### Output Files
After building, find your executable in:
```
dist/
├── win-unpacked/                           # Unpacked Windows files
├── Dual Time & Battery Display Setup.exe  # Windows installer
└── latest.yml                              # Update metadata
```

### Installation Package
The build creates:
- **NSIS Installer**: Easy Windows installation
- **Portable Version**: Run without installation
- **Auto-Updater Ready**: Supports automatic updates

### Customization Options
- **App Name**: Change in package.json `productName`
- **Icon**: Replace assets/icon.ico
- **Version**: Update package.json `version`
- **Installer Options**: Modify `build` section in package.json

## 🎯 Advanced Usage

### Custom Battery Calculations
Modify the PowerShell script in main.js to customize:
- **Charging Rates**: Adjust per-percentage charging time
- **Battery Health**: Account for battery degradation
- **Power Usage**: Include system load in calculations

### Multi-Monitor Setup
The application automatically detects primary display. For multi-monitor:
1. Run multiple instances
2. Position manually using window controls
3. Configure different displays in main.js

### Startup Configuration
Add to Windows startup:
1. **Via Installer**: Check "Start with Windows" during installation
2. **Manual**: Add shortcut to Windows Startup folder
3. **Registry**: Use Windows Task Scheduler for advanced options

## 🐛 Troubleshooting

### Common Issues

**Battery information not updating**
- Ensure Windows WMI service is running
- Try "Refresh Battery Info" from tray menu
- Run application as Administrator for better access

**Display not showing**
- Check if hidden behind other windows
- Use "Show/Hide Display" from tray menu
- Verify screen resolution compatibility

**Performance issues**
- Close other heavy applications
- Reduce update frequency in code
- Check Windows power settings

**Build failures**
- Verify Node.js version (16+)
- Clear node_modules and reinstall
- Check Windows build tools installation

### Logs and Debugging
- **Development logs**: Shown in terminal with `npm run dev`
- **Production logs**: Check Windows Event Viewer
- **Console access**: Press F12 in development mode

### Support
- Check Windows compatibility (10/11 required)
- Verify administrator privileges for full functionality
- Test with different power profiles
- Ensure .NET Framework is installed

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10 (version 1803 or later) / Windows 11
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 200MB free space
- **Node.js**: Version 16.0.0 or higher
- **npm**: Version 7.0.0 or higher (comes with Node.js)

### Optional Requirements
- **Git**: For cloning repository
- **Visual Studio Build Tools**: For native dependencies (auto-installed)
- **Windows PowerShell**: Version 5.1 or higher (built-in on Windows)

## 🚀 Installation Methods

### Method 1: Pre-built Release (Recommended)

1. **Download the latest release**
   - Go to: https://github.com/yourusername/dual-time-battery-display/releases
   - Download: `Dual-Time-Battery-Display-Setup.exe`

2. **Run the installer**
   - Double-click the downloaded .exe file
   - Follow installation wizard
   - Choose installation directory
   - Select "Start with Windows" if desired
   - Click Install

3. **Launch the application**
   - Desktop shortcut created automatically
   - Or find in Start Menu > All Apps
   - System tray icon appears when running

### Method 2: Build from Source

Follow the Quick Start guide above for building from source.

## 📊 Available Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "start": "electron .",
    "dev": "electron . --enable-logging",
    "build": "electron-builder",
    "build-win": "electron-builder --win",
    "build:debug": "electron-builder --win --publish=never",
    "build:portable": "electron-builder --win portable",
    "clean": "rimraf dist node_modules && npm install",
    "rebuild": "electron-rebuild",
    "test": "echo \"No tests specified\" && exit 0",
    "analyze": "npm-bundle-analyzer",
    "postinstall": "electron-builder install-app-deps"
  }
}
```

## 📜 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 🔗 Links

- **GitHub**: https://github.com/yourusername/dual-time-battery-display
- **Issues**: https://github.com/yourusername/dual-time-battery-display/issues
- **Releases**: https://github.com/yourusername/dual-time-battery-display/releases

## 📊 Stats

- **Languages**: JavaScript, HTML, CSS, PowerShell
- **Framework**: Electron
- **Platform**: Windows 10/11
- **License**: MIT
- **Version**: 1.0.0

---

*Built with ❤️ for Windows power users who want beautiful, functional desktop experiences.*