/* Journey plans: list (table-first) + detail (header + tabs: weekly grid / KPI tasks / visit logs). */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};

  function planForm(plan) {
    var db = data.db;
    var name = h('input', { name: 'Name', class: 'input input-bordered input-sm w-full', required: true, minlength: 3, maxlength: 80, value: plan ? plan.Name : '', autocomplete: 'off' });
    var status = ui.select(data.PLAN_STATUSES.map(function (s) { return { value: s, label: s }; }), plan ? plan.Status : 'Draft', { name: 'Status', class: 'select select-bordered select-sm w-full' });
    var supIds = plan ? data.planSupervisorIds(plan.Id) : [];
    var taskIds = plan ? data.planTaskIds(plan.Id) : [];
    ui.modal({
      title: plan ? 'Edit journey plan' : 'New journey plan',
      submitLabel: plan ? 'Save changes' : 'Create plan',
      body: [
        ui.field('Plan name', name, '3–80 characters'),
        ui.field('Status', status),
        ui.field('Supervisors', ui.checkboxList('sup', db.supervisors.map(function (s) { return { Id: s.Id, label: s.Name }; }), supIds), plan ? 'Removing a supervisor also removes their weekly template.' : null),
        ui.field('KPI tasks', ui.checkboxList('task', db.kpiTasks.map(function (k) { return { Id: k.Id, label: k.Title }; }), taskIds)),
      ],
      onSubmit: function (fd) {
        var saved = data.savePlan({
          Id: plan ? plan.Id : null, Name: fd.get('Name'), Status: fd.get('Status'),
          supervisorIds: fd.getAll('sup').map(Number), taskIds: fd.getAll('task').map(Number),
        });
        ui.toast(plan ? 'Plan updated.' : 'Plan created.');
        if (!plan) window.location.hash = '#/plans/' + saved.Id; else RW.app.render();
      },
    });
  }

  // ---------------- list ----------------
  RW.views.plans = function (ctx) {
    var db = data.db;
    var q = ctx.query;
    var search = h('input', { type: 'search', class: 'input input-bordered input-sm w-full sm:w-64', placeholder: 'Search plans…', maxlength: 60, 'aria-label': 'Search plans', value: (q.get('q') || '').slice(0, 60) });
    var statusVal = data.PLAN_STATUSES.indexOf(q.get('status')) > -1 ? q.get('status') : '';
    var status = ui.select([{ value: '', label: 'All statuses' }].concat(data.PLAN_STATUSES.map(function (s) { return { value: s, label: s }; })), statusVal, { 'aria-label': 'Filter by status' });

    function rows() {
      var term = search.value.trim().toLowerCase();
      return db.journeyPlans.filter(function (p) {
        return (!status.value || p.Status === status.value) && (!term || p.Name.toLowerCase().indexOf(term) > -1);
      });
    }
    var table = ui.dataTable({
      rows: rows(), sortKey: 'updated', sortDir: -1, pageSize: 10,
      onRowClick: function (p) { window.location.hash = '#/plans/' + p.Id; },
      columns: [
        { key: 'name', label: 'Plan', sort: function (p) { return p.Name; }, render: function (p) { return h('span', { class: 'font-semibold', text: p.Name }); } },
        { key: 'status', label: 'Status', sort: function (p) { return p.Status; }, render: function (p) { return ui.badge(p.Status); } },
        { key: 'sups', label: 'Supervisors', render: function (p) {
          return h('div', { class: 'flex -space-x-2' }, data.planSupervisorIds(p.Id).map(function (id) {
            var s = data.idx.supervisors.get(id); var a = ui.avatar(s.Name, 'sm'); a.title = s.Name; a.classList.add('ring-2', 'ring-base-100'); return a;
          }));
        } },
        { key: 'markets', label: 'Markets', align: 'right', sort: function (p) { return data.planMarketIds(p.Id).size; }, render: function (p) { return fmt.num(data.planMarketIds(p.Id).size); } },
        { key: 'stops', label: 'Stops / week', align: 'right', sort: function (p) { return data.templates(p.Id).length; }, render: function (p) { return fmt.num(data.templates(p.Id).length); } },
        { key: 'tasks', label: 'KPI tasks', align: 'right', render: function (p) { return data.planTaskIds(p.Id).length; } },
        { key: 'updated', label: 'Updated', sort: function (p) { return p.UpdatedAt; }, render: function (p) { return fmt.date(p.UpdatedAt); } },
      ],
    });
    function sync() {
      table.update(rows());
      var params = new URLSearchParams();
      if (search.value.trim()) params.set('q', search.value.trim());
      if (status.value) params.set('status', status.value);
      var target = '#/plans' + (params.toString() ? '?' + params.toString() : '');
      if (window.location.hash !== target) history.replaceState(null, '', target);
    }
    search.addEventListener('input', sync);
    status.addEventListener('change', sync);

    var counts = {};
    db.journeyPlans.forEach(function (p) { counts[p.Status] = (counts[p.Status] || 0) + 1; });
    var summary = h('div', { class: 'flex flex-wrap gap-2' }, data.PLAN_STATUSES.map(function (s) {
      return h('button', { type: 'button', class: 'btn btn-sm ' + (status.value === s ? 'btn-primary' : 'btn-outline'), on: { click: function () { status.value = status.value === s ? '' : s; sync(); RW.app.render(); } } },
        s, h('span', { class: 'badge badge-sm num', text: String(counts[s] || 0) }));
    }));

    ctx.el.append(
      ui.pageHeader({ title: 'Journey plans', subtitle: 'Weekly visit templates that assign supervisors to markets.',
        actions: ctx.admin ? ui.button('New plan', { class: 'btn-primary', icon: 'plus', onClick: function () { planForm(null); } }) : null }),
      h('div', { class: 'mb-4' }, summary),
      ui.card({ bodyClass: 'p-0', body: [h('div', { class: 'flex flex-wrap gap-2 p-3 border-b border-base-300' }, search, status), table] }));
    if (ctx.admin && q.get('new') === '1') { history.replaceState(null, '', '#/plans'); planForm(null); }
  };

  // ---------------- detail ----------------
  RW.views.planDetail = function (ctx) {
    var planId = Number(ctx.params[0]);
    var plan = data.idx.plans.get(planId);
    if (!plan) {
      ctx.el.append(ui.card({ body: ui.empty('This journey plan does not exist (it may have been deleted).', 'alert', h('a', { href: '#/plans', class: 'btn btn-sm btn-primary', text: 'Back to plans' })) }));
      return;
    }
    ctx.setTitle(plan.Name);
    var supIds = data.planSupervisorIds(planId);
    var mgr = data.idx.managers.get(plan.CreatedByManagerId);
    var active = { tab: ctx.query.get('tab') || 'grid', sup: Number(ctx.query.get('sup')) || supIds[0] || null };
    if (supIds.indexOf(active.sup) === -1) active.sup = supIds[0] || null;

    var facts = h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-4 mt-4' }, [
      ['Supervisors', fmt.num(supIds.length)], ['Markets', fmt.num(data.planMarketIds(planId).size)],
      ['Stops per week', fmt.num(data.templates(planId).length)], ['Created by', mgr ? mgr.Name : '—'],
    ].map(function (f) { return h('div', null, h('p', { class: 'rw-kpi-label', text: f[0] }), h('p', { class: 'text-lg font-bold num', text: f[1] })); }));

    var actions = ctx.admin ? [
      ui.button('Edit', { class: 'btn-outline', icon: 'edit', onClick: function () { planForm(plan); } }),
      ui.button('Delete', { class: 'btn-ghost text-error', icon: 'trash', onClick: function () {
        ui.confirm('Delete "' + plan.Name + '" and its weekly templates? Visit history is kept.', function () {
          data.deletePlan(planId); ui.toast('Plan deleted.'); window.location.hash = '#/plans';
        });
      } }),
    ] : null;

    var header = ui.card({ body: [
      h('div', { class: 'flex flex-wrap items-start gap-3' },
        h('a', { href: '#/plans', class: 'btn btn-ghost btn-sm btn-square', 'aria-label': 'Back to plans' }, ui.icon('back', 18)),
        h('div', { class: 'flex-1 min-w-0' },
          h('div', { class: 'flex flex-wrap items-center gap-2' }, h('h1', { class: 'text-2xl font-extrabold tracking-tight', text: plan.Name }), ui.badge(plan.Status)),
          h('p', { class: 'text-sm rw-muted', text: 'Created ' + fmt.date(plan.CreatedAt) + ' · updated ' + fmt.date(plan.UpdatedAt) })),
        actions ? h('div', { class: 'flex gap-2' }, actions) : null),
      facts] });

    var tabs = [['grid', 'Weekly grid'], ['tasks', 'KPI tasks'], ['logs', 'Visit logs']];
    var tabBar = h('div', { role: 'tablist', class: 'tabs tabs-bordered w-fit mt-6 mb-4' });
    var panel = h('div', { role: 'tabpanel' });
    var destroy = null;
    function showTab(id) {
      active.tab = id;
      tabBar.replaceChildren.apply(tabBar, tabs.map(function (t) {
        return h('button', { type: 'button', role: 'tab', class: 'tab font-semibold' + (t[0] === id ? ' tab-active' : ''), 'aria-selected': String(t[0] === id), on: { click: function () { showTab(t[0]); } } }, t[1]);
      }));
      panel.replaceChildren();
      if (destroy) { destroy(); destroy = null; }
      if (id === 'grid') renderGrid();
      else if (id === 'tasks') renderTasks();
      else renderLogs();
      var params = new URLSearchParams(); params.set('tab', id); if (active.sup) params.set('sup', active.sup);
      history.replaceState(null, '', '#/plans/' + planId + '?' + params.toString());
    }

    function renderGrid() {
      if (!supIds.length) { panel.append(ui.card({ body: ui.empty('No supervisors assigned yet.' + (ctx.admin ? ' Use Edit to assign one.' : '')) })); return; }
      var picker = h('div', { class: 'join flex-wrap' }, supIds.map(function (id) {
        var s = data.idx.supervisors.get(id);
        return h('button', { type: 'button', class: 'btn btn-sm join-item ' + (id === active.sup ? 'btn-primary' : 'btn-outline'), 'aria-pressed': String(id === active.sup), on: { click: function () { active.sup = id; showTab('grid'); } } }, s.Name);
      }));
      var stops = data.templates(planId, active.sup);
      var week = h('div', { class: 'rw-week' });
      data.DAYS.forEach(function (day) {
        var list = stops.filter(function (t) { return t.DayOfWeek === day; }).sort(function (a, b) { return a.OrderInDay - b.OrderInDay; });
        var col = h('div', { class: 'rw-day' },
          h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'font-extrabold text-sm', text: day }), h('span', { class: 'badge badge-sm badge-ghost num', text: list.length + ' stops' })));
        if (!list.length) col.append(h('p', { class: 'text-xs rw-muted py-2', text: 'No visits planned' }));
        list.forEach(function (t, i) {
          var m = data.idx.markets.get(t.MarketId);
          var r = m ? data.idx.routes.get(m.RouteId) : null;
          var row = h('div', { class: 'rw-stop' },
            h('div', { class: 'flex items-center gap-2' },
              h('span', { class: 'rw-stop-order num', text: String(t.OrderInDay) }),
              h('p', { class: 'font-semibold truncate flex-1 min-w-0', title: m ? m.Name : '', text: m ? m.Name : 'Unknown market' })),
            h('p', { class: 'text-[0.7rem] rw-muted mt-1', text: (r ? r.Code : '') + ' · ' + (m ? m.VisitFrequency : '') + ' · ' + fmt.hours(8.5 + (t.OrderInDay - 1) * 1.25) }));
          if (ctx.admin) {
            row.append(h('div', { class: 'flex justify-end gap-0.5 mt-1 -mb-1' },
              h('button', { type: 'button', class: 'btn btn-ghost btn-xs btn-square' + (i === 0 ? ' invisible' : ''), 'aria-label': 'Move up', disabled: i === 0, on: { click: function () { data.moveStop(t.Id, -1); RW.app.render(); } } }, ui.icon('up', 14)),
              h('button', { type: 'button', class: 'btn btn-ghost btn-xs btn-square' + (i === list.length - 1 ? ' invisible' : ''), 'aria-label': 'Move down', disabled: i === list.length - 1, on: { click: function () { data.moveStop(t.Id, 1); RW.app.render(); } } }, ui.icon('down', 14)),
              h('button', { type: 'button', class: 'btn btn-ghost btn-xs btn-square text-error', 'aria-label': 'Remove stop', on: { click: function () { data.removeStop(t.Id); ui.toast('Stop removed.'); RW.app.render(); } } }, ui.icon('x', 14))));
          }
          col.append(row);
        });
        if (ctx.admin) col.append(h('button', { type: 'button', class: 'btn btn-ghost btn-xs mt-auto border-dashed border-base-300', on: { click: function () { addStopDialog(day); } } }, ui.icon('plus', 14), 'Add market'));
        week.append(col);
      });
      week.append(h('div', { class: 'rw-day rw-day-off items-center justify-center text-center' }, h('span', { class: 'font-extrabold text-sm', text: 'FRI' }), h('span', { class: 'text-xs rw-muted', text: 'Off day' })));
      panel.append(ui.card({ title: 'Weekly template', subtitle: ctx.admin ? 'Reorder, remove or add stops. Changes are saved in this browser.' : 'Read-only view.', actions: picker, body: week }));
    }

    function addStopDialog(day) {
      var db = data.db;
      var planRoutes = new Set(data.templates(planId).map(function (t) { var m = data.idx.markets.get(t.MarketId); return m ? m.RouteId : null; }));
      var taken = new Set(data.templates(planId, active.sup).filter(function (t) { return t.DayOfWeek === day; }).map(function (t) { return t.MarketId; }));
      var filter = h('input', { type: 'search', class: 'input input-bordered input-sm w-full', placeholder: 'Filter markets…', maxlength: 40, 'aria-label': 'Filter markets' });
      var sel = h('select', { name: 'market', class: 'select select-bordered select-sm w-full', size: 8, required: true, 'aria-label': 'Market' });
      function fill() {
        var term = filter.value.trim().toLowerCase();
        sel.replaceChildren();
        db.routes.slice().sort(function (a, b) { return (planRoutes.has(b.Id) ? 1 : 0) - (planRoutes.has(a.Id) ? 1 : 0) || a.Id - b.Id; }).forEach(function (r) {
          var group = h('optgroup', { label: r.Code + ' · ' + r.Name });
          db.markets.filter(function (m) { return m.RouteId === r.Id && !taken.has(m.Id) && (!term || (m.Name + ' ' + m.Code).toLowerCase().indexOf(term) > -1); })
            .forEach(function (m) { group.append(h('option', { value: m.Id, text: m.Name + ' (' + m.Code + ')' })); });
          if (group.children.length) sel.append(group);
        });
      }
      filter.addEventListener('input', fill);
      fill();
      ui.modal({
        title: 'Add market · ' + day + ' · ' + data.idx.supervisors.get(active.sup).Name,
        submitLabel: 'Add stop',
        body: [filter, ui.field('Market', sel, 'Routes already used by this plan are listed first.')],
        onSubmit: function (fd) {
          var id = Number(fd.get('market'));
          if (!id) throw new Error('Choose a market.');
          data.addStop(planId, active.sup, day, id);
          ui.toast('Stop added.');
          RW.app.render();
        },
      });
    }

    function renderTasks() {
      var linked = data.planTaskIds(planId);
      var logs = data.logsBetween(data.addDays(data.today(), -27), data.today(), { planId: planId });
      var stats = data.taskStats(logs);
      var list = h('ul', { class: 'divide-y divide-base-300' });
      data.db.kpiTasks.forEach(function (k) {
        var on = linked.indexOf(k.Id) > -1;
        var st = stats.get(k.Id);
        var control = ctx.admin
          ? h('input', { type: 'checkbox', class: 'toggle toggle-primary toggle-sm', checked: on, 'aria-label': 'Include ' + k.Title, on: { change: function (e) {
            var next = data.planTaskIds(planId).filter(function (x) { return x !== k.Id; });
            if (e.target.checked) next.push(k.Id);
            data.setPlanTasks(planId, next); ui.toast('KPI tasks updated.'); RW.app.render();
          } } })
          : (on ? ui.badge('Included', 'success') : ui.badge('Not included'));
        list.append(h('li', { class: 'flex items-center gap-4 px-4 py-3' + (on ? '' : ' opacity-70') },
          h('div', { class: 'flex-1 min-w-0' }, h('p', { class: 'font-semibold text-sm', text: k.Title }), h('p', { class: 'text-xs rw-muted', text: k.Description })),
          h('div', { class: 'w-36 hidden sm:block' }, st ? [ui.progress(st.done / st.total), h('p', { class: 'text-[0.7rem] text-right rw-muted num', text: fmt.pct(st.done / st.total) + ' of ' + fmt.num(st.total) + ' checks' })] : h('p', { class: 'text-xs rw-muted text-right', text: 'No checks yet' })),
          control));
      });
      panel.append(ui.card({ title: 'KPI tasks on this plan', subtitle: 'Completion over the last 4 weeks', bodyClass: 'p-0', body: list }));
    }

    function renderLogs() {
      var all = data.logsBetween(data.addDays(data.today(), -27), data.today(), { planId: planId });
      var st = h('select', { class: 'select select-bordered select-sm', 'aria-label': 'Filter by status' },
        ['', 'Visited', 'Missed', 'Pending'].map(function (s) { return h('option', { value: s, text: s || 'All statuses' }); }));
      var table = ui.dataTable({
        rows: all, sortKey: 'date', sortDir: -1, pageSize: 12,
        columns: [
          { key: 'date', label: 'Date', sort: function (l) { return l.VisitDate + String(l.OrderInDay).padStart(2, '0'); }, render: function (l) { return fmt.day(l.VisitDate); } },
          { key: 'sup', label: 'Supervisor', render: function (l) { return data.idx.supervisors.get(l.SupervisorId).Name; } },
          { key: 'market', label: 'Market', render: function (l) { var m = data.idx.markets.get(l.MarketId); return m ? m.Name : '—'; } },
          { key: 'checkin', label: 'Check-in', align: 'right', render: function (l) { return fmt.time(l.CheckInTime); } },
          { key: 'ontime', label: 'Timing', render: function (l) { return l.IsOnTime == null ? '—' : ui.badge(l.IsOnTime ? 'On time' : 'Late'); } },
          { key: 'status', label: 'Status', sort: function (l) { return l.Status; }, render: function (l) { return ui.badge(l.Status); } },
          { key: 'notes', label: 'Notes', render: function (l) { return h('span', { class: 'text-xs rw-muted', text: l.Notes || '' }); } },
        ],
        empty: plan.Status === 'Active' ? 'No visits logged yet.' : 'Only active plans generate visit logs.',
      });
      st.addEventListener('change', function () { table.update(all.filter(function (l) { return !st.value || l.Status === st.value; })); });
      panel.append(ui.card({ title: 'Visit logs', subtitle: 'Last 4 weeks', bodyClass: 'p-0', actions: st, body: table }));
    }

    ctx.el.append(header, tabBar, panel);
    showTab(['grid', 'tasks', 'logs'].indexOf(active.tab) > -1 ? active.tab : 'grid');
    return function () { if (destroy) destroy(); };
  };
})();
