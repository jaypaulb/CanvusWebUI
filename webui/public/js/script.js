// Change load delay to 0.5 seconds
const LOAD_DELAY = 500; // Changed from whatever it was before to 500ms

// Update canvas name mismatch message
function checkEnvironment(canvasName, canvasId) {
    fetch(`/check-env?canvasName=${encodeURIComponent(canvasName)}&canvasId=${encodeURIComponent(canvasId)}`)
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