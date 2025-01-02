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
            // Redirect to pages.html if .env matches
            window.location.href = "/pages.html";
          } else {
            // Update the button with canvas details
            setTargetButton.textContent = `Set Target for AI Control to ${canvasName}`;
            setTargetButton.dataset.canvasId = canvasId;
            setTargetButton.dataset.canvasName = canvasName;
            setTargetButton.disabled = false; // Enable the button
          }
        })
        .catch(error => {
          console.error("Error:", error);
          displayError("An error occurred while checking environment variables.");
        });
    }
  
    // Function to handle button click with modal password prompt
    setTargetButton.addEventListener("click", () => {
      // Open the password modal
      passwordModal.style.display = "block";
      modalError.style.display = "none";
      adminPasswordInput.value = "";
    });
  
    // Handle modal close
    closeModal.addEventListener("click", () => {
      passwordModal.style.display = "none";
    });
  
    // Handle password submission
    submitPassword.addEventListener("click", () => {
      const password = adminPasswordInput.value.trim();
      if (!password) {
        modalError.textContent = "Password is required.";
        modalError.style.display = "block";
        return;
      }
  
      const canvasId = setTargetButton.dataset.canvasId;
      const canvasName = setTargetButton.dataset.canvasName;
  
      fetch("/update-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          password, 
          canvasId, 
          canvasName 
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            displayConfirmation("Environment updated successfully! Redirecting...");
            passwordModal.style.display = "none";
            // Redirect to pages.html after a short delay
            setTimeout(() => {
              window.location.href = data.redirect || "/pages.html";
            }, 1500);
          } else {
            const errorMessage = data.error || (data.errors && data.errors.map(e => e.msg).join(", ")) || "Failed to update environment.";
            modalError.textContent = errorMessage;
            modalError.style.display = "block";
          }
        })
        .catch(error => {
          console.error("Error:", error);
          modalError.textContent = "An error occurred while updating the environment.";
          modalError.style.display = "block";
        });
    });
  
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
  