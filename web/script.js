// OpenAI API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

function getOpenAIAPIKey() {
    let key = localStorage.getItem('openaiApiKey');
    if (!key) {
        key = window.prompt('Enter your OpenAI API key to use AI features. It will be stored only on this device.');
        if (!key || !key.trim()) throw new Error('An OpenAI API key is required for AI features.');
        key = key.trim();
        localStorage.setItem('openaiApiKey', key);
    }
    return key;
}

// Global Variables
let currentCalculation = '';
let calculatorDisplay = '';
let installedApps = [];
let phoneNumber = '';
let userPasscode = localStorage.getItem('userPasscode') || '';
let currentPasscodeEntry = '';
let currentTheme = localStorage.getItem('currentTheme') || 'theme-light';
let userPhotos = JSON.parse(localStorage.getItem('userPhotos')) || [];
let currentHomeWallpaper = localStorage.getItem('homeWallpaper') || '';
let currentLockWallpaper = localStorage.getItem('lockWallpaper') || '';
let cameraStream = null;
let currentCameraFacingMode = 'user';

// --- IndexedDB Helper ---
const DB_NAME = 'userPhotosDB';
const STORE_NAME = 'photos';
let db;

async function initDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = event => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = event => {
            console.error('IndexedDB error:', event.target.errorCode);
            db = null;
            resolve(null);
        };
    });
}


    // Show/hide Cydia2 app window based on localStorage 'cydia2Installed'
    document.addEventListener('DOMContentLoaded', function() {
        var cydia2App = document.getElementById('cydia2-section');
        var installed = localStorage.getItem('cydia2Installed');
        if (cydia2App) {
            if (installed === '1') {
                cydia2App.style.display = 'flex';
            } else {
                cydia2App.style.display = 'none';
            }
        }
    });


async function savePhotoToDB(photo) {
    if (!db) await initDB();
    if (!db) {
        const photos = JSON.parse(localStorage.getItem('userPhotos') || '[]');
        photos.push(photo);
        localStorage.setItem('userPhotos', JSON.stringify(photos));
        return;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(photo);

        request.onsuccess = () => resolve();
        request.onerror = event => {
            console.error('Error saving photo to DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function loadPhotosFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            resolve(JSON.parse(localStorage.getItem('userPhotos') || '[]'));
            return;
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = event => {
            resolve(event.target.result || []);
        };

        request.onerror = event => {
            console.error('Error loading photos from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Initialize the Mobile OS
document.addEventListener('DOMContentLoaded', async function() {
    await initDB(); // Initialize the database
    initializeOS();
    loadInstalledApps(); // Load installed apps with modern styling
    updateStatusBar();
    setInterval(updateStatusBar, 1000);

    // Apply saved theme
    applyTheme(currentTheme);

    // Register service worker for PWA
    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
        navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Offline worker unavailable:', error));
    }
});

// Initialize OS Functions
function initializeOS() {
    // Start the clock
    updateStatusBar();
    setInterval(updateStatusBar, 1000);

    setupEventListeners();
    loadInstalledApps();
    setupAIToUI();
    initializeAppTheming();
    initializeScreenSaver();
    loadScreenSaverSettings();

    // Initialize app store refresh button
    const refreshBtn = document.getElementById('refreshStore');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAppStore);
    }
}

function setupEventListeners() {
    // App icon clicks - updated for modern design
    const appIcons = document.querySelectorAll('.app-icon, .app-item-modern, .floating-lock');
    appIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const appName = this.getAttribute('data-app');
            openApp(appName);
        });
    });

    // Scroll event for clock and home screen
    const homeScreen = document.querySelector('.home-screen-modern');
    const clockDisplay = document.querySelector('.clock-display-modern');

    if (homeScreen) {
        homeScreen.addEventListener('scroll', function() {
            const scrollTop = this.scrollTop;

            // Hide clock when scrolling down - more responsive
            if (scrollTop > 30) {
                clockDisplay.classList.add('hidden');
                this.classList.add('expanded');
            } else {
                clockDisplay.classList.remove('hidden');
                this.classList.remove('expanded');
            }
        });

        // Also listen to window scroll for better responsiveness
        window.addEventListener('scroll', function() {
            const scrollTop = window.scrollY;

            if (scrollTop > 30) {
                clockDisplay.classList.add('hidden');
                homeScreen.classList.add('expanded');
            } else {
                clockDisplay.classList.remove('hidden');
                homeScreen.classList.remove('expanded');
            }
        });
    }

    // Back button clicks
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const appWindow = this.closest('.app-window');
            closeApp(appWindow.id);
        });
    });

    // Lock screen functionality
    const lockButton = document.querySelector('[data-app="lock"]');
    if (lockButton) {
        lockButton.addEventListener('click', function() {
            activateLockScreen();
        });
    }

    // Terminal input event
    const terminalInput = document.getElementById('terminalInput');
    if (terminalInput) {
        terminalInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                handleTerminalCommand();
            }
        });
    }
}

// Clock Display Functions
function updateStatusBar() {
    const now = new Date();
    const timeElement = document.getElementById('current-time');
    const dateElement = document.getElementById('current-date');

    // Update time (big display)
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timeElement.textContent = timeString;

    // Update date (smaller display)
    const dateString = now.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    dateElement.textContent = dateString;
}

// App Management Functions
function openApp(appName) {
    // Prevent app opening if user is actively typing
    const activeElement = document.activeElement;
    if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.classList.contains('ai-input') ||
        activeElement.classList.contains('note-content')
    )) {
        console.log('Preventing app open while user is typing');
        return; // Don't open app while typing
    }

    const appWindows = document.querySelectorAll('.app-window');
    appWindows.forEach(window => {
        window.classList.remove('active');
        if(window.id === 'cydia2App') window.style.display = 'none';
    });

    // Handle lock app - show lock screen
    if (appName === 'lock') {
        showLockScreen();
        return;
    }

    const appMap = {
        'camera': 'cameraApp',
        'calculator': 'calculatorApp',
        'ai-to-ui': 'aiToUiApp',
        'app-store': 'appStoreApp',
        'settings': 'settingsApp',
        'phone': 'phoneApp',
        'photos': 'photosApp',
        'maths-ai': 'mathsAiApp',
        'ai-messages': 'aiMessagesApp',
        'ai-assistant': 'aiAssistantApp',
        'terminal': 'terminalApp',
        'cydia2': 'cydia2App'
    };

    const appWindowId = appMap[appName];
    if (appWindowId) {
        const appWindow = document.getElementById(appWindowId);
        if (appWindow) {
            if(appWindowId === 'cydia2App') {
                appWindow.style.display = 'flex';
            }
            appWindow.classList.add('active');
            // Focus terminal input if opening terminal
            if(appName === 'terminal') {
                setTimeout(() => {
                    const terminalInput = document.getElementById('terminalInput');
                    if(terminalInput) terminalInput.focus();
                }, 100);
            }
            // Initialize app-specific functionality
            if (appName === 'calculator') {
                initializeCalculator();
            } else if (appName === 'app-store') {
                refreshAppStore();
            } else if (appName === 'camera') {
                openEnhancedCameraApp();
                return; // Don't show default window
            } else if (appName === 'photos') {
                openPhotosApp();
                return; // Don't show default window
            } else if (appName === 'maths-ai') {
                initializeMathsAI();
            } else if (appName === 'ai-messages') {
                initializeAIMessages();
            } else if (appName === 'ai-assistant') {
                initializeAIAssistant();
            }
        }
    }
}
// Terminal App Logic
let cydia2Installed = false;
let terminalHistory = [];

function handleTerminalCommand() {
    const input = document.getElementById('terminalInput');
    const body = document.getElementById('terminalBody');
    if (!input || !body) return;
    const cmd = input.value.trim();
    if (!cmd) return;
    terminalHistory.push(cmd);
    appendTerminalOutput(`> ${cmd}`);
    input.value = '';

    // Command parsing
    if (/^install\s+cydia2$/i.test(cmd)) {
        if (!cydia2Installed) {
            // Simulate a 10-second install with progress lines
            let steps = [
                'Downloading cydia2 package...',
                'Verifying package integrity...',
                'Extracting files...',
                'Setting up environment...',
                'Installing dependencies...',
                'Configuring system...',
                'Finalizing installation...',
                'Cleaning up...',
                'Registering cydia2 app...',
                'Finishing up...'
            ];
            let i = 0;
            function nextStep() {
                if (i < steps.length) {
                    appendTerminalOutput(steps[i]);
                    i++;
                    setTimeout(nextStep, 300);
                } else {
                    localStorage.setItem('cydia2Num', '1');
                    installCydia2();
                    appendTerminalOutput('cydia2 installed.');
                }
            }
            nextStep();
        } else {
            appendTerminalOutput('cydia2 is already installed.');
        }
    } else if (/^remove\s+cydia2$/i.test(cmd)) {
        if (cydia2Installed || localStorage.getItem('cydia2Num') === '1') {
            localStorage.setItem('cydia2Num', '0');
            cydia2Installed = false;
            // Remove icon from home
            const icon = document.querySelector('.app-icon[data-app="cydia2"]');
            if (icon) icon.remove();
            appendTerminalOutput('cydia2 removed.');
        } else {
            appendTerminalOutput('cydia2 is not installed.');
        }
    } else if (/^open\s+cydia2$/i.test(cmd)) {
        if (cydia2Installed) {
            appendTerminalOutput('Opening cydia2...');
            setTimeout(() => {
                openApp('cydia2');
            }, 300);
        } else {
            appendTerminalOutput('cydia2 is not installed.');
        }
    } else if (/^close\s+cydia2$/i.test(cmd)) {
        if (cydia2Installed) {
            appendTerminalOutput('Closing cydia2...');
            closeApp('cydia2App');
        } else {
            appendTerminalOutput('cydia2 is not installed.');
        }
    } else if (/^back$/i.test(cmd)) {
        appendTerminalOutput('Going to home...');
        setTimeout(() => {
            closeApp('terminalApp');
        }, 300);
    } else if (/^help$/i.test(cmd)) {
        appendTerminalOutput('Available commands:\ninstall cydia2\nopen cydia2\nclose cydia2\nback\nhelp');
    } else {
        appendTerminalOutput('Unknown command. Type help for list of commands.');
    }
    scrollTerminalToBottom();
}

function appendTerminalOutput(text) {
    const body = document.getElementById('terminalBody');
    if (!body) return;
    const lines = text.split('\n');
    lines.forEach(line => {
        const div = document.createElement('div');
        div.className = 'terminal-output';
        div.textContent = line;
        body.appendChild(div);
    });
}

function scrollTerminalToBottom() {
    const body = document.getElementById('terminalBody');
    if (body) body.scrollTop = body.scrollHeight;
}

function installCydia2() {
    if (cydia2Installed) return;
    cydia2Installed = true;
    // Add Cydia2 icon to home if not present, after DOM is ready
    function addCydia2Icon() {
        if (!document.querySelector('.app-icon[data-app="cydia2"]')) {
            const appsGrid = document.getElementById('appsGrid');
            if (!appsGrid) {
                // If appsGrid not ready, try again shortly
                setTimeout(addCydia2Icon, 100);
                return;
            }
            const appIcon = document.createElement('div');
            appIcon.className = 'app-icon';
            appIcon.setAttribute('data-app', 'cydia2');
            appIcon.innerHTML = `

                <span class="app-name">cydia2</span>
            `;
            appIcon.addEventListener('click', function() {
                openApp('cydia2');
            });
            appsGrid.appendChild(appIcon);
        }
    }
    addCydia2Icon();
    // Persist Cydia2 icon in localStorage
    localStorage.setItem('cydia2Installed', '1');
    // Show Cydia2 app window if openApp('cydia2') is called
    const cydia2App = document.getElementById('cydia2App');
    if (cydia2App) {
        cydia2App.style.display = 'none';
        cydia2App.classList.remove('active');
    }
// On page load, check localStorage and show Cydia2 icon if installed
document.addEventListener('DOMContentLoaded', function() {
    // Always check localStorage for cydia2Num and update icon accordingly
    function updateCydia2Icon() {
        const appsGrid = document.getElementById('appsGrid');
        if (!appsGrid) {
            setTimeout(updateCydia2Icon, 100);
            return;
        }
        const icon = document.querySelector('.app-icon[data-app="cydia2"]');
            if (localStorage.getItem('cydia2Num') === '1') {
                if (!icon) {
                    const appIcon = document.createElement('div');
                    appIcon.classList.add('app-icon', 'cydia2-home-icon');
                    appIcon.setAttribute('data-app', 'cydia2');
                    appIcon.innerHTML = '<div class="app-icon-bg"><div class="icon robot" style="background-color: #222;"></div></div><span class="app-name">cydia2</span>';
                    appIcon.addEventListener('click', function() {
                        openApp('cydia2');
                    });
                    appsGrid.appendChild(appIcon);
                } else {
                    icon.style.display = '';
                }
                cydia2Installed = true;
            } else {
                if (icon) icon.style.display = 'none';
                cydia2Installed = false;
            }
    }
    updateCydia2Icon();
});
}

// Cydia2 App Terminal-like behavior

function appendCydia2Line(text) {
    const cydia2Content = document.getElementById('cydia2Content');
    if (!cydia2Content) return;
    const div = document.createElement('div');
    div.textContent = text;
    cydia2Content.appendChild(div);
}

function addCydia2Input() {
    const cydia2Content = document.getElementById('cydia2Content');
    if (!cydia2Content) return;
    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.alignItems = 'center';
    const prompt = document.createElement('span');
    prompt.textContent = '> ';
    prompt.style.color = '#39ff14';
    prompt.style.fontFamily = 'Fira Mono, Consolas, monospace';
    const input = document.createElement('input');
    input.type = 'text';
    input.style.background = 'transparent';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.color = '#39ff14';
    input.style.fontFamily = 'Fira Mono, Consolas, monospace';
    input.style.fontSize = '1.1em';
    input.autocomplete = 'off';
    inputRow.appendChild(prompt);
    inputRow.appendChild(input);
    cydia2Content.appendChild(inputRow);
    input.focus();
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            appendCydia2Line('> ' + input.value);
            addCydia2Input();
            inputRow.remove();
        }
    });
}

function focusCydia2Input() {
    const cydia2Content = document.getElementById('cydia2Content');
    if (!cydia2Content) return;
    const inputs = cydia2Content.querySelectorAll('input');
    if (inputs.length) {
        inputs[inputs.length - 1].focus();
    }
}

function closeApp(appWindowId) {
    const appWindow = document.getElementById(appWindowId);
    if (appWindow) {
        appWindow.classList.remove('active');
    }
}

function activateLockScreen() {
    // showLockScreen();
}

function lockScreen() {
    const lockWallpaper = localStorage.getItem('lockWallpaper') || currentLockWallpaper;
     userPasscode = localStorage.getItem('userPasscode') || '4321';


    // Create lock screen overlay
    const lockOverlay = document.createElement('div');
    lockOverlay.className = 'lock-screen';
    lockOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: ${lockWallpaper || 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'};
        ${lockWallpaper && lockWallpaper.startsWith('url(') ? 'background-size: cover; background-position: center; background-repeat: no-repeat;' : ''}
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; color: white; text-align: center;
    `;

    lockOverlay.innerHTML = `
        <div class="lock-content">
            <div class="lock-time" style="font-size: 72px; font-weight: 100; margin-bottom: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" id="lockTime">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="lock-date" style="font-size: 18px; margin-bottom: 50px; opacity: 0.9; font-weight: 300; text-transform: uppercase; letter-spacing: 0.5px;" id="lockDate">
                ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            ${userPasscode ? `
                <div class="passcode-section">
                    <div class="unlock-message" style="margin-bottom: 30px; font-size: 20px;">Enter Passcode</div>
                    <div class="passcode-dots" style="display: flex; justify-content: center; gap: 15px; margin-bottom: 30px;">
                        <div class="passcode-dot" id="dot1" style="width: 15px; height: 15px; border: 2px solid white; border-radius: 50%; background: transparent;"></div>
                        <div class="passcode-dot" id="dot2" style="width: 15px; height: 15px; border: 2px solid white; border-radius: 50%; background: transparent;"></div>
                        <div class="passcode-dot" id="dot3" style="width: 15px; height: 15px; border: 2px solid white; border-radius: 50%; background: transparent;"></div>
                        <div class="passcode-dot" id="dot4" style="width: 15px; height: 15px; border: 2px solid white; border-radius: 50%; background: transparent;"></div>
                    </div>
                    <div class="passcode-keypad" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 300px;">
                        <button class="passcode-key" onclick="enterPasscodeDigit('1')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">1</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('2')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">2</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('3')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">3</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('4')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">4</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('5')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">5</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('6')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">6</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('7')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">7</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('8')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">8</button>
                        <button class="passcode-key" onclick="enterPasscodeDigit('9')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">9</button>
                        <div></div>
                        <button class="passcode-key" onclick="enterPasscodeDigit('0')" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer;">0</button>
                        <button class="passcode-key" onclick="deletePasscodeDigit()" style="width: 70px; height: 70px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: white; font-size: 20px; cursor: pointer;">⌫</button>
                    </div>
                    <div class="passcode-error" id="passcodeError" style="color: #ff6b6b; margin-top: 20px; font-size: 16px;"></div>
                </div>
            ` : `
                <div class="unlock-message" style="padding: 15px 30px; background: rgba(255,255,255,0.2); border-radius: 25px; cursor: pointer;">
                    Tap to unlock
                </div>
            `}
        </div>
    `;

    // Update lock screen time
    function updateLockTime() {
        const timeEl = document.getElementById('lockTime');
        const dateEl = document.getElementById('lockDate');
        if (timeEl && dateEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        }
    }




    updateLockTime();
    const lockTimeInterval = setInterval(updateLockTime, 1000);

    document.body.appendChild(lockOverlay);

    // Store globals for passcode functions
    window.currentLockScreen = lockOverlay;
    window.lockTimeInterval = lockTimeInterval;
    window.currentPasscode = '';

    // Unlock functionality
    if (!userPasscode) {
        lockOverlay.addEventListener('click', function() {
            clearInterval(lockTimeInterval);
            document.body.removeChild(lockOverlay);
        });
    }
}

// Passcode Functions
function enterPasscodeDigit(digit) {
    if (window.currentPasscode.length < 4) {
        window.currentPasscode += digit;

        // Update dots
        const dotNum = window.currentPasscode.length;
        document.getElementById(`dot${dotNum}`).style.background = 'white';

        // Check if 4 digits entered
        if (window.currentPasscode.length === 4) {
            setTimeout(() => {
                checkPasscode();
            }, 200);
        }
    }
}

function deletePasscodeDigit() {
    if (window.currentPasscode.length > 0) {
        const dotNum = window.currentPasscode.length;
        document.getElementById(`dot${dotNum}`).style.background = 'transparent';
        window.currentPasscode = window.currentPasscode.slice(0, -1);
    }
}

// function checkPasscode() {
//     if (window.currentPasscode === userPasscode) {
//         // Correct passcode
//         unlockDevice();
//     } else {
//         // Wrong passcode
//         const errorEl = document.getElementById('passcodeError');
//         errorEl.textContent = 'Incorrect passcode';

//         // Clear dots and passcode
//         setTimeout(() => {
//             for (let i = 1; i <= 4; i++) {
//                 document.getElementById(`dot${i}`).style.background = 'transparent';
//             }
//             window.currentPasscode = '';
//             errorEl.textContent = '';
//         }, 1000);
//     }
// }

function unlockDevice() {
    if (window.lockTimeInterval) {
        clearInterval(window.lockTimeInterval);
    }
    if (window.currentLockScreen) {
        document.body.removeChild(window.currentLockScreen);
    }
}

// Calculator Functions
function initializeCalculator() {
    calculatorDisplay = '0';
    document.getElementById('calcDisplay').textContent = calculatorDisplay;
}

function appendToCalculator(value) {
    if (calculatorDisplay === '0' && !isNaN(value)) {
        calculatorDisplay = value;
    } else {
        calculatorDisplay += value;
    }
    document.getElementById('calcDisplay').textContent = calculatorDisplay;
}

function clearCalculator() {
    calculatorDisplay = '0';
    currentCalculation = '';
    document.getElementById('calcDisplay').textContent = calculatorDisplay;
}

function calculateResult() {
    try {
        // Replace display symbols with calculation symbols
        const calculation = calculatorDisplay.replace(/×/g, '*').replace(/÷/g, '/');
        const result = eval(calculation);
        calculatorDisplay = result.toString();
        document.getElementById('calcDisplay').textContent = calculatorDisplay;
    } catch (error) {
        calculatorDisplay = 'Error';
        document.getElementById('calcDisplay').textContent = calculatorDisplay;
        setTimeout(() => {
            clearCalculator();
        }, 2000);
    }
}

// Enhanced Phone Functions with Real Calling
let currentPhoneNumber = '';

function dialNumber(number) {
    currentPhoneNumber += number;
    const display = document.getElementById('phoneDisplay');
    if (display) {
        display.textContent = currentPhoneNumber;
    }
    updateCallButton();
}

function clearPhoneNumber() {
    currentPhoneNumber = '';
    const display = document.getElementById('phoneDisplay');
    if (display) {
        display.textContent = '';
    }
    updateCallButton();
}

function deletePhoneDigit() {
    currentPhoneNumber = currentPhoneNumber.slice(0, -1);
    const display = document.getElementById('phoneDisplay');
    if (display) {
        display.textContent = currentPhoneNumber;
    }
    updateCallButton();
}

function updateCallButton() {
    const callBtn = document.querySelector('.call-btn');
    if (callBtn) {
        if (currentPhoneNumber.length >= 3) {
            callBtn.textContent = '📞 Call ' + currentPhoneNumber;
            callBtn.style.backgroundColor = '#22c55e';
            callBtn.onclick = makePhoneCall;
        } else {
            callBtn.textContent = '📞 Enter Number';
            callBtn.style.backgroundColor = '#6b7280';
            callBtn.onclick = null;
        }
    }
}

function makePhoneCall() {
    if (!currentPhoneNumber) {
        showNotification('📞 Please enter a phone number first', 'info');
        return;
    }

    // Clean the phone number (remove non-digit characters except + and -)
    const cleanNumber = currentPhoneNumber.replace(/[^\d+\-().\s]/g, '');

    // Check if device supports phone calls
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        try {
            // Try to open the phone dialer with the number
            window.location.href = `tel:${cleanNumber}`;
            showNotification(`📞 Calling ${cleanNumber}...`, 'success');
        } catch (error) {
            showNotification('📞 Unable to make call on this device', 'error');
            console.log('Would call:', cleanNumber);
        }
    } else {
        // Desktop fallback - copy number to clipboard
        navigator.clipboard.writeText(cleanNumber).then(() => {
            showNotification(`📞 Phone number copied: ${cleanNumber}`, 'info');
        }).catch(() => {
            showNotification(`📞 Would call: ${cleanNumber} (Desktop simulation)`, 'info');
        });
    }
}

// AI to UI Functions
function setupAIToUI() {
    const applyBtn = document.getElementById('applyAIChanges');
    const resetBtn = document.getElementById('resetUI');

    if (applyBtn) applyBtn.addEventListener('click', applyAIChanges);
    if (resetBtn) resetBtn.addEventListener('click', resetUI);
}

function setAIPrompt(text) {
    const promptField = document.getElementById('aiPrompt');
    if (promptField) {
        promptField.value = text;
        // Auto-generate theme when example is clicked
        setTimeout(() => generateAITheme(), 100);
    }
}

async function applyAIChanges() {
    const prompt = document.getElementById('aiPrompt').value;
    const statusDiv = document.getElementById('aiStatus');

    if (!prompt.trim()) {
        statusDiv.className = 'ai-status error';
        statusDiv.textContent = 'Please enter a description of UI changes.';
        return;
    }

    // Show loading state
    const applyBtn = document.getElementById('applyAIChanges');
    const originalText = applyBtn.textContent;
    applyBtn.textContent = '⏳ Applying...';
    applyBtn.disabled = true;

    statusDiv.className = 'ai-status loading';
    statusDiv.textContent = 'AI is generating custom CSS for your request...';

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIAPIKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'system',
                    content: `You are a UI/UX designer that generates CSS code for mobile interface changes. Return only valid CSS code that can be applied to modify the appearance of a mobile OS interface.

Focus on:
- Colors, gradients, and backgrounds
- Icon shapes, colors, and sizes (ONLY the icon elements, not borders)
- Clock styling
- Animations and transitions
- Modern app items and glass effects

CRITICAL: Always use !important to override existing styles. Use specific selectors for different elements.
IMPORTANT: Only modify the actual icon elements (.icon, .app-icon-glass .icon), NOT the app item borders or containers.

Icon-only styling examples (target only the icon elements, not borders):
- Star icons: .app-icon-glass .icon, .icon { border-radius: 0 !important; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%) !important; }
- Heart icons: .app-icon-glass .icon, .icon { border-radius: 0 !important; clip-path: path('M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5 C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3 C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z') !important; }
- Circle icons: .app-icon-glass .icon, .icon { border-radius: 50% !important; clip-path: none !important; }
- Large icons: .app-icon-glass .icon, .icon { width: 60px !important; height: 60px !important; font-size: 30px !important; }
- Remove icon backgrounds: .app-icon-glass .icon, .icon { background: transparent !important; background-color: transparent !important; }
- Icon colors: .app-icon-glass .icon, .icon { color: gold !important; background-color: gold !important; }
- Hide icon text: .icon::before { display: none !important; }
- Show only colors: .app-icon-glass .icon, .icon { background-color: gold !important; }
- Diamond icons: .app-icon-glass .icon, .icon { border-radius: 0 !important; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%) !important; }
- Triangle icons: .app-icon-glass .icon, .icon { border-radius: 0 !important; clip-path: polygon(50% 0%, 0% 100%, 100% 100%) !important; }

Clock styling (modern):
- Large clock: .clock-time-modern { font-size: 6rem !important; }
- Clock colors: .clock-time-modern, .clock-date-modern { color: gold !important; text-shadow: 2px 2px 4px rgba(0,0,0,0.5) !important; }
- Rainbow clock: .clock-time-modern { background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000) !important; background-size: 400% 400% !important; animation: rainbowShift 3s ease-in-out infinite !important; }

Floating lock styling:
- Lock colors: .floating-lock { background: gold !important; }
- Lock icon: .floating-lock-icon { color: white !important; }

Background styling:
- Gradient: body, #mobile-os { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; }
- Animated background: body { background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab) !important; background-size: 400% 400% !important; animation: gradientShift 15s ease infinite !important; } @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }

Floating lock styling:
- Lock colors: .floating-lock { background: gold !important; }
- Lock icon: .floating-lock-icon { color: white !important; }

Always target multiple selectors to ensure changes apply everywhere!`
                }, {
                    role: 'user',
                    content: `Generate CSS code for this UI change request: ${prompt}`
                }],
                max_tokens: 800,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const generatedCSS = data.choices[0].message.content.replace(/```css|```/g, '');

        // Apply the generated CSS immediately
        let styleElement = document.getElementById('dynamic-styles');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'dynamic-styles';
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = generatedCSS;

        // Store for later reset
        window.generatedCSS = generatedCSS;

        // Show success
        statusDiv.className = 'ai-status success';
        statusDiv.textContent = '✅ Changes applied successfully! Your interface has been customized.';
        applyBtn.textContent = '✅ Applied!';
        setTimeout(() => {
            applyBtn.textContent = originalText;
            applyBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('AI Error:', error);
        statusDiv.className = 'ai-status error';
        statusDiv.textContent = '❌ Error applying changes: ' + error.message;
        applyBtn.textContent = '❌ Error';
        setTimeout(() => {
            applyBtn.textContent = originalText;
            applyBtn.disabled = false;
        }, 2000);
    }
}

function resetUI() {
    const styleElement = document.getElementById('dynamic-styles');
    if (styleElement) {
        styleElement.remove();
    }

    window.generatedCSS = null;
    const promptField = document.getElementById('aiPrompt');
    if (promptField) {
        promptField.value = '';
    }

    // Show reset confirmation
    const resetBtn = document.getElementById('resetUI');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = '✅ Reset!';
    setTimeout(() => {
        resetBtn.textContent = originalText;
    }, 1500);
}

// App Store Functions
async function refreshAppStore() {
    const appsList = document.getElementById('appsList');

    if (!appsList) {
        console.error('App store list element not found');
        return;
    }

    console.log('Refreshing app store...');
    appsList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading apps...</div>';

    try {
        // Load apps from JSON file
        console.log('Fetching apps from app-store.json...');
        const response = await fetch('apps/app-store.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Apps data loaded:', data);
        const availableApps = data.apps || [];

        // Check which apps are already installed
        availableApps.forEach(app => {
            app.installed = installedApps.some(installed =>
                (installed.id || installed) === app.id
            );
        });

        console.log('Displaying', availableApps.length, 'apps');
        updateAppStoreDisplay(availableApps);
    } catch (error) {
        console.error('Error loading app store:', error);
        // Show error message in app store
        appsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Failed to load apps. Please refresh.<br>Error: ' + error.message + '</div>';
    }
}

function updateAppStoreDisplay(apps) {
    const appsList = document.getElementById('appsList');
    const installedList = document.getElementById('installedAppsList');
    const installedCount = document.getElementById('installedCount');

    // Clear available apps list
    appsList.innerHTML = '';

    // Update installed apps count (including pre-installed apps)
    const totalInstalled = installedApps.length + 1; // +1 for AI Calculator
    installedCount.textContent = `${totalInstalled} apps`;

    // Show only non-installed apps in available section
    const availableApps = apps.filter(app => !app.installed);

    availableApps.forEach(app => {
        const appElement = document.createElement('div');
        appElement.className = 'store-app';
        appElement.setAttribute('data-app-id', app.id);

        // Format download count
        let downloadText = app.downloads;
        if (downloadText >= 1000000000) {
            downloadText = Math.floor(downloadText / 1000000000) + 'B';
        } else if (downloadText >= 1000000) {
            downloadText = Math.floor(downloadText / 1000000) + 'M';
        } else if (downloadText >= 1000) {
            downloadText = Math.floor(downloadText / 1000) + 'K';
        }

        // Create icon element - handle Apple Touch Icons, favicons, and fallbacks
        const iconColor = app.iconColor || '#667eea';
        const fallbackIcon = app.fallbackIcon || 'smartphone';
        const iconElement = app.icon.startsWith('http')
            ? `<img src="${app.icon}" alt="${app.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" onerror="createFallbackIcon(this, '${fallbackIcon}', '${iconColor}')">
               <div class="icon fallback-icon ${fallbackIcon}" style="background-color: ${iconColor}; display: none; color: white; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 24px;"></div>`
            : `<div class="icon ${app.icon}" style="background-color: ${iconColor};"></div>`;

        appElement.innerHTML = `
            <div class="store-app-icon">${iconElement}</div>
            <div class="store-app-info">
                <h4>${app.name}</h4>
                <p>${app.description}</p>
                <div class="app-meta">
                    <span class="category">${app.category}</span>
                </div>
                <button class="install-btn" onclick="installApp('${app.id}', '${app.type || 'app'}', '${app.url || ''}')">
                    Get
                </button>
            </div>
        `;

        appsList.appendChild(appElement);
    });

    // Update installed apps display
    updateInstalledAppsDisplay();

    // Reset search functionality when apps are updated
    allApps = [];
}

function updateInstalledAppsDisplay() {
    const installedList = document.getElementById('installedAppsList');
    const existingDynamic = installedList.querySelectorAll('.dynamic-installed');
    existingDynamic.forEach(el => el.remove());

    // Add dynamically installed apps
    installedApps.forEach(app => {
        if (app.id && app.id !== 'ai-calculator') {  // Skip AI Calculator as it's pre-built
            const appElement = document.createElement('div');
            appElement.className = 'store-app installed-app dynamic-installed';
            appElement.setAttribute('data-app-id', app.id);

            // Get app data for display - handle Apple Touch Icons, favicons, and fallbacks
            const iconColor = app.iconColor || '#667eea';
            const fallbackIcon = app.fallbackIcon || 'smartphone';
            const iconElement = app.icon.startsWith('http')
                ? `<img src="${app.icon}" alt="${app.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" onerror="createFallbackIcon(this, '${fallbackIcon}', '${iconColor}')">
                   <div class="icon fallback-icon ${fallbackIcon}" style="background-color: ${iconColor}; display: none; color: white; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 24px;"></div>`
                : `<div class="icon ${app.icon}" style="background-color: ${iconColor};"></div>`;

            appElement.innerHTML = `
                <div class="store-app-icon">${iconElement}</div>
                <div class="store-app-info">
                    <h4>${app.name}</h4>
                    <p>${app.description}</p>
                    <div class="app-meta">
                        <span class="category">${app.category || 'App'}</span>
                    </div>
                    <div class="app-actions">
                        <button class="open-btn" onclick="openInstalledApp('${app.id}')">Open</button>
                        <button class="uninstall-btn" onclick="uninstallApp('${app.id}')">Uninstall</button>
                    </div>
                </div>
            `;

            installedList.appendChild(appElement);
        }
    });
}

function installApp(appId, appType = 'app', appUrl = '') {
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.add('active');

    // Simulate installation process
    setTimeout(async () => {
        loadingScreen.classList.remove('active');

        // Get full app data from the store
        try {
            const response = await fetch('apps/app-store.json');
            const data = await response.json();
            const appData = data.apps.find(app => app.id === appId);

            if (appData) {
                // Store complete app info
                const appInfo = {
                    id: appId,
                    name: appData.name,
                    description: appData.description,
                    icon: appData.icon,
                    iconColor: appData.iconColor,
                    type: appType,
                    url: appUrl,
                    rating: appData.rating,
                    downloads: appData.downloads,
                    category: appData.category
                };

                installedApps.push(appInfo);
                saveInstalledApps();

                addAppToHomeScreen(appInfo);

                // Update app store display
                refreshAppStore();
            }
        } catch (error) {
            console.error('Error installing app:', error);
        }

    }, 1500);
}

function openInstalledApp(appId) {
    if (appId === 'ai-calculator') {
        openAICalculator();
    } else {
        // Find the app in installed apps
        const app = installedApps.find(installed => installed.id === appId);
        if (app && app.url) {
            window.open(app.url, '_blank');
        }
    }
}

function uninstallApp(appId) {
    if (appId === 'ai-calculator') {
        alert('AI Calculator is a system app and cannot be uninstalled.');
        return;
    }

    if (confirm('Are you sure you want to uninstall this app?')) {
        // Remove from installed apps
        installedApps = installedApps.filter(app => app.id !== appId);
        saveInstalledApps();

        // Remove from home screen
        const homeIcon = document.querySelector(`[data-app="${appId}"]`);
        if (homeIcon) {
            homeIcon.remove();
        }

        // Update app store display
        refreshAppStore();
    }
}

async function addAppToHomeScreen(appInfo) {
    const appsGrid = document.getElementById('appsGrid');

    // Get app details from store
    let appData = null;
    try {
        const response = await fetch('apps/app-store.json');
        const data = await response.json();
        appData = data.apps.find(app => app.id === (appInfo.id || appInfo));
    } catch (error) {
        console.error('Error loading app data:', error);
    }

    if (appData) {
        const appItem = document.createElement('div');
        appItem.className = 'app-item-modern installed';
        appItem.setAttribute('data-app', appData.id);

        // Create icon with consistent sizing
        const iconElement = appData.icon.startsWith('http')
            ? `<img src="${appData.icon}" alt="${appData.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 12px;" onerror="createFallbackIcon(this, '${appData.fallbackIcon || 'smartphone'}', '${appData.iconColor || '#667eea'}')">
               <div class="icon fallback-icon ${appData.fallbackIcon || 'smartphone'}" style="background-color: ${appData.iconColor || '#667eea'}; display: none; color: white; width: 50px; height: 50px; align-items: center; justify-content: center; font-size: 24px; border-radius: 12px;"></div>`
            : `<div class="icon ${appData.icon}" style="background-color: ${appData.iconColor || '#667eea'}; width: 50px; height: 50px; font-size: 24px; border-radius: 12px;"></div>`;

        // Truncate long app names
        let displayName = appData.name;
        if (displayName.length > 15) {
            displayName = displayName.substring(0, 13) + '...';
        }

        appItem.innerHTML = `
            <div class="app-icon-glass">
                ${iconElement}
            </div>
            <div class="app-info-modern">
                <span class="app-name-modern">${displayName}</span>
                <span class="app-desc-modern">${appData.description || 'Installed app'}</span>
            </div>
        `;

        appItem.addEventListener('click', function() {
            if (appData.type === 'website' && appData.url) {
                // Open website in new tab/window
                window.open(appData.url, '_blank');
            } else if (appData.id === 'ai-calculator') {
                openAICalculator();
            } else if (appData.id === 'notes') {
                openNotesApp();
            } else if (appData.id === 'camera') {
                openCameraApp();
            } else if (appData.id === 'photos') {
                openPhotosApp();
            } else {
                // Default app placeholder
                alert(`Opening ${appData.name}...`);
            }
        });

        appsGrid.appendChild(appItem);
    }
}

// Simple Calculator App
function openAICalculator() {
    const calcWindow = createAppWindow('Calculator', `
        <div class="simple-calculator">
            <div class="calc-display" id="simpleCalcDisplay">0</div>
            <div class="calc-grid">
                <button class="calc-key function" onclick="clearSimpleCalc()">C</button>
                <button class="calc-key function" onclick="toggleSign()">±</button>
                <button class="calc-key function" onclick="percentage()">%</button>
                <button class="calc-key operator" onclick="inputOperator('÷')">÷</button>

                <button class="calc-key number" onclick="inputNumber('7')">7</button>
                <button class="calc-key number" onclick="inputNumber('8')">8</button>
                <button class="calc-key number" onclick="inputNumber('9')">9</button>
                <button class="calc-key operator" onclick="inputOperator('×')">×</button>

                <button class="calc-key number" onclick="inputNumber('4')">4</button>
                <button class="calc-key number" onclick="inputNumber('5')">5</button>
                <button class="calc-key number" onclick="inputNumber('6')">6</button>
                <button class="calc-key operator" onclick="inputOperator('-')">−</button>

                <button class="calc-key number" onclick="inputNumber('1')">1</button>
                <button class="calc-key number" onclick="inputNumber('2')">2</button>
                <button class="calc-key number" onclick="inputNumber('3')">3</button>
                <button class="calc-key operator" onclick="inputOperator('+')">+</button>

                <button class="calc-key number zero" onclick="inputNumber('0')">0</button>
                <button class="calc-key number" onclick="inputDecimal()">.</button>
                <button class="calc-key equals" onclick="calculateSimpleResult()">=</button>
            </div>

            <div class="ai-section">
                <input type="text" id="aiMathInput" placeholder="Ask AI: What's 15% of 200?" />
                <button class="ai-calc-btn" onclick="solveWithAI()">🤖 Ask AI</button>
            </div>
        </div>
    `);

    document.body.appendChild(calcWindow);
    calcWindow.classList.add('active');
}

// Simple Calculator State
let calcDisplay = '0';
let previousValue = null;
let operator = null;
let waitingForNewValue = false;

function inputNumber(num) {
    const display = document.getElementById('simpleCalcDisplay');
    if (waitingForNewValue) {
        calcDisplay = num;
        waitingForNewValue = false;
    } else {
        calcDisplay = calcDisplay === '0' ? num : calcDisplay + num;
    }
    display.textContent = calcDisplay;
}

function inputOperator(nextOperator) {
    const inputValue = parseFloat(calcDisplay);

    if (previousValue === null) {
        previousValue = inputValue;
    } else if (operator) {
        const currentValue = previousValue || 0;
        const newValue = performCalculation[operator](currentValue, inputValue);

        calcDisplay = String(newValue);
        document.getElementById('simpleCalcDisplay').textContent = calcDisplay;
        previousValue = newValue;
    }

    waitingForNewValue = true;
    operator = nextOperator;
}

function inputDecimal() {
    if (waitingForNewValue) {
        calcDisplay = '0.';
        waitingForNewValue = false;
    } else if (calcDisplay.indexOf('.') === -1) {
        calcDisplay += '.';
    }
    document.getElementById('simpleCalcDisplay').textContent = calcDisplay;
}

function clearSimpleCalc() {
    calcDisplay = '0';
    previousValue = null;
    operator = null;
    waitingForNewValue = false;
    document.getElementById('simpleCalcDisplay').textContent = calcDisplay;
}

function toggleSign() {
    calcDisplay = String(parseFloat(calcDisplay) * -1);
    document.getElementById('simpleCalcDisplay').textContent = calcDisplay;
}

function percentage() {
    calcDisplay = String(parseFloat(calcDisplay) / 100);
    document.getElementById('simpleCalcDisplay').textContent = calcDisplay;
}

function calculateSimpleResult() {
    const inputValue = parseFloat(calcDisplay);

    if (previousValue !== null && operator) {
        const newValue = performCalculation[operator](previousValue, inputValue);
        calcDisplay = String(newValue);
        document.getElementById('simpleCalcDisplay').textContent = calcDisplay;

        previousValue = null;
        operator = null;
        waitingForNewValue = true;
    }
}

const performCalculation = {
    '+': (a, b) => a + b,
    '−': (a, b) => a - b,
    '×': (a, b) => a * b,
    '÷': (a, b) => a / b
};

async function solveWithAI() {
    const question = document.getElementById('aiMathInput').value;
    const display = document.getElementById('simpleCalcDisplay');

    if (!question.trim()) {
        showNotification('Please enter a math question', 'info');
        return;
    }

    display.textContent = 'AI thinking...';

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIAPIKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'system',
                    content: 'You are a helpful math assistant. Solve math problems and return only the numerical answer when possible. If the problem requires explanation, provide a brief one.'
                }, {
                    role: 'user',
                    content: question
                }],
                max_tokens: 150,
                temperature: 0.1
            })
        });

        const data = await response.json();
        const answer = data.choices[0].message.content;
        display.textContent = answer;
        calcDisplay = answer;

        // Clear the input
        document.getElementById('aiMathInput').value = '';

    } catch (error) {
        display.textContent = 'Error solving problem';
        setTimeout(() => {
            display.textContent = calcDisplay;
        }, 2000);
    }
}

function createAppWindow(title, content) {
    const appWindow = document.createElement('div');
    appWindow.className = 'app-window active';
    appWindow.id = `dynamic-${title.replace(/\s+/g, '-').toLowerCase()}`;

    appWindow.innerHTML = `
        <div class="app-header">
            <button class="back-btn" onclick="closeDynamicApp('${appWindow.id}')">← Back</button>
            <h3>${title}</h3>
        </div>
        <div class="app-content">
            ${content}
        </div>
    `;

    // Close any existing dynamic windows
    const existingWindows = document.querySelectorAll('.app-window[id^="dynamic-"]');
    existingWindows.forEach(window => window.remove());

    // Add to DOM and show
    document.body.appendChild(appWindow);

    return appWindow;
}

function closeDynamicApp(appId) {
    const appWindow = document.getElementById(appId);
    if (appWindow) {
        appWindow.remove();
    }
}



// Settings Functions
let currentWallpaper = null;

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Security Settings
function setupPasscode() {
    const passcode = prompt('Enter a 4-digit passcode:');
    if (passcode && passcode.length === 4 && /^\d+$/.test(passcode)) {
        userPasscode = passcode;
        localStorage.setItem('userPasscode', passcode);
        alert('Passcode set successfully!');
    } else if (passcode !== null) {
        alert('Please enter a 4-digit numeric passcode');
    }
}

function toggleBiometrics() {
    const enabled = document.getElementById('biometrics').checked;
    localStorage.setItem('biometrics', enabled);
    if (enabled) {
        alert('Biometric authentication enabled');
    }
}

function setAutoLock() {
    const time = document.getElementById('autoLock').value;
    localStorage.setItem('autoLock', time);
    showNotification(`🔒 Auto-lock set to ${time === 'never' ? 'never' : time + ' seconds'}`, 'success');

    // Start auto-lock timer if passcode is set
    initializeAutoLock();
}

// Auto-lock functionality
let autoLockTimer = null;
let lastActivity = Date.now();

function initializeAutoLock() {
    const passcode = localStorage.getItem('devicePasscode');
    const autoLockTime = localStorage.getItem('autoLock') || '60';

    // Clear existing timer
    if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
    }

    // Remove existing listeners
    document.removeEventListener('touchstart', resetAutoLockTimer);
    document.removeEventListener('mousedown', resetAutoLockTimer);
    document.removeEventListener('keydown', resetAutoLockTimer);

    // Only set auto-lock if passcode exists and auto-lock is not disabled
    if (passcode && autoLockTime !== 'never') {
        const timeoutMs = parseInt(autoLockTime) * 1000;

        // Set up activity listeners
        document.addEventListener('touchstart', resetAutoLockTimer);
        document.addEventListener('mousedown', resetAutoLockTimer);
        document.addEventListener('keydown', resetAutoLockTimer);

        // Start the auto-lock timer
        startAutoLockTimer(timeoutMs);
        console.log('Auto-lock initialized for', timeoutMs / 1000, 'seconds');
    } else {
        console.log('Auto-lock disabled - no passcode set or auto-lock set to never');
    }
}

function resetAutoLockTimer() {
    lastActivity = Date.now();

    // Clear existing timer
    if (autoLockTimer) {
        clearTimeout(autoLockTimer);
    }

    // Restart timer if passcode exists
    const passcode = localStorage.getItem('devicePasscode');
    const autoLockTime = localStorage.getItem('autoLock') || '60';

    if (passcode && autoLockTime !== 'never') {
        const timeoutMs = parseInt(autoLockTime) * 1000;
        startAutoLockTimer(timeoutMs);
    }
}

function startAutoLockTimer(timeoutMs) {
    autoLockTimer = setTimeout(() => {
        // Check if enough time has passed since last activity
        const timeSinceActivity = Date.now() - lastActivity;

        if (timeSinceActivity >= timeoutMs) {
            // Lock the device
            // showLockScreen();
            showNotification('🔒 Device auto-locked', 'info');
        } else {
            // Restart timer for remaining time
            const remainingTime = timeoutMs - timeSinceActivity;
            startAutoLockTimer(remainingTime);
        }
    }, timeoutMs);
}

// Display & Appearance Settings
function changeWallpaper() {
    loadPhotos(); // Load user photos

    const wallpapers = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'
    ];

    const wallpaperOptions = wallpapers.map((bg, index) =>
        `<div class="wallpaper-option gradient" style="background: ${bg}" onclick="selectWallpaper('${bg}', 'home')"></div>`
    ).join('');

    const photoOptions = photos.map(photo =>
        `<div class="wallpaper-option photo" onclick="selectWallpaper('url(${photo.dataUrl})', 'home')">
            <img src="${photo.dataUrl}" alt="Photo wallpaper" />
        </div>`
    ).join('');

    const wallpaperWindow = createAppWindow('Wallpapers', `
        <div class="wallpaper-picker">
            <div class="wallpaper-tabs">
                <button class="wallpaper-tab active" onclick="switchWallpaperTab('home')">Home Screen</button>
                <button class="wallpaper-tab" onclick="switchWallpaperTab('lock')">Lock Screen</button>
            </div>

            <div id="homeWallpapers" class="wallpaper-section">
                <h4>Gradient Wallpapers</h4>
                <div class="wallpaper-grid">
                    ${wallpaperOptions}
                </div>

                ${photos.length > 0 ? `
                    <h4>Your Photos (${photos.length} available)</h4>
                    <div class="wallpaper-grid">
                        ${photoOptions}
                    </div>
                ` : `
                    <div class="no-photos-wallpaper">
                        <p>📷 No photos available for wallpaper</p>
                        <button class="photos-btn" onclick="openCameraApp()">Take Photos</button>
                        <button class="photos-btn" onclick="openPhotosApp()">View Photos</button>
                    </div>
                `}
            </div>

            <div id="lockWallpapers" class="wallpaper-section" style="display: none;">
                <h4>Lock Screen Gradients</h4>
                <div class="wallpaper-grid">
                    ${wallpapers.map((bg, index) =>
                        `<div class="wallpaper-option gradient" style="background: ${bg}" onclick="selectWallpaper('${bg}', 'lock')"></div>`
                    ).join('')}
                </div>

                ${photos.length > 0 ? `
                    <h4>Your Photos (${photos.length} available)</h4>
                    <div class="wallpaper-grid">
                        ${photos.map(photo =>
                            `<div class="wallpaper-option photo" onclick="selectWallpaper('url(${photo.dataUrl})', 'lock')">
                                <img src="${photo.dataUrl}" alt="Photo wallpaper" />
                            </div>`
                        ).join('')}
                    </div>
                ` : `
                    <div class="no-photos-wallpaper">
                        <p>📷 No photos available for wallpaper</p>
                        <button class="photos-btn" onclick="openCameraApp()">Take Photos</button>
                        <button class="photos-btn" onclick="openPhotosApp()">View Photos</button>
                    </div>
                `}
            </div>
        </div>
    `);

    document.body.appendChild(wallpaperWindow);
    wallpaperWindow.classList.add('active');
}

function changeLockWallpaper() {
    const wallpapers = [
        'linear-gradient(135deg, #232526 0%, #414345 100%)',
        'linear-gradient(135deg, #0c0c0c 0%, #2d2d2d 100%)',
        'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        'linear-gradient(135deg, #7b4397 0%, #dc2430 100%)',
        'linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)',
        'linear-gradient(135deg, #eef2f3 0%, #8e9eab 100%)',
        'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
        'linear-gradient(135deg, #5c258d 0%, #4389a2 100%)'
    ];

    const wallpaperOptions = wallpapers.map((bg, index) =>
        `<div class="wallpaper-option" style="background: ${bg}" onclick="selectLockWallpaper('${bg}')"></div>`
    ).join('');

    const wallpaperWindow = createAppWindow('Lock Screen Wallpapers', `
        <div class="wallpaper-picker">
            <h3>Choose Lock Screen Wallpaper</h3>
            <div class="wallpaper-grid">
                ${wallpaperOptions}
            </div>
        </div>
    `);

    document.body.appendChild(wallpaperWindow);
    wallpaperWindow.classList.add('active');
}

function switchWallpaperTab(type) {
    // Update tab buttons
    document.querySelectorAll('.wallpaper-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Show/hide sections
    document.getElementById('homeWallpapers').style.display = type === 'home' ? 'block' : 'none';
    document.getElementById('lockWallpapers').style.display = type === 'lock' ? 'block' : 'none';
}

function selectWallpaper(background, type = 'home') {
    if (type === 'home') {
        currentWallpaper = background;

        // Handle photo wallpapers differently
        if (background.startsWith('url(')) {
            document.body.style.background = background;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
        } else {
            // Reset background properties for gradients
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundRepeat = '';
            document.body.style.background = background;
        }

        localStorage.setItem('wallpaper', background);
        showNotification('Home screen wallpaper applied!', 'success');
    } else if (type === 'lock') {
        currentLockWallpaper = background;
        localStorage.setItem('lockWallpaper', background);
        showNotification('Lock screen wallpaper applied!', 'success');
    }

    // Close wallpaper settings automatically after a short delay
    setTimeout(() => {
        const currentWindow = document.querySelector('.app-window:last-child');
        if (currentWindow) {
            closeDynamicApp(currentWindow.id);
        }
    }, 800);
}

function selectLockWallpaper(background) {
    currentLockWallpaper = background;
    localStorage.setItem('lockWallpaper', background);
    closeDynamicApp(document.querySelector('.app-window:last-child').id);
    alert('Lock screen wallpaper changed!');
}

function setTextSize() {
    const size = document.getElementById('textSize').value;
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('textSize', size);
}

function setIconStyle() {
    const style = document.getElementById('iconStyle').value;
    const icons = document.querySelectorAll('.icon');

    icons.forEach(icon => {
        icon.classList.remove('shape-circle', 'shape-square', 'shape-star');
        if (style !== 'normal') {
            icon.classList.add('shape-' + style);
        }
    });

    localStorage.setItem('iconStyle', style);
}

// Accessibility Settings
function toggleHighContrast() {
    const enabled = document.getElementById('highContrast').checked;
    document.body.classList.toggle('high-contrast', enabled);
    localStorage.setItem('highContrast', enabled);
}

function toggleReduceMotion() {
    const enabled = document.getElementById('reduceMotion').checked;
    document.body.classList.toggle('reduce-motion', enabled);
    localStorage.setItem('reduceMotion', enabled);
}

function toggleVoiceOver() {
    const enabled = document.getElementById('voiceOver').checked;
    localStorage.setItem('voiceOver', enabled);
    if (enabled) {
        alert('Voice Over is now enabled. This is a demo feature.');
    }
}

// Performance Settings
function toggleLowPowerMode() {
    const enabled = document.getElementById('lowPowerMode').checked;
    document.body.classList.toggle('low-power', enabled);
    localStorage.setItem('lowPowerMode', enabled);
}

function toggleBackgroundRefresh() {
    const enabled = document.getElementById('backgroundRefresh').checked;
    localStorage.setItem('backgroundRefresh', enabled);
}

function setAnimationSpeed() {
    const speed = document.getElementById('animationSpeed').value;
    document.documentElement.style.setProperty('--animation-speed', speed);
    localStorage.setItem('animationSpeed', speed);
}

// Storage Settings
function clearCache() {
    if (confirm('Clear all cached data? This may slow down app loading temporarily.')) {
        // Clear specific cache items but keep user data
        localStorage.removeItem('appStoreCache');
        localStorage.removeItem('tempData');
        alert('Cache cleared successfully!');
    }
}

function backupData() {
    try {
        const data = {
            timestamp: new Date().toISOString(),
            version: '2.0',

            // Content Data
            notes: localStorage.getItem('notes'),
            photos: localStorage.getItem('photos'),
            installedApps: localStorage.getItem('installedApps'),
            calculatorHistory: localStorage.getItem('calculatorHistory'),

            // UI & Theme Data
            selectedTheme: localStorage.getItem('selectedTheme'),
            generatedTheme: localStorage.getItem('generatedTheme'),
            aiThemeData: localStorage.getItem('aiThemeData'),
            homeWallpaper: localStorage.getItem('homeWallpaper'),
            lockWallpaper: localStorage.getItem('lockWallpaper'),
            wallpaperActive: localStorage.getItem('wallpaperActive'),
            wallpaper: localStorage.getItem('wallpaper'),

            // Security Settings
            devicePasscode: localStorage.getItem('devicePasscode'),
            lockScreenPasscode: localStorage.getItem('lockScreenPasscode'),
            userPasscode: localStorage.getItem('userPasscode'),
            autoLockTime: localStorage.getItem('autoLockTime'),
            biometricsEnabled: localStorage.getItem('biometricsEnabled'),

            // System Settings
            darkMode: localStorage.getItem('darkMode'),
            textSize: localStorage.getItem('textSize'),
            iconStyle: localStorage.getItem('iconStyle'),
            highContrast: localStorage.getItem('highContrast'),
            reduceMotion: localStorage.getItem('reduceMotion'),
            voiceOver: localStorage.getItem('voiceOver'),
            lowPowerMode: localStorage.getItem('lowPowerMode'),
            backgroundRefresh: localStorage.getItem('backgroundRefresh'),
            animationSpeed: localStorage.getItem('animationSpeed'),

            // AI Settings
            aiSuggestions: localStorage.getItem('aiSuggestions'),
            smartFeatures: localStorage.getItem('smartFeatures'),

            // App Settings
            cameraFacing: localStorage.getItem('cameraFacing'),
            cameraGridEnabled: localStorage.getItem('cameraGridEnabled'),
            cameraMode: localStorage.getItem('cameraMode'),
            weatherLocation: localStorage.getItem('weatherLocation'),
            musicPlaylist: localStorage.getItem('musicPlaylist'),

            // System State
            lastThemeUpdate: localStorage.getItem('lastThemeUpdate'),
            systemInfo: {
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                screen: `${screen.width}x${screen.height}`,
                language: navigator.language
            }
        };

        const backup = JSON.stringify(data, null, 2);
        const blob = new Blob([backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `mobile-os-complete-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showNotification('✅ Complete backup downloaded successfully!', 'success');
    } catch (error) {
        console.error('Backup failed:', error);
        showNotification('❌ Backup failed: ' + error.message, 'error');
    }
}

function restoreData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const backupData = JSON.parse(e.target.result);

                if (!backupData.timestamp) {
                    throw new Error('Invalid backup file format');
                }

                const backupDate = new Date(backupData.timestamp).toLocaleDateString();
                const version = backupData.version || '1.0';

                if (confirm(`Restore backup from ${backupDate} (v${version})?\n\nThis will overwrite ALL current data including:\n• Apps and content\n• Themes and wallpapers\n• Settings and preferences\n• Security settings\n\nContinue?`)) {

                    // Restore all localStorage items systematically
                    const excludeKeys = ['timestamp', 'version', 'systemInfo']; // Don't restore these

                    Object.keys(backupData).forEach(key => {
                        if (!excludeKeys.includes(key) && backupData[key] !== null && backupData[key] !== undefined) {
                            localStorage.setItem(key, backupData[key]);
                        }
                    });

                    // Handle legacy backup format (v1.0)
                    if (version === '1.0') {
                        if (backupData.settings) {
                            Object.keys(backupData.settings).forEach(key => {
                                if (backupData.settings[key]) {
                                    localStorage.setItem(key, backupData.settings[key]);
                                }
                            });
                        }

                        if (backupData.apps) {
                            localStorage.setItem('installedApps', backupData.apps);
                        }
                    }

                    showNotification('✅ Complete backup restored successfully! Reloading...', 'success');

                    // Show progress indicator
                    const progressDiv = document.createElement('div');
                    progressDiv.style.cssText = `
                        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        background: rgba(0,0,0,0.8); color: white; padding: 20px 40px;
                        border-radius: 10px; z-index: 10000; text-align: center;
                    `;
                    progressDiv.innerHTML = `
                        <div>🔄 Restoring data...</div>
                        <div style="margin-top: 10px; font-size: 14px;">This will take a moment</div>
                    `;
                    document.body.appendChild(progressDiv);

                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                }
            } catch (error) {
                console.error('Restore error:', error);
                showNotification('❌ Error: Invalid backup file format', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// AI Settings
function toggleAISuggestions() {
    const enabled = document.getElementById('aiSuggestions').checked;
    localStorage.setItem('aiSuggestions', enabled);
}

function toggleSmartFeatures() {
    const enabled = document.getElementById('smartFeatures').checked;
    localStorage.setItem('smartFeatures', enabled);
}

// About & Info
function showDeviceInfo() {
    const info = `
        Device: ${navigator.platform}
        User Agent: ${navigator.userAgent}
        Screen: ${screen.width}x${screen.height}
        Language: ${navigator.language}
        Online: ${navigator.onLine ? 'Yes' : 'No'}
        Cookies: ${navigator.cookieEnabled ? 'Enabled' : 'Disabled'}
    `;

    const infoWindow = createAppWindow('Device Information', `
        <div class="device-info">
            <pre>${info}</pre>
        </div>
    `);

    document.body.appendChild(infoWindow);
    infoWindow.classList.add('active');
}

// Reset Functions
function resetAllSettings() {
    if (confirm('Reset all settings to default? This will not delete your apps or data.')) {
        // Clear only settings, keep user data
        const settingsKeys = ['darkMode', 'wallpaper', 'lockWallpaper', 'textSize', 'iconStyle', 'highContrast', 'reduceMotion', 'lowPowerMode', 'animationSpeed'];
        settingsKeys.forEach(key => localStorage.removeItem(key));

        alert('Settings reset! Please reload the page.');
        location.reload();
    }
}

function factoryReset() {
    if (confirm('This will erase ALL data including apps, photos, notes, and settings. Are you sure?')) {
        if (confirm('This action cannot be undone. Continue?')) {
            localStorage.clear();
            alert('Factory reset complete. The page will now reload.');
            location.reload();
        }
    }
}

// Load saved settings
function loadSettings() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        const darkModeToggle = document.getElementById('darkMode');
        if (darkModeToggle) darkModeToggle.checked = true;
    }

    // Load wallpaper
    const wallpaper = localStorage.getItem('wallpaper');
    if (wallpaper) {
        currentWallpaper = wallpaper;
        if (wallpaper.startsWith('url(')) {
            document.body.style.background = wallpaper;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
        } else {
            document.body.style.background = wallpaper;
        }
    }

    // Load text size
    const textSize = localStorage.getItem('textSize');
    if (textSize) {
        document.documentElement.style.fontSize = textSize + 'px';
    }

    // Load other settings
    userPasscode = localStorage.getItem('userPasscode');
    currentLockWallpaper = localStorage.getItem('lockWallpaper');
}

// Storage Functions
function loadInstalledApps() {
    const saved = localStorage.getItem('installedApps');
    if (saved) {
        installedApps = JSON.parse(saved);
        installedApps.forEach(appInfo => {
            addAppToHomeScreen(appInfo);
        });
    }
}

function saveInstalledApps() {
    localStorage.setItem('installedApps', JSON.stringify(installedApps));
}

function loadInstalledApps() {
    const savedApps = localStorage.getItem('installedApps');
    if (savedApps) {
        installedApps = JSON.parse(savedApps);
        // Add installed apps to home screen with modern styling
        installedApps.forEach(appInfo => {
            addAppToHomeScreen(appInfo);
        });
    }
}

// Icon Fallback System
function createFallbackIcon(imgElement, fallbackIcon, iconColor) {
    imgElement.style.display = 'none';
    const fallbackDiv = imgElement.nextElementSibling;
    if (fallbackDiv) {
        fallbackDiv.style.display = 'flex';
        fallbackDiv.className = `icon fallback-icon ${fallbackIcon}`;
        fallbackDiv.style.backgroundColor = iconColor;
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 3000;
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Hide notification
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize settings on load
window.addEventListener('load', function() {
    loadSettings();
});

// Placeholder functions for other apps
function openPhotoEditor() {
    alert('Photo Editor coming soon!');
}

function openTaskManager() {
    alert('Task Manager coming soon!');
}

// Notes App Functions
function openNotesApp() {
    const notesWindow = createAppWindow('Notes', `
        <div class="notes-app">
            <div class="notes-toolbar">
                <button class="notes-btn new-note-btn" onclick="createNewNote()">+ New Note</button>
                <input type="text" id="searchNotes" placeholder="Search notes..." oninput="searchNotes()" />
            </div>
            <div class="notes-container">
                <div class="notes-list" id="notesList">
                    <!-- Notes will be populated here -->
                </div>
                <div class="note-editor" id="noteEditor" style="display: none;">
                    <div class="editor-header">
                        <input type="text" id="noteTitle" placeholder="Note title..." />
                        <div class="editor-actions">
                            <button class="notes-btn save-btn" onclick="saveCurrentNote()">Save</button>
                            <button class="notes-btn cancel-btn" onclick="cancelEdit()">Cancel</button>
                            <button class="notes-btn delete-btn" onclick="deleteCurrentNote()">Delete</button>
                        </div>
                    </div>
                    <textarea id="noteContent" placeholder="Start writing your note..."></textarea>
                </div>
            </div>
        </div>
    `);

    document.body.appendChild(notesWindow);
    notesWindow.classList.add('active');
    loadNotes();
}

let currentNoteId = null;
let notes = [];

function loadNotes() {
    const savedNotes = localStorage.getItem('notes');
    if (savedNotes) {
        notes = JSON.parse(savedNotes);
    } else {
        // Create a welcome note
        notes = [{
            id: 'welcome',
            title: 'Welcome to Notes!',
            content: 'This is your first note. Tap here to edit it, or create a new note with the + button.',
            timestamp: new Date().toISOString()
        }];
        saveNotes();
    }
    displayNotes();
}

function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

function displayNotes(filteredNotes = null) {
    const notesList = document.getElementById('notesList');
    const notesToShow = filteredNotes || notes;

    if (notesToShow.length === 0) {
        notesList.innerHTML = '<div class="no-notes">No notes found. Create your first note!</div>';
        return;
    }

    notesList.innerHTML = notesToShow.map(note => `
        <div class="note-item" onclick="editNote('${note.id}')">
            <div class="note-preview">
                <h4>${note.title || 'Untitled'}</h4>
                <p>${(note.content || '').substring(0, 80)}${note.content && note.content.length > 80 ? '...' : ''}</p>
                <small>${new Date(note.timestamp).toLocaleDateString()}</small>
            </div>
        </div>
    `).join('');
}

function createNewNote() {
    const newNote = {
        id: Date.now().toString(),
        title: '',
        content: '',
        timestamp: new Date().toISOString()
    };

    notes.unshift(newNote);
    editNote(newNote.id);
}

function editNote(noteId) {
    currentNoteId = noteId;
    const note = notes.find(n => n.id === noteId);

    if (!note) return;

    document.getElementById('notesList').style.display = 'none';
    document.getElementById('noteEditor').style.display = 'block';
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteTitle').focus();
}

function saveCurrentNote() {
    if (!currentNoteId) return;

    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    note.title = document.getElementById('noteTitle').value;
    note.content = document.getElementById('noteContent').value;
    note.timestamp = new Date().toISOString();

    saveNotes();
    cancelEdit();
    displayNotes();
}

function cancelEdit() {
    document.getElementById('notesList').style.display = 'block';
    document.getElementById('noteEditor').style.display = 'none';
    currentNoteId = null;
}

function deleteCurrentNote() {
    if (!currentNoteId) return;

    if (confirm('Are you sure you want to delete this note?')) {
        notes = notes.filter(n => n.id !== currentNoteId);
        saveNotes();
        cancelEdit();
        displayNotes();
    }
}

function searchNotes() {
    const searchTerm = document.getElementById('searchNotes').value.toLowerCase();

    if (!searchTerm) {
        displayNotes();
        return;
    }

    const filteredNotes = notes.filter(note =>
        (note.title || '').toLowerCase().includes(searchTerm) ||
        (note.content || '').toLowerCase().includes(searchTerm)
    );

    displayNotes(filteredNotes);
}

// Camera App Functions
let photos = [];

function openCameraApp() {
    loadPhotos(); // Load existing photos for gallery preview

    const cameraWindow = createAppWindow('Camera', `
        <div class="camera-app">
            <div class="camera-viewfinder">
                <video id="cameraVideo" autoplay playsinline muted></video>
                <canvas id="photoCanvas" style="display: none;"></canvas>
                <div class="camera-overlay">
                    <div class="camera-grid">
                        <div class="grid-line"></div>
                        <div class="grid-line"></div>
                        <div class="grid-line vertical"></div>
                        <div class="grid-line vertical"></div>
                    </div>
                    <div class="camera-info">
                        <span id="photoCount">${photos.length} photos</span>
                    </div>
                </div>
            </div>

            <div class="camera-controls">
                <button class="camera-control-btn gallery-btn" onclick="openPhotosApp()">
                    <div class="gallery-preview" id="galleryPreview">
                        ${photos.length > 0 ? `<img src="${photos[0].dataUrl}" alt="Last photo">` : '📷'}
                    </div>
                </button>

                <button class="camera-control-btn capture-btn" onclick="takePhoto()">
                    <div class="capture-inner"></div>
                </button>

                <button class="camera-control-btn switch-btn" onclick="switchCamera()">
                    <span class="switch-icon">🔄</span>
                </button>
            </div>

            <div class="camera-modes">
                <span class="camera-mode active">PHOTO</span>
                <span class="camera-mode">PORTRAIT</span>
                <span class="camera-mode">PANO</span>
            </div>

            <div class="camera-status" id="cameraStatus">Tap allow to use camera</div>
        </div>
    `);

    document.body.appendChild(cameraWindow);
    cameraWindow.classList.add('active');
    startCamera();
}

async function startCamera() {
    try {
        const video = document.getElementById('cameraVideo');
        const statusEl = document.getElementById('cameraStatus');

        if (!video) {
            console.error('Camera video element not found');
            return;
        }

        // Stop any existing stream
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        // Request camera permission with better constraints
        const constraints = {
            video: {
                facingMode: currentCameraFacing || 'environment',
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                aspectRatio: { ideal: 16/9 }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = cameraStream;

        // Ensure video plays
        await video.play();

        if (statusEl) {
            statusEl.textContent = 'Camera ready - Tap capture to take photo';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';
        }

    } catch (error) {
        console.error('Camera error:', error);
        const statusEl = document.getElementById('cameraStatus');
        if (statusEl) {
            statusEl.textContent = 'Camera access denied or not available';
            statusEl.style.background = '#f8d7da';
            statusEl.style.color = '#721c24';
        }
    }
}

async function switchCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    const isFrontCamera = cameraStream && cameraStream.getVideoTracks()[0].getSettings().facingMode === 'user';

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: isFrontCamera ? 'environment' : 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        document.getElementById('cameraVideo').srcObject = cameraStream;
    } catch (error) {
        console.error('Error switching camera:', error);
    }
}

function takePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');

    if (!video.videoWidth) {
        alert('Camera not ready. Please wait.');
        return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Save photo
    const photo = {
        id: Date.now().toString(),
        dataUrl: photoDataUrl,
        timestamp: new Date().toISOString(),
        name: `Photo ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
    };

    photos.unshift(photo);
    savePhotos();

    // Show capture animation
    showCaptureAnimation();

    // Update status
    document.getElementById('cameraStatus').textContent = `Photo saved! Total: ${photos.length} photos`;
}

function showCaptureAnimation() {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: white;
        z-index: 1000;
        opacity: 0.8;
        pointer-events: none;
    `;
    document.body.appendChild(flash);

    setTimeout(() => {
        document.body.removeChild(flash);
    }, 150);
}

// Enhanced Photos App with AI Features
function openPhotosApp() {
    loadPhotos();
    const photosWindow = createAppWindow('Photos', `
        <div class="photos-app-enhanced">
            <div class="photos-header">
                <div class="photos-stats">
                    <h2>Your Photos</h2>
                    <span class="photos-count" id="photosCount">${photos.length} items</span>
                </div>
                <div class="photos-actions">
                    <button class="photos-btn-modern camera-btn" onclick="openEnhancedCameraApp()">
                        <span class="icon">📷</span>
                        Camera
                    </button>
                    <button class="photos-btn-modern ai-btn" onclick="showAIPhotoFeatures()">
                        <span class="icon">🤖</span>
                        AI Tools
                    </button>
                </div>
            </div>

            <div class="photos-filter-tabs">
                <button class="filter-tab active" onclick="filterPhotos('all')">All</button>
                <button class="filter-tab" onclick="filterPhotos('recent')">Recent</button>
                <button class="filter-tab" onclick="filterPhotos('favorites')">Favorites</button>
            </div>

            <div class="photos-grid-enhanced" id="photosGridEnhanced">
                ${photos.length === 0 ?
                    `<div class="no-photos-enhanced">
                        <div class="no-photos-icon">📷</div>
                        <h3>No Photos Yet</h3>
                        <p>Capture moments with your camera</p>
                        <button class="get-started-btn" onclick="openEnhancedCameraApp()">Take First Photo</button>
                    </div>` :
                    photos.map((photo, index) => `
                        <div class="photo-item-enhanced" onclick="viewPhotoEnhanced('${photo.id}')" style="animation-delay: ${index * 0.1}s">
                            <img src="${photo.dataUrl}" alt="${photo.name}" loading="lazy" />
                            <div class="photo-overlay">
                                <div class="photo-actions">
                                    <button class="photo-action-btn" onclick="event.stopPropagation(); favoritePhoto('${photo.id}')">
                                        ${photo.favorite ? '❤️' : '🤍'}
                                    </button>
                                    <button class="photo-action-btn" onclick="event.stopPropagation(); sharePhoto('${photo.id}')">📤</button>
                                </div>
                                <div class="photo-meta">
                                    <small>${formatPhotoDate(photo.timestamp)}</small>
                                </div>
                            </div>
                        </div>
                    `).join('')}
            </div>

            <div class="ai-features-panel" id="aiFeaturesPanel" style="display: none;">
                <h3>🤖 AI Photo Features</h3>
                <div class="ai-feature-grid">
                    <button class="ai-feature-btn" onclick="analyzePhotosWithAI()">
                        <span class="ai-icon">🔍</span>
                        <span class="ai-label">Smart Analysis</span>
                        <small>Identify objects and scenes</small>
                    </button>
                    <button class="ai-feature-btn" onclick="enhancePhotosWithAI()">
                        <span class="ai-icon">✨</span>
                        <span class="ai-label">Auto Enhance</span>
                        <small>Improve photo quality</small>
                    </button>
                    <button class="ai-feature-btn" onclick="organizePhotosWithAI()">
                        <span class="ai-icon">📁</span>
                        <span class="ai-label">Smart Albums</span>
                        <small>Auto-organize by content</small>
                    </button>
                    <button class="ai-feature-btn" onclick="generatePhotoStory()">
                        <span class="ai-icon">📖</span>
                        <span class="ai-label">Photo Story</span>
                        <small>Create photo narratives</small>
                    </button>
                </div>
            </div>
        </div>
    `);

    document.body.appendChild(photosWindow);
    photosWindow.classList.add('active');
}

async function loadPhotos() {
    try {
        userPhotos = await loadPhotosFromDB();
    } catch (error) {
        console.warn('Using locally stored photos:', error);
        userPhotos = JSON.parse(localStorage.getItem('userPhotos') || '[]');
    }
    // The rest of the app uses the userPhotos variable, so we just need to load it.
    // If there's other UI that needs updating, it should be triggered from here.
}

async function savePhotos() {
    if (!db) await initDB();
    if (!db) {
        localStorage.setItem('userPhotos', JSON.stringify(userPhotos));
        return;
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing photos before saving new ones to prevent duplicates
    store.clear();

    for (const photo of userPhotos) {
        store.put(photo);
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            console.log('All photos saved to IndexedDB');
            resolve();
        };
        transaction.onerror = event => {
            console.error('Error saving photos to IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

function viewPhoto(photoId) {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const photoViewer = createAppWindow('Photo Viewer', `
        <div class="photo-viewer">
            <div class="photo-viewer-toolbar">
                <button class="photos-btn" onclick="sharePhoto('${photoId}')">📤 Share</button>
                <button class="photos-btn delete-btn" onclick="deletePhoto('${photoId}')">🗑️ Delete</button>
            </div>
            <div class="photo-viewer-image">
                <img src="${photo.dataUrl}" alt="${photo.name}" />
            </div>
            <div class="photo-viewer-info">
                <h3>${photo.name}</h3>
                <p>Taken: ${new Date(photo.timestamp).toLocaleString()}</p>
            </div>
        </div>
    `);

    document.body.appendChild(photoViewer);
    photoViewer.classList.add('active');
}

function deletePhoto(photoId) {
    if (confirm('Delete this photo?')) {
        photos = photos.filter(p => p.id !== photoId);
        savePhotos();
        // Close viewer and refresh photos app
        const viewer = document.querySelector('.app-window:last-child');
        if (viewer) viewer.remove();
        openPhotosApp();
    }
}

function deleteAllPhotos() {
    if (confirm('Delete all photos? This cannot be undone.')) {
        photos = [];
        savePhotos();
        openPhotosApp();
    }
}

function sharePhoto(photoId) {
    if (navigator.share) {
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
            navigator.share({
                title: photo.name,
                text: 'Check out this photo',
                url: photo.dataUrl
            });
        }
    } else {
        showNotification('Sharing not supported on this device', 'info');
    }
}

// Enhanced Photos App Functions
function formatPhotoDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function favoritePhoto(photoId) {
    const photoIndex = photos.findIndex(p => p.id === photoId);
    if (photoIndex !== -1) {
        photos[photoIndex].favorite = !photos[photoIndex].favorite;
        savePhotos();
        openPhotosApp(); // Refresh the display
    }
}

function filterPhotos(filter) {
    // Remove active class from all tabs
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    // Add active class to clicked tab
    event.target.classList.add('active');

    let filteredPhotos = photos;
    if (filter === 'recent') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filteredPhotos = photos.filter(photo => new Date(photo.timestamp) > sevenDaysAgo);
    } else if (filter === 'favorites') {
        filteredPhotos = photos.filter(photo => photo.favorite);
    }

    // Update grid
    const grid = document.getElementById('photosGridEnhanced');
    grid.innerHTML = filteredPhotos.length === 0 ?
        `<div class="no-photos-enhanced">
            <div class="no-photos-icon">📷</div>
            <h3>No ${filter} photos</h3>
            <p>Try a different filter or take some photos</p>
        </div>` :
        filteredPhotos.map((photo, index) => `
            <div class="photo-item-enhanced" onclick="viewPhotoEnhanced('${photo.id}')" style="animation-delay: ${index * 0.1}s">
                <img src="${photo.dataUrl}" alt="${photo.name}" loading="lazy" />
                <div class="photo-overlay">
                    <div class="photo-actions">
                        <button class="photo-action-btn" onclick="event.stopPropagation(); favoritePhoto('${photo.id}')">
                            ${photo.favorite ? '❤️' : '🤍'}
                        </button>
                        <button class="photo-action-btn" onclick="event.stopPropagation(); sharePhoto('${photo.id}')">📤</button>
                    </div>
                    <div class="photo-meta">
                        <small>${formatPhotoDate(photo.timestamp)}</small>
                    </div>
                </div>
            </div>
        `).join('');
}

function showAIPhotoFeatures() {
    const panel = document.getElementById('aiFeaturesPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function viewPhotoEnhanced(photoId) {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const photoViewer = createAppWindow('Photo Viewer', `
        <div class="photo-viewer-enhanced">
            <div class="photo-viewer-image">
                <img src="${photo.dataUrl}" alt="${photo.name}" />
            </div>
            <div class="photo-viewer-controls">
                <button class="viewer-btn favorite-btn ${photo.favorite ? 'active' : ''}" onclick="favoritePhoto('${photoId}')">
                    ${photo.favorite ? '❤️ Favorited' : '🤍 Add to Favorites'}
                </button>
                <button class="viewer-btn share-btn" onclick="sharePhoto('${photoId}')">
                    📤 Share
                </button>
                <button class="viewer-btn ai-btn" onclick="analyzePhotoWithAI('${photoId}')">
                    🤖 AI Analysis
                </button>
                <button class="viewer-btn delete-btn" onclick="deletePhoto('${photoId}')">
                    🗑️ Delete
                </button>
            </div>
            <div class="photo-info-enhanced">
                <h3>${photo.name || 'Untitled Photo'}</h3>
                <p><strong>Taken:</strong> ${new Date(photo.timestamp).toLocaleString()}</p>
                <div id="aiAnalysis-${photoId}" class="ai-analysis-result"></div>
            </div>
        </div>
    `);

    document.body.appendChild(photoViewer);
    photoViewer.classList.add('active');
}

// AI Photo Features
async function analyzePhotoWithAI(photoId) {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const analysisDiv = document.getElementById(`aiAnalysis-${photoId}`);
    analysisDiv.innerHTML = '<div class="ai-loading">🤖 Analyzing photo...</div>';

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIAPIKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-4-vision-preview',
                messages: [{
                    role: 'user',
                    content: [{
                        type: 'text',
                        text: 'Analyze this photo and describe what you see. Identify objects, people, scenes, and any interesting details.'
                    }, {
                        type: 'image_url',
                        image_url: { url: photo.dataUrl }
                    }]
                }],
                max_tokens: 300
            })
        });

        const data = await response.json();
        const analysis = data.choices[0].message.content;

        analysisDiv.innerHTML = `
            <div class="ai-analysis">
                <h4>🤖 AI Analysis</h4>
                <p>${analysis}</p>
            </div>
        `;

    } catch (error) {
        analysisDiv.innerHTML = '<div class="ai-error">❌ Analysis failed. Please try again.</div>';
    }
}

async function analyzePhotosWithAI() {
    if (photos.length === 0) {
        showNotification('No photos to analyze', 'info');
        return;
    }

    showNotification('🤖 Analyzing all photos...', 'info');
    // This would normally batch analyze all photos
    // For demo, we'll just show a summary
    setTimeout(() => {
        showNotification(`✨ Found ${photos.length} photos with various subjects and scenes`, 'success');
    }, 2000);
}

async function enhancePhotosWithAI() {
    showNotification('✨ AI photo enhancement coming soon!', 'info');
}

async function organizePhotosWithAI() {
    showNotification('📁 Smart albums will organize your photos automatically', 'info');
}

async function generatePhotoStory() {
    if (photos.length < 3) {
        showNotification('Add more photos to generate a story', 'info');
        return;
    }
    showNotification('📖 Creating your photo story...', 'info');
}

// Theme Management Functions
function applyTheme(themeName) {
    const body = document.body;
    // Remove all theme classes
    body.classList.remove('theme-light', 'theme-dark', 'theme-ocean', 'theme-sunset', 'theme-forest', 'theme-cosmic');

    // Add new theme class
    body.classList.add(themeName);
    currentTheme = themeName;
    localStorage.setItem('currentTheme', themeName);
}

function openThemeSettings() {
    const themes = [
        { name: 'light', label: 'Light', description: 'Clean and bright interface', color: '#667eea' },
        { name: 'dark', label: 'Dark', description: 'Easy on the eyes', color: '#1a1a2e' },
        { name: 'ultradark', label: 'Ultra Dark', description: 'Pure black elegance', color: '#000000' },
        { name: 'ocean', label: 'Ocean', description: 'Deep blue serenity', color: '#0082c8' },
        { name: 'sunset', label: 'Sunset', description: 'Warm and vibrant', color: '#ff9a9e' },
        { name: 'forest', label: 'Forest', description: 'Natural green tones', color: '#71b280' },
        { name: 'cosmic', label: 'Cosmic', description: 'Purple space vibes', color: '#764ba2' },
        { name: 'neon', label: 'Neon', description: 'Cyberpunk vibes', color: '#00ffff' },
        { name: 'autumn', label: 'Autumn', description: 'Warm fall colors', color: '#ff7e5f' },
        { name: 'winter', label: 'Winter', description: 'Cool and serene', color: '#e6ddd4' },
        { name: 'space', label: 'Space', description: 'Deep space blue', color: '#004e92' }
    ];

    const currentTheme = localStorage.getItem('selectedTheme') || 'dark';

    const themeOptions = themes.map(theme =>
        `<div class="theme-option ${theme.name} ${currentTheme === theme.name ? 'active' : ''}"
              onclick="selectAndApplyTheme('${theme.name}')">
            <div class="theme-preview" style="background: ${theme.color}; height: 50px; border-radius: 8px; margin-bottom: 8px;"></div>
            <h4>${theme.label}</h4>
            <p style="font-size: 11px; opacity: 0.7; margin: 0;">${theme.description}</p>
        </div>`
    ).join('');

    const themeWindow = createAppWindow('Themes', `
        <div class="theme-settings">
            <h3>🎨 Choose Theme</h3>
            <p style="margin-bottom: 20px; opacity: 0.8;">Select a theme to customize your interface</p>
            <div class="themes-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 10px;">
                ${themeOptions}
            </div>
            <style>
                .theme-option {
                    padding: 12px;
                    border: 2px solid rgba(255,255,255,0.2);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-align: center;
                    background: rgba(255,255,255,0.05);
                }
                .theme-option:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    border-color: rgba(255,255,255,0.4);
                }
                .theme-option.active {
                    border-color: #667eea;
                    background: rgba(102, 126, 234, 0.1);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                }
                .theme-option h4 {
                    margin: 5px 0 3px 0;
                    color: white;
                    font-size: 14px;
                }
                .theme-option p {
                    margin: 0;
                    color: rgba(255,255,255,0.7);
                    font-size: 11px;
                }
            </style>
        </div>
    `);

    document.body.appendChild(themeWindow);
    themeWindow.classList.add('active');
}

function selectAndApplyTheme(themeName) {
    // Apply the theme
    applyTheme(themeName);

    // Close the theme settings window after a short delay
    setTimeout(() => {
        const themeWindow = document.querySelector('.app-window:last-child');
        if (themeWindow && themeWindow.querySelector('.theme-settings')) {
            closeDynamicApp(themeWindow.id);
        }
    }, 500);
}

// Enhanced Passcode Management
function openPasscodeSettings() {
    const hasPasscode = localStorage.getItem('devicePasscode') && localStorage.getItem('devicePasscode').length > 0;

    const passcodeWindow = createAppWindow('Passcode Settings', `
        <div class="passcode-settings">
            <div class="setting-item">
                <label>Current Status</label>
                <span class="status-indicator ${hasPasscode ? 'enabled' : 'disabled'}">
                    ${hasPasscode ? '🔒 Passcode Enabled' : '🔓 No Passcode Set'}
                </span>
            </div>

            <div class="setting-item">
                <button class="settings-btn" onclick="${hasPasscode ? 'changePasscode()' : 'setupNewPasscode()'}">
                    ${hasPasscode ? 'Change Passcode' : 'Set Passcode'}
                </button>
            </div>

            ${hasPasscode ? `
                <div class="setting-item">
                    <button class="settings-btn danger" onclick="removePasscode()">
                        Remove Passcode
                    </button>
                </div>
            ` : ''}

            <div class="setting-item">
                <label>Auto-Lock Timing</label>
                <select id="autoLockTime" onchange="updateAutoLock()">
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="never">Never</option>
                </select>
            </div>
        </div>
    `);

    document.body.appendChild(passcodeWindow);
    passcodeWindow.classList.add('active');
}

function setupNewPasscode() {
    const passcode = prompt('Enter a 4-digit passcode:');
    if (passcode && passcode.length === 4 && /^\d+$/.test(passcode)) {
        const confirmPasscode = prompt('Confirm your passcode:');
        if (confirmPasscode === passcode) {
            localStorage.setItem('devicePasscode', passcode);
            showNotification('🔒 Passcode set successfully! Your device is now protected.', 'success');
            initializeAutoLock(); // Start auto-lock
            closeDynamicApp(document.querySelector('.app-window:last-child').id);
        } else {
            showNotification('❌ Passcodes do not match. Please try again.', 'error');
        }
    } else if (passcode !== null) {
        showNotification('⚠️ Please enter a 4-digit numeric passcode', 'error');
    }
}

function changePasscode() {
    const currentPasscode = prompt('Enter your current passcode:');
    const savedPasscode = localStorage.getItem('devicePasscode');
    if (currentPasscode === savedPasscode) {
        setupNewPasscode();
    } else if (currentPasscode !== null) {
        showNotification('❌ Incorrect current passcode', 'error');
    }
}

function removePasscode() {
    const currentPasscode = prompt('Enter your current passcode to remove it:');
    const savedPasscode = localStorage.getItem('devicePasscode');
    if (currentPasscode === savedPasscode) {
        localStorage.removeItem('devicePasscode');

        // Clear auto-lock when passcode is removed
        if (autoLockTimer) {
            clearTimeout(autoLockTimer);
            autoLockTimer = null;
        }

        showNotification('🔓 Passcode removed successfully', 'success');
        closeDynamicApp(document.querySelector('.app-window:last-child').id);
    } else if (currentPasscode !== null) {
        showNotification('❌ Incorrect passcode', 'error');
    }
}

function updateAutoLock() {
    const value = document.getElementById('autoLockTime').value;
    localStorage.setItem('autoLock', value);
}

// Ultra Simple Wallpaper System - One-Tap Apply
function openWallpaperSettings() {
    loadPhotos(); // Load user photos

    const wallpaperWindow = createAppWindow('Easy Wallpapers', `
        <div class="ultra-simple-wallpaper">
            <div class="wallpaper-header">
                <h3>🖼️ Tap to Apply Wallpaper</h3>
                <p>One tap sets both home and lock screens!</p>
            </div>

            <!-- Built-in Presets -->
            <div class="wallpaper-section">
                <h4>🎨 Built-in Wallpapers</h4>
                <div class="preset-wallpaper-grid">
                    <div class="preset-wallpaper-item" onclick="applyEasyWallpaper('linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'Purple Galaxy')">
                        <div class="preset-preview" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
                        <span>Purple Galaxy</span>
                    </div>
                    <div class="preset-wallpaper-item" onclick="applyEasyWallpaper('linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', 'Rose Sunset')">
                        <div class="preset-preview" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);"></div>
                        <span>Rose Sunset</span>
                    </div>
                    <div class="preset-wallpaper-item" onclick="applyEasyWallpaper('linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', 'Ocean Breeze')">
                        <div class="preset-preview" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);"></div>
                        <span>Ocean Breeze</span>
                    </div>
                    <div class="preset-wallpaper-item" onclick="applyEasyWallpaper('linear-gradient(135deg, #ff9a56 0%, #ffad56 100%)', 'Golden Hour')">
                        <div class="preset-preview" style="background: linear-gradient(135deg, #ff9a56 0%, #ffad56 100%);"></div>
                        <span>Golden Hour</span>
                    </div>
                    <div class="preset-wallpaper-item" onclick="applyEasyWallpaper('linear-gradient(135deg, #000000 0%, #1a1a1a 100%)', 'Pure Black')">
                        <div class="preset-preview" style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);"></div>
                        <span>Pure Black</span>
                    </div>
                    <div class="preset-wallpaper-item" onclick="applyEasyWallpaper('linear-gradient(135deg, #0082c8 0%, #667db6 100%)', 'Deep Ocean')">
                        <div class="preset-preview" style="background: linear-gradient(135deg, #0082c8 0%, #667db6 100%);"></div>
                        <span>Deep Ocean</span>
                    </div>
                </div>
            </div>

            ${photos.length > 0 ? `
                <div class="wallpaper-section">
                    <h4>📸 Your Photos</h4>
                    <div class="photo-wallpaper-grid">
                        ${photos.map(photo => `
                            <div class="photo-wallpaper-item" onclick="applyEasyWallpaper('url(${photo.dataUrl})', 'Custom Photo')">
                                <img src="${photo.dataUrl}" alt="Photo" />
                                <span>📷 Tap to Apply</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="wallpaper-actions">
                <button class="wallpaper-action-btn primary" onclick="importPhotoForWallpaper()">
                    📁 Add Your Image
                </button>
                <button class="wallpaper-action-btn" onclick="openEnhancedCameraApp()">
                    📸 Take Photo
                </button>
            </div>
        </div>
    `);

    document.body.appendChild(wallpaperWindow);
    wallpaperWindow.classList.add('active');
}

// Simplified Wallpaper Functions
function setAsHomeWallpaper(photoDataUrl) {
    const background = `url(${photoDataUrl})`;
    document.body.style.background = background;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    localStorage.setItem('wallpaper', background);
    showNotification('Home screen wallpaper set!', 'success');

    // Close wallpaper settings
    setTimeout(() => {
        const currentWindow = document.querySelector('.app-window:last-child');
        if (currentWindow) {
            closeDynamicApp(currentWindow.id);
        }
    }, 800);
}

function setAsLockWallpaper(photoDataUrl) {
    const background = `url(${photoDataUrl})`;
    currentLockWallpaper = background;
    localStorage.setItem('lockWallpaper', background);
    showNotification('Lock screen wallpaper set!', 'success');

    // Close wallpaper settings
    setTimeout(() => {
        const currentWindow = document.querySelector('.app-window:last-child');
        if (currentWindow) {
            closeDynamicApp(currentWindow.id);
        }
    }, 800);
}

function setAsBothWallpaper(photoDataUrl) {
    setAsHomeWallpaper(photoDataUrl);
    setTimeout(() => {
        setAsLockWallpaper(photoDataUrl);
        showNotification('Both wallpapers set!', 'success');
    }, 100);
}

// Ultra Easy Wallpaper Application - Smooth & Reliable
function applyEasyWallpaper(backgroundValue, wallpaperName) {
    // Clear any existing theme to avoid conflicts
    localStorage.removeItem('selectedTheme');

    // Apply transition for smooth change
    document.body.style.transition = 'background 0.5s ease-in-out';

    // Apply to home screen with proper handling
    if (backgroundValue.startsWith('url(')) {
        // For image wallpapers
        document.body.style.background = backgroundValue;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        localStorage.setItem('wallpaper', backgroundValue);
        localStorage.setItem('wallpaperType', 'image');
    } else {
        // For gradient wallpapers
        document.body.style.background = backgroundValue;
        document.body.style.backgroundSize = 'auto';
        document.body.style.backgroundPosition = 'initial';
        document.body.style.backgroundRepeat = 'initial';
        document.body.style.backgroundAttachment = 'initial';
        localStorage.setItem('wallpaper', backgroundValue);
        localStorage.setItem('wallpaperType', 'gradient');
    }

    // Apply to mobile OS container as well for consistency
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.background = backgroundValue;
        if (backgroundValue.startsWith('url(')) {
            mobileOS.style.backgroundSize = 'cover';
            mobileOS.style.backgroundPosition = 'center';
            mobileOS.style.backgroundRepeat = 'no-repeat';
        }
    }

    // Apply to lock screen
    currentLockWallpaper = backgroundValue;
    localStorage.setItem('lockWallpaper', backgroundValue);

    // Update CSS custom properties for consistent theming
    document.documentElement.style.setProperty('--bg-primary', backgroundValue);

    showNotification(`🎨 ${wallpaperName} applied to both screens!`, 'success');

    // Remove transition after animation completes
    setTimeout(() => {
        document.body.style.transition = '';
    }, 500);

    // Auto-close wallpaper settings after animation
    setTimeout(() => {
        const currentWindow = document.querySelector('.app-window:last-child');
        if (currentWindow) {
            closeDynamicApp(currentWindow.id);
        }
    }, 800);
}

function importPhotoForWallpaper() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const photo = {
                id: Date.now().toString(),
                dataUrl: e.target.result,
                timestamp: new Date().toISOString(),
                name: file.name || `Imported ${new Date().toLocaleDateString()}`
            };
            photos.unshift(photo);
            savePhotos();
            showNotification('Image imported successfully!', 'success');

            // Refresh wallpaper view
            openWallpaperSettings();
        };
        reader.readAsDataURL(file);
    };

    fileInput.click();
}

function resetToDefaultWallpapers() {
    const defaultWallpaper = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    const defaultLockWallpaper = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';

    // Reset home wallpaper
    document.body.style.background = defaultWallpaper;
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';
    localStorage.setItem('wallpaper', defaultWallpaper);

    // Reset lock wallpaper
    currentLockWallpaper = defaultLockWallpaper;
    localStorage.setItem('lockWallpaper', defaultLockWallpaper);

    showNotification('Wallpapers reset to default!', 'success');
}

function openFileAccess() {
    // Create a file input for accessing device files
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;

    fileInput.onchange = function(event) {
        const files = event.target.files;
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photo = {
                    id: Date.now().toString() + Math.random(),
                    dataUrl: e.target.result,
                    timestamp: new Date().toISOString(),
                    name: file.name || `Imported ${new Date().toLocaleDateString()}`
                };
                userPhotos.unshift(photo);
                localStorage.setItem('userPhotos', JSON.stringify(userPhotos));
                alert(`${files.length} image(s) imported successfully!`);

                // Refresh wallpaper view if open
                if (document.querySelector('.wallpaper-picker')) {
                    closeDynamicApp(document.querySelector('.app-window:last-child').id);
                    openWallpaperSettings();
                }
            };
            reader.readAsDataURL(file);
        }
    };

    fileInput.click();
}

// Enhanced Camera App
function openEnhancedCameraApp() {
    const cameraWindow = createAppWindow('Camera', `
        <div class="camera-app">
            <div class="camera-top-bar">
                <button class="camera-flash-btn">⚡</button>
                <div class="photo-count">${userPhotos.length} photos</div>
            </div>

            <div class="camera-viewfinder">
                <video id="cameraVideo" autoplay playsinline muted></video>
                <canvas id="photoCanvas" style="display: none;"></canvas>
                <div class="camera-overlay">
                    <div class="camera-grid" id="cameraGrid" style="display: none;">
                        <div class="grid-line"></div>
                        <div class="grid-line"></div>
                        <div class="grid-line vertical"></div>
                        <div class="grid-line vertical"></div>
                    </div>
                </div>
            </div>

            <div class="camera-controls">
                <button class="gallery-btn" onclick="openPhotosApp()">
                    <div class="gallery-preview" id="galleryPreview">
                        ${userPhotos.length > 0 ? `<img src="${userPhotos[0].dataUrl}" alt="Last photo">` : '📷'}
                    </div>
                </button>

                <button class="capture-btn" onclick="takeEnhancedPhoto()">
                    <div class="capture-inner"></div>
                </button>

                <button class="switch-btn" onclick="switchCameraMode()">
                    🔄
                </button>
            </div>

            <div class="camera-modes">
                <span class="camera-mode active">PHOTO</span>
                <span class="camera-mode">PORTRAIT</span>
                <span class="camera-mode">PANO</span>
            </div>
        </div>
    `);

    document.body.appendChild(cameraWindow);
    cameraWindow.classList.add('active');
    startEnhancedCamera();
}

async function startEnhancedCamera() {
    try {
        const video = document.getElementById('cameraVideo');

        // Stop existing stream
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        // Request camera with high quality
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCameraFacingMode,
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 }
            },
            audio: false
        });

        video.srcObject = cameraStream;

        // Show grid toggle
        const gridToggle = document.createElement('button');
        gridToggle.textContent = '⊞';
        gridToggle.className = 'camera-flash-btn';
        gridToggle.style.position = 'absolute';
        gridToggle.style.top = '60px';
        gridToggle.style.right = '20px';
        gridToggle.onclick = toggleCameraGrid;
        document.querySelector('.camera-top-bar').appendChild(gridToggle);

    } catch (error) {
        alert('Camera access denied or not available. Please check permissions.');
        console.error('Camera error:', error);
    }
}

function toggleCameraGrid() {
    const grid = document.getElementById('cameraGrid');
    grid.style.display = grid.style.display === 'none' ? 'block' : 'none';
}

function switchCameraMode() {
    currentCameraFacingMode = currentCameraFacingMode === 'user' ? 'environment' : 'user';
    startEnhancedCamera();
}

function takeEnhancedPhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');

    if (!video.videoWidth) {
        alert('Camera not ready. Please wait.');
        return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to high quality data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Save photo
    const photo = {
        id: Date.now().toString(),
        dataUrl: photoDataUrl,
        timestamp: new Date().toISOString(),
        name: `Photo ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        size: Math.round(photoDataUrl.length * 0.75), // Approximate size
        dimensions: `${canvas.width}x${canvas.height}`
    };

    userPhotos.unshift(photo);
    localStorage.setItem('userPhotos', JSON.stringify(userPhotos));

    // Show capture animation
    showCaptureAnimation();

    // Update photo count
    document.querySelector('.photo-count').textContent = `${userPhotos.length} photos`;

    // Update gallery preview
    if (userPhotos.length > 0) {
        document.getElementById('galleryPreview').innerHTML = `<img src="${userPhotos[0].dataUrl}" alt="Last photo">`;
    }
}

// Enhanced Camera Functions
async function startCamera() {
    const video = document.getElementById('cameraVideo');
    const viewfinder = document.querySelector('.camera-viewfinder');

    try {
        // Show loading state
        showNotification('📷 Starting camera...', 'info');

        const constraints = {
            video: {
                facingMode: currentCameraFacing === 'front' ? 'user' : 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play().then(resolve).catch(resolve);
            };
        });

        showNotification('📷 Camera ready!', 'success');

        // Update camera info
        const info = document.querySelector('.camera-info');
        if (info) {
            info.textContent = `${currentCameraFacing === 'front' ? 'Front' : 'Back'} Camera • ${video.videoWidth}x${video.videoHeight}`;
        }

    } catch (error) {
        console.error('Camera access failed:', error);
        showCameraError(viewfinder, error);
        showNotification('❌ Camera access denied', 'error');
    }
}

function showCameraError(container, error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'camera-error';

    let message = 'Camera not available';
    if (error.name === 'NotAllowedError') {
        message = 'Camera access denied. Please allow camera permissions and try again.';
    } else if (error.name === 'NotFoundError') {
        message = 'No camera found. Please connect a camera and try again.';
    } else if (error.name === 'NotReadableError') {
        message = 'Camera is in use by another application.';
    }

    errorDiv.innerHTML = `
        <div class="camera-placeholder">
            <div style="font-size: 48px; margin-bottom: 20px;">📷</div>
            <h3>Camera Unavailable</h3>
            <p>${message}</p>
            <button onclick="startCamera()" style="margin-top: 20px; padding: 10px 20px; background: rgba(255,255,255,0.2); border: none; border-radius: 20px; color: white; cursor: pointer;">
                Try Again
            </button>
        </div>
    `;

    container.innerHTML = '';
    container.appendChild(errorDiv);
}

// Enhanced Phone App Colors & Real Numbers
function initializePhoneApp() {
    const phoneDisplay = document.querySelector('.phone-display');
    if (phoneDisplay) {
        phoneDisplay.style.backgroundColor = '#1a1a1a';
        phoneDisplay.style.color = '#ffffff';
        phoneDisplay.style.border = '2px solid #333';
    }

    // Add real phone number functionality
    window.dialRealNumber = function() {
        const number = document.getElementById('phoneNumber').value;
        if (number) {
            // For mobile devices, try to open phone dialer
            if (/Mobi|Android/i.test(navigator.userAgent)) {
                window.open(`tel:${number}`, '_self');
            } else {
                showNotification(`📞 Would dial: ${number}`, 'info');
            }
        }
    };
}

// Enhanced AI to UI App - Horizontal Layout
function initializeAIToUI() {
    const aiContainer = document.querySelector('.ai-ui-container');
    if (aiContainer) {
        aiContainer.innerHTML = `
            <div class="ai-ui-horizontal">
                <div class="ai-left-panel">
                    <h3 style="color: #ffffff;">🎨 AI Theme Designer</h3>
                    <div class="ai-input-group">
                        <textarea id="aiPrompt" placeholder="Describe your dream interface theme..."
                                  style="width: 100%; height: 120px; margin-bottom: 15px; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; resize: vertical;"></textarea>
                        <div class="ai-controls-horizontal">
                            <button onclick="generateAITheme()" class="ai-btn primary">
                                ✨ Generate Theme
                            </button>
                            <button onclick="importAITheme()" class="ai-btn secondary">
                                📂 Import Theme
                            </button>
                            <button onclick="exportAITheme()" class="ai-btn tertiary">
                                📤 Export Theme
                            </button>
                        </div>
                    </div>
                    <div class="ai-examples-horizontal">
                        <h4 style="color: #ffffff;">🚀 Quick Themes:</h4>
                        <div class="example-grid">
                            <button onclick="setAIPrompt('Neon cyberpunk theme with glowing purple icons, star shapes, rotating animations')" class="example-chip">🔮 Cyberpunk</button>
                            <button onclick="setAIPrompt('Nature forest theme with green tones, leaf-shaped icons, gentle floating animations')" class="example-chip">🌿 Nature</button>
                            <button onclick="setAIPrompt('Space galaxy theme with cosmic colors, planet-shaped icons, orbital animations')" class="example-chip">🌌 Galaxy</button>
                            <button onclick="setAIPrompt('Ocean waves theme with blue gradients, water drop icons, wave animations')" class="example-chip">🌊 Ocean</button>
                            <button onclick="setAIPrompt('Sunset theme with warm orange and pink colors, heart-shaped icons, pulse animations')" class="example-chip">🌅 Sunset</button>
                            <button onclick="setAIPrompt('Minimalist black and white theme with geometric shapes, smooth fade animations')" class="example-chip">⚫ Minimal</button>
                        </div>
                    </div>
                    <!-- More Themes Section -->
                    <div class="more-themes-section" style="margin-top: 24px;">
                      <h4 style="color: #fff; margin-bottom: 10px;">More Themes:</h4>
                      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button onclick="setAIPrompt('Dark theme with deep blacks, subtle gradients, and glowing accent colors for a modern look')" class="example-chip">🌑 Dark Theme</button>
                        <button onclick="setAIPrompt('3D icons theme with realistic shadows, glassy effects, and floating 3D shapes for home screen')" class="example-chip">🧊 3D Theme</button>
                      </div>
                    </div>
                </div>
                <div class="ai-right-panel">
                    <div class="ai-preview-header">
                        <h4 style="color: #ffffff;">🎭 Live Preview</h4>
                        <div class="preview-actions">
                            <button onclick="applyGeneratedTheme()" class="apply-theme-btn">🎨 Apply Theme</button>
                            <button onclick="resetToDefaultTheme()" class="reset-theme-btn">🔄 Reset</button>
                        </div>
                    </div>
                    <div id="aiThemePreview" class="ai-preview-panel">
                        <div class="preview-placeholder">
                            <div style="font-size: 48px; margin-bottom: 20px;">🎨</div>
                            <h3 style="color: #ffffff;">Theme Preview</h3>
                            <p style="color: #cccccc;">Generated theme will be applied in real-time</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// AI Theme Generation Engine
function generateAITheme() {
    const prompt = document.getElementById('aiPrompt').value.trim();
    if (!prompt) {
        showNotification('💭 Please describe your theme idea first!', 'info');
        return;
    }

    showNotification('🎨 Generating magical theme...', 'info');

    // Analyze prompt for theme elements
    const themeData = analyzeThemePrompt(prompt);

    // Apply the generated theme
    applyDynamicTheme(themeData);

    // Show preview
    updateThemePreview(themeData);

    showNotification('✨ Theme generated successfully!', 'success');
}

function analyzeThemePrompt(prompt) {
    const lowerPrompt = prompt.toLowerCase();

    // Enhanced Color Analysis with 50+ color combinations
    let colors = { primary: '#667eea', secondary: '#764ba2', accent: '#ff6b9d', text: '#ffffff' };

    if (lowerPrompt.includes('purple') || lowerPrompt.includes('neon') || lowerPrompt.includes('cyberpunk')) {
        colors = { primary: '#8b5cf6', secondary: '#a855f7', accent: '#06ffa5', text: '#00ffff' };
    } else if (lowerPrompt.includes('green') || lowerPrompt.includes('nature') || lowerPrompt.includes('forest')) {
        colors = { primary: '#10b981', secondary: '#059669', accent: '#34d399', text: '#ffffff' };
    } else if (lowerPrompt.includes('blue') || lowerPrompt.includes('ocean') || lowerPrompt.includes('water')) {
        colors = { primary: '#3b82f6', secondary: '#1d4ed8', accent: '#60a5fa', text: '#ffffff' };
    } else if (lowerPrompt.includes('red') || lowerPrompt.includes('fire') || lowerPrompt.includes('sunset')) {
        colors = { primary: '#ef4444', secondary: '#dc2626', accent: '#fbbf24', text: '#ffffff' };
    } else if (lowerPrompt.includes('pink') || lowerPrompt.includes('love') || lowerPrompt.includes('heart')) {
        colors = { primary: '#ec4899', secondary: '#be185d', accent: '#f472b6', text: '#ffffff' };
    } else if (lowerPrompt.includes('gold') || lowerPrompt.includes('golden') || lowerPrompt.includes('luxury')) {
        colors = { primary: '#fbbf24', secondary: '#f59e0b', accent: '#fffbeb', text: '#92400e' };
    } else if (lowerPrompt.includes('silver') || lowerPrompt.includes('chrome') || lowerPrompt.includes('metallic')) {
        colors = { primary: '#94a3b8', secondary: '#64748b', accent: '#f1f5f9', text: '#1e293b' };
    } else if (lowerPrompt.includes('rainbow') || lowerPrompt.includes('colorful') || lowerPrompt.includes('vibrant')) {
        colors = { primary: '#ec4899', secondary: '#8b5cf6', accent: '#06ffa5', text: '#ffffff' };
    } else if (lowerPrompt.includes('orange') || lowerPrompt.includes('autumn') || lowerPrompt.includes('warm')) {
        colors = { primary: '#f97316', secondary: '#ea580c', accent: '#fed7aa', text: '#ffffff' };
    } else if (lowerPrompt.includes('black') || lowerPrompt.includes('dark') || lowerPrompt.includes('minimal')) {
        colors = { primary: '#000000', secondary: '#1f1f1f', accent: '#ffffff', text: '#ffffff' };
    }

    // Comprehensive Shape Analysis - 30+ shapes
    let iconShape = 'circle';
    const shapeMap = {
        'square': ['square', 'geometric', 'box'],
        'rectangle': ['rectangle', 'rectangular', 'horizontal'],
        'circle': ['circle', 'round', 'circular'],
        'triangle': ['triangle', 'triangular', 'arrow'],
        'pentagon': ['pentagon', 'five'],
        'hexagon': ['hexagon', 'six', 'honeycomb'],
        'heptagon': ['heptagon', 'seven'],
        'octagon': ['octagon', 'eight', 'stop'],
        'nonagon': ['nonagon', 'nine'],
        'decagon': ['decagon', 'ten'],
        'star': ['star', 'cosmic', 'space', 'stellar'],
        'oval': ['oval', 'ellipse', 'egg'],
        'trapezoid': ['trapezoid', 'trapezium'],
        'parallelogram': ['parallelogram', 'slanted'],
        'rhombus': ['rhombus', 'diamond'],
        'kite': ['kite', 'flying'],
        'heart': ['heart', 'love', 'romantic'],
        'crescent': ['crescent', 'moon', 'lunar'],
        'arrow': ['arrow', 'pointer', 'direction'],
        'cross': ['cross', 'plus', 'medical'],
        'spiral': ['spiral', 'swirl', 'vortex'],
        'diamond': ['diamond', 'crystal', 'gem'],
        'semicircle': ['semicircle', 'half', 'arch'],
        'lshape': ['l-shape', 'lshape', 'corner'],
        'tshape': ['t-shape', 'tshape', 'junction'],
        'teardrop': ['teardrop', 'drop', 'water'],
        'shield': ['shield', 'protection', 'security'],
        'cloud': ['cloud', 'fluffy', 'weather'],
        'blob': ['blob', 'organic', 'amorphous', 'irregular']
    };

    for (const [shape, keywords] of Object.entries(shapeMap)) {
        if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
            iconShape = shape;
            break;
        }
    }

    // Comprehensive Animation Analysis - 20+ animations
    let animation = 'none';
    const animationMap = {
        'jumping': ['jump', 'jumping', 'hop'],
        'rotating': ['rotate', 'rotating', 'spin'],
        'dancing': ['dance', 'dancing', 'groove'],
        'spinning': ['spinning', 'whirl', 'orbital'],
        'bouncing': ['bounce', 'bouncing', 'elastic'],
        'sliding': ['slide', 'sliding', 'glide'],
        'twisting': ['twist', 'twisting', 'spiral'],
        'swinging': ['swing', 'swinging', 'pendulum'],
        'gliding': ['gliding', 'smooth', 'flowing'],
        'flipping': ['flip', 'flipping', 'turn'],
        'waving': ['wave', 'waving', 'wavy'],
        'hopping': ['hopping', 'skip'],
        'swaying': ['sway', 'swaying', 'gentle'],
        'crawling': ['crawl', 'crawling'],
        'running': ['run', 'running', 'fast'],
        'walking': ['walk', 'walking', 'step'],
        'rolling': ['roll', 'rolling', 'tumble'],
        'shaking': ['shake', 'shaking', 'vibrate'],
        'floating': ['float', 'floating', 'hover'],
        'zooming': ['zoom', 'zooming', 'scale'],
        'pulsing': ['pulse', 'pulsing', 'heartbeat', 'glow']
    };

    for (const [anim, keywords] of Object.entries(animationMap)) {
        if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
            animation = anim;
            break;
        }
    }

    // Enhanced Size and Effect Analysis
    let iconSize = 'normal';
    let effect = 'none';

    if (lowerPrompt.includes('large') || lowerPrompt.includes('big') || lowerPrompt.includes('huge')) {
        iconSize = 'large';
    } else if (lowerPrompt.includes('small') || lowerPrompt.includes('tiny') || lowerPrompt.includes('compact')) {
        iconSize = 'small';
    } else if (lowerPrompt.includes('giant') || lowerPrompt.includes('massive')) {
        iconSize = 'giant';
    }

    if (lowerPrompt.includes('3d') || lowerPrompt.includes('three dimensional')) {
        effect = '3d';
    } else if (lowerPrompt.includes('glossy') || lowerPrompt.includes('shiny') || lowerPrompt.includes('glass')) {
        effect = 'glossy';
    } else if (lowerPrompt.includes('glow') || lowerPrompt.includes('glowing') || lowerPrompt.includes('luminous')) {
        effect = 'glow';
    } else if (lowerPrompt.includes('shadow') || lowerPrompt.includes('depth')) {
        effect = 'shadow';
    } else if (lowerPrompt.includes('neon') || lowerPrompt.includes('electric')) {
        effect = 'neon';
    }

    return {
        colors,
        iconShape,
        animation,
        iconSize,
        effect,
        background: generateBackgroundGradient(colors),
        name: extractThemeName(prompt) || 'Custom Theme'
    };
}

function generateBackgroundGradient(colors) {
    return `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.primary} 100%)`;
}

function extractThemeName(prompt) {
    const words = prompt.split(' ');
    return words.slice(0, 2).join(' ').replace(/[^a-zA-Z\s]/g, '') || 'Custom';
}

function applyDynamicTheme(themeData) {
    const root = document.documentElement;

    // Apply CSS variables
    root.style.setProperty('--bg-primary', themeData.background);
    root.style.setProperty('--glass-bg', `${themeData.colors.primary}20`);
    root.style.setProperty('--glass-border', `${themeData.colors.accent}40`);
    root.style.setProperty('--text-primary', themeData.colors.text);
    root.style.setProperty('--accent', themeData.colors.accent);

    // Apply to mobile OS background
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.background = themeData.background;
    }

    // Apply icon shapes and animations
    applyIconTransforms(themeData);

    // Store generated theme
    localStorage.setItem('generatedTheme', JSON.stringify(themeData));
}

function applyIconTransforms(themeData) {
    const icons = document.querySelectorAll('.app-icon-bg, .dock-icon');

    icons.forEach((icon, index) => {
        // Reset previous transforms
        icon.style.borderRadius = '';
        icon.style.clipPath = '';
        icon.style.transform = '';
        icon.style.animation = '';
        icon.style.background = '';
        icon.style.boxShadow = '';
        icon.style.filter = '';

        // Apply comprehensive shapes (30+ shapes)
        const shapeStyles = {
            'square': { borderRadius: '12px', clipPath: 'none' },
            'rectangle': { borderRadius: '8px', clipPath: 'none', transform: 'scaleX(1.3)' },
            'circle': { borderRadius: '50%', clipPath: 'none' },
            'triangle': { borderRadius: '0', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
            'pentagon': { borderRadius: '0', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
            'hexagon': { borderRadius: '0', clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)' },
            'heptagon': { borderRadius: '0', clipPath: 'polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%)' },
            'octagon': { borderRadius: '0', clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' },
            'nonagon': { borderRadius: '0', clipPath: 'polygon(50% 0%, 83% 12%, 100% 43%, 94% 78%, 68% 100%, 32% 100%, 6% 78%, 0% 43%, 17% 12%)' },
            'decagon': { borderRadius: '0', clipPath: 'polygon(50% 0%, 80% 10%, 100% 35%, 100% 70%, 80% 90%, 50% 100%, 20% 90%, 0% 70%, 0% 35%, 20% 10%)' },
            'star': { borderRadius: '0', clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
            'oval': { borderRadius: '50%', clipPath: 'none', transform: 'scaleY(1.3)' },
            'trapezoid': { borderRadius: '0', clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' },
            'parallelogram': { borderRadius: '0', clipPath: 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)' },
            'rhombus': { borderRadius: '0', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
            'kite': { borderRadius: '0', clipPath: 'polygon(50% 0%, 100% 50%, 50% 90%, 0% 50%)' },
            'heart': { borderRadius: '0', clipPath: 'path("M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5 C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3 C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z")' },
            'crescent': { borderRadius: '0', clipPath: 'circle(50% at 35% 50%)' },
            'arrow': { borderRadius: '0', clipPath: 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)' },
            'cross': { borderRadius: '0', clipPath: 'polygon(40% 0%, 60% 0%, 60% 40%, 100% 40%, 100% 60%, 60% 60%, 60% 100%, 40% 100%, 40% 60%, 0% 60%, 0% 40%, 40% 40%)' },
            'spiral': { borderRadius: '50%', clipPath: 'none', background: 'conic-gradient(from 0deg, transparent, currentColor)' },
            'diamond': { borderRadius: '0', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
            'semicircle': { borderRadius: '100px 100px 0 0', clipPath: 'none' },
            'lshape': { borderRadius: '0', clipPath: 'polygon(0% 0%, 40% 0%, 40% 60%, 100% 60%, 100% 100%, 0% 100%)' },
            'tshape': { borderRadius: '0', clipPath: 'polygon(0% 0%, 100% 0%, 100% 40%, 60% 40%, 60% 100%, 40% 100%, 40% 40%, 0% 40%)' },
            'teardrop': { borderRadius: '0', clipPath: 'radial-gradient(circle at 50% 100%, transparent 50%, currentColor 51%)' },
            'shield': { borderRadius: '0', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' },
            'cloud': { borderRadius: '50px', clipPath: 'none', background: 'radial-gradient(circle at 25% 25%, currentColor 25%, transparent 26%), radial-gradient(circle at 75% 25%, currentColor 25%, transparent 26%), radial-gradient(circle at 50% 50%, currentColor 50%, transparent 51%)' },
            'blob': { borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', clipPath: 'none' }
        };

        const shapeStyle = shapeStyles[themeData.iconShape] || shapeStyles.circle;
        Object.assign(icon.style, shapeStyle);

        // Apply sizes with multiple options
        let sizeTransform = '';
        switch (themeData.iconSize) {
            case 'small': sizeTransform = 'scale(0.8)'; break;
            case 'large': sizeTransform = 'scale(1.2)'; break;
            case 'giant': sizeTransform = 'scale(1.5)'; break;
            default: sizeTransform = 'scale(1)';
        }

        // Combine size with existing transform
        if (shapeStyle.transform) {
            icon.style.transform = `${shapeStyle.transform} ${sizeTransform}`;
        } else {
            icon.style.transform = sizeTransform;
        }

        // Apply comprehensive animations (20+ animations)
        if (themeData.animation !== 'none') {
            const duration = 2 + (index * 0.1);
            icon.style.animation = `${themeData.animation} ${duration}s infinite ease-in-out`;
        }

        // Apply enhanced color effects
        let background = `linear-gradient(135deg, ${themeData.colors.primary}, ${themeData.colors.secondary})`;
        let boxShadow = `0 8px 25px ${themeData.colors.accent}40`;
        let filter = '';

        // Apply special effects
        switch (themeData.effect) {
            case '3d':
                boxShadow = `0 15px 35px ${themeData.colors.accent}60, inset 0 2px 0 rgba(255,255,255,0.3)`;
                background = `linear-gradient(135deg, ${themeData.colors.primary}, ${themeData.colors.secondary}), linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)`;
                break;
            case 'glossy':
                background = `linear-gradient(135deg, ${themeData.colors.primary}, ${themeData.colors.secondary}), linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%)`;
                boxShadow = `0 8px 25px ${themeData.colors.accent}40, inset 0 1px 0 rgba(255,255,255,0.6)`;
                break;
            case 'glow':
                boxShadow = `0 0 30px ${themeData.colors.accent}, 0 0 60px ${themeData.colors.accent}80`;
                filter = 'brightness(1.2)';
                break;
            case 'shadow':
                boxShadow = `0 20px 40px ${themeData.colors.primary}60, 0 8px 16px ${themeData.colors.secondary}40`;
                break;
            case 'neon':
                background = `linear-gradient(135deg, ${themeData.colors.primary}, ${themeData.colors.secondary})`;
                boxShadow = `0 0 20px ${themeData.colors.accent}, 0 0 40px ${themeData.colors.accent}, inset 0 0 20px ${themeData.colors.accent}40`;
                filter = 'saturate(1.5) brightness(1.3)';
                break;
        }

        icon.style.background = background;
        icon.style.boxShadow = boxShadow;
        if (filter) icon.style.filter = filter;
    });
}

// Import/Export functionality
function importAITheme() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const themeData = JSON.parse(e.target.result);
                    applyDynamicTheme(themeData);
                    updateThemePreview(themeData);
                    showNotification('📂 Theme imported successfully!', 'success');
                } catch (error) {
                    showNotification('❌ Invalid theme file', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function exportAITheme() {
    const themeData = localStorage.getItem('generatedTheme');
    if (!themeData) {
        showNotification('❌ No theme to export. Generate one first!', 'error');
        return;
    }

    try {
        const blob = new Blob([themeData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${JSON.parse(themeData).name.replace(/\s+/g, '_')}_theme.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('📤 Theme exported successfully!', 'success');
    } catch (error) {
        showNotification('❌ Export failed', 'error');
    }
}

function applyGeneratedTheme() {
    const themeData = localStorage.getItem('generatedTheme');
    if (themeData) {
        applyDynamicTheme(JSON.parse(themeData));
        showNotification('🎨 Theme applied to device!', 'success');
    }
}

function resetToDefaultTheme() {
    applyTheme('cosmic'); // Reset to default

    // Reset icon transforms
    const icons = document.querySelectorAll('.app-icon-bg, .dock-icon');
    icons.forEach(icon => {
        icon.style.borderRadius = '';
        icon.style.clipPath = '';
        icon.style.transform = '';
        icon.style.animation = '';
        icon.style.background = '';
        icon.style.boxShadow = '';
    });

    showNotification('🔄 Reset to default theme', 'info');
}

function updateThemePreview(themeData) {
    const preview = document.getElementById('aiThemePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="theme-preview-content">
                <h4>🎨 ${themeData.name}</h4>
                <div class="preview-colors">
                    <div class="color-swatch" style="background: ${themeData.colors.primary}"></div>
                    <div class="color-swatch" style="background: ${themeData.colors.secondary}"></div>
                    <div class="color-swatch" style="background: ${themeData.colors.accent}"></div>
                </div>
                <div class="preview-details">
                    <p><strong>🔷 Shape:</strong> ${themeData.iconShape}</p>
                    <p><strong>🎭 Animation:</strong> ${themeData.animation}</p>
                    <p><strong>📏 Size:</strong> ${themeData.iconSize}</p>
                </div>
                <div class="preview-icons">
                    <div class="preview-icon ${themeData.iconShape}" style="background: ${themeData.colors.primary}; animation: ${themeData.animation} 2s infinite;"></div>
                    <div class="preview-icon ${themeData.iconShape}" style="background: ${themeData.colors.secondary}; animation: ${themeData.animation} 2.2s infinite;"></div>
                    <div class="preview-icon ${themeData.iconShape}" style="background: ${themeData.colors.accent}; animation: ${themeData.animation} 2.4s infinite;"></div>
                </div>
            </div>
        `;
    }
}

// Enhanced Camera with iOS Support
async function startCamera() {
    const video = document.getElementById('cameraVideo');
    const viewfinder = document.querySelector('.camera-viewfinder');

    if (!video || !viewfinder) {
        console.error('Camera elements not found');
        return;
    }

    try {
        showNotification('📷 Starting camera...', 'info');

        // Enhanced iOS detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                     /iPhone|iPad|iPod|iOS/.test(navigator.userAgent);

        // Check camera availability
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Camera API not supported on this device');
        }

        // iPhone-specific optimized constraints
        let constraints;
        if (isIOS) {
            constraints = {
                video: {
                    facingMode: currentCameraFacing === 'front' ? 'user' : 'environment',
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 15, max: 30 },
                    aspectRatio: { ideal: 4/3 }
                },
                audio: false
            };
        } else {
            constraints = {
                video: {
                    facingMode: currentCameraFacing === 'front' ? 'user' : 'environment',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: false
            };
        }

        console.log('Camera constraints for ' + (isIOS ? 'iOS' : 'other') + ':', constraints);

        // Stop any existing streams first
        if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Setup video element for iOS
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.setAttribute('webkit-playsinline', true);
        video.setAttribute('controls', false);
        video.muted = true;
        video.autoplay = true;

        // iOS-specific fixes
        if (isIOS) {
            video.style.objectFit = 'cover';
            video.style.width = '100%';
            video.style.height = '100%';
        }

        // Enhanced loading promise with better error handling
        await new Promise((resolve, reject) => {
            let resolved = false;

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    reject(new Error('Camera loading timeout - please check permissions'));
                }
            }, isIOS ? 20000 : 10000); // Longer timeout for iOS

            const resolveOnce = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    resolve();
                }
            };

            const rejectOnce = (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            };

            video.onloadedmetadata = async () => {
                try {
                    console.log('Video metadata loaded, attempting to play...');

                    // For iOS, try multiple play attempts
                    let playPromise;
                    if (isIOS) {
                        playPromise = video.play().catch(() => {
                            // Retry play after short delay
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    video.play().then(resolve).catch(resolve);
                                }, 100);
                            });
                        });
                    } else {
                        playPromise = video.play();
                    }

                    await playPromise;

                    // Update camera info
                    const info = document.querySelector('.camera-info');
                    if (info) {
                        info.textContent = `${currentCameraFacing === 'front' ? 'Front' : 'Back'} Camera • ${video.videoWidth || 'Unknown'}x${video.videoHeight || 'Unknown'}`;
                    }

                    showNotification('📷 Camera ready!', 'success');
                    resolveOnce();
                } catch (playError) {
                    console.error('Video play error:', playError);
                    rejectOnce(playError);
                }
            };

            video.onerror = (error) => {
                console.error('Video element error:', error);
                rejectOnce(new Error('Video playback failed'));
            };

            video.onloadstart = () => {
                console.log('Video loading started...');
            };

            // Trigger metadata loading
            video.load();
        });

    } catch (error) {
        console.error('Camera startup failed:', error);
        showCameraError(viewfinder, error);

        // Enhanced error messages
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
            showNotification('📷 Camera permission denied - please allow camera access', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('📷 No camera found on this device', 'error');
        } else if (error.name === 'NotSupportedError') {
            showNotification('📷 Camera not supported on this browser', 'error');
        } else if (error.name === 'NotReadableError') {
            showNotification('📷 Camera is being used by another app', 'error');
        } else if (error.message.includes('timeout')) {
            showNotification('📷 Camera loading timeout - please try again', 'error');
        } else {
            showNotification('❌ Camera error: ' + error.message, 'error');
        }
    }
}

// Fix themes functionality
function applyTheme(themeName) {
    const themes = {
        light: {
            '--bg-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.1)',
            '--glass-border': 'rgba(255, 255, 255, 0.2)',
            '--text-primary': '#333333',
            '--accent': '#667eea'
        },
        dark: {
            '--bg-primary': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.05)',
            '--glass-border': 'rgba(255, 255, 255, 0.1)',
            '--text-primary': '#ffffff',
            '--accent': '#4a9eff'
        },
        ultradark: {
            '--bg-primary': 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.02)',
            '--glass-border': 'rgba(255, 255, 255, 0.05)',
            '--text-primary': '#ffffff',
            '--accent': '#333333'
        },
        ocean: {
            '--bg-primary': 'linear-gradient(135deg, #667db6 0%, #0082c8 35%, #0082c8 65%, #667db6 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.12)',
            '--glass-border': 'rgba(255, 255, 255, 0.25)',
            '--text-primary': '#ffffff',
            '--accent': '#00bcd4'
        },
        sunset: {
            '--bg-primary': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.15)',
            '--glass-border': 'rgba(255, 255, 255, 0.3)',
            '--text-primary': '#333333',
            '--accent': '#ff6b9d'
        },
        forest: {
            '--bg-primary': 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.08)',
            '--glass-border': 'rgba(255, 255, 255, 0.15)',
            '--text-primary': '#ffffff',
            '--accent': '#4caf50'
        },
        cosmic: {
            '--bg-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.1)',
            '--glass-border': 'rgba(255, 255, 255, 0.2)',
            '--text-primary': '#ffffff',
            '--accent': '#9c27b0'
        },
        neon: {
            '--bg-primary': 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 50%, #000000 100%)',
            '--glass-bg': 'rgba(0, 255, 255, 0.1)',
            '--glass-border': 'rgba(0, 255, 255, 0.3)',
            '--text-primary': '#00ffff',
            '--accent': '#ff0080'
        },
        autumn: {
            '--bg-primary': 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.15)',
            '--glass-border': 'rgba(255, 255, 255, 0.25)',
            '--text-primary': '#ffffff',
            '--accent': '#ff6347'
        },
        winter: {
            '--bg-primary': 'linear-gradient(135deg, #e6ddd4 0%, #d1c4e9 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.2)',
            '--glass-border': 'rgba(255, 255, 255, 0.4)',
            '--text-primary': '#333333',
            '--accent': '#7986cb'
        },
        space: {
            '--bg-primary': 'linear-gradient(135deg, #000428 0%, #004e92 100%)',
            '--glass-bg': 'rgba(255, 255, 255, 0.05)',
            '--glass-border': 'rgba(255, 255, 255, 0.1)',
            '--text-primary': '#ffffff',
            '--accent': '#00d4ff'
        }
    };

    const theme = themes[themeName];
    if (!theme) {
        // showNotification('❌ Theme not found', 'error');
        return;
    }

    const root = document.documentElement;
    const mobileOS = document.getElementById('mobile-os');

    try {
        // Always clear wallpaper when applying theme
        localStorage.removeItem('homeWallpaper');
        localStorage.removeItem('wallpaperActive');

        // Apply CSS variables
        Object.entries(theme).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        // Apply background to mobile OS
        if (mobileOS && theme['--bg-primary']) {
            mobileOS.style.backgroundImage = '';
            mobileOS.style.background = theme['--bg-primary'];
            mobileOS.classList.add('theme-active');
        }

        // Save theme
        localStorage.setItem('selectedTheme', themeName);
        showNotification(`🎨 ${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme applied!`, 'success');

    } catch (error) {
        console.error('Theme application error:', error);
        // showNotification('❌ Failed to apply theme', 'error');
    }
}

// Enhanced Wallpaper System
function initializeWallpaperSystem() {
    // Create simplified wallpaper interface
    window.setWallpaper = function(imageUrl, target = 'home') {
        if (!imageUrl) {
            showNotification('❌ No image provided', 'error');
            return;
        }

        try {
            if (target === 'home' || target === 'both') {
                applyHomeWallpaper(imageUrl);
            }

            if (target === 'lock' || target === 'both') {
                localStorage.setItem('lockWallpaper', imageUrl);
                showNotification('🔒 Lock wallpaper saved!', 'success');
            }

        } catch (error) {
            console.error('Wallpaper error:', error);
            showNotification('❌ Failed to set wallpaper', 'error');
        }
    };

    // Quick wallpaper application
    window.applyHomeWallpaper = function(imageUrl) {
        const mobileOS = document.getElementById('mobile-os');
        if (!mobileOS) return;

        // Clear any existing wallpaper first
        mobileOS.style.backgroundImage = '';
        mobileOS.style.background = '';
        mobileOS.classList.remove('theme-active');

        // Apply new wallpaper
        mobileOS.style.backgroundImage = `url(${imageUrl})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';

        // Save state
        localStorage.setItem('homeWallpaper', imageUrl);
        localStorage.setItem('wallpaperActive', 'true');
        localStorage.removeItem('selectedTheme'); // Clear theme when wallpaper applied

        showNotification('🖼️ Home wallpaper applied!', 'success');
    };

    // Apply wallpaper to lock screen too
    window.applyBothWallpaper = function(imageUrl) {
        // Apply to home screen
        applyHomeWallpaper(imageUrl);

        // Save for lock screen
        localStorage.setItem('lockWallpaper', imageUrl);

        showNotification('🖼️ Wallpaper applied to both screens!', 'success');
    };

    // Clear wallpaper function
    window.clearWallpaper = function() {
        const mobileOS = document.getElementById('mobile-os');
        if (!mobileOS) return;

        mobileOS.style.backgroundImage = '';
        localStorage.removeItem('homeWallpaper');
        localStorage.removeItem('wallpaperActive');

        // Apply default theme
        applyTheme('cosmic');
        showNotification('🎨 Wallpaper cleared, theme restored', 'success');
    };

    // Easy wallpaper picker from photos
    window.openWallpaperPicker = function() {
        const photos = JSON.parse(localStorage.getItem('photos') || '[]');
        if (photos.length === 0) {
            showNotification('📷 No photos available. Take some photos first!', 'info');
            return;
        }

        // Create quick picker modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 10000; overflow-y: auto;
            display: flex; align-items: center; justify-content: center; padding: 20px;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 20px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #333;">Choose Wallpaper</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
                                         ${photos.map(photo => `
                         <div style="position: relative; cursor: pointer;">
                             <img src="${photo.dataUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 10px;">
                             <div style="position: absolute; bottom: 5px; left: 5px;">
                                 <button onclick="window.applyHomeWallpaper('${photo.dataUrl}'); this.closest('.modal').remove();" style="background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border: none; border-radius: 8px; font-size: 10px; margin-right: 4px; cursor: pointer;">
                                     Home
                                 </button>
                                 <button onclick="window.applyBothWallpaper('${photo.dataUrl}'); this.closest('.modal').remove();" style="background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border: none; border-radius: 8px; font-size: 10px; cursor: pointer;">
                                     Both
                                 </button>
                             </div>
                         </div>
                     `).join('')}
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="window.clearWallpaper(); this.closest('.modal').remove();" style="padding: 10px 20px; background: #ff6b6b; color: white; border: none; border-radius: 10px; cursor: pointer;">
                        Clear Wallpaper
                    </button>
                </div>
            </div>
        `;

        modal.className = 'modal';
        document.body.appendChild(modal);
    };

    // Apply saved wallpaper on load
    const homeWallpaper = localStorage.getItem('homeWallpaper');
    const wallpaperActive = localStorage.getItem('wallpaperActive');

    if (homeWallpaper && wallpaperActive === 'true') {
        const mobileOS = document.getElementById('mobile-os');
        if (mobileOS) {
            mobileOS.style.backgroundImage = `url(${homeWallpaper})`;
            mobileOS.style.backgroundSize = 'cover';
            mobileOS.style.backgroundPosition = 'center';
            mobileOS.style.backgroundRepeat = 'no-repeat';
            mobileOS.style.backgroundAttachment = 'fixed';
        }
    }
}

// This function is replaced by the enhanced version at the end of the file

// Enhanced lock screen functions
let currentPasscodeInput = '';

function hideLockScreen() {
    const lockScreen = document.getElementById('lockScreen');
    if (lockScreen) {
        lockScreen.remove();
        document.body.style.overflow = '';
    }
}

function requestPasscodeEntry() {
    const passcode = localStorage.getItem('devicePasscode');
    const hasPasscode = passcode && passcode !== '';

    if (!hasPasscode) {
        // No passcode set, unlock immediately
        showNotification('🔓 Device unlocked', 'success');
        hideLockScreen();
        return;
    }

    // Show passcode entry interface
    const lockScreen = document.getElementById('lockScreen');
    if (!lockScreen) return;

    const unlockSection = lockScreen.querySelector('.unlock-section');
    if (!unlockSection) return;

    unlockSection.innerHTML = `
        <p>Enter Passcode</p>
        <div class="passcode-dots">
            <div class="passcode-dot"></div>
            <div class="passcode-dot"></div>
            <div class="passcode-dot"></div>
            <div class="passcode-dot"></div>
        </div>
        <div class="passcode-keypad">
            ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(key =>
                key === '' ? '<button class="passcode-key empty"></button>' :
                `<button class="passcode-key" onclick="handlePasscodeInput('${key}')">${key}</button>`
            ).join('')}
        </div>
        <div id="passcodeError" class="passcode-error" style="display: none;"></div>
    `;
}

function handlePasscodeInput(key) {
    if (key === '⌫') {
        if (currentPasscodeInput.length > 0) {
            currentPasscodeInput = currentPasscodeInput.slice(0, -1);
            updatePasscodeDots();
        }
        return;
    }

    if (key === '' || currentPasscodeInput.length >= 4) {
        return;
    }

    currentPasscodeInput += key;
    updatePasscodeDots();

    if (currentPasscodeInput.length === 4) {
        setTimeout(() => checkPasscode(), 300);
    }
}

function updatePasscodeDots() {
    const dots = document.querySelectorAll('.passcode-dot');
    dots.forEach((dot, index) => {
        if (index < currentPasscodeInput.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}


function checkPasscode() {
    console.log('Entered Passcode:', window.currentPasscode);
    console.log('Stored Passcode (userPasscode):', userPasscode);
    console.log('Stored Passcode (localStorage):', localStorage.getItem('userPasscode'));

    if (window.currentPasscode === userPasscode) {
         unlockDevice();
        document.getElementById("lockScreen").style.display="none";

    } else {
        const errorEl = document.getElementById('passcodeError');
        errorEl.textContent = 'Incorrect passcode';

        // Clear dots and passcode
        setTimeout(() => {
            for (let i = 1; i <= 4; i++) {
                document.getElementById(`dot${i}`).style.background = 'transparent';
            }
            window.currentPasscode = '';
            errorEl.textContent = '';
        }, 1000);
    }
}


// function checkPasscode() {
//     const storedPasscode = localStorage.getItem('devicePasscode');
//     const errorDiv = document.getElementById('passcodeError');

//     if (currentPasscodeInput === storedPasscode) {
//         showNotification('🔓 Device unlocked', 'success');
//         hideLockScreen();
//     } else {
//         // Show error
//         errorDiv.style.display = 'block';
//         errorDiv.textContent = '❌ Incorrect passcode';

//         // Shake animation
//         const keypad = document.querySelector('.passcode-keypad');
//         if (keypad) {
//             keypad.style.animation = 'shake 0.5s ease-in-out';
//             setTimeout(() => {
//                 keypad.style.animation = '';
//             }, 500);
//         }

//         // Clear input after delay
//         setTimeout(() => {
//             currentPasscodeInput = '';
//             updatePasscodeDots();
//             errorDiv.style.display = 'none';
//         }, 1500);
//     }
// }

// Initialize enhanced systems
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...

    initializePhoneApp();
    initializeAIToUI();
    initializeWallpaperSystem();

    // Initialize auto-lock if passcode is set
    initializeAutoLock();

    // Apply saved theme
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('dark'); // Default theme changed to dark
    }
});

// New AI Apps Functions
function initializeMathsAI() {
    const solveMathBtn = document.getElementById('solveMath');
    const mathQuestion = document.getElementById('mathQuestion');
    const mathStatus = document.getElementById('mathStatus');

    if (solveMathBtn) {
        solveMathBtn.addEventListener('click', solveMathProblem);
    }

    if (mathQuestion) {
        mathQuestion.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                solveMathProblem();
            }
        });
    }
}

async function solveMathProblem() {
    const mathQuestion = document.getElementById('mathQuestion');
    const mathHistory = document.getElementById('mathHistory');
    const mathStatus = document.getElementById('mathStatus');
    const solveMathBtn = document.getElementById('solveMath');

    const question = mathQuestion.value.trim();
    if (!question) return;

    // Show loading state
    solveMathBtn.disabled = true;
    solveMathBtn.textContent = '🔄 Solving...';
    mathStatus.textContent = 'AI is solving your math problem...';
    mathStatus.style.color = '#007AFF';

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIAPIKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful math tutor. Solve math problems step by step. Show your work clearly and explain each step. If it\'s a simple calculation, still show the process. Format your answer with clear steps and highlight the final answer.'
                    },
                    {
                        role: 'user',
                        content: question
                    }
                ],
                max_tokens: 500,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.choices[0].message.content;

        // Format the answer for better display
        const formattedAnswer = answer
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/(\d+[\+\-\*\/\=]\d+)/g, '<code>$1</code>')
            .replace(/Answer: (.*)/g, '<div style="background: #e3f2fd; padding: 10px; border-radius: 8px; margin: 10px 0;"><strong>📝 Answer:</strong> $1</div>');

        // Add to history
        const resultDiv = document.createElement('div');
        resultDiv.className = 'math-result';
        resultDiv.innerHTML = `
            <div class="math-question" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #2196F3;">
                <strong>❓ Question:</strong> ${question}
            </div>
            <div class="math-answer" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; line-height: 1.6;">
                ${formattedAnswer}
            </div>
            <div style="font-size: 12px; color: #888; margin-top: 8px; text-align: right;">🕐 ${new Date().toLocaleTimeString()}</div>
        `;

        mathHistory.appendChild(resultDiv);
        mathHistory.scrollTop = mathHistory.scrollHeight;

        // Clear input
        mathQuestion.value = '';
        mathStatus.textContent = 'Problem solved successfully!';
        mathStatus.style.color = '#34C759';

    } catch (error) {
        console.error('Error solving math problem:', error);
        mathStatus.textContent = 'Error solving problem. Please try again.';
        mathStatus.style.color = '#FF3B30';
    }

    // Reset button
    setTimeout(() => {
        solveMathBtn.disabled = false;
        solveMathBtn.textContent = '🧮 Solve with AI';
        mathStatus.textContent = '';
    }, 2000);
}

function initializeAIMessages() {
    const contacts = document.querySelectorAll('.contact');
    contacts.forEach(contact => {
        contact.addEventListener('click', function() {
            const character = this.getAttribute('data-character');
            openChat(character);
        });
    });
}

let currentCharacter = '';
const characterProfiles = {
    'girlfriend': {
        name: 'Girlfriend 💕',
        personality: 'You are a loving, caring girlfriend. You speak warmly and affectionately, use heart emojis occasionally, and show genuine interest in your partner\'s day. You\'re supportive and understanding.',
        greeting: 'Hey babe! How was your day? 💕'
    },
    'emily': {
        name: 'Emily 👩',
        personality: 'You are Emily, a friendly and bubbly person. You\'re optimistic, creative, and love to chat about everyday things. You use casual language and are always encouraging.',
        greeting: 'Hi there! I\'m Emily! So nice to meet you! 😊'
    },
    'angelina': {
        name: 'Angelina Jolie ⭐',
        personality: 'You are Angelina Jolie, the famous actress and humanitarian. You speak eloquently, are passionate about humanitarian causes, and have a sophisticated yet warm personality. You\'re inspiring and thoughtful.',
        greeting: 'Hello! It\'s wonderful to connect with you. How can I help make a positive difference in your day?'
    },
    'trump': {
        name: 'Donald Trump 🇺🇸',
        personality: 'You are Donald Trump. You speak with confidence, use superlatives frequently ("tremendous", "fantastic", "the best"), and have a distinctive speaking style. You\'re businesslike and direct.',
        greeting: 'Hello! This is going to be tremendous, believe me. The best conversation you\'ve ever had!'
    },
    'einstein': {
        name: 'Albert Einstein 🧠',
        personality: 'You are Albert Einstein, the brilliant physicist. You speak thoughtfully about science, philosophy, and life. You\'re curious, wise, and love to explore deep questions about the universe.',
        greeting: 'Greetings! I am delighted to engage in intellectual discourse with you. What mysteries of the universe shall we explore?'
    },
    'shakespeare': {
        name: 'Shakespeare 📚',
        personality: 'You are William Shakespeare, the great playwright and poet. You speak in a somewhat Elizabethan style (but not too heavy), are eloquent, and love language, poetry, and human nature.',
        greeting: 'Good morrow! Prithee, what brings thee to discourse with this humble scribe?'
    },
    'oprah': {
        name: 'Oprah Winfrey 📺',
        personality: 'You are Oprah Winfrey, the inspiring media mogul. You\'re warm, encouraging, empowering, and love to help people grow. You speak with enthusiasm and wisdom.',
        greeting: 'Hello, beautiful soul! I\'m so excited to connect with you today. What\'s on your heart?'
    }
};

function openChat(character) {
    currentCharacter = character;
    const contactsList = document.getElementById('contactsList');
    const chatArea = document.getElementById('chatArea');
    const currentContact = document.getElementById('currentContact');
    const messages = document.getElementById('messages');

    contactsList.style.display = 'none';
    chatArea.style.display = 'flex';
    currentContact.textContent = characterProfiles[character].name;

    // Clear previous messages
    messages.innerHTML = '';

    // Add greeting message
    addMessage(characterProfiles[character].greeting, 'ai');
}

function showContactsList() {
    const contactsList = document.getElementById('contactsList');
    const chatArea = document.getElementById('chatArea');

    contactsList.style.display = 'block';
    chatArea.style.display = 'none';
    currentCharacter = '';
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message || !currentCharacter) return;

    // Add user message
    addMessage(message, 'user');
    messageInput.value = '';

    // Show AI is typing
    const typingDiv = addMessage('Typing...', 'ai');

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIAPIKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: characterProfiles[currentCharacter].personality
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;

        // Remove typing message and add AI response
        typingDiv.remove();
        addMessage(reply, 'ai');

    } catch (error) {
        console.error('Error sending message:', error);
        typingDiv.textContent = 'Sorry, I couldn\'t respond right now. Please try again.';
    }
}

function addMessage(text, sender) {
    const messages = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;

    return messageDiv;
}

function initializeAIAssistant() {
    const askAssistantBtn = document.getElementById('askAssistant');
    const assistantInput = document.getElementById('assistantInput');
    const assistantStatus = document.getElementById('assistantStatus');

    if (askAssistantBtn) {
        askAssistantBtn.addEventListener('click', askAIAssistant);
    }

    if (assistantInput) {
        assistantInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                askAIAssistant();
            }
        });
    }
}

async function askAIAssistant() {
    const assistantInput = document.getElementById('assistantInput');
    const assistantChat = document.getElementById('assistantChat');
    const assistantStatus = document.getElementById('assistantStatus');
    const askAssistantBtn = document.getElementById('askAssistant');

    const question = assistantInput.value.trim();
    if (!question) return;

    // Show loading state
    askAssistantBtn.disabled = true;
    askAssistantBtn.textContent = '🔄 Thinking...';
    assistantStatus.textContent = 'AI Assistant is thinking...';
    assistantStatus.style.color = '#007AFF';

    // Add user message to chat
    addAssistantMessage(question, 'user');
    assistantInput.value = '';

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIAPIKey()}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant. You provide clear, concise, and helpful responses to any questions or requests. You\'re friendly, professional, and aim to be as useful as possible.'
                    },
                    {
                        role: 'user',
                        content: question
                    }
                ],
                max_tokens: 400,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.choices[0].message.content;

        // Add AI response to chat
        addAssistantMessage(answer, 'ai');

        assistantStatus.textContent = 'Response generated successfully!';
        assistantStatus.style.color = '#34C759';

    } catch (error) {
        console.error('Error asking AI assistant:', error);
        addAssistantMessage('Sorry, I couldn\'t process your request right now. Please try again.', 'ai');
        assistantStatus.textContent = 'Error getting response. Please try again.';
        assistantStatus.style.color = '#FF3B30';
    }

    // Reset button
    setTimeout(() => {
        askAssistantBtn.disabled = false;
        askAssistantBtn.textContent = '💬 Ask Assistant';
        assistantStatus.textContent = '';
    }, 2000);
}

function addAssistantMessage(text, sender) {
    const assistantChat = document.getElementById('assistantChat');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'assistant-message';

    messageDiv.innerHTML = `
        <div class="${sender}-message">
            <strong>${sender === 'user' ? 'You:' : 'AI Assistant:'}</strong>
            <div class="ai-response">${text.replace(/\n/g, '<br>')}</div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">${new Date().toLocaleTimeString()}</div>
        </div>
    `;

    assistantChat.appendChild(messageDiv);
    assistantChat.scrollTop = assistantChat.scrollHeight;
}

// Photo-based Wallpaper Settings
async function openPhotoWallpaperSettings() {
    const photos = await loadPhotosFromDB();

    const content = `
        <div class="wallpaper-settings">
            <h3 style="color: var(--app-text, #333); margin-bottom: 20px;">Wallpaper Settings</h3>

            <!-- Upload New Photo Section -->
            <div class="wallpaper-options">
                <h4 style="color: var(--app-text, #333); margin-bottom: 15px;">📷 Upload From Files</h4>
                <div class="photo-upload-section" style="margin: 20px 0;">
                    <input type="file" id="wallpaperUpload" accept="image/*" style="display: none;" onchange="handleWallpaperUpload(event)">
                    <input type="file" id="wallpaperFiles" accept="image/*" multiple style="display: none;" onchange="handleMultipleWallpaperUpload(event)">

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <button onclick="document.getElementById('wallpaperUpload').click()" class="upload-btn" style="
                            padding: 15px;
                            background: #007AFF;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                        ">📷 Single Photo</button>

                        <button onclick="document.getElementById('wallpaperFiles').click()" class="upload-btn" style="
                            padding: 15px;
                            background: #34C759;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                        ">📁 Multiple Files</button>
                    </div>

                    <button onclick="accessPhonePhotos()" class="upload-btn" style="
                        width: 100%;
                        padding: 15px;
                        background: #FF9500;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        margin-bottom: 15px;
                    ">📱 Access iPhone Photos</button>

                    <button onclick="openPhotoGallerySelector()" class="upload-btn" style="
                        width: 100%;
                        padding: 15px;
                        background: #AF52DE;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                    ">🖼️ Select from Gallery</button>
                </div>

                <button onclick="clearAllWallpapers()" class="upload-btn" style="
                    width: 100%;
                    padding: 15px;
                    background: #FF3B30; /* Red color */
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-top: 15px;
                ">🗑️ Clear All Images</button>

                <div id="wallpaperPreview" style="display: none; margin: 20px 0;">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">Preview:</h4>
                    <img id="previewImage" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
                    <div class="wallpaper-controls" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="applyPhotoToBoth()" class="wallpaper-btn" style="flex: 1; padding: 12px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer;">🏠🔒 Both Screens</button>
                        <button onclick="applyPhotoToHome()" class="wallpaper-btn" style="flex: 1; padding: 12px; background: #34C759; color: white; border: none; border-radius: 8px; cursor: pointer;">🏠 Home Only</button>
                        <button onclick="applyPhotoToLock()" class="wallpaper-btn" style="flex: 1; padding: 12px; background: #FF9500; color: white; border: none; border-radius: 8px; cursor: pointer;">🔒 Lock Only</button>
                    </div>
                </div>
            </div>

            <!-- Phone Gallery Section -->
            <div class="phone-gallery-section">
                <h4 style="color: var(--app-text, #333); margin-bottom: 15px;">📱 From Phone Gallery</h4>
                <div class="phone-photos-grid" id="phone-photos-grid" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 10px;
                    margin: 15px 0;
                    max-height: 300px;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch; /* Enables momentum scrolling on iOS */
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 10px;
                ">
                    ${photos.length > 0 ? photos.map(photo => `
                        <div class="phone-photo-item" style="position: relative; cursor: pointer; border-radius: 8px; overflow: hidden;">
                            <img src="${photo.dataUrl}" style="width: 100%; height: 120px; object-fit: cover;" onclick="selectPhonePhoto('${photo.dataUrl}')">
                            <div class="photo-actions" style="
                                position: absolute;
                                bottom: 0;
                                left: 0;
                                right: 0;
                                background: linear-gradient(transparent, rgba(0,0,0,0.8));
                                padding: 5px;
                                display: flex;
                                gap: 3px;
                            ">
                                <button onclick="applyPhonePhotoToHome('${photo.dataUrl}')" style="
                                    flex: 1;
                                    padding: 4px;
                                    background: #34C759;
                                    color: white;
                                    border: none;
                                    border-radius: 4px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">🏠</button>
                                <button onclick="applyPhonePhotoToLock('${photo.dataUrl}')" style="
                                    flex: 1;
                                    padding: 4px;
                                    background: #FF9500;
                                    color: white;
                                    border: none;
                                    border-radius: 4px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">🔒</button>
                                <button onclick="applyPhonePhotoToBoth('${photo.dataUrl}')" style="
                                    flex: 1;
                                    padding: 4px;
                                    background: #007AFF;
                                    color: white;
                                    border: none;
                                    border-radius: 4px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">Both</button>
                            </div>
                        </div>
                    `).join('') : `
                        <div style="
                            grid-column: 1 / -1;
                            text-align: center;
                            padding: 40px 20px;
                            color: #666;
                        ">
                            <p>📷 No photos in gallery</p>
                            <p style="font-size: 14px; margin-top: 10px;">Take some photos with the Camera app first!</p>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    createAppWindow('Wallpaper Settings', content);
}

let selectedWallpaperPhoto = '';

function handleWallpaperUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        selectedWallpaperPhoto = e.target.result;

        // Show preview
        const preview = document.getElementById('wallpaperPreview');
        const previewImage = document.getElementById('previewImage');

        previewImage.src = selectedWallpaperPhoto;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Centralized function to save wallpaper settings reliably
async function saveWallpaperSettings(settings) {
    return new Promise(resolve => {
        if (settings.hasOwnProperty('home')) {
            localStorage.setItem('homeWallpaper', settings.home);
            localStorage.setItem('wallpaperActive', 'true');
        }
        if (settings.hasOwnProperty('lock')) {
            localStorage.setItem('lockWallpaper', `url(${settings.lock})`);
        }

        // A small delay can help ensure the data is written in restrictive environments
        setTimeout(() => resolve(), 100);
    });
}

async function applyPhotoToBoth() {
    if (!selectedWallpaperPhoto) return;

    // Apply to home screen (main OS background)
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.backgroundImage = `url(${selectedWallpaperPhoto})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';
    }

    await saveWallpaperSettings({ home: selectedWallpaperPhoto, lock: selectedWallpaperPhoto });

    showNotification('Photo wallpaper applied to both screens!', 'success');
    closeDynamicApp('wallpaper-settings');
}

async function applyPhotoToHome() {
    if (!selectedWallpaperPhoto) return;

    // Apply to home screen (main OS background)
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.backgroundImage = `url(${selectedWallpaperPhoto})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';
    }
    await saveWallpaperSettings({ home: selectedWallpaperPhoto });

    showNotification('Photo wallpaper applied to home screen!', 'success');
    closeDynamicApp('wallpaper-settings');
}

async function applyPhotoToLock() {
    if (!selectedWallpaperPhoto) return;

    await saveWallpaperSettings({ lock: selectedWallpaperPhoto });

    showNotification('Photo wallpaper applied to lock screen!', 'success');
    closeDynamicApp('wallpaper-settings');
}




// Phone gallery wallpaper functions
function selectPhonePhoto(photoDataUrl) {
    selectedWallpaperPhoto = photoDataUrl;

    // Show preview
    const preview = document.getElementById('wallpaperPreview');
    const previewImage = document.getElementById('previewImage');

    if (preview && previewImage) {
        previewImage.src = selectedWallpaperPhoto;
        preview.style.display = 'block';
    }
}

function applyPhonePhotoToHome(photoDataUrl) {
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.backgroundImage = `url(${photoDataUrl})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';
    }
    localStorage.setItem('homeWallpaper', photoDataUrl);
    localStorage.setItem('wallpaperActive', 'true');

    showNotification('🏠 Home wallpaper applied!', 'success');
    closeDynamicApp('wallpaper-settings');
}

function applyPhonePhotoToLock(photoDataUrl) {
    localStorage.setItem('lockWallpaper', `url(${photoDataUrl})`);

    showNotification('🔒 Lock wallpaper applied!', 'success');
    closeDynamicApp('wallpaper-settings');
}

function applyPhonePhotoToBoth(photoDataUrl) {
    // Apply to home screen
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.backgroundImage = `url(${photoDataUrl})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';
    }
    localStorage.setItem('homeWallpaper', photoDataUrl);
    localStorage.setItem('wallpaperActive', 'true');

    // Apply to lock screen
    localStorage.setItem('lockWallpaper', `url(${photoDataUrl})`);

    showNotification('🏠🔒 Wallpaper applied to both screens!', 'success');
    closeDynamicApp('wallpaper-settings');
}

// Enhanced Lock Screen with Face Recognition - Override existing function
function showLockScreen() {
    const lockWallpaper = localStorage.getItem('lockWallpaper') || 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';

    // Create lock screen overlay
    const lockOverlay = document.createElement('div');
    lockOverlay.className = 'lock-screen';
    lockOverlay.id = 'lockScreen';
    lockOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: ${lockWallpaper};
        ${lockWallpaper.startsWith('url(') ? 'background-size: cover; background-position: center; background-repeat: no-repeat;' : ''}
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; color: white; text-align: center;
    `;

    lockOverlay.innerHTML = `
        <div class="lock-content" onclick="startFaceRecognitionImmediate()" style="cursor: pointer; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="lock-time" style="font-size: 72px; font-weight: 100; margin-bottom: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" id="lockTime">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="lock-date" style="font-size: 18px; margin-bottom: 50px; opacity: 0.9; font-weight: 300; text-transform: uppercase; letter-spacing: 0.5px;" id="lockDate">
                ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div class="unlock-section" id="unlockSection">
                <div class="face-recognition" id="faceRecognition" style="display: none;">
                    <div class="face-scanner" style="width: 150px; height: 150px; border: 3px solid #007AFF; border-radius: 50%; margin: 0 auto 20px; position: relative; overflow: hidden;">
                        <div class="scanner-line" style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #007AFF; animation: faceScanning 2s ease-in-out infinite;"></div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 48px;">👤</div>
                    </div>
                    <div class="face-status" id="faceStatus" style="font-size: 16px; margin-bottom: 20px;">Scanning face...</div>
                </div>
                <div class="unlock-btn" id="unlockBtn" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid rgba(255, 255, 255, 0.5);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 25px;
                    font-size: 18px;
                    cursor: pointer;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                    display: inline-block;
                ">
                    👆 Tap to Unlock
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(lockOverlay);

    // Update time every second
    const timeInterval = setInterval(() => {
        const lockTimeEl = document.getElementById('lockTime');
        const lockDateEl = document.getElementById('lockDate');
        if (!lockTimeEl) {
            clearInterval(timeInterval);
            return;
        }

        const now = new Date();
        lockTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lockDateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }, 1000);
}

// Add CSS for face scanning animation
const faceAnimationCSS = `
@keyframes faceScanning {
    0% { top: 0; }
    50% { top: calc(100% - 6px); }
    100% { top: 0; }
}
`;

// Add the CSS to the document
if (!document.querySelector('#face-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'face-animation-styles';
    style.textContent = faceAnimationCSS;
    document.head.appendChild(style);
}

function startFaceRecognition() {
    const unlockBtn = document.getElementById('unlockBtn');
    const faceRecognition = document.getElementById('faceRecognition');
    const faceStatus = document.getElementById('faceStatus');

    if (!unlockBtn || !faceRecognition || !faceStatus) {
        console.log('Lock screen elements not found, unlocking directly...');
        hideLockScreen();
        return;
    }

    // Hide unlock button and show face recognition
    unlockBtn.style.display = 'none';
    faceRecognition.style.display = 'block';

    // Simulate face recognition process with smoother timing
    faceStatus.textContent = 'Positioning face...';

    setTimeout(() => {
        faceStatus.textContent = 'Face detected 👤';
    }, 800);

    setTimeout(() => {
        faceStatus.textContent = 'Analyzing features...';
    }, 1600);

    setTimeout(() => {
        faceStatus.textContent = 'Verifying identity...';
    }, 2200);

    setTimeout(() => {
        faceStatus.textContent = 'Face recognized! ✓';
        faceStatus.style.color = '#34C759';
    }, 2800);

    setTimeout(() => {
        hideLockScreen();
    }, 3200);
}

// Immediate Face Recognition (for tap anywhere unlock)
function startFaceRecognitionImmediate() {
    const faceRecognition = document.getElementById('faceRecognition');
    const faceStatus = document.getElementById('faceStatus');

    if (!faceRecognition || !faceStatus) {
        console.log('Face recognition elements not found, unlocking directly...');
        hideLockScreen();
        return;
    }

    // Show face recognition immediately
    faceRecognition.style.display = 'block';
    faceStatus.textContent = 'Scanning...';
    faceStatus.style.color = '#ffffff';

    // Faster recognition process
    setTimeout(() => {
        faceStatus.textContent = 'Face detected ✓';
        faceStatus.style.color = '#34C759';
    }, 800);

    setTimeout(() => {
        faceStatus.textContent = 'Face recognized! ✓';
        faceStatus.style.color = '#34C759';
    }, 1500);

    setTimeout(() => {
        showNotification('🔓 Device unlocked with Face ID', 'success');
        hideLockScreen();
    }, 2200);
}

// App Theming System
function initializeAppTheming() {
    updateAppTheme();

    // Watch for theme changes
    const observer = new MutationObserver(() => {
        updateAppTheme();
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });
}

function updateAppTheme() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const currentTheme = localStorage.getItem('selectedTheme') || 'cosmic';

    // Define theme-based color schemes for store apps
    const themeColors = {
        light: {
            appBg: '#ffffff',
            appText: '#333333',
            appSecondary: '#666666'
        },
        dark: {
            appBg: '#1a1a1a',
            appText: '#ffffff',
            appSecondary: '#cccccc'
        },
        cosmic: {
            appBg: isDarkMode ? '#0a0a0f' : '#f8f9ff',
            appText: isDarkMode ? '#e0e0ff' : '#2a2a4a',
            appSecondary: isDarkMode ? '#9090ff' : '#6060aa'
        },
        ocean: {
            appBg: isDarkMode ? '#001122' : '#f0f8ff',
            appText: isDarkMode ? '#80ccff' : '#003366',
            appSecondary: isDarkMode ? '#4488cc' : '#0066cc'
        },
        sunset: {
            appBg: isDarkMode ? '#2a1a00' : '#fff8f0',
            appText: isDarkMode ? '#ffcc80' : '#4a3000',
            appSecondary: isDarkMode ? '#cc8844' : '#cc6600'
        },
        forest: {
            appBg: isDarkMode ? '#0a1a0a' : '#f0fff0',
            appText: isDarkMode ? '#80ff80' : '#003300',
            appSecondary: isDarkMode ? '#44cc44' : '#006600'
        }
    };

    const colors = themeColors[currentTheme] || themeColors.cosmic;

    // Default app styling (black background, white text)
    const defaultAppColors = {
        appBg: '#000000',
        appText: '#ffffff',
        appSecondary: '#cccccc'
    };

    // Update CSS custom properties for themed apps
    document.documentElement.style.setProperty('--app-bg', colors.appBg);
    document.documentElement.style.setProperty('--app-text', colors.appText);
    document.documentElement.style.setProperty('--app-secondary', colors.appSecondary);

    // Update CSS custom properties for default apps
    document.documentElement.style.setProperty('--default-app-bg', defaultAppColors.appBg);
    document.documentElement.style.setProperty('--default-app-text', defaultAppColors.appText);
    document.documentElement.style.setProperty('--default-app-secondary', defaultAppColors.appSecondary);

    // Apply specific styling to app windows
    const appWindows = document.querySelectorAll('.app-window');
    appWindows.forEach(window => {
        const appId = window.id;

        // Default apps get black background with white text
        const defaultApps = [
            'cameraApp', 'calculatorApp', 'settingsApp', 'phoneApp',
            'notesApp', 'weatherApp', 'musicApp', 'photosApp',
            'mathsAiApp', 'aiMessagesApp', 'aiAssistantApp'
        ];

        // AI to UI app and store apps use dark gray colors
        const darkGrayApps = ['aiToUiApp', 'appStoreApp'];

        if (defaultApps.includes(appId)) {
            window.style.backgroundColor = defaultAppColors.appBg;
            window.style.color = defaultAppColors.appText;

            // Update content area specifically
            const appContent = window.querySelector('.app-content');
            if (appContent) {
                appContent.style.backgroundColor = defaultAppColors.appBg;
                appContent.style.color = defaultAppColors.appText;
            }
        } else if (darkGrayApps.includes(appId)) {
            window.style.backgroundColor = '#2c2c2c';
            window.style.color = '#ffffff';

            // Update content area specifically
            const appContent = window.querySelector('.app-content');
            if (appContent) {
                appContent.style.backgroundColor = '#2c2c2c';
                appContent.style.color = '#ffffff';
            }
        }
    });
}

// Screen Saver System
// let screenSaverTimeout = 10; // Default 10 seconds
let screenSaverTimer;
let isScreenSaverActive = false;
let lastActivityTime = Date.now();

function initializeScreenSaver() {
    // Load saved timeout
    const savedTimeout = localStorage.getItem('screensaverTimeout');
    if (savedTimeout && savedTimeout !== 'never') {
        screenSaverTimeout = parseInt(savedTimeout);
    }

    // Set the dropdown to saved value
    const dropdown = document.getElementById('screensaverTimeout');
    if (dropdown) {
        dropdown.value = savedTimeout || '10';
    }

    // Start monitoring user activity
    startActivityMonitoring();
    resetScreenSaverTimer();
}

function startActivityMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
        document.addEventListener(event, () => {
            if (isScreenSaverActive) {
                hideScreenSaver();
            }
            resetScreenSaverTimer();
        }, true);
    });
}

function resetScreenSaverTimer() {
    lastActivityTime = Date.now();

    if (screenSaverTimer) {
        clearTimeout(screenSaverTimer);
    }

    const timeout = localStorage.getItem('screensaverTimeout');
    if (timeout === 'never') return;

    const timeoutMs = (parseInt(timeout) || screenSaverTimeout) * 1000;

    screenSaverTimer = setTimeout(() => {
        showScreenSaver();
    }, timeoutMs);
}

function showScreenSaver() {
    if (isScreenSaverActive) return;

    isScreenSaverActive = true;

    // Create screensaver overlay
    const screensaver = document.createElement('div');
    screensaver.id = 'screensaver';
    screensaver.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(45deg, #000000, #1a1a1a, #000000);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
    `;

    const pattern = localStorage.getItem('screensaverPattern') || 'clock';

    if (pattern === 'clock') {
        screensaver.innerHTML = `
            <div class="screensaver-clock" style="text-align: center;">
                <div id="screensaver-time" style="font-size: 8rem; font-weight: 100; margin-bottom: 1rem; text-shadow: 0 0 20px rgba(255,255,255,0.5);">
                    ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div id="screensaver-date" style="font-size: 2rem; opacity: 0.7; font-weight: 300;">
                    ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
            </div>
        `;

        // Update time every second
        window.screensaverInterval = setInterval(() => {
            const timeEl = document.getElementById('screensaver-time');
            const dateEl = document.getElementById('screensaver-date');
            if (timeEl && dateEl) {
                const now = new Date();
                timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            }
        }, 1000);

    } else if (pattern === 'analog') {
        screensaver.innerHTML = `
            <div class="analog-clock" style="text-align: center;">
                <div class="clock-face" style="width: 300px; height: 300px; border: 4px solid white; border-radius: 50%; position: relative; margin: 0 auto;">
                    <div class="hour-hand" id="hour-hand" style="position: absolute; width: 6px; height: 80px; background: white; left: 50%; top: 25%; transform-origin: bottom; border-radius: 3px;"></div>
                    <div class="minute-hand" id="minute-hand" style="position: absolute; width: 4px; height: 100px; background: white; left: 50%; top: 17%; transform-origin: bottom; border-radius: 2px;"></div>
                    <div class="second-hand" id="second-hand" style="position: absolute; width: 2px; height: 110px; background: #ff0000; left: 50%; top: 13%; transform-origin: bottom; border-radius: 1px;"></div>
                    <div class="center-dot" style="position: absolute; width: 12px; height: 12px; background: white; border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%, -50%);"></div>
                </div>
                <div class="analog-time" style="margin-top: 2rem; font-size: 1.5rem; opacity: 0.8;">${new Date().toLocaleTimeString()}</div>
            </div>
        `;

        updateAnalogClock();
        window.screensaverInterval = setInterval(updateAnalogClock, 1000);

    } else if (pattern === 'patterns') {
        screensaver.innerHTML = `
            <div class="pattern-animation" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
                <div class="floating-shapes"></div>
            </div>
        `;
        addFloatingShapes(screensaver.querySelector('.floating-shapes'));

    }

    else if (pattern === 'waves') {
    screensaver.innerHTML = `
        <div class="wave-animation" style="width: 100%; height: 100%; position: relative; overflow: hidden;">
            <canvas id="wave-canvas" style="width: 100%; height: 100%;"></canvas>
        </div>
    `;

    // ✅ Delay to ensure canvas is fully available in DOM
    setTimeout(() => {
        createWaveAnimation();
    }, 50); // 50ms delay is usually enough
}

    else if (pattern === 'photos') {
        const photos = JSON.parse(localStorage.getItem('photos') || '[]');
        if (photos.length > 0) {
            screensaver.innerHTML = `
                <div class="photo-slideshow" style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;">
                    <img id="slideshow-image" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 12px; box-shadow: 0 0 30px rgba(255,255,255,0.3);">
                    <div class="photo-info" style="position: absolute; bottom: 50px; left: 50%; transform: translateX(-50%); text-align: center; background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 20px;">
                        <div id="photo-count" style="font-size: 1rem; opacity: 0.8;"></div>
                    </div>
                </div>
            `;
            startPhotoSlideshow(photos);
        } else {
            screensaver.innerHTML = `
                <div style="text-align: center;">
                    <h2 style="margin-bottom: 1rem;">📷 No Photos Available</h2>
                    <p style="opacity: 0.7;">Take some photos with the Camera app to use this screensaver!</p>
                </div>
            `;
        }

    } else if (pattern === 'matrix') {
        screensaver.innerHTML = `
            <div class="matrix-animation" style="width: 100%; height: 100%; position: relative; overflow: hidden; background: #000;">
                <canvas id="matrix-canvas" style="width: 100%; height: 100%;"></canvas>
            </div>
        `;

          setTimeout(() => {
            createMatrixAnimation();
         }, 50); // 50ms delay is usually enough



    }

    // Click to dismiss
    screensaver.addEventListener('click', hideScreenSaver);

    document.body.appendChild(screensaver);
}

function addFloatingShapes(container) {
    const shapes = ['●', '■', '▲', '♦', '★'];
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];

    for (let i = 0; i < 20; i++) {
        const shape = document.createElement('div');
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        shape.textContent = randomShape;
        shape.style.cssText = `
            position: absolute;
            font-size: ${Math.random() * 40 + 20}px;
            color: ${randomColor};
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 10}s infinite linear;
            opacity: 0.7;
        `;

        container.appendChild(shape);
    }

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float {
            0% { transform: translateY(100vh) rotate(0deg); }
            100% { transform: translateY(-100vh) rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function hideScreenSaver() {
    const screensaver = document.getElementById('screensaver');
    if (screensaver) {
        screensaver.remove();
    }

    if (window.screensaverInterval) {
        clearInterval(window.screensaverInterval);
    }

    isScreenSaverActive = false;
    resetScreenSaverTimer();
}

function setScreenSaverTimeout() {
    const dropdown = document.getElementById('screensaverTimeout');
    const value = dropdown.value;

    localStorage.setItem('screensaverTimeout', value);

    if (value === 'never') {
        if (screenSaverTimer) {
            clearTimeout(screenSaverTimer);
        }
        showNotification('Screen saver disabled', 'info');
    } else {
        screenSaverTimeout = parseInt(value);
        resetScreenSaverTimer();
        showNotification(`Screen saver set to ${value} seconds`, 'success');
    }
}

function openScreenSaverSettings() {
    const content = `
        <div class="screensaver-settings">
            <h3 style="color: var(--app-text, #333); margin-bottom: 20px;">Screen Saver Settings</h3>

            <div class="screensaver-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div class="setting-group">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">🕐 Digital Clock</h4>
                    <p style="color: var(--app-text, #666); margin-bottom: 10px; font-size: 12px;">Modern digital display</p>
                    <button onclick="setScreenSaverPattern('clock')" class="screensaver-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #007AFF;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Digital Clock</button>
                </div>

                <div class="setting-group">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">🕰️ Analog Clock</h4>
                    <p style="color: var(--app-text, #666); margin-bottom: 10px; font-size: 12px;">Classic clock face</p>
                    <button onclick="setScreenSaverPattern('analog')" class="screensaver-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #34C759;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Analog Clock</button>
                </div>

                <div class="setting-group">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">✨ Floating Shapes</h4>
                    <p style="color: var(--app-text, #666); margin-bottom: 10px; font-size: 12px;">Geometric animations</p>
                    <button onclick="setScreenSaverPattern('patterns')" class="screensaver-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #FF9500;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Floating Shapes</button>
                </div>

                <div class="setting-group">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">🌊 Dynamic Waves</h4>
                    <p style="color: var(--app-text, #666); margin-bottom: 10px; font-size: 12px;">Flowing wave patterns</p>
                    <button onclick="setScreenSaverPattern('waves')" class="screensaver-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #5AC8FA;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Dynamic Waves</button>
                </div>

                <div class="setting-group">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">🖼️ Photo Gallery</h4>
                    <p style="color: var(--app-text, #666); margin-bottom: 10px; font-size: 12px;">Slideshow of photos</p>
                    <button onclick="setScreenSaverPattern('photos')" class="screensaver-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #FF2D92;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Photo Gallery</button>
                </div>

                <div class="setting-group">
                    <h4 style="color: var(--app-text, #333); margin-bottom: 10px;">🌟 Matrix Rain</h4>
                    <p style="color: var(--app-text, #666); margin-bottom: 10px; font-size: 12px;">Falling green code</p>
                    <button onclick="setScreenSaverPattern('matrix')" class="screensaver-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #30D158;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Matrix Rain</button>
                </div>
            </div>

            <div class="setting-group">
                <h4 style="color: var(--app-text, #333); margin-bottom: 15px;">⚡ Test Current Screen Saver</h4>
                <button onclick="testScreenSaver()" class="screensaver-btn" style="
                    width: 100%;
                    padding: 15px;
                    background: #8E8E93;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                ">🔍 Preview Screen Saver</button>
            </div>
        </div>
    `;

    createAppWindow('Screen Saver Settings', content);
}

function setScreenSaverPattern(pattern) {
    localStorage.setItem('screensaverPattern', pattern);

    const patternNames = {
        'clock': 'Digital Clock',
        'analog': 'Analog Clock',
        'patterns': 'Floating Shapes',
        'waves': 'Dynamic Waves',
        'photos': 'Photo Gallery',
        'matrix': 'Matrix Rain'
    };

    const patternName = patternNames[pattern] || 'Unknown Pattern';
    showNotification(`Screen saver set to: ${patternName}`, 'success');
    closeDynamicApp('screensaver-settings');
}

function testScreenSaver() {
    showScreenSaver();
    closeDynamicApp('screensaver-settings');
}

function loadScreenSaverSettings() {
    // Load saved screensaver timeout
    const savedTimeout = localStorage.getItem('screensaverTimeout');
    if (savedTimeout) {
        const dropdown = document.getElementById('screensaverTimeout');
        if (dropdown) {
            dropdown.value = savedTimeout;
            if (savedTimeout !== 'never') {
                screenSaverTimeout = parseInt(savedTimeout);
            }
        }
    }

    // Load saved screensaver pattern
    const savedPattern = localStorage.getItem('screensaverPattern');
    if (savedPattern) {
        console.log(`Loaded screensaver pattern: ${savedPattern}`);
    }
}

// Enhanced Wallpaper Upload Functions
// Function to resize and convert images to a web-friendly format
function processImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return resolve(null); // Not an image file
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Set a max dimension for the wallpaper
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1080;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG for broad compatibility and smaller size
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

                const photoData = {
                    id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    dataUrl: dataUrl,
                    timestamp: Date.now(),
                    type: 'uploaded',
                    favorite: false
                };
                resolve(photoData);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleMultipleWallpaperUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    showNotification('Processing images...', 'info');

    const promises = Array.from(files).map(processImage);

    try {
        const newPhotos = (await Promise.all(promises)).filter(p => p !== null);
        if (newPhotos.length > 0) {
            userPhotos.push(...newPhotos);
            await savePhotos(); // Save all new photos to IndexedDB
            showNotification(`${newPhotos.length} photos added successfully!`, 'success');
        } else {
            showNotification('No valid image files were selected.', 'error');
        }
    } catch (error) {
        console.error('Error processing multiple wallpaper uploads:', error);
        showNotification('An error occurred while adding photos.', 'error');
    }

    // Refresh the interface after a short delay
    setTimeout(() => {
        openPhotoWallpaperSettings();
    }, 1500);
}

async function clearAllWallpapers() {
    if (confirm('Are you sure you want to delete all saved wallpapers? This cannot be undone.')) {
        try {
            if (!db) await initDB();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await store.clear();

            userPhotos = []; // Clear the in-memory array

            transaction.oncomplete = () => {
                showNotification('All wallpapers have been cleared.', 'success');
                // Refresh the view
                const grid = document.getElementById('phone-photos-grid');
                if (grid) {
                    grid.innerHTML = '<p style="color: var(--app-text, #333); text-align: center;">No photos in gallery.</p>';
                }
            };

            transaction.onerror = (event) => {
                console.error('Error clearing wallpapers:', event.target.error);
                showNotification('Failed to clear wallpapers.', 'error');
            };

        } catch (error) {
            console.error('Error accessing IndexedDB to clear wallpapers:', error);
            showNotification('An error occurred while clearing wallpapers.', 'error');
        }
    }
}

function accessPhonePhotos() {
    const photos = JSON.parse(localStorage.getItem('photos') || '[]');
    if (photos.length === 0) {
        showNotification('No photos found. Take some photos with the Camera app first!', 'info');
        return;
    }

    // Add phone photos to wallpaper gallery
    const wallpaperGallery = JSON.parse(localStorage.getItem('wallpaperGallery') || '[]');

    photos.forEach(photo => {
        const exists = wallpaperGallery.find(w => w.dataUrl === photo.dataUrl);
        if (!exists) {
            wallpaperGallery.push({
                id: Date.now() + Math.random(),
                name: `Photo_${photo.timestamp}`,
                dataUrl: photo.dataUrl,
                timestamp: photo.timestamp,
                type: 'camera'
            });
        }
    });

    localStorage.setItem('wallpaperGallery', JSON.stringify(wallpaperGallery));
    showNotification(`${photos.length} photos imported to wallpaper gallery!`, 'success');

    setTimeout(() => {
        openPhotoWallpaperSettings(); // Refresh the interface
    }, 1000);
}

function openPhotoGallerySelector() {
    const photos = JSON.parse(localStorage.getItem('photos') || '[]');
    const wallpaperGallery = JSON.parse(localStorage.getItem('wallpaperGallery') || '[]');
    const allPhotos = [...photos, ...wallpaperGallery];

    if (allPhotos.length === 0) {
        showNotification('No photos available. Take some photos or upload files first!', 'info');
        return;
    }

    const content = `
        <div class="photo-gallery-selector">
            <h3 style="color: var(--app-text, #333); margin-bottom: 20px;">📷 Select Photo for Wallpaper</h3>
            <div class="gallery-grid" style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                max-height: 400px;
                overflow-y: auto;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 12px;
                background: rgba(255,255,255,0.05);
            ">
                ${allPhotos.map((photo, index) => `
                    <div class="gallery-photo-item" style="
                        position: relative;
                        cursor: pointer;
                        border-radius: 12px;
                        overflow: hidden;
                        border: 2px solid transparent;
                        transition: all 0.3s ease;
                    " onclick="selectGalleryPhoto('${photo.dataUrl}', ${index})">
                        <img src="${photo.dataUrl}" style="
                            width: 100%;
                            height: 150px;
                            object-fit: cover;
                        ">


                            <div style="display: flex; gap: 5px;">
                                <button onclick="event.stopPropagation(); applyGalleryPhotoToHome('${photo.dataUrl}')" style="
                                    flex: 1;
                                    padding: 6px;
                                    background: #34C759;
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">🏠 Home</button>
                                <button onclick="event.stopPropagation(); applyGalleryPhotoToLock('${photo.dataUrl}')" style="
                                    flex: 1;
                                    padding: 6px;
                                    background: #FF9500;
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">🔒 Lock</button>
                                <button onclick="event.stopPropagation(); applyGalleryPhotoToBoth('${photo.dataUrl}')" style="
                                    flex: 1;
                                    padding: 6px;
                                    background: #007AFF;
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">Both</button>
                            </div>

                              <div class="photo-overlay" style="
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            background: linear-gradient(transparent, rgba(0,0,0,0.8));
                            padding: 10px;
                            color: white;
                            font-size: 12px;
                            z-index: -99;">


                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="closeDynamicApp('photo-gallery-selector')" style="
                    padding: 12px 30px;
                    background: #666;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                ">Close</button>
            </div>
        </div>
    `;

    createAppWindow('Photo Gallery', content);
}

function selectGalleryPhoto(dataUrl, index) {
    // Highlight selected photo
    const items = document.querySelectorAll('.gallery-photo-item');
    items.forEach(item => item.style.border = '2px solid transparent');
    if (items[index]) {
        items[index].style.border = '2px solid #007AFF';
    }
    selectedWallpaperPhoto = dataUrl;
}

function applyGalleryPhotoToHome(dataUrl) {
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.backgroundImage = `url(${dataUrl})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';
    }
    localStorage.setItem('homeWallpaper', dataUrl);
    localStorage.setItem('wallpaperActive', 'true');
    showNotification('Photo applied to home screen!', 'success');
    closeDynamicApp('photo-gallery-selector');
}

function applyGalleryPhotoToLock(dataUrl) {
    localStorage.setItem('lockWallpaper', `url(${dataUrl})`);
    showNotification('Photo applied to lock screen!', 'success');
    closeDynamicApp('photo-gallery-selector');
}

function applyGalleryPhotoToBoth(dataUrl) {
    // Apply to home screen
    const mobileOS = document.getElementById('mobile-os');
    if (mobileOS) {
        mobileOS.style.backgroundImage = `url(${dataUrl})`;
        mobileOS.style.backgroundSize = 'cover';
        mobileOS.style.backgroundPosition = 'center';
        mobileOS.style.backgroundRepeat = 'no-repeat';
        mobileOS.style.backgroundAttachment = 'fixed';
    }
    localStorage.setItem('homeWallpaper', dataUrl);
    localStorage.setItem('wallpaperActive', 'true');

    // Apply to lock screen
    localStorage.setItem('lockWallpaper', `url(${dataUrl})`);

    showNotification('Photo applied to both screens!', 'success');
    closeDynamicApp('photo-gallery-selector');
}

// Screensaver Animation Functions
function updateAnalogClock() {
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourDegree = (hours * 30) + (minutes * 0.5) - 90;
    const minuteDegree = (minutes * 6) - 90;
    const secondDegree = (seconds * 6) - 90;

    const hourHand = document.getElementById('hour-hand');
    const minuteHand = document.getElementById('minute-hand');
    const secondHand = document.getElementById('second-hand');

    if (hourHand) hourHand.style.transform = `translateX(-50%) rotate(${hourDegree}deg)`;
    if (minuteHand) minuteHand.style.transform = `translateX(-50%) rotate(${minuteDegree}deg)`;
    if (secondHand) secondHand.style.transform = `translateX(-50%) rotate(${secondDegree}deg)`;

    const timeDisplay = document.querySelector('.analog-time');
    if (timeDisplay) timeDisplay.textContent = now.toLocaleTimeString();
}

function createWaveAnimation() {

    const canvas = document.getElementById('wave-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let time = 0;

    function drawWaves() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 122, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(52, 199, 89, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 45, 146, 0.3)');

        ctx.fillStyle = gradient;

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x++) {
                const y = Math.sin((x * 0.01) + (time * 0.02) + (i * 2)) * 50 +
                         Math.sin((x * 0.02) + (time * 0.01) + (i * 3)) * 30 +
                         canvas.height / 2 + (i * 100);

                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        time += 0.5;
        requestAnimationFrame(drawWaves);
    }

    drawWaves();
}

function startPhotoSlideshow(photos) {
    let currentIndex = 0;
    const img = document.getElementById('slideshow-image');
    const counter = document.getElementById('photo-count');

    function showPhoto() {
        if (photos.length === 0) return;

        img.src = photos[currentIndex].dataUrl;
        counter.textContent = `${currentIndex + 1} of ${photos.length}`;

        currentIndex = (currentIndex + 1) % photos.length;
    }

    showPhoto();
    window.screensaverInterval = setInterval(showPhoto, 5000);
}

function createMatrixAnimation() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = new Array(Math.floor(columns)).fill(1);

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0f0';
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }

        requestAnimationFrame(draw);
    }

    draw();
}

// App Store search functionality
let allApps = [];

function searchApps() {
    const searchTerm = document.getElementById('appSearchInput').value.toLowerCase().trim();
    const appsList = document.getElementById('appsList');

    if (!allApps.length) {
        // Store all apps for searching
        const storeApps = document.querySelectorAll('.store-app');
        allApps = Array.from(storeApps).map(app => ({
            element: app,
            name: app.querySelector('h4').textContent.toLowerCase(),
            description: app.querySelector('p').textContent.toLowerCase(),
            category: app.querySelector('.category').textContent.toLowerCase()
        }));
    }

    // Clear current display
    appsList.innerHTML = '';

    // Filter and display apps
    const filteredApps = allApps.filter(app =>
        app.name.includes(searchTerm) ||
        app.description.includes(searchTerm) ||
        app.category.includes(searchTerm)
    );

    if (filteredApps.length === 0 && searchTerm) {
        appsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <h3>No apps found</h3>
                <p>Try searching for something else</p>
            </div>
        `;
    } else {
        filteredApps.forEach(app => {
            appsList.appendChild(app.element.cloneNode(true));
        });

        if (searchTerm === '') {
            // Show all apps when search is empty
            allApps.forEach(app => {
                appsList.appendChild(app.element.cloneNode(true));
            });
        }
    }
}

// --- Lock Apps Logic ---
let originalOpenApp = window.originalOpenApp || openApp;
window.originalOpenApp = originalOpenApp;

// --- App Lock State Management ---
function isCalculatorLocked() { return localStorage.getItem('lockCalculator') === 'true'; }
function setCalculatorLocked(locked) { localStorage.setItem('lockCalculator', locked ? 'true' : 'false'); }
function toggleLockCalculator() { setCalculatorLocked(document.getElementById('lockCalculator').checked); }

function isCameraLocked() { return localStorage.getItem('lockCamera') === 'true'; }
function setCameraLocked(locked) { localStorage.setItem('lockCamera', locked ? 'true' : 'false'); }
function toggleLockCamera() { setCameraLocked(document.getElementById('lockCamera').checked); }

function isAiToUiLocked() { return localStorage.getItem('lockAiToUi') === 'true'; }
function setAiToUiLocked(locked) { localStorage.setItem('lockAiToUi', locked ? 'true' : 'false'); }
function toggleLockAiToUi() { setAiToUiLocked(document.getElementById('lockAiToUi').checked); }

function isPhoneLocked() { return localStorage.getItem('lockPhone') === 'true'; }
function setPhoneLocked(locked) { localStorage.setItem('lockPhone', locked ? 'true' : 'false'); }
function toggleLockPhone() { setPhoneLocked(document.getElementById('lockPhone').checked); }

function isAppStoreLocked() { return localStorage.getItem('lockAppStore') === 'true'; }
function setAppStoreLocked(locked) { localStorage.setItem('lockAppStore', locked ? 'true' : 'false'); }
function toggleLockAppStore() { setAppStoreLocked(document.getElementById('lockAppStore').checked); }

// --- Sync Checkboxes with localStorage ---
function syncAllLockCheckboxes() {
    const apps = ['Calculator', 'Camera', 'AiToUi', 'Phone', 'AppStore'];
    apps.forEach(app => {
        const isLocked = localStorage.getItem(`lock${app}`) === 'true';
        const checkbox = document.getElementById(`lock${app}`);
        if (checkbox) {
            checkbox.checked = isLocked;
        }
    });
}

// --- Passcode and Unlock Logic ---
function openPasscodeSettings() {
    const currentPasscode = localStorage.getItem('devicePasscode') || '';
    const promptMessage = currentPasscode ? 'Enter new passcode (4-8 digits). Leave blank to remove.' : 'Set a new passcode (4-8 digits):';
    const newPasscode = prompt(promptMessage);

    if (newPasscode === null) return; // User cancelled

    if (newPasscode.trim() === '') {
        if (currentPasscode) {
            localStorage.removeItem('devicePasscode');
            alert('Passcode removed.');
        }
    } else if (/^\d{4,8}$/.test(newPasscode)) {
        localStorage.setItem('devicePasscode', newPasscode.trim());
        alert('Passcode set successfully.');
    } else {
        alert('Invalid passcode. Please enter 4 to 8 digits.');
    }
}

function showAppLockPasscodePopup(appName) {
    if (document.getElementById('appLockPasscodePopup')) return;

    const popup = document.createElement('div');
    popup.id = 'appLockPasscodePopup';
    popup.className = 'locked-app-popup';
    popup.style.cssText = `
        position: fixed; left: 50%; top: 30%; transform: translate(-50%, 0); z-index: 3000;
        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); color: #222; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        padding: 32px 36px; font-size: 20px; font-weight: 600; text-align: center;
        min-width: 280px;
    `;

    const isPasscodeSet = localStorage.getItem('devicePasscode');
    let popupHTML = '';

    if (isPasscodeSet) {
        popupHTML = `
            <div style="font-size: 32px; margin-bottom: 12px;">🔒</div>
            <div style="margin-bottom: 18px;">Enter Passcode</div>
            <input type="password" id="appLockPasscodeInput" style="width: 80%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; text-align: center; font-size: 18px; margin-bottom: 18px;" inputmode="numeric">
            <div id="appLockError" style="color: red; font-size: 14px; height: 20px; margin-bottom: 10px;"></div>
            <button style="width: 100%; padding: 12px 24px; border-radius: 8px; border: none; background: #007AFF; color: white; font-size: 16px; cursor: pointer;" onclick="checkAppLockPasscode('${appName}')">Unlock</button>
            <button style="width: 100%; padding: 10px 24px; border: none; background: transparent; color: #007AFF; font-size: 14px; cursor: pointer; margin-top: 10px;" onclick="document.getElementById('appLockPasscodePopup').remove()">Cancel</button>
        `;
    } else {
        popupHTML = `
            <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
            <div style="margin-bottom: 18px; font-size: 16px;">Set a device passcode in Settings to use App Lock.</div>
            <button style="padding: 8px 24px; border-radius: 8px; border: none; background: #007AFF; color: white; font-size: 16px; cursor: pointer;" onclick="document.getElementById('appLockPasscodePopup').remove()">OK</button>
        `;
    }

    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);
    const passcodeInput = document.getElementById('appLockPasscodeInput');
    if (passcodeInput) passcodeInput.focus();
}

function checkAppLockPasscode(appName) {
    const enteredPasscode = document.getElementById('appLockPasscodeInput').value;
    const correctPasscode = localStorage.getItem('devicePasscode');
    const errorEl = document.getElementById('appLockError');

    if (enteredPasscode === correctPasscode) {
        switch (appName) {
            case 'calculator': setCalculatorLocked(false); break;
            case 'camera': setCameraLocked(false); break;
            case 'ai-to-ui': setAiToUiLocked(false); break;
            case 'phone': setPhoneLocked(false); break;
            case 'app-store': setAppStoreLocked(false); break;
        }
        syncAllLockCheckboxes();

        const popup = document.getElementById('appLockPasscodePopup');
        if (popup) popup.remove();
        originalOpenApp(appName);
    } else {
        errorEl.textContent = 'Incorrect Passcode';
        const passcodeInput = document.getElementById('appLockPasscodeInput');
        passcodeInput.style.border = '1px solid red';
        setTimeout(() => {
            if (passcodeInput) {
                errorEl.textContent = '';
                passcodeInput.style.border = '1px solid #ccc';
            }
        }, 2000);
    }
}

// --- Patch openApp to Intercept Locked Apps ---
if (!window._openAppLockPatchApplied) {
    window.openApp = function(appName) {
        if (
            (appName === 'calculator' && isCalculatorLocked()) ||
            (appName === 'camera' && isCameraLocked()) ||
            (appName === 'ai-to-ui' && isAiToUiLocked()) ||
            (appName === 'phone' && isPhoneLocked()) ||
            (appName === 'app-store' && isAppStoreLocked())
        ) {
            showAppLockPasscodePopup(appName);
            return;
        }
        if (appName === 'settings') {
            setTimeout(syncAllLockCheckboxes, 100);
        }
        originalOpenApp.apply(this, arguments);
    };
    window._openAppLockPatchApplied = true;
}

window.addEventListener('DOMContentLoaded', function() {
    syncAllLockCheckboxes();
});
// ... existing code ...
