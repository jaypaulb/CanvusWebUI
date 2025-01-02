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
  });
  