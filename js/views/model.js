/* Data model: Mermaid ER diagram (pinned mermaid@11.4.1 + SRI) rendered from a constant definition,
   plus entity list with live record counts. */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};
  var renderSeq = 0;

  // Constant diagram source — never built from user data.
  var DIAGRAM = [
    'erDiagram',
    '  UnitManager { int Id PK string Name string Email string PasswordHash }',
    '  Supervisor { int Id PK string Name string Email string PasswordHash string Phone }',
    '  Route { int Id PK string Name string Description int CreatedByManagerId FK }',
    '  Market { int Id PK string Name string Location decimal Latitude decimal Longitude string VisitFrequency int RouteId FK }',
    '  JourneyPlan { int Id PK string Name string Status int CreatedByManagerId FK datetime CreatedAt datetime UpdatedAt }',
    '  JourneyPlanSupervisor { int Id PK int JourneyPlanId FK int SupervisorId FK }',
    '  WeeklyTemplate { int Id PK int JourneyPlanId FK int SupervisorId FK string DayOfWeek int MarketId FK int OrderInDay }',
    '  KPITask { int Id PK string Title string Description int CreatedByManagerId FK }',
    '  JourneyPlanKPITask { int Id PK int JourneyPlanId FK int KPITaskId FK }',
    '  VisitLog { int Id PK int WeeklyTemplateId FK int SupervisorId FK date VisitDate datetime CheckInTime decimal CheckInLat decimal CheckInLng string Status bool IsOnTime string Notes datetime CreatedAt }',
    '  TaskCompletion { int Id PK int VisitLogId FK int KPITaskId FK bool IsCompleted string Notes }',
    '  UnitManager ||--o{ Route : creates',
    '  UnitManager ||--o{ JourneyPlan : creates',
    '  UnitManager ||--o{ KPITask : defines',
    '  Route ||--o{ Market : contains',
    '  JourneyPlan ||--o{ JourneyPlanSupervisor : assigns',
    '  Supervisor ||--o{ JourneyPlanSupervisor : assigned_to',
    '  JourneyPlan ||--o{ WeeklyTemplate : has',
    '  Supervisor ||--o{ WeeklyTemplate : has',
    '  Market ||--o{ WeeklyTemplate : scheduled_in',
    '  JourneyPlan ||--o{ JourneyPlanKPITask : includes',
    '  KPITask ||--o{ JourneyPlanKPITask : linked_to',
    '  WeeklyTemplate ||--o{ VisitLog : generates',
    '  Supervisor ||--o{ VisitLog : logs',
    '  VisitLog ||--o{ TaskCompletion : tracks',
    '  KPITask ||--o{ TaskCompletion : evaluated_by',
  ].join('\n').replace(/\{ ([^}]*) \}/g, function (_, body) {
    // expand "type name [PK|FK] type name ..." into one attribute per line
    var tokens = body.split(' '), lines = [], cur = [];
    tokens.forEach(function (t) {
      if ((t === 'PK' || t === 'FK') && cur.length) { cur.push(t); return; }
      if (cur.length === 2 || cur.length === 3) { lines.push(cur.join(' ')); cur = []; }
      cur.push(t);
    });
    if (cur.length) lines.push(cur.join(' '));
    return '{\n    ' + lines.join('\n    ') + '\n  }';
  });

  var ENTITIES = [
    ['UnitManager', 'unitManagers', 'Owns routes, plans and KPI tasks.'],
    ['Supervisor', 'supervisors', 'Field user who visits markets.'],
    ['Route', 'routes', 'Named group of markets (RT-xxx).'],
    ['Market', 'markets', 'Outlet with coordinates and visit frequency.'],
    ['JourneyPlan', 'journeyPlans', 'Draft / Active / Completed / Archived plan.'],
    ['JourneyPlanSupervisor', 'journeyPlanSupervisors', 'Supervisors assigned to a plan.'],
    ['WeeklyTemplate', 'weeklyTemplates', 'Day + order of each market stop.'],
    ['KPITask', 'kpiTasks', 'Check performed during a visit.'],
    ['JourneyPlanKPITask', 'journeyPlanKpiTasks', 'Tasks required by a plan.'],
    ['VisitLog', 'visitLogs', 'Check-in record generated from a template.'],
    ['TaskCompletion', 'taskCompletions', 'Result of a KPI task on a visit.'],
  ];

  RW.views.model = function (ctx) {
    var db = data.db;
    var host = h('div', { class: 'rw-erd overflow-x-auto' }, ui.skeleton(8));
    var dead = false;

    ui.loadScript(RW.CDN.mermaid.url, RW.CDN.mermaid.sri).then(function () {
      if (dead) return;
      var mermaid = window.mermaid && (window.mermaid.default || window.mermaid);
      var v = function (n) { return ui.cssVar(n); };
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base',
        fontFamily: 'Manrope, Segoe UI, sans-serif',
        er: { useMaxWidth: false },
        themeVariables: {
          fontFamily: 'Manrope, Segoe UI, sans-serif', fontSize: '13px',
          primaryColor: v('--rw-erd-fill'), primaryBorderColor: v('--rw-erd-border'), primaryTextColor: v('--rw-erd-text'),
          lineColor: v('--rw-erd-line'), textColor: v('--rw-erd-text'), mainBkg: v('--rw-erd-fill'),
          attributeBackgroundColorOdd: v('--rw-erd-row'), attributeBackgroundColorEven: v('--rw-erd-fill'),
          background: 'transparent',
        },
      });
      renderSeq += 1;
      return mermaid.render('rw-erd-' + renderSeq, DIAGRAM).then(function (out) {
        if (dead) return;
        // Parse mermaid's (sanitised) SVG output with DOMParser and adopt the node — no HTML-string sinks on the page.
        var doc = new DOMParser().parseFromString(out.svg, 'text/html');
        var svg = doc.querySelector('svg');
        if (!svg) throw new Error('no svg');
        host.replaceChildren(document.adoptNode(svg));
      });
    }).catch(function () {
      if (!dead) host.replaceChildren(ui.empty('Diagram library could not be loaded (offline?). The entity list is still available.', 'database'));
    });

    var list = h('ul', { class: 'grid sm:grid-cols-2 xl:grid-cols-3 divide-base-300' }, ENTITIES.map(function (e) {
      var n = Array.isArray(db[e[1]]) ? db[e[1]].length : 0;
      return h('li', { class: 'flex items-start gap-3 px-4 py-2.5 border-b border-base-300' },
        h('div', { class: 'flex-1 min-w-0' }, h('p', { class: 'font-mono text-sm font-bold', text: e[0] }), h('p', { class: 'text-xs rw-muted', text: e[2] })),
        h('span', { class: 'badge badge-ghost num', text: fmt.num(n) }));
    }));

    ctx.el.append(
      ui.pageHeader({ title: 'Data model', subtitle: 'Entity-relationship model behind RouteWise. Mock JSON in data/ follows it 1:1.' }),
      h('div', { class: 'grid grid-cols-1 xl:grid-cols-12 gap-4' },
        ui.card({ title: 'ER diagram', subtitle: 'Rendered with Mermaid', class: 'xl:col-span-12', body: host }),
        ui.card({ title: 'Entities', subtitle: 'Record counts in the demo dataset', class: 'xl:col-span-12', bodyClass: 'p-0', body: list })));
    return function () { dead = true; };
  };
})();
