// /public/js/main-page.js

document.addEventListener("DOMContentLoaded", () => {
    const setTargetButton = document.getElementById("setTargetButton");
    const confirmationSpan = document.getElementById("confirmation");
    const errorSpan = document.getElementById("error");
  
    const passwordModal = document.getElementById("passwordModal");
    const closeModal = document.getElementById("closeModal");
    const submitPassword = document.getElementById("submitPassword");
    const adminPasswordInput = document.getElementById("adminPassword");
    const modalError = document.getElementById("modalError");
  
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
  
    // Check for pending UID from index page
    const pendingUID = sessionStorage.getItem('pendingUID');
    if (pendingUID) {
        sessionStorage.removeItem('pendingUID'); // Clear it
        // Wait a bit then update URL to include UID
        setTimeout(() => {
            window.history.replaceState({}, '', `main.html?uid=${pendingUID}`);
            // Now trigger the normal UID handling
            const params = new URLSearchParams(window.location.search);
            const uid = params.get("uid");
            // ... rest of your existing code ...
        }, 500); // Wait 0.5 seconds before adding UID
    }
  
    if (uid) {
      // Step 1: Fetch canvas details based on UID
      fetch("/find-canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid })
      })
        .then(response => response.json())
        .then(data => {
          if (data.canvasName && data.canvasId) {
            checkEnvAndUpdateButton(data.canvasName, data.canvasId);
          } else {
            displayError(data.error || "Canvas not found.");
          }
        })
        .catch(error => {
          console.error("Error:", error);
          displayError("An error occurred while fetching canvas data.");
        });
    } else {
      displayError("UID not found in the URL.");
    }
  
    // Function to check .env and update the button
    function checkEnvAndUpdateButton(canvasName, canvasId) {
      fetch(`/check-env?canvasName=${encodeURIComponent(canvasName)}&canvasId=${encodeURIComponent(canvasId)}`)
        .then(response => response.json())
        .then(data => {
          if (data.matches) {
            window.location.href = "/pages.html";
          } else {
            setTargetButton.textContent = `Set Target for AI Control to ${canvasName}`;
            setTargetButton.dataset.canvasId = canvasId;
            setTargetButton.dataset.canvasName = canvasName;
            setTargetButton.disabled = false;
            displayError(`Currently controlling ${data.CANVAS_NAME}. Update the target with the above button.`);
          }
        })
        .catch(error => {
          console.error("Error:", error);
          displayError("An error occurred while fetching canvas data.");
        });
    }
  
    // Function to handle button click with modal password prompt
    setTargetButton.addEventListener("click", () => {
      // Open the password modal
      passwordModal.style.display = "block";
      modalError.style.display = "none";
      adminPasswordInput.value = "";
      adminPasswordInput.focus(); // Focus the input when modal opens
    });
  
    // Handle modal close
    closeModal.addEventListener("click", () => {
      passwordModal.style.display = "none";
    });

    // Function to handle password submission
    async function handlePasswordSubmission() {
        const password = adminPasswordInput.value;
        const canvasName = setTargetButton.dataset.canvasName;
        const canvasId = setTargetButton.dataset.canvasId;
        
        try {
            const response = await fetch('/update-env', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password,
                    CANVAS_NAME: canvasName,
                    CANVAS_ID: canvasId
                })
            });

            // If response is ok, proceed with success flow regardless of JSON parsing
            if (response.ok) {
                passwordModal.style.display = 'none';
                displayConfirmation("Environment updated successfully! Redirecting...");
                
                setTimeout(() => {
                    window.location.href = "/pages.html";
                }, 1500);
                return;
            }

            // Only try to parse error responses
            const data = await response.text();
            let errorMessage = 'Failed to update environment';
            try {
                const jsonData = JSON.parse(data);
                errorMessage = jsonData.error || errorMessage;
            } catch (e) {
                // If can't parse JSON, use text response if available
                errorMessage = data || errorMessage;
            }
            throw new Error(errorMessage);
            
        } catch (error) {
            modalError.textContent = error.message;
            modalError.style.display = 'block';
        }
    }
  
    // Handle enter key in password input
    adminPasswordInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handlePasswordSubmission();
        }
    });
  
    // Handle password submission button click
    submitPassword.addEventListener("click", handlePasswordSubmission);
  
    // Close modal when clicking outside of it
    window.addEventListener("click", (event) => {
      if (event.target == passwordModal) {
        passwordModal.style.display = "none";
      }
    });
  
    // Function to display confirmation messages
    function displayConfirmation(message) {
      confirmationSpan.textContent = message;
      confirmationSpan.className = "message success";
      confirmationSpan.style.display = "inline";
      // Clear any existing error messages
      errorSpan.textContent = "";
      errorSpan.className = "message";
      errorSpan.style.display = "none";
    }
  
    // Function to display error messages
    function displayError(message) {
      errorSpan.textContent = message;
      errorSpan.className = "message error";
      errorSpan.style.display = "inline";
      // Clear any existing confirmation messages
      confirmationSpan.textContent = "";
      confirmationSpan.className = "message";
      confirmationSpan.style.display = "none";
    }
  });
  