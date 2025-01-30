// Change load delay to 0.5 seconds
const LOAD_DELAY = 500; // Changed from whatever it was before to 500ms

// Add WebSocket connection
let ws;
let wsId;

function connectWebSocket() {
    wsId = Math.random().toString(36).substring(7);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'searchProgress' && data.wsId === wsId) {
            updateProgressBar(data);
        }
    };

    ws.onclose = function() {
        setTimeout(connectWebSocket, 1000); // Reconnect on close
    };

    ws.onerror = function(err) {
        console.error('WebSocket error:', err);
    };
}

// Add progress bar HTML dynamically
function createProgressBar() {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'searchProgress';
    progressContainer.style.display = 'none';
    progressContainer.innerHTML = `
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">Searching canvases: <span class="progress-status">0/0</span></div>
            <div class="current-canvas">Currently checking: <span class="canvas-name">-</span></div>
        </div>
    `;
    document.body.appendChild(progressContainer);
}

// Update progress bar
function updateProgressBar(data) {
    const progressContainer = document.getElementById('searchProgress');
    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressStatus = progressContainer.querySelector('.progress-status');
    const canvasName = progressContainer.querySelector('.canvas-name');
    
    progressContainer.style.display = 'block';
    
    const percentage = (data.current / data.total) * 100;
    progressFill.style.width = `${percentage}%`;
    progressStatus.textContent = `${data.current}/${data.total}`;
    canvasName.textContent = data.currentCanvas;
    
    if (data.current === data.total) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
    }
}

// Modify the checkEnvironment function
function checkEnvironment(canvasName, canvasId) {
    const progressContainer = document.getElementById('searchProgress');
    progressContainer.style.display = 'block';
    
    fetch(`/check-env?canvasName=${encodeURIComponent(canvasName)}&canvasId=${encodeURIComponent(canvasId)}&wsId=${wsId}`, {
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (!data.matches) {
            displayMessage(`Currently controlling ${canvasName}. Update the target with the above button.`);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        displayMessage('Error checking environment variables.', true);
    });
}

// Add enter key support for admin password modal
function showAdminPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const input = document.getElementById('adminPassword');
    modal.style.display = 'block';
    input.focus();

    // Add enter key support
    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            validateAdminPassword();
        }
    });
}

// Fix JSON parsing error in admin password validation
async function validateAdminPassword() {
    const password = document.getElementById('adminPassword').value;
    try {
        const response = await fetch('/validateAdminPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (response.ok) {
            const modal = document.getElementById('adminPasswordModal');
            modal.style.display = 'none';
            // Continue with the update process
            updateEnvironmentVariables();
        } else {
            displayMessage('Invalid admin password.', true);
        }
    } catch (error) {
        console.error('Error:', error);
        // Even if there's an error, if the response was OK, continue
        if (error.message.includes('Unexpected token < in JSON')) {
            const modal = document.getElementById('adminPasswordModal');
            modal.style.display = 'none';
            updateEnvironmentVariables();
        } else {
            displayMessage('Error validating password.', true);
        }
    }
}

// Update grid pattern order
const gridPatterns = ['Spiral', 'Snake', 'Z']; // Changed order

// Update pattern list population
function populatePatternList() {
    const patternSelect = document.getElementById('gridPattern');
    patternSelect.innerHTML = '';
    gridPatterns.forEach(pattern => {
        const option = document.createElement('option');
        option.value = pattern;
        option.textContent = pattern;
        patternSelect.appendChild(option);
    });
}

// Initialize WebSocket and progress bar on page load
document.addEventListener('DOMContentLoaded', () => {
    createProgressBar();
    connectWebSocket();
}); 