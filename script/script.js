function toggleMenu() {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) {
    return;
  }
  navLinks.classList.toggle('active');
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelector('.nav-links');
  const navItems = document.querySelectorAll('.nav-links a');
  const yearElement = document.getElementById('current-year');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
      }
    });
  });

  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }
});
