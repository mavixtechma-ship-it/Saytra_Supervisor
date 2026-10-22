/* Live visits (status board): summary bar → per-supervisor stop grid → check-in timeline + missed list. */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};

  RW.views.visits = function (ctx) {
    var today = data.today();
    var lastUpdated = new Date();
    var root = h('div');
    ctx.el.append(root);

    function draw() {
      var logs = data.logsBetween(today, today);
      var st = data.summarize(logs);
      var refresh = ui.button('Refresh', { class: 'btn-outline', icon: 'refresh', onClick: function () { lastUpdated = new Date(); draw(); ui.toast('Live board refreshed.', 'info'); } });
      var simulate = ctx.admin ? ui.button('Simulate check-in', { class: 'btn-primary', icon: 'play', title: 'Demo: marks the next pending stop as visited (memory only)', onClick: function () {
        var l = data.simulateCheckIn();
        if (!l) { ui.toast('No pending stops left today.', 'info'); return; }
        lastUpdated = new Date(); draw();
        var m = data.idx.markets.get(l.MarketId);
        ui.toast(data.idx.supervisors.get(l.SupervisorId).Name + ' checked in at ' + (m ? m.Name : 'market') + '.');
      } }) : null;

      var summary = h('div', { class: 'rw-card p-4 flex flex-wrap items-center gap-x-8 gap-y-3' },
        [['Visited', st.visited, 'text-success'], ['Pending', st.pending, ''], ['Missed', st.missed, 'text-error'], ['Planned', st.planned, '']].map(function (k) {
          return h('div', null, h('p', { class: 'rw-kpi-label', text: k[0] }), h('p', { class: 'text-3xl font-extrabold num ' + k[2], text: fmt.num(k[1]) }));
        }),
        h('div', { class: 'flex-1 min-w-48' }, h('p', { class: 'rw-kpi-label mb-1', text: 'Day progress' }), ui.progress(st.planned ? st.visited / st.planned : 0, 'primary'),
          h('p', { class: 'text-xs rw-muted mt-1', text: 'Last updated ' + lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · demo data for ' + fmt.day(today) })));

      // status grid per supervisor
      var grid = h('div', { class: 'grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3' });
      data.db.supervisors.forEach(function (s) {
        var mine = logs.filter(function (l) { return l.SupervisorId === s.Id; }).sort(function (a, b) { return a.OrderInDay - b.OrderInDay; });
        var done = mine.filter(function (l) { return l.Status === 'Visited'; }).length;
        var next = mine.find(function (l) { return l.Status === 'Pending'; });
        var nextM = next ? data.idx.markets.get(next.MarketId) : null;
        grid.append(h('div', { class: 'rw-card p-3 flex flex-col gap-2' },
          h('div', { class: 'flex items-center gap-2' }, ui.avatar(s.Name, 'sm'), h('span', { class: 'font-semibold text-sm flex-1 truncate', text: s.Name }), h('span', { class: 'text-xs num rw-muted', text: done + '/' + mine.length })),
          mine.length ? h('div', { class: 'flex flex-wrap gap-1', role: 'list', 'aria-label': 'Stops today' }, mine.map(function (l) {
            var m = data.idx.markets.get(l.MarketId);
            return h('span', { class: 'rw-stop-dot', role: 'listitem', dataset: { s: l.Status }, title: '#' + l.OrderInDay + ' ' + (m ? m.Name : '') + ' — ' + l.Status, 'aria-label': '#' + l.OrderInDay + ' ' + l.Status });
          })) : h('p', { class: 'text-xs rw-muted', text: 'No stops today' }),
          h('p', { class: 'text-xs rw-muted truncate', text: nextM ? 'Next: ' + nextM.Name + ' · ' + fmt.hours(8.5 + (next.OrderInDay - 1) * 1.25) : (mine.length ? 'Route complete' : '—') })));
      });

      // timeline
      var checkins = logs.filter(function (l) { return l.CheckInTime; }).sort(function (a, b) { return b.CheckInTime.localeCompare(a.CheckInTime); });
      var timeline = checkins.length ? h('ul', { class: 'timeline timeline-vertical timeline-compact' }, checkins.map(function (l, i) {
        var m = data.idx.markets.get(l.MarketId);
        return h('li', null,
          i ? h('hr', { class: 'bg-base-300' }) : null,
          h('div', { class: 'timeline-middle text-success' }, ui.icon('check', 16)),
          h('div', { class: 'timeline-end mb-4' },
            h('time', { class: 'text-xs font-mono rw-muted', text: fmt.time(l.CheckInTime) }),
            h('p', { class: 'text-sm font-semibold', text: (m ? m.Name : 'Market') }),
            h('p', { class: 'text-xs rw-muted flex items-center gap-2' }, h('span', { text: data.idx.supervisors.get(l.SupervisorId).Name }), ui.badge(l.IsOnTime ? 'On time' : 'Late'))),
          i < checkins.length - 1 ? h('hr', { class: 'bg-base-300' }) : null);
      })) : ui.empty('No check-ins yet today.', 'clock');

      // missed last 7 days
      var missed = data.logsBetween(data.addDays(today, -6), today).filter(function (l) { return l.Status === 'Missed'; })
        .sort(function (a, b) { return b.VisitDate.localeCompare(a.VisitDate); });
      var missedList = missed.length ? h('ul', { class: 'divide-y divide-base-300' }, missed.slice(0, 12).map(function (l) {
        var m = data.idx.markets.get(l.MarketId);
        return h('li', { class: 'px-4 py-2 text-sm flex items-center gap-3' },
          h('span', { class: 'w-24 text-xs rw-muted', text: fmt.day(l.VisitDate) }),
          h('div', { class: 'flex-1 min-w-0' }, h('p', { class: 'font-semibold truncate', text: m ? m.Name : '—' }), h('p', { class: 'text-xs rw-muted truncate', text: data.idx.supervisors.get(l.SupervisorId).Name + ' · ' + (l.Notes || 'No reason given') })));
      })) : ui.empty('No missed visits in the last 7 days.', 'check');

      root.replaceChildren(
        ui.pageHeader({ title: 'Live visits', subtitle: 'Today\'s field activity by supervisor.', actions: [simulate, refresh] }),
        summary,
        h('div', { class: 'mt-4' }, grid),
        h('div', { class: 'grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4' },
          ui.card({ title: 'Check-in timeline', subtitle: fmt.num(checkins.length) + ' check-ins today', class: 'xl:col-span-7', body: timeline }),
          ui.card({ title: 'Missed in the last 7 days', subtitle: fmt.num(missed.length) + ' visits', class: 'xl:col-span-5', bodyClass: 'p-0', body: missedList })));
    }
    draw();
  };
})();
