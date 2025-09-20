const { ipcRenderer } = require('electron');

class DualDisplay {
    constructor() {
        this.is24HourFormat = true;
        this.batteryData = {
            level: 75,
            charging: false,
            timeRemainingSeconds: 14400, // Initial 4 hours in seconds
            chargingTimeToFullSeconds: 0, // Time to reach 100% when charging
            lastUpdate: Date.now()
        };
        
        this.elements = this.initializeElements();
        this.init();
        this.loadSettings();
    }

    initializeElements() {
        const timeUnits = ['hours-tens', 'hours-ones', 'minutes-tens', 'minutes-ones', 
                          'seconds-tens', 'seconds-ones', 'ms-tens', 'ms-ones'];
        const batteryUnits = ['hours-tens', 'hours-ones', 'minutes-tens', 'minutes-ones',
                             'seconds-tens', 'seconds-ones', 'ms-tens', 'ms-ones'];
        
        const elements = { time: {}, battery: {} };
        
        // Time elements
        timeUnits.forEach(unit => {
            const id = `time-${unit}`;
            elements.time[unit] = {
                current: document.getElementById(`${id}-current`),
                next: document.getElementById(`${id}-next`),
                card: document.getElementById(`${id}-card`).parentElement
            };
        });
        
        // Battery elements
        batteryUnits.forEach(unit => {
            const id = `battery-${unit}`;
            elements.battery[unit] = {
                current: document.getElementById(`${id}-current`),
                next: document.getElementById(`${id}-next`),
                card: document.getElementById(`${id}-card`).parentElement
            };
        });
        
        elements.batteryPercentage = document.getElementById('battery-percentage');
        elements.batteryStatus = document.getElementById('battery-status');
        
        return elements;
    }

    init() {
        // Initialize displays
        this.updateTimeDisplay();
        this.updateBatteryCountdown();
        this.updateBatteryInfo();
        
        // Start high-frequency update for live milliseconds (every 50ms for smooth animation)
        this.highFreqInterval = setInterval(() => {
            this.updateTimeDisplay();
            this.updateBatteryCountdown();
        }, 50);
        
        // Listen for IPC messages
        if (ipcRenderer) {
            ipcRenderer.on('toggle-format', () => {
                this.toggleTimeFormat();
            });
            
            ipcRenderer.on('battery-update', (event, batteryInfo) => {
                console.log('Battery update received:', batteryInfo);
                this.updateBatteryData(batteryInfo);
            });
        }
        
        console.log('Dual Display initialized successfully');
    }

    updateBatteryData(batteryInfo) {
        this.batteryData = {
            level: batteryInfo.level,
            charging: batteryInfo.charging,
            timeRemainingSeconds: batteryInfo.timeRemaining * 60, // Convert minutes to seconds
            chargingTimeToFullSeconds: (batteryInfo.chargingTimeToFull || 0) * 60, // Convert minutes to seconds
            lastUpdate: Date.now()
        };
        this.updateBatteryInfo();
        console.log('Battery data updated:', this.batteryData);
    }

    updateTimeDisplay() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();
        
        // Convert to 12-hour format if needed
        if (!this.is24HourFormat) {
            hours = hours % 12;
            if (hours === 0) hours = 12;
        }
        
        const currentTime = {
            'hours-tens': Math.floor(hours / 10).toString(),
            'hours-ones': (hours % 10).toString(),
            'minutes-tens': Math.floor(minutes / 10).toString(),
            'minutes-ones': (minutes % 10).toString(),
            'seconds-tens': Math.floor(seconds / 10).toString(),
            'seconds-ones': (seconds % 10).toString(),
            'ms-tens': Math.floor(milliseconds / 100).toString(),
            'ms-ones': Math.floor((milliseconds % 100) / 10).toString()
        };
        
        // Update each time unit with smooth transitions
        Object.keys(currentTime).forEach(unit => {
            this.updateUnit('time', unit, currentTime[unit]);
        });
    }

    updateBatteryCountdown() {
        const now = Date.now();
        const elapsedSeconds = (now - this.batteryData.lastUpdate) / 1000;

        if (this.batteryData.charging) {
            // CHARGING MODE: Show time remaining to reach 100%
            let totalChargingSeconds = Math.max(0, this.batteryData.chargingTimeToFullSeconds - elapsedSeconds);
            
            // FIXED: If battery is 100% or time is 0, show all zeros
            if (this.batteryData.level >= 100 || totalChargingSeconds <= 0) {
                const zeroTime = {
                    'hours-tens': '0', 'hours-ones': '0',
                    'minutes-tens': '0', 'minutes-ones': '0',
                    'seconds-tens': '0', 'seconds-ones': '0',
                    'ms-tens': '0', 'ms-ones': '0'
                };
                
                Object.keys(zeroTime).forEach(unit => {
                    this.updateUnit('battery', unit, zeroTime[unit]);
                });
                return;
            }
            
            const hours = Math.floor(totalChargingSeconds / 3600);
            const minutes = Math.floor((totalChargingSeconds % 3600) / 60);
            const seconds = Math.floor(totalChargingSeconds % 60);
            
            // Live milliseconds for charging - count down from 99 to 00
            const decimalPart = totalChargingSeconds - Math.floor(totalChargingSeconds);
            const millisecondsValue = Math.floor((1 - decimalPart) * 100);
            
            const chargingTime = {
                'hours-tens': Math.floor(hours / 10).toString(),
                'hours-ones': (hours % 10).toString(),
                'minutes-tens': Math.floor(minutes / 10).toString(),
                'minutes-ones': (minutes % 10).toString(),
                'seconds-tens': Math.floor(seconds / 10).toString(),
                'seconds-ones': (seconds % 10).toString(),
                'ms-tens': Math.floor(millisecondsValue / 10).toString(),
                'ms-ones': (millisecondsValue % 10).toString()
            };
            
            Object.keys(chargingTime).forEach(unit => {
                this.updateUnit('battery', unit, chargingTime[unit]);
            });
            
        } else {
            // DISCHARGING MODE: Show time remaining until battery empty
            const totalRemainingSeconds = Math.max(0, this.batteryData.timeRemainingSeconds - elapsedSeconds);
            
            const hours = Math.floor(totalRemainingSeconds / 3600);
            const minutes = Math.floor((totalRemainingSeconds % 3600) / 60);
            const seconds = Math.floor(totalRemainingSeconds % 60);
            
            // Live milliseconds calculation - count down from 99 to 00
            const decimalPart = totalRemainingSeconds - Math.floor(totalRemainingSeconds);
            const millisecondsValue = Math.floor((1 - decimalPart) * 100);
            
            const dischargingTime = {
                'hours-tens': Math.floor(hours / 10).toString(),
                'hours-ones': (hours % 10).toString(),
                'minutes-tens': Math.floor(minutes / 10).toString(),
                'minutes-ones': (minutes % 10).toString(),
                'seconds-tens': Math.floor(seconds / 10).toString(),
                'seconds-ones': (seconds % 10).toString(),
                'ms-tens': Math.floor(millisecondsValue / 10).toString(),
                'ms-ones': (millisecondsValue % 10).toString()
            };
            
            Object.keys(dischargingTime).forEach(unit => {
                this.updateUnit('battery', unit, dischargingTime[unit]);
            });
        }
    }

    updateUnit(type, unit, newValue) {
        if (!this.elements[type] || !this.elements[type][unit]) {
            console.warn(`Element not found: ${type}.${unit}`);
            return;
        }
        
        const element = this.elements[type][unit];
        const currentValue = element.current.textContent;
        
        if (currentValue !== newValue) {
            // Set the next value
            element.next.textContent = newValue;
            
            // Trigger flip animation
            element.card.classList.add('flipping');
            
            // After flip completes, update current value and reset
            setTimeout(() => {
                if (element.current && element.card) {
                    element.current.textContent = newValue;
                    element.card.classList.remove('flipping');
                }
            }, 150); // Faster flip animation
        }
    }

    updateBatteryInfo() {
        const { level, charging } = this.batteryData;
        
        // Update percentage
        if (this.elements.batteryPercentage) {
            this.elements.batteryPercentage.textContent = Math.round(level);
            
            // Update battery level color
            const batteryLevelElement = this.elements.batteryPercentage;
            batteryLevelElement.classList.remove('low', 'charging');
            
            if (charging) {
                batteryLevelElement.classList.add('charging');
                if (this.elements.batteryStatus) {
                    // Show "FULLY CHARGED" when at 100%
                    if (level >= 100) {
                        this.elements.batteryStatus.textContent = 'FULLY CHARGED';
                    } else {
                        this.elements.batteryStatus.textContent = 'CHARGING';
                    }
                }
            } else {
                if (level < 20) {
                    batteryLevelElement.classList.add('low');
                }
                if (this.elements.batteryStatus) {
                    this.elements.batteryStatus.textContent = 'DISCHARGING';
                }
            }
        }
    }

    toggleTimeFormat() {
        this.is24HourFormat = !this.is24HourFormat;
        this.updateTimeDisplay();
        this.saveSettings();
        console.log('Time format changed to:', this.is24HourFormat ? '24-hour' : '12-hour');
    }

    saveSettings() {
        const settings = {
            is24HourFormat: this.is24HourFormat
        };
        
        try {
            localStorage.setItem('dualDisplaySettings', JSON.stringify(settings));
        } catch (error) {
            console.warn('Could not save settings:', error);
        }
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('dualDisplaySettings'));
            if (settings && settings.is24HourFormat !== undefined) {
                this.is24HourFormat = settings.is24HourFormat;
            }
        } catch (error) {
            console.warn('Could not load settings:', error);
        }
    }

    destroy() {
        if (this.highFreqInterval) {
            clearInterval(this.highFreqInterval);
        }
        console.log('Dual Display destroyed');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.dualDisplay = new DualDisplay();
        
        // Debug interface for testing
        window.displayDebug = {
            toggleFormat: () => window.dualDisplay.toggleTimeFormat(),
            
            // Updated test functions with correct data
            testFullyCharged: () => {
                window.dualDisplay.updateBatteryData({
                    level: 100,
                    charging: true,
                    timeRemaining: 0, // Should show 00:00:00:00
                    chargingTimeToFull: 0
                });
                console.log('Test fully charged mode set - should show 00:00:00:00');
            },
            
            testNearFull: () => {
                window.dualDisplay.updateBatteryData({
                    level: 99,
                    charging: true,
                    timeRemaining: 2, // Should show 00:02:00:xx
                    chargingTimeToFull: 2
                });
                console.log('Test 99% charging mode set - should show ~2 minutes');
            },
            
            testCharging: () => {
                window.dualDisplay.updateBatteryData({
                    level: 80,
                    charging: true,
                    timeRemaining: 45,
                    chargingTimeToFull: 45
                });
                console.log('Test 80% charging mode set - 45 minutes to full');
            },
            
            testDischarging: () => {
                window.dualDisplay.updateBatteryData({
                    level: 75,
                    charging: false,
                    timeRemaining: 268,
                    chargingTimeToFull: 0
                });
                console.log('Test discharging mode set');
            }
        };
        
        // Start with actual battery reading
        console.log('Debug functions available:');
        console.log('- displayDebug.testFullyCharged() - Test 100% charged (00:00:00:00)');
        console.log('- displayDebug.testNearFull() - Test 99% charging');
        console.log('- displayDebug.testCharging() - Test normal charging');
        console.log('- displayDebug.testDischarging() - Test discharging');
        
    } catch (error) {
        console.error('Failed to initialize Dual Display:', error);
    }
});

// Handle window focus/blur for performance
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Display hidden - continuing updates');
    } else {
        console.log('Display visible - ensuring updates');
        if (window.dualDisplay) {
            window.dualDisplay.updateTimeDisplay();
            window.dualDisplay.updateBatteryCountdown();
        }
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DualDisplay;
}
