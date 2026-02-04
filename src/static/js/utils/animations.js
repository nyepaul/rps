/**
 * Animation utilities for RPS frontend
 * Handles staggered entrances and scroll-triggered reveals
 */

/**
 * Apply staggered entrance animation to child elements
 * @param {string} containerSelector - CSS selector for parent container
 * @param {string} childSelector - CSS selector for children to animate
 */
export function animateChildren(containerSelector, childSelector = ':scope > *') {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const children = container.querySelectorAll(childSelector);
  children.forEach((child, index) => {
    child.style.animationDelay = `${index * 50}ms`;
    child.classList.add('card-animate');
  });
}

/**
 * Intersection Observer for scroll-triggered animations
 * @param {string} selector - CSS selector for elements to observe
 * @param {string} animationClass - Class to add when visible
 */
export function observeForAnimation(selector, animationClass = 'card-animate') {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add(animationClass);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll(selector).forEach(el => {
    observer.observe(el);
  });
}

/**
 * Initialize animations for a tab when it becomes active
 * @param {string} tabId - ID of the tab content container
 */
export function initTabAnimations(tabId) {
  const tab = document.getElementById(tabId);
  if (!tab) return;

  // Reset and re-trigger animations
  const animatedElements = tab.querySelectorAll('.card-animate');
  animatedElements.forEach(el => {
    el.style.animation = 'none';
    el.offsetHeight; // Trigger reflow
    el.style.animation = null;
  });
}
