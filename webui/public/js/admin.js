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
    const successNotification = document.getElementById('successNotification');
  
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
  
    // Function to show success notification
    function showSuccessNotification() {
        successNotification.classList.add('show');
        setTimeout(() => {
            successNotification.classList.remove('show');
        }, 3000);
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
  
        if (data.success) {
          displayMessage(passwordMessage, "Authentication successful.", "success");
          // Hide the password section and show the environment form
          document.getElementById('password-section').style.display = 'none';
          envFormContainer.style.display = 'block';
          // Set the hidden password field
          envForm.querySelector('input[name="password"]').value = enteredPassword;
          // Fetch and populate environment variables
          await fetchAndPopulateEnvVariables();
        } else {
          displayMessage(passwordMessage, "Invalid password.", "error");
        }
  
      } catch (error) {
        console.error('Error:', error);
        displayMessage(passwordMessage, "An error occurred. Please try again.", "error");
      }
    });
  
    // Function to fetch and populate Environment Variables
    async function fetchAndPopulateEnvVariables() {
      clearMessage(envMessage);
      displayMessage(envMessage, "Loading environment variables...", "loading");
  
      try {
        const response = await fetch('/env-variables');
        const data = await response.json();
        const envVariablesDiv = document.getElementById('env-variables');
        envVariablesDiv.innerHTML = ''; // Clear existing content
  
        // Create form fields for each environment variable
        for (const [key, value] of Object.entries(data)) {
          const formGroup = document.createElement('div');
          formGroup.className = 'form-group';
  
          const label = document.createElement('label');
          label.textContent = key;
          label.htmlFor = `env-${key}`;
  
          const input = document.createElement('input');
          input.type = 'text';
          input.id = `env-${key}`;
          input.name = key;
          input.value = value;
  
          formGroup.appendChild(label);
          formGroup.appendChild(input);
          envVariablesDiv.appendChild(formGroup);
        }
  
        clearMessage(envMessage); // Clear the loading message
      } catch (error) {
        console.error('Error:', error);
        displayMessage(envMessage, "Failed to load environment variables.", "error");
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
      const updatedVars = {};
  
      // Convert FormData to object, excluding the password
      for (const [key, value] of formData.entries()) {
        if (key !== 'password') {
          updatedVars[key] = value;
        }
      }
  
      try {
        const response = await fetch('/update-env', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: formData.get('password'),
            ...updatedVars
          }),
        });
  
        const data = await response.json();
  
        if (data.success) {
          showSuccessNotification();
          displayMessage(envMessage, "Environment variables updated successfully.", "success");
        } else {
          displayMessage(envMessage, data.error || "Failed to update environment variables.", "error");
        }
  
      } catch (error) {
        console.error('Error:', error);
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
  