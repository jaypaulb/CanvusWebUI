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
  
    // Initialize common components
    MessageSystem.initialize();
    AdminModal.initialize();
  
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    console.log("URL Parameters:", window.location.search);
    console.log("Extracted UID:", uid);

    // Update button text to initial state
    setTargetButton.innerHTML = `
        <span class="button-content">
            <span class="loading-spinner" style="display: none;"></span>
            <span class="button-text">Searching for current canvas to control...</span>
        </span>
    `;
  
    if (uid) {
      console.log("Starting canvas search for UID:", uid);
      // Show searching state
      setTargetButton.querySelector('.loading-spinner').style.display = 'inline-block';
      
      // Set up message display
      confirmationSpan.textContent = '';
      confirmationSpan.className = "message success";
      confirmationSpan.style.display = "inline";
      
      // Connect to SSE endpoint
      const eventSource = new EventSource(`/find-canvas-progress`);
      
      eventSource.onmessage = function(event) {
        confirmationSpan.textContent = event.data;
      };
      
      eventSource.onerror = function() {
        eventSource.close();
      };

      // Make the search request
      fetch("/find-canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid })
      })
        .then(response => response.json())
        .then(data => {
          eventSource.close();
          
          if (data.canvas_name && data.canvas_id) {
            checkEnvAndUpdateButton(data.canvas_name, data.canvas_id);
          } else {
            setTargetButton.querySelector('.loading-spinner').style.display = 'none';
            setTargetButton.querySelector('.button-text').textContent = 'No Canvas Found';
            displayError(data.error || "Canvas not found.");
          }
        })
        .catch(error => {
          eventSource.close();
          console.error("Error during canvas search:", error);
          setTargetButton.querySelector('.loading-spinner').style.display = 'none';
          setTargetButton.querySelector('.button-text').textContent = 'Error Finding Canvas';
          displayError("An error occurred while fetching canvas data.");
        });
    } else {
      console.log("No UID found in URL parameters");
      setTargetButton.querySelector('.loading-spinner').style.display = 'none';
      setTargetButton.querySelector('.button-text').textContent = 'No Canvas UID Provided';
      displayError("UID not found in the URL.");
    }
  
    // Function to check .env and update the button
    function checkEnvAndUpdateButton(canvas_name, canvas_id) {
      fetch(`/check-env?canvas_name=${encodeURIComponent(canvas_name)}&canvas_id=${encodeURIComponent(canvas_id)}`)
        .then(response => response.json())
        .then(data => {
          setTargetButton.querySelector('.loading-spinner').style.display = 'none';
          
          if (data.matches) {
            // Redirect to pages.html if .env matches
            window.location.href = "/pages.html";
          } else {
            // Update the button with canvas details
            setTargetButton.querySelector('.button-text').textContent = `Click here to update target to ${canvas_name}`;
            setTargetButton.dataset.canvas_id = canvas_id;
            setTargetButton.dataset.canvas_name = canvas_name;
            setTargetButton.disabled = false; // Enable the button
            
            // Display warning message
            displayError("DANGER: You are not currently controlling the canvas you opened WebUI from. Please update or proceed with caution.");
          }
        })
        .catch(error => {
          console.error("Error:", error);
          setTargetButton.querySelector('.loading-spinner').style.display = 'none';
          setTargetButton.querySelector('.button-text').textContent = 'Error Checking Environment';
          displayError("An error occurred while checking environment variables.");
        });
    }
  
    // Function to handle button click with modal password prompt
    setTargetButton.addEventListener("click", async () => {
        const canvas_id = setTargetButton.dataset.canvas_id;
        const canvas_name = setTargetButton.dataset.canvas_name;
        
        if (!canvas_id || !canvas_name) {
            displayError("Missing canvas information. Please try refreshing the page.");
            return;
        }

        try {
            // Show admin modal and wait for authentication
            const password = await AdminModal.show();
            if (!password) {
                displayError("Authentication cancelled");
                return;
            }
            
            // Show loading state
            setTargetButton.querySelector('.loading-spinner').style.display = 'inline-block';
            setTargetButton.querySelector('.button-text').textContent = 'Updating...';
            setTargetButton.disabled = true;
            
            // Make the update request
            const response = await fetch("/admin/update-env", {
                method: "POST",
                headers: { 
                    'Authorization': `Bearer ${password}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    CANVAS_ID: canvas_id, 
                    CANVAS_NAME: canvas_name 
                })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update environment');
            }
            
            if (data.success) {
                displayConfirmation("Environment updated successfully! Redirecting...");
                // Redirect to pages.html after a short delay
                setTimeout(() => {
                    window.location.href = "/pages.html";
                }, 1500);
            } else {
                throw new Error(data.error || "Failed to update environment.");
            }
        } catch (error) {
            console.error("Error:", error);
            displayError(error.message || "An error occurred while updating the environment.");
            // Reset button state
            setTargetButton.querySelector('.loading-spinner').style.display = 'none';
            setTargetButton.querySelector('.button-text').textContent = `Click here to update target to ${canvas_name}`;
            setTargetButton.disabled = false;
        }
    });
  
    // Close modal when clicking outside of it
    window.addEventListener("click", (event) => {
      if (event.target == passwordModal) {
        passwordModal.style.display = "none";
      }
    });
  
    function updateSearchStatus(status) {
      const searchMsg = document.createElement('div');
      searchMsg.textContent = status;
      
      const updatesContainer = confirmationSpan.querySelector('.search-updates');
      if (updatesContainer) {
        updatesContainer.appendChild(searchMsg);
        updatesContainer.scrollTop = updatesContainer.scrollHeight;
      }
    }
  
    // Function to display confirmation messages
    function displayConfirmation(message) {
      confirmationSpan.textContent = message;
      confirmationSpan.className = "message success";
      confirmationSpan.style.display = "inline";
      errorSpan.textContent = "";
      errorSpan.className = "message";
      errorSpan.style.display = "none";
    }
  
    // Function to display error messages
    function displayError(message) {
      errorSpan.textContent = message;
      errorSpan.className = "message error";
      errorSpan.style.display = "inline";
      // Only clear confirmation if not during search
      if (!message.includes("Searching") && !confirmationSpan.querySelector('.search-updates')) {
        confirmationSpan.textContent = "";
        confirmationSpan.className = "message";
        confirmationSpan.style.display = "none";
      }
    }
  });
  