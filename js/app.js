/* RouteWise SPA shell: hash router, topbar/sidebar state, session checks. */
(function () {
  'use strict';
  var RW = window.RW;
  var ui = RW.ui, data = RW.data, h = ui.h;
  var view = document.getElementById('view');
  var cleanup = null;

  var ROUTES = [
    { re: /^\/dashboard$/, view: 'dashboard', nav: 'dashboard', section: 'Planning', title: 'Overview' },
    { re: /^\/plans$/, view: 'plans', nav: 'plans', section: 'Planning', title: 'Journey Plans' },
    { re: /^\/plans\/(\d{1,6})$/, view: 'planDetail', nav: 'plans', section: 'Journey Plans', title: 'Plan detail' },
    { re: /^\/markets$/, view: 'markets', nav: 'markets', section: 'Planning', title: 'Markets' },
    { re: /^\/supervisors$/, view: 'supervisors', nav: 'supervisors', section: 'Planning', title: 'Supervisors' },
    { re: /^\/routes$/, view: 'routes', nav: 'routes', section: 'Planning', title: 'Routes' },
    { re: /^\/visits$/, view: 'visits', nav: 'visits', section: 'Monitoring', title: 'Live Visits' },
    { re: /^\/reports$/, view: 'reports', nav: 'reports', section: 'Monitoring', title: 'Reports' },
    { re: /^\/kpi$/, view: 'kpi', nav: 'kpi', section: 'Monitoring', title: 'KPI Tasks' },
    { re: /^\/model$/, view: 'model', nav: 'model', section: 'System', title: 'Data Model' },
  ];

  function parseHash() {
    var raw = window.location.hash.replace(/^#/, '') || '/dashboard';
    var q = raw.indexOf('?');
    var path = q > -1 ? raw.slice(0, q) : raw;
    var query = new URLSearchParams(q > -1 ? raw.slice(q + 1) : '');
    return { path: path, query: query };
  }

  function updateShell() {
    var db = data.db;
    var s = RW.auth.session();
    document.getElementById('user-name').textContent = s.displayName;
    document.getElementById('user-role').textContent = s.role === 'admin' ? 'Administrator · full access' : 'Viewer · read-only';
    document.getElementById('user-avatar').textContent = s.displayName.split(' ').map(function (p) { return p.charAt(0); }).join('').slice(0, 2);
    document.getElementById('role-tag').classList.toggle('hidden', s.role === 'admin');
    document.getElementById('reset-item').classList.toggle('hidden', s.role !== 'admin');
    var today = data.today();
    document.getElementById('week-tag').textContent = 'Week ' + data.isoWeek(today) + ' · ' + ui.fmt.date(today).slice(3);
    document.getElementById('nav-count-plans').textContent = String(db.journeyPlans.filter(function (p) { return p.Status === 'Active'; }).length);
    var pending = data.logsBetween(today, today).filter(function (l) { return l.Status === 'Pending'; }).length;
    var live = document.getElementById('nav-count-live');
    live.textContent = pending ? String(pending) : '';
    live.classList.toggle('hidden', !pending);
    document.getElementById('side-city').textContent = db.meta.City + ' · data as of ' + ui.fmt.date(db.meta.AnchorDate);
  }

  function render() {
    if (!RW.auth.touch()) { RW.auth.requireSession(); return; }
    ui.closeDrawer();
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { /* ignore */ } }
    cleanup = null;
    var loc = parseHash();
    var route = ROUTES.find(function (r) { return r.re.test(loc.path); });
    if (!route) { window.location.replace('#/dashboard'); return; }
    var m = loc.path.match(route.re);
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === route.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.getElementById('topbar-section').textContent = route.section;
    document.getElementById('topbar-title').textContent = route.title;
    document.title = 'RouteWise · ' + route.title;
    var toggle = document.getElementById('nav-toggle');
    if (toggle) toggle.checked = false;
    view.replaceChildren();
    var v = RW.views[route.view];
    try {
      cleanup = v({ el: view, params: m.slice(1), query: loc.query, admin: RW.auth.isAdmin(), setTitle: function (t) {
        document.getElementById('topbar-title').textContent = t; document.title = 'RouteWise · ' + t;
      } }) || null;
    } catch (e) {
      view.replaceChildren(ui.card({ body: ui.empty('Something went wrong while rendering this page.', 'alert') }));
      if (window.console) console.error(e);
    }
    updateShell();
  }

  // About dialog: system identity + owner (Mavix Tech) info. Built with DOM APIs only.
  function openAbout() {
    var O = RW.OWNER;
    var dlg;
    function close() { dlg.close(); }
    dlg = h('dialog', { class: 'modal', 'aria-labelledby': 'about-title' },
      h('div', { class: 'modal-box max-w-md' },
        h('div', { class: 'flex items-start gap-3' },
          h('img', { src: 'favicon.svg', alt: '', width: 40, height: 40, class: 'shrink-0' }),
          h('div', { class: 'flex-1 min-w-0' },
            h('h3', { id: 'about-title', class: 'text-lg font-extrabold', text: 'RouteWise' }),
            h('p', { class: 'text-sm rw-muted' }, h('span', { class: 'badge badge-accent badge-sm me-2', text: 'Demo system' }), 'Sales journey-plan portal · fictional data')),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-square', 'aria-label': 'Close', on: { click: close } }, '✕')),
        h('div', { class: 'mx-about-brand mt-5' },
          h('p', { class: 'text-[0.68rem] font-semibold uppercase tracking-[0.14em] rw-muted', text: 'Developed by' }),
          h('img', { src: RW.owner.isDark() ? O.logoDark : O.logo, alt: O.name, width: 146, height: 48, class: 'h-12 w-auto mt-2' }),
          h('p', { class: 'text-sm font-semibold mt-3', text: O.tagline }),
          h('p', { class: 'text-sm rw-muted mt-2', text: O.description }),
          h('p', { class: 'text-sm font-bold mt-3', text: O.cta })),
        h('div', { class: 'modal-action' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: close } }, 'Close'),
          h('a', { href: O.url, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-sm mx-cta' }, 'Visit website', h('span', { class: 'sr-only', text: ' (opens in a new tab)' })))),
      h('form', { method: 'dialog', class: 'modal-backdrop' }, h('button', { type: 'submit', 'aria-label': 'Close' }, 'close')));
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  }

  function boot() {
    view.replaceChildren(ui.skeleton(6));
    data.load().then(function () {
      document.getElementById('data-source').textContent = window.__DATA__ ? 'Data: bundled fallback (file mode)' : 'Data: data/*.json';
      window.addEventListener('hashchange', render);
      document.addEventListener('rw:theme', render);
      document.addEventListener('rw:data', function () { updateShell(); });
      document.getElementById('sign-out').addEventListener('click', function () { RW.auth.logout(); });
      document.getElementById('about-open').addEventListener('click', function () {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // close the dropdown
        openAbout();
      });
      document.getElementById('reset-data').addEventListener('click', function () {
        ui.confirm('Discard all plan, template and KPI-task edits stored in this browser?', function () {
          data.resetEdits(); ui.toast('Demo edits cleared.'); render();
        }, 'Reset');
      });
      // Periodic session check (expiry).
      setInterval(function () { if (!RW.auth.session()) RW.auth.requireSession(); }, 30000);
      render();
    }).catch(function () {
      view.replaceChildren(ui.card({ body: ui.empty('Could not load demo data. Serve the folder (npx serve .) or rebuild js/data.bundle.js.', 'alert') }));
    });
  }

  if (RW.auth.session()) boot();
  RW.app = { render: render, h: h };
})();
