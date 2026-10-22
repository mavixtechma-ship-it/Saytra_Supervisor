/* RouteWise UI kit: safe DOM builder + shared components (KPI tile, card, badge, table, drawer, modal, toast).
   All data is written with textContent / createElement — never HTML strings. */
(function () {
  'use strict';
  var RW = (window.RW = window.RW || {});
  var SVGNS = 'http://www.w3.org/2000/svg';

  function safeUrl(u) {
    var s = String(u);
    if (s.charAt(0) === '#') return s;
    try {
      var x = new URL(s, window.location.href);
      if (x.protocol === 'https:' || x.protocol === 'http:' || x.protocol === 'mailto:' || x.protocol === 'tel:' || x.protocol === 'blob:' || x.protocol === window.location.protocol) return s;
    } catch (e) { /* fallthrough */ }
    return '#';
  }
  function append(el, kids) {
    kids.forEach(function (k) {
      if (Array.isArray(k)) { append(el, k); return; }
      if (k == null || k === false) return;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    });
  }
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = String(v);
        else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = String(v[d]); });
        else if (k === 'style') Object.keys(v).forEach(function (sk) { el.style.setProperty(sk, String(v[sk])); });
        else if (/^on/i.test(k)) throw new Error('Inline handlers are not allowed');
        else if (k === 'href' || k === 'src') el.setAttribute(k, safeUrl(v));
        else if (k === 'value') el.value = String(v);
        else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      });
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }

  // Lucide-style icon set (constant path data only).
  var ICONS = {
    grid: [['rect', { x: 3, y: 3, width: 7, height: 9, rx: 1.5 }], ['rect', { x: 14, y: 3, width: 7, height: 5, rx: 1.5 }], ['rect', { x: 14, y: 12, width: 7, height: 9, rx: 1.5 }], ['rect', { x: 3, y: 16, width: 7, height: 5, rx: 1.5 }]],
    calendar: [['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ['path', { d: 'M16 2v4M8 2v4M3 10h18' }]],
    store: [['path', { d: 'M3 9l1.5-5h15L21 9M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z' }], ['path', { d: 'M5 13v8h14v-8M10 21v-5h4v5' }]],
    users: [['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }]],
    route: [['circle', { cx: 6, cy: 19, r: 3 }], ['circle', { cx: 18, cy: 5, r: 3 }], ['path', { d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' }]],
    activity: [['path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' }]],
    chart: [['path', { d: 'M3 3v18h18' }], ['path', { d: 'M7 15l4-4 3 3 5-6' }]],
    check: [['path', { d: 'M20 6L9 17l-5-5' }]],
    tasks: [['path', { d: 'M9 11l3 3L22 4' }], ['path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' }]],
    database: [['ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }], ['path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M21 21l-4.3-4.3' }]],
    x: [['path', { d: 'M18 6L6 18M6 6l12 12' }]],
    up: [['path', { d: 'M18 15l-6-6-6 6' }]],
    down: [['path', { d: 'M6 9l6 6 6-6' }]],
    trash: [['path', { d: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6' }]],
    edit: [['path', { d: 'M12 20h9' }], ['path', { d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' }]],
    pin: [['path', { d: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
    clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
    download: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' }]],
    refresh: [['path', { d: 'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5' }]],
    back: [['path', { d: 'M19 12H5M12 19l-7-7 7-7' }]],
    alert: [['path', { d: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' }], ['path', { d: 'M12 9v4M12 17h.01' }]],
    sort: [['path', { d: 'M7 15l5 5 5-5M7 9l5-5 5 5' }]],
    inbox: [['path', { d: 'M22 12h-6l-2 3h-4l-2-3H2' }], ['path', { d: 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }]],
    play: [['path', { d: 'M5 3l14 9-14 9V3z' }]],
  };
  function icon(name, size, cls) {
    var svg = document.createElementNS(SVGNS, 'svg');
    var s = String(size || 18);
    svg.setAttribute('width', s); svg.setAttribute('height', s);
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    (ICONS[name] || []).forEach(function (spec) {
      var c = document.createElementNS(SVGNS, spec[0]);
      Object.keys(spec[1]).forEach(function (k) { c.setAttribute(k, String(spec[1][k])); });
      svg.appendChild(c);
    });
    return svg;
  }

  // ---------- formatting ----------
  var nf = new Intl.NumberFormat('en-US');
  var dateF = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  var dayF = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
  var timeF = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  var fmt = {
    num: function (n) { return n == null ? '—' : nf.format(n); },
    pct: function (r) { return r == null ? '—' : Math.round(r * 100) + '%'; },
    date: function (d) { return d ? dateF.format(typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00Z' : d) : d) : '—'; },
    day: function (d) { return d ? dayF.format(typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00Z' : d) : d) : '—'; },
    time: function (iso) { return iso ? timeF.format(new Date(iso)) : '—'; },
    hours: function (h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); },
    relative: function (iso, nowMs) {
      var diff = Math.round(((nowMs || Date.now()) - new Date(iso).getTime()) / 60000);
      if (diff < 1) return 'just now';
      if (diff < 60) return diff + ' min ago';
      var hrs = Math.round(diff / 60);
      if (hrs < 24) return hrs + ' h ago';
      return Math.round(hrs / 24) + ' d ago';
    },
  };

  // ---------- components ----------
  var TONES = {
    Active: 'success', Visited: 'success', Draft: 'warning', Pending: 'ghost', Missed: 'error',
    Completed: 'info', Archived: 'ghost', 'On time': 'success', Late: 'warning',
  };
  function badge(text, tone, extra) {
    var t = tone || TONES[text] || 'ghost';
    return h('span', { class: 'badge badge-sm gap-1.5 font-semibold whitespace-nowrap ' + (t === 'ghost' ? 'badge-ghost' : 'badge-' + t + ' badge-outline') + (extra ? ' ' + extra : '') },
      h('span', { class: 'rw-dot', 'aria-hidden': 'true' }), text);
  }
  function card(opts) {
    var head = null;
    if (opts.title || opts.actions) {
      head = h('div', { class: 'rw-card-head' },
        opts.icon ? h('span', { class: 'text-primary' }, icon(opts.icon, 18)) : null,
        h('div', { class: 'flex-1 min-w-0' },
          h('h2', { class: 'rw-card-title', text: opts.title || '' }),
          opts.subtitle ? h('p', { class: 'text-xs rw-muted', text: opts.subtitle }) : null),
        opts.actions || null);
    }
    var body = h('div', { class: opts.bodyClass == null ? 'p-4' : opts.bodyClass }, opts.body || null);
    var el = h('section', { class: 'rw-card flex flex-col min-w-0 ' + (opts.class || '') }, head, body);
    el.body = body;
    return el;
  }
  function kpiTile(o) {
    return h('div', { class: 'rw-card p-4 flex flex-col gap-2 min-w-0' },
      h('div', { class: 'flex items-center justify-between gap-2' },
        h('span', { class: 'rw-kpi-label', text: o.label }),
        o.icon ? h('span', { class: 'w-8 h-8 rounded-lg grid place-items-center bg-primary/10 text-primary' }, icon(o.icon, 16)) : null),
      h('div', { class: 'rw-kpi-value num ' + (o.valueClass || ''), title: o.title || null, text: o.value }),
      o.progress != null ? progress(o.progress, o.progressTone) : null,
      o.sub ? h('div', { class: 'text-xs rw-muted flex items-center gap-1 ' + (o.subClass || '') }, o.sub) : null);
  }
  function progress(ratio, tone) {
    var pct = Math.max(0, Math.min(100, Math.round((ratio || 0) * 100)));
    var t = tone || (pct >= 85 ? 'success' : pct >= 65 ? 'warning' : 'error');
    return h('progress', { class: 'progress progress-' + t + ' w-full h-2', value: pct, max: 100, 'aria-label': pct + '%' });
  }
  function delta(curr, prev, invert) {
    if (curr == null || prev == null) return null;
    var d = curr - prev;
    if (Math.abs(d) < 0.005) return h('span', { class: 'rw-muted', text: '— no change vs previous' });
    var good = invert ? d < 0 : d > 0;
    return h('span', { class: good ? 'text-success font-semibold' : 'text-error font-semibold', text: (d > 0 ? '▲ ' : '▼ ') + (Math.abs(d) < 1 ? Math.round(Math.abs(d) * 100) + ' pts' : nf.format(Math.abs(d))) + ' vs previous' });
  }
  var AVATAR_TONES = ['bg-primary text-primary-content', 'bg-secondary text-secondary-content', 'bg-accent text-accent-content', 'bg-neutral text-neutral-content'];
  function avatar(name, size) {
    var initials = String(name).split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var hsh = 0; for (var i = 0; i < name.length; i++) hsh = (hsh * 31 + name.charCodeAt(i)) >>> 0;
    var sz = size === 'sm' ? 'w-7 h-7 text-[0.65rem]' : 'w-9 h-9 text-xs';
    return h('span', { class: 'rounded-full grid place-items-center font-bold shrink-0 ' + sz + ' ' + AVATAR_TONES[hsh % AVATAR_TONES.length], 'aria-hidden': 'true', text: initials });
  }
  function empty(msg, iconName, action) {
    return h('div', { class: 'flex flex-col items-center justify-center text-center gap-2 py-10 rw-muted' },
      icon(iconName || 'inbox', 28), h('p', { class: 'text-sm', text: msg }), action || null);
  }
  function skeleton(lines) {
    var wrap = h('div', { class: 'space-y-3 p-2', 'aria-busy': 'true' });
    for (var i = 0; i < (lines || 3); i++) wrap.append(h('div', { class: 'rw-skeleton h-4', style: { width: (60 + ((i * 17) % 40)) + '%' } }));
    return wrap;
  }
  function pageHeader(o) {
    return h('header', { class: 'flex flex-wrap items-end gap-3 mb-6' },
      h('div', { class: 'flex-1 min-w-0' },
        o.crumbs ? h('div', { class: 'breadcrumbs text-xs p-0 rw-muted' }, h('ul', null, o.crumbs.map(function (c) {
          return h('li', null, c.href ? h('a', { href: c.href, text: c.label }) : h('span', { text: c.label }));
        }))) : null,
        h('h1', { class: 'text-2xl font-extrabold tracking-tight', text: o.title }),
        o.subtitle ? h('p', { class: 'text-sm rw-muted mt-0.5', text: o.subtitle }) : null),
      o.actions ? h('div', { class: 'flex flex-wrap items-center gap-2' }, o.actions) : null);
  }
  function button(label, o) {
    o = o || {};
    return h('button', { type: 'button', class: 'btn btn-sm ' + (o.class || 'btn-ghost'), on: o.onClick ? { click: o.onClick } : null, 'aria-label': o.aria || null, title: o.title || null, disabled: o.disabled },
      o.icon ? icon(o.icon, 16) : null, label ? h('span', { text: label }) : null);
  }
  function select(opts, value, attrs) {
    var s = h('select', Object.assign({ class: 'select select-bordered select-sm' }, attrs || {}));
    opts.forEach(function (o) { s.append(h('option', { value: o.value, text: o.label, selected: String(o.value) === String(value) })); });
    return s;
  }

  /* data table: columns [{key,label,align,render(row),sort(row),class}], sortable + paged */
  function dataTable(o) {
    var state = { sortKey: o.sortKey || null, dir: o.sortDir || 1, page: 0, rows: o.rows || [] };
    var pageSize = o.pageSize || 12;
    var wrap = h('div', { class: 'flex flex-col' });
    var tableWrap = h('div', { class: 'rw-table-wrap' });
    var table = h('table', { class: 'table table-sm rw-table' });
    var thead = h('thead');
    var tbody = h('tbody');
    var foot = h('div', { class: 'flex items-center justify-between gap-2 px-4 py-2 border-t border-base-300 text-xs rw-muted' });
    table.append(thead, tbody); tableWrap.append(table); wrap.append(tableWrap, foot);

    function renderHead() {
      var tr = h('tr');
      o.columns.forEach(function (c) {
        var align = c.align === 'right' ? 'text-right' : '';
        var th = h('th', { scope: 'col', class: align, 'aria-sort': state.sortKey === c.key ? (state.dir > 0 ? 'ascending' : 'descending') : null });
        if (c.sort) {
          th.append(h('button', { type: 'button', class: 'hover:text-primary', on: { click: function () {
            if (state.sortKey === c.key) state.dir = -state.dir; else { state.sortKey = c.key; state.dir = 1; }
            state.page = 0; render();
          } } }, c.label, state.sortKey === c.key ? (state.dir > 0 ? '▲' : '▼') : icon('sort', 12)));
        } else th.textContent = c.label;
        tr.append(th);
      });
      thead.replaceChildren(tr);
    }
    function sorted() {
      var col = o.columns.find(function (c) { return c.key === state.sortKey; });
      if (!col || !col.sort) return state.rows;
      return state.rows.slice().sort(function (a, b) {
        var x = col.sort(a), y = col.sort(b);
        if (x == null) return 1; if (y == null) return -1;
        return (x > y ? 1 : x < y ? -1 : 0) * state.dir;
      });
    }
    function render() {
      renderHead();
      var rows = sorted();
      var pages = Math.max(1, Math.ceil(rows.length / pageSize));
      if (state.page >= pages) state.page = pages - 1;
      var slice = rows.slice(state.page * pageSize, (state.page + 1) * pageSize);
      tbody.replaceChildren();
      if (!slice.length) {
        tbody.append(h('tr', null, h('td', { colspan: o.columns.length }, empty(o.empty || 'No records match these filters.'))));
      }
      slice.forEach(function (r) {
        var tr = h('tr', { class: o.onRowClick ? 'rw-clickable' : '' });
        if (o.onRowClick) {
          tr.tabIndex = 0;
          tr.addEventListener('click', function (e) { if (!e.target.closest('button,a,input,select')) o.onRowClick(r); });
          tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === tr) o.onRowClick(r); });
        }
        o.columns.forEach(function (c) {
          var v = c.render ? c.render(r) : r[c.key];
          tr.append(h('td', { class: (c.align === 'right' ? 'text-right num ' : '') + (c.class || '') }, v instanceof Node ? v : (v == null ? '—' : String(v))));
        });
        tbody.append(tr);
      });
      var from = rows.length ? state.page * pageSize + 1 : 0;
      foot.replaceChildren(
        h('span', { class: 'num', text: from + '–' + Math.min(rows.length, (state.page + 1) * pageSize) + ' of ' + fmt.num(rows.length) }),
        h('div', { class: 'join' },
          h('button', { type: 'button', class: 'btn btn-xs join-item', disabled: state.page === 0, 'aria-label': 'Previous page', on: { click: function () { state.page--; render(); } } }, '‹'),
          h('span', { class: 'btn btn-xs join-item no-animation pointer-events-none num', text: (state.page + 1) + ' / ' + pages }),
          h('button', { type: 'button', class: 'btn btn-xs join-item', disabled: state.page >= pages - 1, 'aria-label': 'Next page', on: { click: function () { state.page++; render(); } } }, '›')));
    }
    render();
    wrap.update = function (rows) { state.rows = rows; state.page = 0; render(); };
    return wrap;
  }

  // ---------- drawer ----------
  var openDrawerEl = null;
  function closeDrawer() {
    if (!openDrawerEl) return;
    openDrawerEl.backdrop.remove(); openDrawerEl.panel.remove();
    document.removeEventListener('keydown', openDrawerEl.onKey);
    if (openDrawerEl.returnFocus) openDrawerEl.returnFocus.focus();
    openDrawerEl = null;
  }
  function drawer(title, content, subtitle) {
    closeDrawer();
    var backdrop = h('div', { class: 'rw-drawer-backdrop', on: { click: closeDrawer } });
    var closeBtn = button(null, { class: 'btn-ghost btn-square', icon: 'x', aria: 'Close panel', onClick: closeDrawer });
    var panel = h('aside', { class: 'rw-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'flex items-start gap-3 p-5 border-b border-base-300' },
        h('div', { class: 'flex-1 min-w-0' }, h('h2', { class: 'text-lg font-extrabold', text: title }), subtitle ? h('p', { class: 'text-sm rw-muted', text: subtitle }) : null),
        closeBtn),
      h('div', { class: 'flex-1 overflow-y-auto p-5 space-y-5' }, content));
    var onKey = function (e) { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    openDrawerEl = { backdrop: backdrop, panel: panel, onKey: onKey, returnFocus: document.activeElement };
    document.body.append(backdrop, panel);
    closeBtn.focus();
  }

  // ---------- modal (native <dialog>) ----------
  function modal(o) {
    var err = h('p', { class: 'text-error text-sm min-h-5', role: 'status', 'aria-live': 'polite' });
    var form = h('form', { class: 'space-y-4', novalidate: true }, o.body, err);
    var submit = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, o.submitLabel || 'Save');
    var dlg = h('dialog', { class: 'modal' },
      h('div', { class: 'modal-box max-w-lg' },
        h('h3', { class: 'text-lg font-extrabold mb-4', text: o.title }),
        form,
        h('div', { class: 'modal-action' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: function () { dlg.close(); } } }, 'Cancel'),
          submit)),
      h('form', { method: 'dialog', class: 'modal-backdrop' }, h('button', { type: 'submit', 'aria-label': 'Close' }, 'close')));
    function doSubmit(e) {
      e.preventDefault();
      err.textContent = '';
      try {
        var keep = o.onSubmit(new FormData(form), form);
        if (keep !== false) dlg.close();
      } catch (ex) { err.textContent = ex && ex.message ? ex.message : 'Could not save.'; }
    }
    form.addEventListener('submit', doSubmit);
    submit.addEventListener('click', doSubmit);
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
    var first = form.querySelector('input,select,textarea');
    if (first) first.focus();
    return dlg;
  }
  function confirmDialog(message, onYes, label) {
    modal({ title: 'Please confirm', body: h('p', { class: 'text-sm', text: message }), submitLabel: label || 'Delete', onSubmit: function () { onYes(); } });
    var btns = document.querySelectorAll('dialog .btn-primary');
    var b = btns[btns.length - 1];
    if (b) { b.classList.remove('btn-primary'); b.classList.add('btn-error'); }
  }

  // ---------- toast ----------
  var toastHost = null;
  function toast(msg, tone) {
    if (!toastHost) { toastHost = h('div', { class: 'toast toast-end toast-bottom z-[80]', role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
    var el = h('div', { class: 'alert alert-' + (tone || 'success') + ' text-sm py-2 shadow' }, h('span', { text: msg }));
    toastHost.append(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  // ---------- form field helpers ----------
  function field(label, control, hint) {
    return h('label', { class: 'form-control w-full' },
      h('span', { class: 'label-text font-semibold mb-1', text: label }), control,
      hint ? h('span', { class: 'label-text-alt rw-muted mt-1', text: hint }) : null);
  }
  function checkboxList(name, items, checkedIds) {
    return h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto rounded-lg border border-base-300 p-2' },
      items.map(function (it) {
        return h('label', { class: 'label cursor-pointer justify-start gap-2 py-1' },
          h('input', { type: 'checkbox', class: 'checkbox checkbox-sm checkbox-primary', name: name, value: it.Id, checked: checkedIds.indexOf(it.Id) > -1 }),
          h('span', { class: 'label-text text-sm', text: it.label }));
      }));
  }

  // ---------- external script loader (pinned + SRI) ----------
  var loaded = {};
  function loadScript(url, integrity) {
    if (!loaded[url]) {
      loaded[url] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = url; s.async = true;
        if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
        s.referrerPolicy = 'no-referrer';
        s.addEventListener('load', function () { resolve(); });
        s.addEventListener('error', function () { delete loaded[url]; reject(new Error('Failed to load ' + url)); });
        document.head.append(s);
      });
    }
    return loaded[url];
  }
  function loadStyle(url, integrity) {
    if (document.querySelector('link[data-src="' + url.replace(/"/g, '') + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url; l.dataset.src = url;
    if (integrity) { l.integrity = integrity; l.crossOrigin = 'anonymous'; }
    document.head.append(l);
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  RW.ui = {
    h: h, icon: icon, fmt: fmt, badge: badge, card: card, kpiTile: kpiTile, progress: progress, delta: delta,
    avatar: avatar, empty: empty, skeleton: skeleton, pageHeader: pageHeader, button: button, select: select,
    dataTable: dataTable, drawer: drawer, closeDrawer: closeDrawer, modal: modal, confirm: confirmDialog, toast: toast,
    field: field, checkboxList: checkboxList, loadScript: loadScript, loadStyle: loadStyle, cssVar: cssVar,
  };
})();
