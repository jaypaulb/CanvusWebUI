// /public/js/index.js

document.addEventListener("DOMContentLoaded", () => {
    // Generate a unique ID
    const uniqueID = Date.now() + Math.random().toString(36).substring(2, 15);
  
    // Redirect to main.html with the unique ID in the URL
    window.location.href = `main.html?uid=${uniqueID}`;
  });
  