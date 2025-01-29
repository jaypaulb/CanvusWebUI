// /public/js/index.js

document.addEventListener("DOMContentLoaded", () => {
    // Check if we're already on main.html
    if (window.location.pathname.includes('main.html')) {
        return;
    }
    
    // Generate a unique ID
    const uniqueID = Date.now() + Math.random().toString(36).substring(2, 15);
    
    // Configure loading time
    const LOADING_TIME_SECONDS = 1; // Easily adjustable loading time
    
    // Update progress bar and counter
    let progress = 0;
    const interval = 50;
    const steps = (LOADING_TIME_SECONDS * 1000) / interval;
    const increment = 100 / steps;
    
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const timeLeft = document.getElementById('time-left');
    const loadingContainer = document.querySelector('.loading-container');
    
    const updateProgress = setInterval(() => {
        progress += increment;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
        progressText.textContent = `${Math.min(Math.round(progress), 100)}%`;
        
        const secondsRemaining = Math.max(0, Math.ceil((LOADING_TIME_SECONDS * 1000 - (progress/100) * LOADING_TIME_SECONDS * 1000) / 1000));
        timeLeft.textContent = `${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''} remaining`;
        
        if (progress >= 100) {
            clearInterval(updateProgress);
            
            // Replace loading content with the establish link button
            loadingContainer.innerHTML = `
                <div class="establish-link">
                    <button id="establishLink" class="establish-button">
                        Click to Establish Canvus Link
                    </button>
                </div>
            `;

            // Add click handler for the establish link button
            document.getElementById('establishLink').addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = `main.html?uid=${uniqueID}`;
                link.setAttribute('data-navigation', 'true');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }, interval);
});
  