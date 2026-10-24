/* Owner branding (Mavix Tech): single source of copy, link and logo paths.
   Fills [data-owner] text nodes, [data-owner-link] anchors and [data-owner-logo] / [data-owner-mark]
   images with textContent / setAttribute only, and swaps the light/dark logo variant with the theme. */
(function () {
  'use strict';
  var RW = (window.RW = window.RW || {});

  var OWNER = Object.freeze({
    name: 'Mavix Tech',
    tagline: 'Systems · Automation · Graduation Projects',
    description: 'Custom business systems, workflow automation and complete graduation projects. ASP.NET, Angular, SQL Server.',
    cta: 'Have an idea? Let’s build it.',
    url: 'https://mavixtechma-ship-it.github.io/Mavix/',
    logo: 'assets/mavix/mavix-logo.svg',
    logoDark: 'assets/mavix/mavix-logo-white.svg',
    mark: 'assets/mavix/mavix-mark.svg',
    markDark: 'assets/mavix/mavix-mark-white.svg',
  });

  function isDark() {
    return !!(RW.theme && RW.theme.isDark && RW.theme.isDark());
  }

  /* data-owner-logo="auto" follows the theme; "light" / "dark" force a variant (e.g. on the dark sidebar). */
  function variant(el, light, dark) {
    var mode = el.getAttribute('data-owner-logo') || el.getAttribute('data-owner-mark') || 'auto';
    if (mode === 'dark') return dark;
    if (mode === 'light') return light;
    return isDark() ? dark : light;
  }

  function apply(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-owner]').forEach(function (el) {
      var key = el.getAttribute('data-owner');
      if (Object.prototype.hasOwnProperty.call(OWNER, key)) el.textContent = OWNER[key];
    });
    scope.querySelectorAll('a[data-owner-link]').forEach(function (a) {
      a.setAttribute('href', OWNER.url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    scope.querySelectorAll('img[data-owner-logo]').forEach(function (img) {
      img.setAttribute('src', variant(img, OWNER.logo, OWNER.logoDark));
    });
    scope.querySelectorAll('img[data-owner-mark]').forEach(function (img) {
      img.setAttribute('src', variant(img, OWNER.mark, OWNER.markDark));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); });
  else apply();
  document.addEventListener('rw:theme', function () { apply(); });

  RW.OWNER = OWNER;
  RW.owner = { OWNER: OWNER, apply: apply, isDark: isDark };
})();
