/* Pinned CDN assets (exact versions + SRI) and Chart.js helpers themed from CSS tokens. */
(function () {
  'use strict';
  var RW = window.RW;
  var ui = RW.ui;
  RW.views = RW.views || {};

  RW.CDN = Object.freeze({
    chart: { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.js', sri: 'sha384-zYPBGXwO4633CABX/5Spf6emCKUJCfoOkhOMYyxMsatqQZPnDblmmOewfjsIVWCM' },
    leafletJs: { url: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', sri: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH' },
    leafletCss: { url: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', sri: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H' },
    mermaid: { url: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js', sri: 'sha384-rbtjAdnIQE/aQJGEgXrVUlMibdfTSa4PQju4HDhN3sR2PmaKFzhEafuePsl9H/9I' },
  });

  function palette() {
    return {
      primary: ui.cssVar('--rw-chart-primary'), accent: ui.cssVar('--rw-chart-accent'),
      ok: ui.cssVar('--rw-chart-ok'), err: ui.cssVar('--rw-chart-err'), muted: ui.cssVar('--rw-chart-muted'),
      grid: ui.cssVar('--rw-chart-grid'), text: ui.cssVar('--rw-chart-text'),
    };
  }

  /* Creates a chart inside `host` (a card body). Returns a destroy function. */
  function chart(host, buildConfig, height) {
    var holder = ui.h('div', { class: 'relative w-full', style: { height: (height || 260) + 'px' } });
    var canvas = ui.h('canvas', { role: 'img', 'aria-label': 'Chart' });
    holder.append(canvas);
    host.replaceChildren(ui.skeleton(4));
    var instance = null, dead = false;
    ui.loadScript(RW.CDN.chart.url, RW.CDN.chart.sri).then(function () {
      if (dead) return;
      host.replaceChildren(holder);
      var p = palette();
      var Chart = window.Chart;
      Chart.defaults.font.family = 'Manrope, Segoe UI, system-ui, sans-serif';
      Chart.defaults.color = p.text;
      Chart.defaults.borderColor = p.grid;
      var cfg = buildConfig(p);
      cfg.options = cfg.options || {};
      cfg.options.responsive = true;
      cfg.options.maintainAspectRatio = false;
      cfg.options.animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 300 };
      instance = new Chart(canvas, cfg);
      if (cfg.ariaLabel) canvas.setAttribute('aria-label', cfg.ariaLabel);
    }).catch(function () {
      if (!dead) host.replaceChildren(ui.empty('Chart library could not be loaded (offline?).', 'alert'));
    });
    return function () { dead = true; if (instance) instance.destroy(); };
  }

  RW.charts = { chart: chart, palette: palette };
})();
