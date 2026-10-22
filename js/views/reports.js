/* Reports (filter + story): sticky filters (URL-synced) → KPIs with delta → daily stacked bars →
   completion by route (sorted horizontal bars) → KPI task completion → CSV export. */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};
  var PERIODS = [7, 14, 28];

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  RW.views.reports = function (ctx) {
    var db = data.db, today = data.today(), q = ctx.query;
    var period = PERIODS.indexOf(Number(q.get('period'))) > -1 ? Number(q.get('period')) : 14;
    var routeId = data.idx.routes.has(Number(q.get('route'))) ? Number(q.get('route')) : null;
    var supId = data.idx.supervisors.has(Number(q.get('sup'))) ? Number(q.get('sup')) : null;
    var filter = { routeId: routeId, supervisorId: supId };
    var from = data.addDays(today, -(period - 1));
    var logs = data.logsBetween(from, today, filter);
    var st = data.summarize(logs);
    var prev = period < 28 ? data.summarize(data.logsBetween(data.addDays(from, -period), data.addDays(from, -1), filter)) : null;

    function go(next) {
      var p = new URLSearchParams();
      p.set('period', next.period); if (next.route) p.set('route', next.route); if (next.sup) p.set('sup', next.sup);
      window.location.hash = '#/reports?' + p.toString();
    }
    var periodSel = h('div', { class: 'join', role: 'group', 'aria-label': 'Period' }, PERIODS.map(function (p) {
      return h('button', { type: 'button', class: 'btn btn-sm join-item ' + (p === period ? 'btn-primary' : 'btn-outline'), 'aria-pressed': String(p === period), on: { click: function () { go({ period: p, route: routeId, sup: supId }); } } }, p + ' days');
    }));
    var routeSel = ui.select([{ value: '', label: 'All routes' }].concat(db.routes.map(function (r) { return { value: r.Id, label: r.Code + ' · ' + r.Name }; })), routeId || '', { 'aria-label': 'Route' });
    var supSel = ui.select([{ value: '', label: 'All supervisors' }].concat(db.supervisors.map(function (s) { return { value: s.Id, label: s.Name }; })), supId || '', { 'aria-label': 'Supervisor' });
    routeSel.addEventListener('change', function () { go({ period: period, route: routeSel.value, sup: supId }); });
    supSel.addEventListener('change', function () { go({ period: period, route: routeId, sup: supSel.value }); });

    function exportCsv() {
      var header = ['VisitDate', 'Supervisor', 'MarketCode', 'Market', 'Route', 'Order', 'Status', 'CheckInTime', 'OnTime', 'Notes'];
      var lines = [header.join(',')].concat(logs.map(function (l) {
        var m = data.idx.markets.get(l.MarketId) || {};
        var r = data.idx.routes.get(m.RouteId) || {};
        return [l.VisitDate, data.idx.supervisors.get(l.SupervisorId).Name, m.Code, m.Name, r.Code, l.OrderInDay, l.Status, l.CheckInTime || '', l.IsOnTime == null ? '' : (l.IsOnTime ? 'yes' : 'no'), l.Notes].map(csvCell).join(',');
      }));
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: 'routewise-visits-' + data.dayStr(from) + '_' + data.dayStr(today) + '.csv' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      ui.toast('CSV exported (' + logs.length + ' rows).');
    }

    var filterBar = h('div', { class: 'rw-card p-3 flex flex-wrap items-center gap-2 sticky top-20 z-20 mb-4' },
      periodSel, routeSel, supSel, h('span', { class: 'flex-1' }),
      ui.button('Export CSV', { class: 'btn-outline', icon: 'download', onClick: exportCsv }));

    var kpis = h('div', { class: 'grid grid-cols-2 xl:grid-cols-4 gap-4' },
      ui.kpiTile({ label: 'Planned visits', value: fmt.num(st.planned), sub: prev ? ui.delta(st.planned, prev.planned) : 'Full data window' }),
      ui.kpiTile({ label: 'Completion rate', value: fmt.pct(st.completion), progress: st.completion, sub: prev ? ui.delta(st.completion, prev.completion) : null }),
      ui.kpiTile({ label: 'Missed visits', value: fmt.num(st.missed), valueClass: 'text-error', sub: prev ? ui.delta(st.missed, prev.missed, true) : null }),
      ui.kpiTile({ label: 'On-time rate', value: fmt.pct(st.onTimeRate), sub: prev ? ui.delta(st.onTimeRate, prev.onTimeRate) : null }));

    // daily stacked bars
    var dailyCard = ui.card({ title: 'Visits per day', subtitle: 'Visited · missed · pending', class: 'xl:col-span-12' });
    var labels = [], v = [], mi = [], pe = [];
    for (var i = period - 1; i >= 0; i--) {
      var d = data.addDays(today, -i);
      if (data.dayCode(d) === 'FRI') continue;
      var s = data.summarize(data.logsBetween(d, d, filter));
      labels.push(fmt.day(d)); v.push(s.visited); mi.push(s.missed); pe.push(s.pending);
    }
    var destroyers = [];
    destroyers.push(RW.charts.chart(dailyCard.body, function (p) {
      return { type: 'bar', ariaLabel: 'Stacked bar chart of visits per day by status',
        data: { labels: labels, datasets: [
          { label: 'Visited', data: v, backgroundColor: p.primary, borderRadius: 3, stack: 's' },
          { label: 'Missed', data: mi, backgroundColor: p.err, borderRadius: 3, stack: 's' },
          { label: 'Pending', data: pe, backgroundColor: p.muted, borderRadius: 3, stack: 's' },
        ] },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
          scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } };
    }, 260));

    // by route
    var byRoute = db.routes.map(function (r) {
      var s = data.summarize(data.logsBetween(from, today, { routeId: r.Id, supervisorId: supId }));
      return { label: r.Code, value: s.completion == null ? null : Math.round(s.completion * 100) };
    }).filter(function (x) { return x.value != null && (!routeId || x.label === data.idx.routes.get(routeId).Code); })
      .sort(function (a, b) { return b.value - a.value; });
    var routeCard = ui.card({ title: 'Completion by route', subtitle: 'Sorted, % of closed visits', class: 'xl:col-span-6' });
    destroyers.push(byRoute.length ? RW.charts.chart(routeCard.body, function (p) {
      return { type: 'bar', ariaLabel: 'Horizontal bar chart of completion by route',
        data: { labels: byRoute.map(function (x) { return x.label; }), datasets: [{ label: 'Completion %', data: byRoute.map(function (x) { return x.value; }),
          backgroundColor: byRoute.map(function (x) { return x.value < 70 ? p.err : p.primary; }), borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + '%'; } } } },
          scales: { x: { min: 0, max: 100, ticks: { callback: function (val) { return val + '%'; } } }, y: { grid: { display: false } } } } };
    }, 300) : (routeCard.body.replaceChildren(ui.empty('No closed visits for this filter.')), function () {}));

    // KPI tasks
    var ts = data.taskStats(logs);
    var taskRows = Array.from(ts.entries()).map(function (e) {
      var k = data.idx.kpi.get(e[0]);
      return { label: k ? k.Title : 'Task ' + e[0], value: Math.round(e[1].done / e[1].total * 100), total: e[1].total };
    }).sort(function (a, b) { return b.value - a.value; });
    var taskCard = ui.card({ title: 'KPI task completion', subtitle: 'Share of visits where the task was done', class: 'xl:col-span-6' });
    destroyers.push(taskRows.length ? RW.charts.chart(taskCard.body, function (p) {
      return { type: 'bar', ariaLabel: 'Horizontal bar chart of KPI task completion',
        data: { labels: taskRows.map(function (x) { return x.label; }), datasets: [{ label: 'Done %', data: taskRows.map(function (x) { return x.value; }), backgroundColor: p.accent, borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + '% of ' + taskRows[c.dataIndex].total + ' checks'; } } } },
          scales: { x: { min: 0, max: 100, ticks: { callback: function (val) { return val + '%'; } } }, y: { grid: { display: false } } } } };
    }, 300) : (taskCard.body.replaceChildren(ui.empty('No KPI checks for this filter.')), function () {}));

    ctx.el.append(
      ui.pageHeader({ title: 'Reports', subtitle: fmt.date(from) + ' – ' + fmt.date(today) + (prev ? ' · compared with the previous ' + period + ' days' : '') }),
      filterBar, kpis,
      h('div', { class: 'grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4' }, dailyCard, routeCard, taskCard));
    return function () { destroyers.forEach(function (d) { d(); }); };
  };
})();
