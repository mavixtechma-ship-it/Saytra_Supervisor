/* RouteWise data layer: loads data/*.json (fallback: js/data.bundle.js for file://),
   keeps admin edits in memory + localStorage, and exposes selectors used by the views. */
(function () {
  'use strict';
  var RW = (window.RW = window.RW || {});
  var FILES = ['meta', 'unitManagers', 'supervisors', 'routes', 'markets', 'journeyPlans', 'journeyPlanSupervisors',
    'weeklyTemplates', 'kpiTasks', 'journeyPlanKpiTasks', 'visitLogs', 'taskCompletions'];
  var MUTABLE = ['journeyPlans', 'journeyPlanSupervisors', 'weeklyTemplates', 'kpiTasks', 'journeyPlanKpiTasks'];
  var STORE_KEY = 'rw.edits.v1';
  var DAYS = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
  var JS_DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var PLAN_STATUSES = ['Draft', 'Active', 'Completed', 'Archived'];

  // Field schemas for the editable collections (whitelists — anything else is dropped).
  var SCHEMA = {
    journeyPlans: { Id: 'number', Name: 'string', Status: 'string', CreatedByManagerId: 'number', CreatedAt: 'string', UpdatedAt: 'string' },
    journeyPlanSupervisors: { Id: 'number', JourneyPlanId: 'number', SupervisorId: 'number' },
    weeklyTemplates: { Id: 'number', JourneyPlanId: 'number', SupervisorId: 'number', DayOfWeek: 'string', MarketId: 'number', OrderInDay: 'number' },
    kpiTasks: { Id: 'number', Title: 'string', Description: 'string', CreatedByManagerId: 'number' },
    journeyPlanKpiTasks: { Id: 'number', JourneyPlanId: 'number', KPITaskId: 'number' },
  };

  var base = null;   // pristine data as loaded
  var db = null;     // working copy

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function fetchJson(name) {
    return fetch('data/' + name + '.json', { credentials: 'same-origin', cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function loadBundle() {
    if (window.__DATA__) return Promise.resolve(window.__DATA__);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'js/data.bundle.js';
      s.onload = function () { window.__DATA__ ? resolve(window.__DATA__) : reject(new Error('bundle empty')); };
      s.onerror = function () { reject(new Error('bundle missing')); };
      document.head.appendChild(s);
    });
  }

  function sanitizeRows(name, rows) {
    var schema = SCHEMA[name];
    if (!Array.isArray(rows)) return null;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
      var clean = {};
      for (var k in schema) {
        if (!Object.prototype.hasOwnProperty.call(schema, k)) continue;
        if (typeof r[k] !== schema[k]) return null;
        clean[k] = r[k];
      }
      out.push(clean);
    }
    return out;
  }
  function readEdits() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var result = {};
      for (var i = 0; i < MUTABLE.length; i++) {
        var rows = sanitizeRows(MUTABLE[i], parsed[MUTABLE[i]]);
        if (!rows) return null; // corrupt → ignore all edits
        result[MUTABLE[i]] = rows;
      }
      return result;
    } catch (e) { return null; }
  }
  function persist() {
    var payload = {};
    MUTABLE.forEach(function (k) { payload[k] = db[k]; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)); return true; } catch (e) { return false; }
  }

  function load() {
    // file:// cannot fetch local JSON (CORS) — go straight to the generated bundle.
    var p = window.location.protocol === 'file:' ? loadBundle() : Promise.all(FILES.map(fetchJson)).then(function (parts) {
      var o = {};
      FILES.forEach(function (f, i) { o[f] = parts[i]; });
      return o;
    }).catch(function () { return loadBundle(); });
    return p.then(function (data) {
      base = clone(data);
      db = clone(data);
      var edits = readEdits();
      if (edits) MUTABLE.forEach(function (k) { db[k] = edits[k]; });
      reindex();
      return db;
    });
  }

  // ---------- indices ----------
  var idx = {};
  function byId(arr) { var m = new Map(); arr.forEach(function (x) { m.set(x.Id, x); }); return m; }
  function reindex() {
    idx.supervisors = byId(db.supervisors);
    idx.routes = byId(db.routes);
    idx.markets = byId(db.markets);
    idx.plans = byId(db.journeyPlans);
    idx.kpi = byId(db.kpiTasks);
    idx.managers = byId(db.unitManagers);
    // Visit logs keep pointing at the template they were generated from (history is immutable).
    idx.baseTemplates = byId(base.weeklyTemplates);
    idx.logs = db.visitLogs.map(function (l) {
      var t = idx.baseTemplates.get(l.WeeklyTemplateId) || {};
      return Object.assign({}, l, { MarketId: t.MarketId, JourneyPlanId: t.JourneyPlanId, OrderInDay: t.OrderInDay, DayOfWeek: t.DayOfWeek });
    });
    idx.completionsByLog = new Map();
    db.taskCompletions.forEach(function (c) {
      if (!idx.completionsByLog.has(c.VisitLogId)) idx.completionsByLog.set(c.VisitLogId, []);
      idx.completionsByLog.get(c.VisitLogId).push(c);
    });
  }

  // ---------- dates ----------
  function parseDay(s) { return new Date(s + 'T00:00:00Z'); }
  function dayStr(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function today() { return parseDay(db.meta.AnchorDate); }
  function weekStart(d) { // Saturday-based week
    var diff = (d.getUTCDay() + 1) % 7;
    return addDays(d, -diff);
  }
  function dayCode(d) { return JS_DAY[d.getUTCDay()]; }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  // ---------- selectors ----------
  function planSupervisorIds(planId) {
    return db.journeyPlanSupervisors.filter(function (x) { return x.JourneyPlanId === planId; }).map(function (x) { return x.SupervisorId; });
  }
  function planTaskIds(planId) {
    return db.journeyPlanKpiTasks.filter(function (x) { return x.JourneyPlanId === planId; }).map(function (x) { return x.KPITaskId; });
  }
  function templates(planId, supId) {
    return db.weeklyTemplates.filter(function (t) {
      return (planId == null || t.JourneyPlanId === planId) && (supId == null || t.SupervisorId === supId);
    });
  }
  function planMarketIds(planId) {
    var s = new Set(); templates(planId).forEach(function (t) { s.add(t.MarketId); }); return s;
  }
  function logsBetween(from, to, filter) {
    var a = dayStr(from), b = dayStr(to);
    return idx.logs.filter(function (l) {
      if (l.VisitDate < a || l.VisitDate > b) return false;
      if (!filter) return true;
      if (filter.supervisorId && l.SupervisorId !== filter.supervisorId) return false;
      if (filter.planId && l.JourneyPlanId !== filter.planId) return false;
      if (filter.marketId && l.MarketId !== filter.marketId) return false;
      if (filter.routeId) { var m = idx.markets.get(l.MarketId); if (!m || m.RouteId !== filter.routeId) return false; }
      return true;
    });
  }
  function summarize(logs) {
    var s = { planned: logs.length, visited: 0, missed: 0, pending: 0, onTime: 0 };
    logs.forEach(function (l) {
      if (l.Status === 'Visited') { s.visited++; if (l.IsOnTime) s.onTime++; }
      else if (l.Status === 'Missed') s.missed++;
      else s.pending++;
    });
    var closed = s.visited + s.missed;
    s.completion = closed ? s.visited / closed : null;
    s.onTimeRate = s.visited ? s.onTime / s.visited : null;
    return s;
  }
  function taskStats(logs) {
    var map = new Map();
    logs.forEach(function (l) {
      (idx.completionsByLog.get(l.Id) || []).forEach(function (c) {
        var e = map.get(c.KPITaskId) || { total: 0, done: 0 };
        e.total++; if (c.IsCompleted) e.done++;
        map.set(c.KPITaskId, e);
      });
    });
    return map;
  }

  // ---------- validation + mutations (admin only) ----------
  function assertAdmin() {
    if (!RW.auth || !RW.auth.isAdmin()) throw new Error('Read-only account: changes are not allowed.');
  }
  function cleanText(v, min, max, label) {
    var s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length < min || s.length > max) throw new Error(label + ' must be ' + min + '–' + max + ' characters.');
    return s;
  }
  function nextId(arr) { return arr.reduce(function (m, x) { return Math.max(m, x.Id); }, 0) + 1; }
  function nowIso() { return new Date().toISOString(); }
  function validIds(ids, map, label) {
    if (!Array.isArray(ids)) throw new Error(label + ' invalid.');
    var out = [];
    ids.forEach(function (raw) {
      var id = Number(raw);
      if (!Number.isInteger(id) || !map.has(id)) throw new Error('Unknown ' + label + '.');
      if (out.indexOf(id) === -1) out.push(id);
    });
    return out;
  }
  function currentManagerId() { return 1; }

  function savePlan(input) {
    assertAdmin();
    var name = cleanText(input.Name, 3, 80, 'Plan name');
    if (PLAN_STATUSES.indexOf(input.Status) === -1) throw new Error('Choose a valid status.');
    var sups = validIds(input.supervisorIds || [], idx.supervisors, 'supervisor');
    if (!sups.length) throw new Error('Assign at least one supervisor.');
    var tasks = validIds(input.taskIds || [], idx.kpi, 'KPI task');
    var dup = db.journeyPlans.some(function (p) { return p.Name.toLowerCase() === name.toLowerCase() && p.Id !== input.Id; });
    if (dup) throw new Error('A plan with this name already exists.');
    var plan;
    if (input.Id) {
      plan = idx.plans.get(input.Id);
      if (!plan) throw new Error('Plan not found.');
      plan.Name = name; plan.Status = input.Status; plan.UpdatedAt = nowIso();
    } else {
      plan = { Id: nextId(db.journeyPlans), Name: name, Status: input.Status, CreatedByManagerId: currentManagerId(), CreatedAt: nowIso(), UpdatedAt: nowIso() };
      db.journeyPlans.push(plan);
    }
    // supervisors: drop removed ones (and their templates), add new ones
    db.journeyPlanSupervisors = db.journeyPlanSupervisors.filter(function (x) { return x.JourneyPlanId !== plan.Id || sups.indexOf(x.SupervisorId) > -1; });
    db.weeklyTemplates = db.weeklyTemplates.filter(function (t) { return t.JourneyPlanId !== plan.Id || sups.indexOf(t.SupervisorId) > -1; });
    sups.forEach(function (s) {
      if (!db.journeyPlanSupervisors.some(function (x) { return x.JourneyPlanId === plan.Id && x.SupervisorId === s; })) {
        db.journeyPlanSupervisors.push({ Id: nextId(db.journeyPlanSupervisors), JourneyPlanId: plan.Id, SupervisorId: s });
      }
    });
    setPlanTasks(plan.Id, tasks, true);
    commit();
    return plan;
  }
  function setPlanTasks(planId, taskIds, skipCommit) {
    assertAdmin();
    var ids = validIds(taskIds, idx.kpi, 'KPI task');
    db.journeyPlanKpiTasks = db.journeyPlanKpiTasks.filter(function (x) { return x.JourneyPlanId !== planId; });
    ids.forEach(function (k) { db.journeyPlanKpiTasks.push({ Id: nextId(db.journeyPlanKpiTasks), JourneyPlanId: planId, KPITaskId: k }); });
    touchPlan(planId);
    if (!skipCommit) commit();
  }
  function deletePlan(planId) {
    assertAdmin();
    if (!idx.plans.has(planId)) throw new Error('Plan not found.');
    db.journeyPlans = db.journeyPlans.filter(function (p) { return p.Id !== planId; });
    db.journeyPlanSupervisors = db.journeyPlanSupervisors.filter(function (x) { return x.JourneyPlanId !== planId; });
    db.weeklyTemplates = db.weeklyTemplates.filter(function (x) { return x.JourneyPlanId !== planId; });
    db.journeyPlanKpiTasks = db.journeyPlanKpiTasks.filter(function (x) { return x.JourneyPlanId !== planId; });
    commit();
  }
  function touchPlan(planId) { var p = idx.plans.get(planId); if (p) p.UpdatedAt = nowIso(); }
  function renumber(planId, supId, day) {
    templates(planId, supId).filter(function (t) { return t.DayOfWeek === day; })
      .sort(function (a, b) { return a.OrderInDay - b.OrderInDay; })
      .forEach(function (t, i) { t.OrderInDay = i + 1; });
  }
  function addStop(planId, supId, day, marketId) {
    assertAdmin();
    if (!idx.plans.has(planId)) throw new Error('Plan not found.');
    if (planSupervisorIds(planId).indexOf(supId) === -1) throw new Error('Supervisor is not on this plan.');
    if (DAYS.indexOf(day) === -1) throw new Error('Choose a working day.');
    if (!idx.markets.has(marketId)) throw new Error('Choose a market.');
    var dayStops = templates(planId, supId).filter(function (t) { return t.DayOfWeek === day; });
    if (dayStops.some(function (t) { return t.MarketId === marketId; })) throw new Error('This market is already scheduled on that day.');
    if (dayStops.length >= 12) throw new Error('A day can hold at most 12 stops.');
    db.weeklyTemplates.push({ Id: nextId(db.weeklyTemplates), JourneyPlanId: planId, SupervisorId: supId, DayOfWeek: day, MarketId: marketId, OrderInDay: dayStops.length + 1 });
    touchPlan(planId);
    commit();
  }
  function removeStop(templateId) {
    assertAdmin();
    var t = db.weeklyTemplates.find(function (x) { return x.Id === templateId; });
    if (!t) return;
    db.weeklyTemplates = db.weeklyTemplates.filter(function (x) { return x.Id !== templateId; });
    renumber(t.JourneyPlanId, t.SupervisorId, t.DayOfWeek);
    touchPlan(t.JourneyPlanId);
    commit();
  }
  function moveStop(templateId, delta) {
    assertAdmin();
    var t = db.weeklyTemplates.find(function (x) { return x.Id === templateId; });
    if (!t) return;
    var list = templates(t.JourneyPlanId, t.SupervisorId).filter(function (x) { return x.DayOfWeek === t.DayOfWeek; })
      .sort(function (a, b) { return a.OrderInDay - b.OrderInDay; });
    var i = list.indexOf(t), j = i + delta;
    if (j < 0 || j >= list.length) return;
    var tmp = list[j].OrderInDay; list[j].OrderInDay = t.OrderInDay; t.OrderInDay = tmp;
    touchPlan(t.JourneyPlanId);
    commit();
  }
  function saveKpiTask(input) {
    assertAdmin();
    var title = cleanText(input.Title, 3, 60, 'Title');
    var desc = cleanText(input.Description, 0, 200, 'Description');
    if (db.kpiTasks.some(function (k) { return k.Title.toLowerCase() === title.toLowerCase() && k.Id !== input.Id; })) throw new Error('A task with this title already exists.');
    if (input.Id) {
      var k = idx.kpi.get(input.Id);
      if (!k) throw new Error('Task not found.');
      k.Title = title; k.Description = desc;
    } else {
      db.kpiTasks.push({ Id: nextId(db.kpiTasks), Title: title, Description: desc, CreatedByManagerId: currentManagerId() });
    }
    commit();
  }
  function commit() {
    reindex();
    var ok = persist();
    document.dispatchEvent(new CustomEvent('rw:data', { detail: { persisted: ok } }));
  }
  function resetEdits() {
    assertAdmin();
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    MUTABLE.forEach(function (k) { db[k] = clone(base[k]); });
    reindex();
    document.dispatchEvent(new CustomEvent('rw:data', { detail: { reset: true } }));
  }
  // Demo-only: mark the next pending stop of today as visited (memory only, not persisted).
  function simulateCheckIn() {
    assertAdmin();
    var t = dayStr(today());
    var next = idx.logs.filter(function (l) { return l.VisitDate === t && l.Status === 'Pending'; })
      .sort(function (a, b) { return a.OrderInDay - b.OrderInDay || a.Id - b.Id; })[0];
    if (!next) return null;
    var raw = db.visitLogs.find(function (l) { return l.Id === next.Id; });
    var m = idx.markets.get(next.MarketId);
    var now = new Date();
    var at = new Date(today().getTime() + (now.getUTCHours() * 60 + now.getUTCMinutes()) * 60000);
    raw.Status = 'Visited';
    raw.CheckInTime = at.toISOString();
    raw.CheckInLat = m ? m.Latitude : null;
    raw.CheckInLng = m ? m.Longitude : null;
    raw.IsOnTime = Math.random() > 0.3;
    raw.CreatedAt = at.toISOString();
    reindex();
    return idx.logs.find(function (l) { return l.Id === raw.Id; });
  }

  RW.data = {
    DAYS: DAYS, PLAN_STATUSES: PLAN_STATUSES,
    load: load,
    get db() { return db; },
    idx: idx,
    today: today, weekStart: weekStart, addDays: addDays, dayStr: dayStr, parseDay: parseDay, dayCode: dayCode, isoWeek: isoWeek,
    planSupervisorIds: planSupervisorIds, planTaskIds: planTaskIds, templates: templates, planMarketIds: planMarketIds,
    logsBetween: logsBetween, summarize: summarize, taskStats: taskStats,
    savePlan: savePlan, deletePlan: deletePlan, setPlanTasks: setPlanTasks,
    addStop: addStop, removeStop: removeStop, moveStop: moveStop, saveKpiTask: saveKpiTask,
    resetEdits: resetEdits, simulateCheckIn: simulateCheckIn,
    hasEdits: function () { try { return !!localStorage.getItem(STORE_KEY); } catch (e) { return false; } },
  };
})();
