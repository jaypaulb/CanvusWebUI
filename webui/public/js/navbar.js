// /public/js/navbar.js

// Function to load the navbar
async function loadNavbar() {
    try {
      const response = await fetch('/components/navbar.html');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const navbarHTML = await response.text();
      document.getElementById('navbar-placeholder').innerHTML = navbarHTML;
  
      // Set the active link based on the current page
      setActiveNavLink();
    } catch (error) {
      console.error('Error loading navbar:', error);
    }
  }
  
  // Function to set the active navigation link
  function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-link');
  
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPage) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
  
  // Load the navbar when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', loadNavbar);
  