# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform RPS from generic SaaS aesthetics to a distinctive, memorable financial planning interface using the "Sage & Amber" design system.

**Architecture:** Incremental CSS-first approach. Update design tokens first, then typography, then animations, then component refinements. Each change builds on the previous, allowing visual validation at each step.

**Tech Stack:** CSS3 (variables, animations, gradients), Google Fonts (Libre Baskerville + Source Sans 3), vanilla JS for animation triggers

---

## Phase 1: Color System Overhaul

### Task 1: Update Light Theme Colors

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css:1-50` (root variables)

**Step 1: Read current color variables**

Verify current state before modifying.

**Step 2: Replace light theme color variables**

Find the `:root` block and replace the color variables with:

```css
:root {
  /* === SAGE & AMBER DESIGN SYSTEM === */

  /* Backgrounds - Warm, not sterile */
  --bg-primary: #faf9f7;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f5f3f0;

  /* Text - Warm blacks and slates */
  --text-primary: #1a1a1a;
  --text-secondary: #475569;
  --text-muted: #78716c;

  /* Brand Colors - Sage & Amber */
  --accent-color: #2d6a4f;
  --accent-hover: #1e4d38;
  --accent-secondary: #d4a373;
  --accent-secondary-hover: #c4956a;

  /* Semantic Colors */
  --success-color: #2d6a4f;
  --warning-color: #b45309;
  --danger-color: #b91c1c;
  --info-color: #1e40af;

  /* Borders & Shadows */
  --border-color: #e7e5e0;
  --shadow-color: rgba(26, 26, 26, 0.08);

  /* Gradients */
  --gradient-primary-start: #2d6a4f;
  --gradient-primary-end: #40916c;
  --gradient-accent-start: #d4a373;
  --gradient-accent-end: #e9c46a;

  /* Card Gradients (used by existing code) */
  --card-gradient-1: #2d6a4f;
  --card-gradient-2: #40916c;
```

**Step 3: Verify visually**

Run: `./bin/start` and open http://localhost:5137
Expected: Light theme shows warm sage green accents instead of blue

**Step 4: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: update light theme to Sage & Amber palette

Replace generic blue (#3b82f6) with distinctive sage green (#2d6a4f)
and add warm amber secondary accent (#d4a373). Backgrounds now use
warm off-whites instead of cool grays.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update Dark Theme Colors

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css` (dark-mode section)

**Step 1: Find dark mode section**

Search for `body.dark-mode` in main.css.

**Step 2: Replace dark theme color variables**

```css
body.dark-mode {
  /* Backgrounds - Rich blacks */
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #262626;

  /* Text - Warm whites */
  --text-primary: #f5f3f0;
  --text-secondary: #a3a3a3;
  --text-muted: #737373;

  /* Brand Colors - Lighter for dark mode */
  --accent-color: #40916c;
  --accent-hover: #52b788;
  --accent-secondary: #e9c46a;
  --accent-secondary-hover: #f4d58d;

  /* Semantic Colors */
  --success-color: #52b788;
  --warning-color: #fbbf24;
  --danger-color: #f87171;
  --info-color: #60a5fa;

  /* Borders & Shadows */
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.4);

  /* Card Gradients */
  --card-gradient-1: #40916c;
  --card-gradient-2: #2d6a4f;
```

**Step 3: Verify dark mode visually**

Run app, toggle to dark mode via settings
Expected: Dark theme shows lighter sage greens with amber accents

**Step 4: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: update dark theme to Sage & Amber palette

Lighter sage greens (#40916c) for dark mode visibility,
bright amber (#e9c46a) accents, warm off-white text.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update High Contrast Theme

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css` (high-contrast section)

**Step 1: Find high contrast section**

Search for `body.high-contrast-mode` in main.css.

**Step 2: Replace high contrast variables**

```css
body.high-contrast-mode {
  --bg-primary: #000000;
  --bg-secondary: #0a0a0a;
  --bg-tertiary: #1a1a1a;
  --text-primary: #ffffff;
  --text-secondary: #e0e0e0;
  --text-muted: #b0b0b0;
  --accent-color: #4ade80;
  --accent-hover: #86efac;
  --accent-secondary: #fbbf24;
  --accent-secondary-hover: #fcd34d;
  --success-color: #4ade80;
  --warning-color: #fbbf24;
  --danger-color: #f87171;
  --info-color: #60a5fa;
  --border-color: #ffffff;
  --card-gradient-1: #4ade80;
  --card-gradient-2: #22c55e;
}
```

**Step 3: Verify high contrast mode**

Toggle to high contrast, verify WCAG AAA compliance
Expected: Bright green accents on pure black, high readability

**Step 4: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: update high contrast theme with bright greens

Maintain WCAG AAA compliance with bright sage green (#4ade80)
on pure black backgrounds.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Update Login Page Gradient

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/login.css`

**Step 1: Read current login.css**

Verify current gradient values.

**Step 2: Update login background gradient**

Find the body/container gradient and replace:

```css
body {
  background: linear-gradient(135deg, #2d6a4f 0%, #1a1a1a 100%);
  /* ... rest of body styles ... */
}
```

Also update any accent colors in the file from blue (#3b82f6) to sage (#2d6a4f).

**Step 3: Verify login page**

Navigate to /login.html
Expected: Deep sage-to-black gradient background

**Step 4: Commit**

```bash
git add src/static/css/login.css
git commit -m "$(cat <<'EOF'
style: update login page to sage gradient

Replace blue-purple gradient with sophisticated sage-to-black.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Typography Enhancement

### Task 5: Add Google Fonts

**Files:**
- Modify: `/home/paul/src/rps/src/static/index.html`
- Modify: `/home/paul/src/rps/src/templates/login.html` (if exists) or `/home/paul/src/rps/src/static/login.html`

**Step 1: Add font imports to index.html**

Add in the `<head>` section, before other stylesheets:

```html
<!-- Typography: Libre Baskerville (display) + Source Sans 3 (body) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
```

**Step 2: Add same fonts to login page**

Add the same `<link>` tags to the login page `<head>`.

**Step 3: Verify fonts load**

Open DevTools Network tab, verify fonts.googleapis.com requests succeed
Expected: Two font families loaded

**Step 4: Commit**

```bash
git add src/static/index.html src/static/login.html src/templates/login.html 2>/dev/null || true
git commit -m "$(cat <<'EOF'
style: add Libre Baskerville and Source Sans 3 fonts

Libre Baskerville for headings (editorial, trustworthy)
Source Sans 3 for body text (readable, professional)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update Font Stack in CSS

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Add font variables to :root**

Add these new variables in the `:root` section:

```css
  /* Typography */
  --font-display: 'Libre Baskerville', Georgia, 'Times New Roman', serif;
  --font-body: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', Consolas, monospace;
```

**Step 2: Update body font-family**

Find the `body` selector and update:

```css
body {
  font-family: var(--font-body);
  /* ... rest of body styles ... */
}
```

**Step 3: Update heading styles**

Find h1, h2, h3 selectors and add font-family:

```css
h1, h2, h3 {
  font-family: var(--font-display);
}
```

**Step 4: Verify typography**

Refresh app, inspect headings and body text
Expected: Serif headings (Libre Baskerville), sans-serif body (Source Sans 3)

**Step 5: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: apply new typography system

Headings use Libre Baskerville (editorial, trustworthy feel)
Body uses Source Sans 3 (readable, professional)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Refine Heading Typography

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Update heading styles with better hierarchy**

Find and update heading styles:

```css
h1 {
  font-family: var(--font-display);
  font-size: var(--font-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text-primary);
}

h2 {
  font-family: var(--font-display);
  font-size: var(--font-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: var(--text-primary);
}

h3 {
  font-family: var(--font-display);
  font-size: var(--font-lg);
  font-weight: 400;
  font-style: italic;
  line-height: 1.4;
  color: var(--text-secondary);
}
```

**Step 2: Verify heading hierarchy**

Check dashboard, analysis tabs for heading appearance
Expected: Clear visual hierarchy, h3 has elegant italic style

**Step 3: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: refine heading typography hierarchy

h1/h2 bold with tight letter-spacing, h3 italic for elegance.
Creates clear visual hierarchy with editorial feel.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Animation & Motion

### Task 8: Add Staggered Card Entrance Animation

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Add new keyframe animation**

Add after existing keyframes section:

```css
/* Staggered entrance animation */
@keyframes slideInFromBottom {
  0% {
    opacity: 0;
    transform: translateY(24px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Card entrance with stagger support */
.card-animate {
  animation: slideInFromBottom 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  opacity: 0;
}

.card-animate:nth-child(1) { animation-delay: 0ms; }
.card-animate:nth-child(2) { animation-delay: 50ms; }
.card-animate:nth-child(3) { animation-delay: 100ms; }
.card-animate:nth-child(4) { animation-delay: 150ms; }
.card-animate:nth-child(5) { animation-delay: 200ms; }
.card-animate:nth-child(6) { animation-delay: 250ms; }
.card-animate:nth-child(7) { animation-delay: 300ms; }
.card-animate:nth-child(8) { animation-delay: 350ms; }
```

**Step 2: Verify animation class works**

Manually add `card-animate` class to a card in DevTools
Expected: Card animates in with slight delay based on position

**Step 3: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: add staggered card entrance animation

Cards animate in with 50ms stagger delay, creating orchestrated
page load effect. Uses smooth cubic-bezier easing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Add Animation Trigger JavaScript

**Files:**
- Create: `/home/paul/src/rps/src/static/js/utils/animations.js`

**Step 1: Create animations utility module**

```javascript
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
```

**Step 2: Verify file created**

Run: `ls -la src/static/js/utils/animations.js`
Expected: File exists with correct content

**Step 3: Commit**

```bash
git add src/static/js/utils/animations.js
git commit -m "$(cat <<'EOF'
feat: add animation utilities module

- animateChildren(): staggered entrance for card grids
- observeForAnimation(): scroll-triggered reveals
- initTabAnimations(): re-trigger on tab switch

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Add Enhanced Hover Effects

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Add enhanced button hover effects**

Find button styles and enhance:

```css
/* Enhanced button interactions */
button, .btn {
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

button:hover:not(:disabled), .btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

button:active:not(:disabled), .btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px var(--shadow-color);
}

/* Card hover lift effect */
.metric-card:hover,
.action-item:hover,
.profile-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px var(--shadow-color);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
```

**Step 2: Verify hover effects**

Hover over buttons and cards in the app
Expected: Smooth lift effect with shadow increase

**Step 3: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: add enhanced hover effects with lift and shadow

Buttons and cards now lift on hover with smooth cubic-bezier
easing and deepening shadows for depth.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Visual Refinements

### Task 11: Add Subtle Background Texture

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Add noise texture to body**

Update body styles:

```css
body {
  font-family: var(--font-body);
  background-color: var(--bg-primary);
  /* Subtle noise texture for depth */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-blend-mode: overlay;
  background-size: 256px 256px;
  /* ... rest of body styles ... */
}

/* Remove texture in dark mode for cleaner look */
body.dark-mode {
  background-image: none;
}
```

**Step 2: Verify texture appears**

Refresh app in light mode
Expected: Very subtle grain texture visible on background

**Step 3: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: add subtle noise texture to light mode background

SVG-based noise texture adds depth and warmth without
performance impact. Disabled in dark mode for cleaner aesthetic.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Enhance Modal Styling

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Update modal overlay and content styles**

Find modal styles and enhance:

```css
.modal-overlay {
  background: rgba(26, 26, 26, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow:
    0 24px 48px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px var(--border-color);
  animation: modalSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes modalSlideIn {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

**Step 2: Verify modal styling**

Open any modal in the app
Expected: Frosted glass backdrop, smooth slide-in animation

**Step 3: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: enhance modal with frosted glass and smooth animation

8px backdrop blur for depth, improved shadow system,
scale + translate animation for polished entrance.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Add Secondary Accent Usage

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/main.css`

**Step 1: Add secondary accent button style**

```css
/* Secondary accent button (amber) */
.btn-accent-secondary {
  background: var(--accent-secondary);
  color: #1a1a1a;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-accent-secondary:hover {
  background: var(--accent-secondary-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(212, 163, 115, 0.3);
}

/* Amber highlight for important notices */
.highlight-amber {
  background: linear-gradient(135deg, var(--accent-secondary) 0%, var(--gradient-accent-end) 100%);
  color: #1a1a1a;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
}

/* Action item priority indicator */
.action-item.priority-high {
  border-left-color: var(--accent-secondary);
}
```

**Step 2: Verify secondary accent**

Inspect in DevTools by adding classes
Expected: Warm amber provides visual variety from sage green

**Step 3: Commit**

```bash
git add src/static/css/main.css
git commit -m "$(cat <<'EOF'
style: add secondary amber accent for visual variety

Amber buttons, highlight boxes, and priority indicators
complement sage green for richer visual hierarchy.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Component Integration

### Task 14: Update Dashboard Cards to Use Animations

**Files:**
- Modify: `/home/paul/src/rps/src/static/js/components/dashboard-tab.js` (or equivalent)

**Step 1: Read current dashboard component**

Find the dashboard component and understand card rendering.

**Step 2: Import animation utilities**

At top of file:
```javascript
import { animateChildren } from '../utils/animations.js';
```

**Step 3: Call animateChildren after render**

After cards are rendered to DOM, add:
```javascript
// Animate metric cards on load
animateChildren('.metrics-grid', '.metric-card');
```

**Step 4: Verify dashboard animations**

Refresh app on dashboard tab
Expected: Metric cards animate in with stagger effect

**Step 5: Commit**

```bash
git add src/static/js/components/dashboard-tab.js
git commit -m "$(cat <<'EOF'
feat: integrate staggered animations on dashboard

Metric cards now animate in with 50ms stagger for
orchestrated page load experience.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Update Chart Colors

**Files:**
- Modify: `/home/paul/src/rps/src/static/js/components/analysis-tab.js` (or chart configuration file)

**Step 1: Find chart color configuration**

Search for Chart.js color definitions.

**Step 2: Update chart colors to match new palette**

Replace hardcoded colors with palette-aware values:

```javascript
// Sage & Amber chart palette
const chartColors = {
  primary: getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#2d6a4f',
  secondary: getComputedStyle(document.documentElement).getPropertyValue('--accent-secondary').trim() || '#d4a373',
  success: getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim() || '#2d6a4f',
  warning: getComputedStyle(document.documentElement).getPropertyValue('--warning-color').trim() || '#b45309',
  danger: getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim() || '#b91c1c',
};
```

**Step 3: Verify chart colors**

Run analysis, check chart colors match new palette
Expected: Charts use sage green and amber instead of blue

**Step 4: Commit**

```bash
git add src/static/js/components/analysis-tab.js
git commit -m "$(cat <<'EOF'
style: update chart colors to Sage & Amber palette

Charts now pull colors from CSS variables for theme consistency.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Final Polish

### Task 16: Update Feedback Tracking Styles

**Files:**
- Modify: `/home/paul/src/rps/src/static/css/feedback-tracking.css`

**Step 1: Read current feedback styles**

Review the file for hardcoded colors.

**Step 2: Update colors to CSS variables**

Replace any hardcoded blues (#3b82f6) with `var(--accent-color)`.
Ensure styles inherit from main.css variables.

**Step 3: Verify feedback modal**

Open feedback modal
Expected: Sage green accents throughout

**Step 4: Commit**

```bash
git add src/static/css/feedback-tracking.css
git commit -m "$(cat <<'EOF'
style: update feedback styles to use CSS variables

Removes hardcoded colors for theme consistency.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Version Bump and Final Verification

**Files:**
- Modify: `/home/paul/src/rps/src/__version__.py`
- Modify: `/home/paul/src/rps/src/static/index.html`

**Step 1: Check current version**

```bash
cat src/__version__.py
```

**Step 2: Bump version using script**

```bash
./bin/bump-version 3.10.13 "Frontend redesign: Sage & Amber design system with enhanced typography and animations"
```

**Step 3: Full visual verification**

Test all three themes:
1. Light mode - warm sage and amber
2. Dark mode - adjusted greens
3. High contrast - bright greens

Test animations:
1. Dashboard card entrance
2. Modal open/close
3. Button hovers

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: bump version to 3.9.152

Frontend redesign complete:
- Sage & Amber color palette
- Libre Baskerville + Source Sans 3 typography
- Staggered card entrance animations
- Enhanced hover effects and modal styling
- Subtle background texture

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-4 | Color system (light, dark, high-contrast, login) |
| 2 | 5-7 | Typography (fonts, hierarchy) |
| 3 | 8-10 | Animation & motion (stagger, scroll, hover) |
| 4 | 11-13 | Visual refinements (texture, modals, amber accent) |
| 5 | 14-15 | Component integration (dashboard, charts) |
| 6 | 16-17 | Final polish and version bump |

**Total Tasks:** 17
**Estimated Commits:** 17

---

## Post-Implementation

After completing all tasks:

1. **Visual QA**: Test all tabs in all three themes
2. **Performance**: Verify font loading doesn't block render
3. **Accessibility**: Re-test with screen reader and keyboard nav
4. **Cross-browser**: Check Safari, Firefox, Chrome
5. **Mobile**: Verify animations work on touch devices
