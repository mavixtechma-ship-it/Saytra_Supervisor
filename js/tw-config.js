/* Tailwind Play CDN configuration — colours map to the DaisyUI theme variables in css/app.css. */
'use strict';
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: ['selector', '[data-theme="routewise-dark"]'],
  corePlugins: { preflight: true },
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'Segoe UI', 'system-ui', 'sans-serif'] },
    },
  },
};
