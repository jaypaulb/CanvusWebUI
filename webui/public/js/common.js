// /public/js/main.js

// Utility: Display a message
function displayMessage(element, text, type) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = "block";
  }
  
  // Utility: Clear messages
  function clearMessage(element) {
    element.textContent = "";
    element.className = "message";
    element.style.display = "none";
  }
  
  // Utility: Enable or disable all buttons within a container
  function toggleButtons(container, disabled) {
    const buttons = container.querySelectorAll("button");
    buttons.forEach(btn => (btn.disabled = disabled));
  }
  