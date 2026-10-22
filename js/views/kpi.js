/* KPI tasks: summary tiles + task table (admin can add / edit tasks). */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};

  function taskForm(task) {
    var title = h('input', { name: 'Title', class: 'input input-bordered input-sm w-full', required: true, minlength: 3, maxlength: 60, value: task ? task.Title : '', autocomplete: 'off' });
    var desc = h('textarea', { name: 'Description', class: 'textarea textarea-bordered textarea-sm w-full', maxlength: 200, rows: 3 });
    desc.value = task ? task.Description : '';
    ui.modal({
      title: task ? 'Edit KPI task' : 'New KPI task', submitLabel: task ? 'Save changes' : 'Create task',
      body: [ui.field('Title', title, '3–60 characters'), ui.field('Description', desc, 'Up to 200 characters')],
      onSubmit: function (fd) {
        data.saveKpiTask({ Id: task ? task.Id : null, Title: fd.get('Title'), Description: fd.get('Description') });
        ui.toast(task ? 'Task updated.' : 'Task created. Link it to plans from a plan\'s KPI tab.');
        RW.app.render();
      },
    });
  }

  RW.views.kpi = function (ctx) {
    var db = data.db, today = data.today();
    var logs = data.logsBetween(data.addDays(today, -27), today);
    var stats = data.taskStats(logs);
    var rows = db.kpiTasks.map(function (k) {
      var s = stats.get(k.Id);
      var plans = db.journeyPlanKpiTasks.filter(function (x) { return x.KPITaskId === k.Id; }).map(function (x) { return data.idx.plans.get(x.JourneyPlanId); }).filter(Boolean);
      return { k: k, total: s ? s.total : 0, done: s ? s.done : 0, rate: s ? s.done / s.total : null, plans: plans };
    });
    var tot = rows.reduce(function (a, r) { return { total: a.total + r.total, done: a.done + r.done }; }, { total: 0, done: 0 });
    var ranked = rows.filter(function (r) { return r.rate != null; }).sort(function (a, b) { return b.rate - a.rate; });

    var table = ui.dataTable({
      rows: rows, sortKey: 'rate', sortDir: -1, pageSize: 10,
      columns: [
        { key: 'title', label: 'Task', sort: function (r) { return r.k.Title; }, render: function (r) { return h('div', null, h('p', { class: 'font-semibold', text: r.k.Title }), h('p', { class: 'text-xs rw-muted', text: r.k.Description })); } },
        { key: 'plans', label: 'Used in plans', render: function (r) {
          return r.plans.length ? h('div', { class: 'flex flex-wrap gap-1' }, r.plans.map(function (p) { return h('a', { href: '#/plans/' + p.Id + '?tab=tasks', class: 'badge badge-sm badge-outline badge-primary max-w-44 truncate', title: p.Name, text: p.Name }); })) : h('span', { class: 'text-xs rw-muted', text: 'Not linked' });
        } },
        { key: 'checks', label: 'Checks (4 wk)', align: 'right', sort: function (r) { return r.total; }, render: function (r) { return fmt.num(r.total); } },
        { key: 'rate', label: 'Completion', sort: function (r) { return r.rate; }, render: function (r) { return r.rate == null ? h('span', { class: 'text-xs rw-muted', text: 'No data' }) : h('div', { class: 'w-32' }, ui.progress(r.rate), h('span', { class: 'text-[0.7rem] num rw-muted', text: fmt.pct(r.rate) })); } },
        ctx.admin ? { key: 'act', label: '', render: function (r) { return ui.button(null, { class: 'btn-ghost btn-square btn-xs', icon: 'edit', aria: 'Edit ' + r.k.Title, onClick: function () { taskForm(r.k); } }); } } : null,
      ].filter(Boolean),
    });

    ctx.el.append(
      ui.pageHeader({ title: 'KPI tasks', subtitle: 'Checks supervisors complete at each market visit.',
        actions: ctx.admin ? ui.button('New task', { class: 'btn-primary', icon: 'plus', onClick: function () { taskForm(null); } }) : null }),
      h('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-4' },
        ui.kpiTile({ label: 'Overall task completion', value: fmt.pct(tot.total ? tot.done / tot.total : null), progress: tot.total ? tot.done / tot.total : 0, sub: fmt.num(tot.total) + ' checks in 4 weeks' }),
        ui.kpiTile({ label: 'Strongest task', value: ranked[0] ? fmt.pct(ranked[0].rate) : '—', icon: 'check', sub: ranked[0] ? ranked[0].k.Title : null }),
        ui.kpiTile({ label: 'Needs attention', value: ranked.length ? fmt.pct(ranked[ranked.length - 1].rate) : '—', icon: 'alert', valueClass: 'text-warning', sub: ranked.length ? ranked[ranked.length - 1].k.Title : null })),
      ui.card({ bodyClass: 'p-0', body: table }));
  };
})();
