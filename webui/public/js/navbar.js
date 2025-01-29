// /public/js/navbar.js
document.addEventListener('DOMContentLoaded', async () => {
    // Load the navbar HTML
    const response = await fetch('/components/navbar.html');
    const navbarHtml = await response.text();
    document.getElementById('navbar-placeholder').innerHTML = navbarHtml;

    // Fetch and set the canvas name
    try {
        const envResponse = await fetch('/check-env');
        const envVars = await envResponse.json();
        const canvasName = envVars.CANVAS_NAME;
        
        const navbarTitle = document.getElementById("navbar-title");
        if (navbarTitle) {
            navbarTitle.textContent = `Currently Connected to ${canvasName}`;
        }
    } catch (err) {
        console.error("Error fetching canvas name:", err);
    }

    // Set active nav link based on current page
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
});
  