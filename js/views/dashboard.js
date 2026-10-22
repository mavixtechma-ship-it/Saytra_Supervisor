/* Overview (bento): KPI strip → daily trend + plan list → leaderboard + today's schedule. */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};

  function dayPattern(supId) {
    var days = new Set(data.templates(null, supId).filter(function (t) {
      var p = data.idx.plans.get(t.JourneyPlanId); return p && p.Status === 'Active';
    }).map(function (t) { return t.DayOfWeek; }));
    return h('div', { class: 'flex gap-0.5', 'aria-label': 'Working days' },
      data.DAYS.concat(['FRI']).map(function (d) {
        var on = days.has(d);
        return h('span', { class: 'w-5 h-5 rounded text-[0.55rem] font-bold grid place-items-center ' + (on ? 'bg-primary/15 text-primary' : 'bg-base-200 rw-muted'), title: d + (on ? ' · scheduled' : ' · off'), text: d.charAt(0) + (d === 'SUN' || d === 'THU' ? d.charAt(1).toLowerCase() : '') });
      }));
  }

  RW.views.dashboard = function (ctx) {
    var db = data.db, today = data.today();
    var ws = data.weekStart(today);
    var week = data.summarize(data.logsBetween(ws, today));
    var prevWeek = data.summarize(data.logsBetween(data.addDays(ws, -7), data.addDays(today, -7)));
    var active = db.journeyPlans.filter(function (p) { return p.Status === 'Active'; });
    var covered = new Set();
    active.forEach(function (p) { data.planMarketIds(p.Id).forEach(function (m) { covered.add(m); }); });

    var kpis = h('div', { class: 'grid grid-cols-2 xl:grid-cols-4 gap-4' },
      ui.kpiTile({ label: 'Active journey plans', value: fmt.num(active.length), icon: 'calendar', sub: fmt.num(covered.size) + ' of ' + fmt.num(db.markets.length) + ' markets covered' }),
      ui.kpiTile({ label: 'Visit completion · this week', value: fmt.pct(week.completion), progress: week.completion, sub: ui.delta(week.completion, prevWeek.completion) }),
      ui.kpiTile({ label: 'Missed visits · this week', value: fmt.num(week.missed), valueClass: week.missed ? 'text-error' : '', icon: 'alert', sub: ui.delta(week.missed, prevWeek.missed, true) }),
      ui.kpiTile({ label: 'On-time check-ins', value: fmt.pct(week.onTimeRate), icon: 'clock', sub: fmt.num(week.onTime) + ' of ' + fmt.num(week.visited) + ' visits within 30 min of slot' }));

    // trend (28 days)
    var trendCard = ui.card({ title: 'Daily visits', subtitle: 'Last 4 weeks · visited vs missed', class: 'xl:col-span-8' });
    var labels = [], visited = [], missed = [];
    for (var i = 27; i >= 0; i--) {
      var d = data.addDays(today, -i);
      if (data.dayCode(d) === 'FRI') continue;
      var s = data.summarize(data.logsBetween(d, d));
      labels.push(fmt.day(d)); visited.push(s.visited); missed.push(s.missed);
    }
    var destroyTrend = RW.charts.chart(trendCard.body, function (p) {
      return {
        type: 'line', ariaLabel: 'Line chart of visited and missed visits per day over the last four weeks',
        data: { labels: labels, datasets: [
          { label: 'Visited', data: visited, borderColor: p.primary, backgroundColor: p.primary + '22', fill: true, tension: 0.35, pointRadius: 2 },
          { label: 'Missed', data: missed, borderColor: p.err, backgroundColor: p.err, tension: 0.35, pointRadius: 2, borderDash: [4, 3] },
        ] },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
      };
    }, 280);

    // plan list
    var planList = h('ul', { class: 'divide-y divide-base-300' });
    db.journeyPlans.slice().sort(function (a, b) { return (a.Status === 'Active' ? 0 : 1) - (b.Status === 'Active' ? 0 : 1) || b.UpdatedAt.localeCompare(a.UpdatedAt); })
      .forEach(function (p) {
        var sups = data.planSupervisorIds(p.Id).length, mk = data.planMarketIds(p.Id).size;
        planList.append(h('li', null, h('a', { href: '#/plans/' + p.Id, class: 'flex items-center gap-3 px-4 py-3 hover:bg-base-200' },
          h('div', { class: 'flex-1 min-w-0' },
            h('p', { class: 'font-semibold text-sm truncate', text: p.Name }),
            h('p', { class: 'text-xs rw-muted', text: fmt.num(mk) + ' markets · ' + sups + ' supervisor' + (sups === 1 ? '' : 's') })),
          ui.badge(p.Status))));
      });
    var plansCard = ui.card({ title: 'Journey plans', class: 'xl:col-span-4', bodyClass: 'p-0', body: planList,
      actions: h('a', { href: '#/plans', class: 'btn btn-ghost btn-xs', text: 'View all' }) });

    // leaderboard
    var board = h('ol', { class: 'divide-y divide-base-300' });
    db.supervisors.map(function (s) {
      return { s: s, st: data.summarize(data.logsBetween(ws, today, { supervisorId: s.Id })) };
    }).sort(function (a, b) { return (b.st.completion || 0) - (a.st.completion || 0); }).forEach(function (r, i) {
      board.append(h('li', { class: 'flex items-center gap-3 px-4 py-2.5' },
        h('span', { class: 'w-5 text-xs font-bold rw-muted num', text: String(i + 1) }),
        ui.avatar(r.s.Name, 'sm'),
        h('div', { class: 'flex-1 min-w-0' },
          h('p', { class: 'text-sm font-semibold truncate', text: r.s.Name }),
          dayPattern(r.s.Id)),
        h('div', { class: 'w-24' }, ui.progress(r.st.completion),
          h('p', { class: 'text-[0.7rem] text-right rw-muted num', text: fmt.pct(r.st.completion) + ' · ' + r.st.visited + '/' + (r.st.visited + r.st.missed) }))));
    });
    var boardCard = ui.card({ title: 'Supervisor leaderboard', subtitle: 'Completion this week', class: 'xl:col-span-5', bodyClass: 'p-0', body: board });

    // today's schedule
    var supSel = ui.select([{ value: '', label: 'All supervisors' }].concat(db.supervisors.map(function (s) { return { value: s.Id, label: s.Name }; })), '', { 'aria-label': 'Filter by supervisor' });
    function todayRows() {
      var sid = Number(supSel.value) || null;
      return data.logsBetween(today, today, sid ? { supervisorId: sid } : null);
    }
    var table = ui.dataTable({
      rows: todayRows(), pageSize: 8, sortKey: 'order',
      columns: [
        { key: 'sup', label: 'Supervisor', sort: function (r) { return data.idx.supervisors.get(r.SupervisorId).Name; }, render: function (r) { return data.idx.supervisors.get(r.SupervisorId).Name; } },
        { key: 'order', label: '#', align: 'right', sort: function (r) { return r.OrderInDay; }, render: function (r) { return r.OrderInDay; } },
        { key: 'market', label: 'Market', render: function (r) { var m = data.idx.markets.get(r.MarketId); return m ? m.Name : '—'; } },
        { key: 'route', label: 'Route', render: function (r) { var m = data.idx.markets.get(r.MarketId); return m ? data.idx.routes.get(m.RouteId).Code : '—'; } },
        { key: 'slot', label: 'Slot', align: 'right', render: function (r) { return fmt.hours(8.5 + (r.OrderInDay - 1) * 1.25); } },
        { key: 'status', label: 'Status', sort: function (r) { return r.Status; }, render: function (r) { return ui.badge(r.Status); } },
      ],
    });
    supSel.addEventListener('change', function () { table.update(todayRows()); });
    var schedCard = ui.card({ title: "Today's schedule", subtitle: fmt.day(today), class: 'xl:col-span-7', bodyClass: 'p-0', body: table, actions: supSel });

    ctx.el.append(
      ui.pageHeader({ title: 'Good to see you', subtitle: 'Week of ' + fmt.date(ws) + ' · data as of ' + fmt.date(today),
        actions: ctx.admin ? h('a', { href: '#/plans?new=1', class: 'btn btn-primary btn-sm' }, ui.icon('plus', 16), 'New plan') : null }),
      kpis,
      h('div', { class: 'grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4' }, trendCard, plansCard, boardCard, schedCard));
    return function () { destroyTrend(); };
  };
})();
