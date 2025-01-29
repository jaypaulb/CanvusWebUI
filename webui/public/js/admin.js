// /public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('admin-password');
    const passwordMessage = document.getElementById('password-message');
    const envFormContainer = document.getElementById('env-form-container');
    const envForm = document.getElementById('env-form');
    const envMessage = document.getElementById('env-message');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmSaveButton = document.getElementById('confirm-save');
    const cancelSaveButton = document.getElementById('cancel-save');
    const restartApiBtn = document.getElementById('restart-api-btn');
    const restartWebuiBtn = document.getElementById('restart-webui-btn');
    const apiConfirm = document.getElementById('api-confirm');
    const webuiConfirm = document.getElementById('webui-confirm');
    const apiStatus = document.getElementById('api-status');
    const webuiStatus = document.getElementById('webui-status');
  
    // Function to display messages
    function displayMessage(element, text, type) {
      element.textContent = text;
      element.className = `message ${type}`;
      element.style.display = "block";
    }
  
    // Function to clear messages
    function clearMessage(element) {
      element.textContent = "";
      element.className = "message";
      element.style.display = "none";
    }
  
    // Handle Password Form Submission
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault(); // Prevent form from submitting normally
      clearMessage(passwordMessage);
      clearMessage(envMessage);
  
      const enteredPassword = passwordInput.value.trim();
  
      if (!enteredPassword) {
        displayMessage(passwordMessage, "Password cannot be empty.", "error");
        return;
      }
  
      try {
        // Authenticate the password by sending it to the server
        const response = await fetch('/validateAdminPassword', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: enteredPassword }),
        });
  
        const data = await response.json();
  
        if (response.ok && data.success) {
          displayMessage(passwordMessage, "Authentication successful.", "success");
          // Hide the password section and show the environment form
          document.getElementById('password-section').style.display = 'none';
          envFormContainer.style.display = 'block';
          // Set the hidden password field
          envForm.querySelector('input[name="password"]').value = enteredPassword;
          // Fetch and populate environment variables
          fetchAndPopulateEnvVariables();
        } else {
          displayMessage(passwordMessage, data.error || "Authentication failed.", "error");
        }
  
      } catch (error) {
        console.error('Error during authentication:', error);
        displayMessage(passwordMessage, "An error occurred during authentication.", "error");
      }
    });
  
    // Function to fetch and populate Environment Variables
    async function fetchAndPopulateEnvVariables() {
      clearMessage(envMessage);
      displayMessage(envMessage, "Loading environment variables...", "loading");
  
      try {
        const response = await fetch('/env-variables', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to fetch environment variables.');
        }
  
        const envData = await response.json();
  
        // Display the environment variables in editable fields
        const envContainer = document.getElementById('env-variables');
        envContainer.innerHTML = ''; // Clear any existing content
  
        for (const [key, value] of Object.entries(envData)) {
          const fieldDiv = document.createElement('div');
          fieldDiv.className = 'env-field';
  
          const label = document.createElement('label');
          label.setAttribute('for', key);
          label.textContent = `${key}:`;
  
          const input = document.createElement('input');
          input.type = 'text';
          input.name = key;
          input.id = key;
          input.value = value;
          input.required = true;
  
          fieldDiv.appendChild(label);
          fieldDiv.appendChild(input);
          envContainer.appendChild(fieldDiv);
        }
  
        clearMessage(envMessage); // Clear the loading message
      } catch (error) {
        console.error('Error fetching environment variables:', error);
        displayMessage(envMessage, "Error fetching environment variables.", "error");
      }
    }
  
    // Function to handle Environment Variables Form Submission
    envForm.addEventListener('submit', (event) => {
      event.preventDefault(); // Prevent default form submission behavior
      clearMessage(envMessage);
  
      // Show the confirmation modal
      confirmModal.style.display = 'block';
    });
  
    // Handle Confirm Save Button Click
    confirmSaveButton.addEventListener('click', async () => {
      // Hide the confirmation modal
      confirmModal.style.display = 'none';
      displayMessage(envMessage, "Saving changes...", "loading");
  
      const formData = new FormData(envForm);
      const updatedValues = {};
  
      // Collect all form data, including the password
      formData.forEach((value, key) => {
        updatedValues[key] = value.trim();
      });
  
      try {
        const response = await fetch('/update-env', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedValues)
        });
  
        const result = await response.json();
  
        if (response.ok && result.success) {
          displayMessage(envMessage, "Environment variables updated successfully.", "success");
        } else {
          displayMessage(envMessage, result.error || "Failed to update environment variables.", "error");
        }
  
      } catch (error) {
        console.error("Error updating environment variables:", error);
        displayMessage(envMessage, "An error occurred while saving changes.", "error");
      }
    });
  
    // Handle Cancel Save Button Click
    cancelSaveButton.addEventListener('click', () => {
      // Hide the confirmation modal
      confirmModal.style.display = 'none';
      // Optionally, display a message or take other actions
    });
  
    // Optional: Close the modal when clicking outside the modal content
    window.addEventListener('click', (event) => {
      if (event.target == confirmModal) {
        confirmModal.style.display = 'none';
      }
    });
  
    // Function to handle PM2 restart
    async function restartPM2Process(processName) {
        try {
            const password = envForm.querySelector('input[name="password"]').value;
            const statusElement = processName === 'apiDemo' ? apiStatus : webuiStatus;
            
            clearMessage(statusElement);
            displayMessage(statusElement, `Attempting to restart ${processName}...`, "loading");
            
            console.log(`Attempting to restart ${processName}...`);
            
            if (processName === 'webui') {
                // For webui, just send the request and assume it worked if we get a 502
                try {
                    await fetch('/restart-pm2', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            process: processName,
                            password: password
                        })
                    });
                } catch (error) {
                    console.log('Expected disconnect during webui restart');
                }
                
                // Show reload message immediately
                displayMessage(statusElement, "WebUI is restarting. Page will reload in 10 seconds...", "info");
                
                // Wait 10 seconds then reload the page
                setTimeout(() => {
                    window.location.reload();
                }, 10000);
                
                return;
            }
            
            // For other processes (like apiDemo), use the normal flow
            const response = await fetch('/restart-pm2', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    process: processName,
                    password: password
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server returned non-JSON response (${response.status})`);
            }

            const result = await response.json();
            console.log('Restart result:', result);

            if (response.ok && result.success) {
                displayMessage(statusElement, `${processName} restarted successfully.`, "success");
            } else {
                throw new Error(result.error || `Failed to restart ${processName}`);
            }
        } catch (error) {
            console.error(`Error restarting ${processName}:`, error);
            const statusElement = processName === 'apiDemo' ? apiStatus : webuiStatus;
            
            if (processName === 'webui' && error.message.includes('502')) {
                // This is expected for webui restart
                displayMessage(statusElement, "WebUI is restarting. Page will reload in 10 seconds...", "info");
                setTimeout(() => {
                    window.location.reload();
                }, 10000);
            } else {
                displayMessage(statusElement, `Error: ${error.message}`, "error");
            }
        }
    }

    // API Demo restart button click handler
    restartApiBtn.addEventListener('click', () => {
        apiConfirm.style.display = 'block';
        webuiConfirm.style.display = 'none'; // Hide other confirmation if visible
        clearMessage(apiStatus);
    });

    // WebUI restart button click handler
    restartWebuiBtn.addEventListener('click', () => {
        webuiConfirm.style.display = 'block';
        apiConfirm.style.display = 'none'; // Hide other confirmation if visible
        clearMessage(webuiStatus);
    });

    // Handle confirmation buttons for API Demo
    apiConfirm.querySelector('.confirm-yes').addEventListener('click', async () => {
        apiConfirm.style.display = 'none';
        displayMessage(apiStatus, "Restarting API Demo...", "loading");
        await restartPM2Process('apiDemo');
    });

    apiConfirm.querySelector('.confirm-no').addEventListener('click', () => {
        apiConfirm.style.display = 'none';
        clearMessage(apiStatus);
    });

    // Handle confirmation buttons for WebUI
    webuiConfirm.querySelector('.confirm-yes').addEventListener('click', async () => {
        webuiConfirm.style.display = 'none';
        displayMessage(webuiStatus, "Restarting WebUI...", "loading");
        await restartPM2Process('webui');
    });

    webuiConfirm.querySelector('.confirm-no').addEventListener('click', () => {
        webuiConfirm.style.display = 'none';
        clearMessage(webuiStatus);
    });
});
  