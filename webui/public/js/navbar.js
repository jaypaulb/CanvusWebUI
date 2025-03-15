// /public/js/navbar.js

// Navbar functionality
document.addEventListener('DOMContentLoaded', function() {
    const navbar = `
        <nav class="navbar">
            <div class="nav-left">
                <a href="/" class="nav-brand">Canvus Web UI</a>
                <div id="canvasInfo" class="canvas-info">Currently Connected to: Loading...</div>
            </div>
            <div class="nav-right">
                <button class="theme-toggle">
                    <span>🌙</span>
                    <span style="margin-left: 0.5rem">Dark Mode</span>
                </button>
                <button class="hamburger" aria-label="Toggle menu" aria-expanded="false">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
                <div class="nav-menu">
                    <a href="/main.html" class="nav-link">Main</a>
                    <a href="/macros.html" class="nav-link">Macros</a>
                    <a href="/pages.html" class="nav-link">Pages</a>
                    <a href="/upload.html" class="nav-link">Upload</a>
                    <a href="/admin.html" class="nav-link">Admin</a>
                </div>
            </div>
        </nav>
    `;

    // Insert navbar
    document.getElementById('navbar-placeholder').innerHTML = navbar;

    // Set active link
    const currentPage = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage || 
            (currentPage === '/' && link.getAttribute('href') === '/main.html')) {
            link.classList.add('active');
        }
    });

    // Theme toggle functionality
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        // Set initial theme (dark by default)
        if (!localStorage.getItem('theme')) {
            localStorage.setItem('theme', 'dark');
        }
        
        // Apply theme from localStorage
        const currentTheme = localStorage.getItem('theme');
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeToggle(themeToggle, currentTheme);

        // Toggle theme
        themeToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeToggle(themeToggle, newTheme);
        });
    }

    // Update canvas info
    fetch('/get-canvas-info')
        .then(response => response.json())
        .then(data => {
            if (data.canvasName) {
                document.getElementById('canvasInfo').textContent = `Currently Connected to: ${data.canvasName}`;
            }
        })
        .catch(error => console.error('Error fetching canvas info:', error));

    // Mobile menu functionality
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            const isExpanded = hamburger.classList.contains('active');
            hamburger.setAttribute('aria-expanded', isExpanded);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                hamburger.setAttribute('aria-expanded', false);
            }
        });

        // Close menu when pressing Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });

        // Handle touch events for better mobile experience
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);

        function handleSwipe() {
            const swipeThreshold = 50;
            const swipeDistance = touchEndX - touchStartX;

            if (Math.abs(swipeDistance) < swipeThreshold) return;

            if (swipeDistance > 0 && !navMenu.classList.contains('active')) {
                // Swipe right, open menu
                hamburger.classList.add('active');
                navMenu.classList.add('active');
                hamburger.setAttribute('aria-expanded', 'true');
            } else if (swipeDistance < 0 && navMenu.classList.contains('active')) {
                // Swipe left, close menu
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        }
    }
});

// Helper function to update theme toggle button
function updateThemeToggle(button, theme) {
    button.innerHTML = `
        <span>${theme === 'dark' ? '☀️' : '🌙'}</span>
        <span style="margin-left: 0.5rem">${theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
    `;
}
  