/* Supervisors (table-first + drawer) and Routes (coverage status grid + drawer). */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};

  function supRow(s, from, to) {
    var st = data.summarize(data.logsBetween(from, to, { supervisorId: s.Id }));
    var plans = data.db.journeyPlanSupervisors.filter(function (x) { return x.SupervisorId === s.Id; })
      .map(function (x) { return data.idx.plans.get(x.JourneyPlanId); }).filter(Boolean);
    var activeStops = data.templates(null, s.Id).filter(function (t) { var p = data.idx.plans.get(t.JourneyPlanId); return p && p.Status === 'Active'; });
    return { s: s, st: st, plans: plans, stops: activeStops };
  }

  RW.views.supervisors = function (ctx) {
    var db = data.db, today = data.today(), from = data.addDays(today, -27);
    var rowsAll = db.supervisors.map(function (s) { return supRow(s, from, today); });
    var team = data.summarize(data.logsBetween(from, today));
    var onPlan = rowsAll.filter(function (r) { return r.stops.length; }).length;

    function open(r) {
      var s = r.s;
      var perDay = data.DAYS.map(function (d) { return [d, r.stops.filter(function (t) { return t.DayOfWeek === d; }).length]; });
      var maxDay = Math.max.apply(null, perDay.map(function (p) { return p[1]; }).concat([1]));
      var missed = data.logsBetween(from, today, { supervisorId: s.Id }).filter(function (l) { return l.Status === 'Missed'; })
        .sort(function (a, b) { return b.VisitDate.localeCompare(a.VisitDate); });
      var tasks = data.taskStats(data.logsBetween(from, today, { supervisorId: s.Id }));
      ui.drawer(s.Name, [
        h('div', { class: 'flex items-center gap-3' }, ui.avatar(s.Name),
          h('div', { class: 'text-sm' },
            h('a', { class: 'link link-hover block', href: 'mailto:' + s.Email, text: s.Email }),
            h('span', { class: 'rw-muted', text: s.Phone }))),
        h('div', { class: 'grid grid-cols-3 gap-3' }, [
          ['Completion', fmt.pct(r.st.completion)], ['On time', fmt.pct(r.st.onTimeRate)], ['Missed', fmt.num(r.st.missed)],
        ].map(function (k) { return h('div', { class: 'rw-card p-3' }, h('p', { class: 'rw-kpi-label', text: k[0] }), h('p', { class: 'text-xl font-extrabold num', text: k[1] })); })),
        h('div', null, h('h3', { class: 'font-bold text-sm mb-2', text: 'Stops per day (active plans)' }),
          h('div', { class: 'flex items-end gap-2 h-24' }, perDay.map(function (p) {
            return h('div', { class: 'flex-1 flex flex-col items-center gap-1' },
              h('span', { class: 'text-[0.7rem] num rw-muted', text: String(p[1]) }),
              h('div', { class: 'w-full rounded-t bg-primary/70', style: { height: Math.max(4, Math.round(p[1] / maxDay * 64)) + 'px' } }),
              h('span', { class: 'text-[0.65rem] font-bold', text: p[0] }));
          }))),
        h('div', null, h('h3', { class: 'font-bold text-sm mb-2', text: 'KPI task completion' }),
          tasks.size ? h('ul', { class: 'space-y-2' }, Array.from(tasks.entries()).map(function (e) {
            var k = data.idx.kpi.get(e[0]);
            return h('li', { class: 'text-sm' }, h('div', { class: 'flex justify-between' }, h('span', { text: k ? k.Title : 'Task' }), h('span', { class: 'num rw-muted', text: fmt.pct(e[1].done / e[1].total) })), ui.progress(e[1].done / e[1].total));
          })) : h('p', { class: 'text-sm rw-muted', text: 'No checks recorded.' })),
        h('div', null, h('h3', { class: 'font-bold text-sm mb-2', text: 'Recent missed visits' }),
          missed.length ? h('ul', { class: 'space-y-1 text-sm' }, missed.slice(0, 6).map(function (l) {
            var m = data.idx.markets.get(l.MarketId);
            return h('li', { class: 'flex gap-2' }, h('span', { class: 'w-28 rw-muted', text: fmt.day(l.VisitDate) }), h('span', { class: 'flex-1 truncate', text: (m ? m.Name : '—') + ' — ' + (l.Notes || '') }));
          })) : h('p', { class: 'text-sm rw-muted', text: 'None — great work.' })),
      ], r.plans.map(function (p) { return p.Name; }).join(' · ') || 'No plans assigned');
    }

    var table = ui.dataTable({
      rows: rowsAll, sortKey: 'completion', sortDir: -1, pageSize: 10, onRowClick: open,
      columns: [
        { key: 'name', label: 'Supervisor', sort: function (r) { return r.s.Name; }, render: function (r) { return h('div', { class: 'flex items-center gap-2' }, ui.avatar(r.s.Name, 'sm'), h('span', { class: 'font-semibold', text: r.s.Name })); } },
        { key: 'phone', label: 'Phone', render: function (r) { return h('span', { class: 'text-xs rw-muted num', text: r.s.Phone }); } },
        { key: 'plans', label: 'Plans', render: function (r) { return h('div', { class: 'flex flex-wrap gap-1' }, r.plans.map(function (p) { var b = ui.badge(p.Name, p.Status === 'Active' ? 'success' : p.Status === 'Draft' ? 'warning' : 'ghost', 'max-w-48 truncate'); b.title = p.Name + ' (' + p.Status + ')'; return b; })); } },
        { key: 'stops', label: 'Stops / week', align: 'right', sort: function (r) { return r.stops.length; }, render: function (r) { return fmt.num(r.stops.length); } },
        { key: 'visited', label: 'Visited', align: 'right', sort: function (r) { return r.st.visited; }, render: function (r) { return fmt.num(r.st.visited); } },
        { key: 'completion', label: 'Completion', sort: function (r) { return r.st.completion; }, render: function (r) { return h('div', { class: 'w-28' }, ui.progress(r.st.completion), h('span', { class: 'text-[0.7rem] num rw-muted', text: fmt.pct(r.st.completion) })); } },
        { key: 'ontime', label: 'On time', align: 'right', sort: function (r) { return r.st.onTimeRate; }, render: function (r) { return fmt.pct(r.st.onTimeRate); } },
      ],
    });

    ctx.el.append(
      ui.pageHeader({ title: 'Supervisors', subtitle: 'Field supervisors and their performance over the last 4 weeks.' }),
      h('div', { class: 'stats stats-vertical sm:stats-horizontal w-full rw-card mb-4' },
        h('div', { class: 'stat' }, h('div', { class: 'stat-title', text: 'On active plans' }), h('div', { class: 'stat-value text-2xl num', text: onPlan + ' / ' + db.supervisors.length })),
        h('div', { class: 'stat' }, h('div', { class: 'stat-title', text: 'Team completion' }), h('div', { class: 'stat-value text-2xl num', text: fmt.pct(team.completion) })),
        h('div', { class: 'stat' }, h('div', { class: 'stat-title', text: 'Team on-time rate' }), h('div', { class: 'stat-value text-2xl num', text: fmt.pct(team.onTimeRate) }))),
      ui.card({ bodyClass: 'p-0', body: table }));
  };

  RW.views.routes = function (ctx) {
    var db = data.db, today = data.today(), from = data.addDays(today, -27);
    var grid = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3' });
    db.routes.forEach(function (r) {
      var markets = db.markets.filter(function (m) { return m.RouteId === r.Id; });
      var st = data.summarize(data.logsBetween(from, today, { routeId: r.Id }));
      var scheduled = new Set(data.templates().filter(function (t) { return markets.some(function (m) { return m.Id === t.MarketId; }); }).map(function (t) { return t.MarketId; }));
      var c = st.completion;
      var tone = c == null ? 'ghost' : c >= 0.85 ? 'success' : c >= 0.7 ? 'warning' : 'error';
      var label = c == null ? 'No visits' : c >= 0.85 ? 'Healthy' : c >= 0.7 ? 'Watch' : 'At risk';
      var mgr = data.idx.managers.get(r.CreatedByManagerId);
      grid.append(h('button', { type: 'button', class: 'rw-card p-4 text-start hover:border-primary transition-colors flex flex-col gap-2', on: { click: function () { openRoute(r, markets, scheduled, st); } } },
        h('div', { class: 'flex items-center justify-between gap-2' }, h('span', { class: 'font-mono text-xs font-bold text-primary', text: r.Code }), ui.badge(label, tone)),
        h('p', { class: 'font-bold', text: r.Name }),
        h('p', { class: 'text-xs rw-muted', text: r.Description }),
        h('div', { class: 'flex items-baseline gap-1 mt-auto' }, h('span', { class: 'text-2xl font-extrabold num', text: fmt.pct(c) }), h('span', { class: 'text-xs rw-muted', text: 'completion' })),
        h('p', { class: 'text-xs rw-muted num', text: markets.length + ' markets · ' + scheduled.size + ' scheduled · ' + (mgr ? mgr.Name : '') })));
    });

    function openRoute(r, markets, scheduled, st) {
      ui.drawer(r.Code + ' · ' + r.Name, [
        h('p', { class: 'text-sm', text: r.Description }),
        h('div', { class: 'grid grid-cols-3 gap-3' }, [['Visited', fmt.num(st.visited)], ['Missed', fmt.num(st.missed)], ['On time', fmt.pct(st.onTimeRate)]].map(function (k) {
          return h('div', { class: 'rw-card p-3' }, h('p', { class: 'rw-kpi-label', text: k[0] }), h('p', { class: 'text-xl font-extrabold num', text: k[1] }));
        })),
        h('ul', { class: 'divide-y divide-base-300 text-sm' }, markets.map(function (m) {
          return h('li', { class: 'flex items-center gap-2 py-2' },
            h('span', { class: 'font-mono text-xs w-16', text: m.Code }),
            h('span', { class: 'flex-1 truncate', text: m.Name }),
            scheduled.has(m.Id) ? ui.badge('Scheduled', 'success') : ui.badge('Unscheduled'));
        })),
        h('a', { href: '#/markets?route=' + r.Id, class: 'btn btn-outline btn-sm w-full', text: 'Open in Markets' }),
      ], markets.length + ' markets');
    }

    ctx.el.append(
      ui.pageHeader({ title: 'Routes', subtitle: 'Route health based on visit completion over the last 4 weeks (≥85% healthy, ≥70% watch).' }),
      grid);
  };
})();
