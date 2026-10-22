/* Theme: applied synchronously in <head> to avoid a flash, then wires toggle buttons. */
(function () {
  'use strict';
  var KEY = 'rw.theme';
  var LIGHT = 'routewise';
  var DARK = 'routewise-dark';
  function stored() {
    try { var v = localStorage.getItem(KEY); return v === LIGHT || v === DARK ? v : null; } catch (e) { return null; }
  }
  function preferred() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(theme === DARK));
      b.setAttribute('aria-label', theme === DARK ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }
  apply(stored() || preferred());

  function toggle() {
    var next = document.documentElement.getAttribute('data-theme') === DARK ? LIGHT : DARK;
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage unavailable */ }
    apply(next);
    document.dispatchEvent(new CustomEvent('rw:theme', { detail: { theme: next } }));
  }
  document.addEventListener('DOMContentLoaded', function () {
    apply(document.documentElement.getAttribute('data-theme'));
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) { b.addEventListener('click', toggle); });
  });
  window.RW = window.RW || {};
  window.RW.theme = { isDark: function () { return document.documentElement.getAttribute('data-theme') === DARK; }, toggle: toggle };
})();
