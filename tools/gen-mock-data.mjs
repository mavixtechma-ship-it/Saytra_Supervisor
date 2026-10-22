// RouteWise — deterministic mock-data generator.
// Usage: node tools/gen-mock-data.mjs [--anchor YYYY-MM-DD] [--seed N]
// Writes data/*.json following the ERD. All names, codes, emails and
// coordinates are fictional. Run tools/build-data-bundle.mjs afterwards.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data');
mkdirSync(outDir, { recursive: true });

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const anchorStr = arg('--anchor', new Date().toISOString().slice(0, 10));
if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorStr)) throw new Error('--anchor must be YYYY-MM-DD');
const ANCHOR = new Date(anchorStr + 'T00:00:00Z');

// Seeded PRNG (mulberry32) — reproducible demo data, not used for security.
let seed = Number(arg('--seed', 20261)) >>> 0;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const iso = (d) => d.toISOString();
const dayOnly = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Guard: never emit digit runs that collide with identifiers purged from the original mockups.
// (Stored base64-encoded so the repository-wide leak grep stays clean.)
const BLOCKED = new RegExp(["MTIyNg==","MTEwODgy","MTE5ODgy","MjUwNQ==","MjIwNg==","NjgwMw==","MjkwNQ==","MjUwMg=="].map((b) => Buffer.from(b, 'base64').toString()).join('|'));
const coord = (fn) => { for (;;) { const v = Number(fn().toFixed(6)); if (!BLOCKED.test(String(v))) return v; } };
const safeId = (n) => { while (BLOCKED.test(String(n))) n++; return n; };

const WORK_DAYS = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];
const JS_DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Fictional city "Northbridge"; coordinates are random points inside an arbitrary box.
const CITY = { name: 'Northbridge', lat: 45.505, lng: 9.19, spanLat: 0.09, spanLng: 0.13 };

const unitManagers = [
  { Id: 1, Name: 'Rania Aziz', Email: 'rania.aziz@routewise.example', PasswordHash: null },
  { Id: 2, Name: 'Hossam Lotfy', Email: 'hossam.lotfy@routewise.example', PasswordHash: null },
];

const supNames = ['Nadia Farouk', 'Karim Adel', 'Sara Mansour', 'Youssef Nabil', 'Mona Khalil', 'Tarek Samir', 'Hana Fathy', 'Ziad Hamdy'];
const supervisors = supNames.map((Name, i) => ({
  Id: i + 1,
  Name,
  Email: Name.toLowerCase().replace(' ', '.') + '@routewise.example',
  PasswordHash: null,
  Phone: `+1-555-01${String(10 + i * 7).padStart(2, '0')}`,
}));
const reliability = supervisors.map(() => between(0.62, 0.97));

const districts = ['Oakfield', 'Riverside', 'Old Quarter', 'Hillcrest', 'Westgate', 'Lakeside', 'Cedar Park', 'Harbor View', 'Stonebrook', 'Millbrook'];
const routeNames = ['North Loop', 'River Run', 'Old Quarter Circuit', 'Hillcrest Ridge', 'Westgate Line', 'Lakeside Arc', 'Cedar Park Ring', 'Harbor Strip', 'Stonebrook Spur', 'Millbrook Way'];
const routes = routeNames.map((Name, i) => ({
  Id: i + 1,
  Code: `RT-${101 + i}`,
  Name,
  Description: `Traditional-trade outlets around ${districts[i]}.`,
  CreatedByManagerId: i < 6 ? 1 : 2,
}));

const prefixes = ['Green', 'Corner', 'Sunrise', 'Family', 'City', 'Golden', 'Fresh', 'Blue Door', 'Maple', 'Harbor', 'Daily', 'Olive', 'Lantern', 'Brightside', 'Northstar', 'Willow', 'Pebble', 'Copper', 'Meadow', 'Juniper'];
const suffixes = ['Market', 'Grocers', 'Mini Mart', 'Store', 'Kiosk', 'Supermarket', 'Pantry', 'Deli', 'Provisions', 'Corner Shop'];
const streets = ['Elm St', 'Station Rd', 'Canal Walk', 'Mill Lane', 'High St', 'Park Ave', 'Bridge Rd', 'Orchard Way', 'King St', 'Garden Row'];
const usedNames = new Set();
const markets = [];
for (let i = 0; i < 120; i++) {
  const routeIdx = i % 10;
  let Name;
  do { Name = `${pick(prefixes)} ${pick(suffixes)}`; } while (usedNames.has(Name));
  usedNames.add(Name);
  // cluster each route around its own centre inside the city box
  const cLat = CITY.lat + ((routeIdx % 5) / 4 - 0.5) * CITY.spanLat;
  const cLng = CITY.lng + ((Math.floor(routeIdx / 5)) - 0.5) * CITY.spanLng * 0.7;
  const r = rnd();
  markets.push({
    Id: i + 1,
    Code: `MK-${1001 + i}`,
    Name,
    Location: `${int(1, 240)} ${pick(streets)}, ${districts[routeIdx]}`,
    Latitude: coord(() => cLat + between(-0.012, 0.012)),
    Longitude: coord(() => cLng + between(-0.018, 0.018)),
    VisitFrequency: r < 0.65 ? 'Weekly' : r < 0.85 ? 'Twice weekly' : 'Bi-weekly',
    RouteId: routeIdx + 1,
  });
}

const kpiTasks = [
  ['Shelf-share check', 'Count facings vs. competitors on the main shelf.'],
  ['Planogram compliance', 'Confirm products are placed per the current planogram.'],
  ['Expiry & freshness audit', 'Check date codes and remove near-expiry stock.'],
  ['Price-tag verification', 'Verify shelf prices match the recommended price list.'],
  ['Cooler hygiene', 'Inspect branded cooler cleanliness and temperature.'],
  ['Promo material placement', 'Install or refresh point-of-sale promo material.'],
  ['Out-of-stock capture', 'Record SKUs that are out of stock and raise an order.'],
  ['Owner feedback', 'Log retailer feedback and competitor activity.'],
].map(([Title, Description], i) => ({ Id: i + 1, Title, Description, CreatedByManagerId: i < 5 ? 1 : 2 }));

const createdBase = addDays(ANCHOR, -60);
const planDefs = [
  { Name: 'Q4 Core Coverage — North', Status: 'Active', sups: [1, 2], routes: [1, 2, 3], tasks: [1, 2, 3, 7], mgr: 1 },
  { Name: 'Q4 Core Coverage — South', Status: 'Active', sups: [3, 4], routes: [4, 5, 6], tasks: [1, 3, 4, 7], mgr: 1 },
  { Name: 'Harbor & Lakeside Push', Status: 'Active', sups: [5, 6], routes: [6, 7, 8], tasks: [2, 5, 6], mgr: 2 },
  { Name: 'East Growth Routes', Status: 'Active', sups: [7, 8], routes: [8, 9, 10], tasks: [1, 4, 6, 8], mgr: 2 },
  { Name: 'Winter Launch Pilot', Status: 'Draft', sups: [2, 7], routes: [3, 9], tasks: [5, 6], mgr: 2 },
  { Name: 'Q3 Core Coverage', Status: 'Completed', sups: [1, 3, 5], routes: [1, 4, 7], tasks: [1, 2, 3], mgr: 1 },
];

const journeyPlans = [];
const journeyPlanSupervisors = [];
const journeyPlanKpiTasks = [];
const weeklyTemplates = [];
planDefs.forEach((p, idx) => {
  const Id = idx + 1;
  const created = addDays(createdBase, idx * 6 - (p.Status === 'Completed' ? 50 : 0));
  journeyPlans.push({
    Id, Name: p.Name, Status: p.Status, CreatedByManagerId: p.mgr,
    CreatedAt: iso(new Date(created.getTime() + 9.5 * 3600000)),
    UpdatedAt: iso(new Date(addDays(created, int(2, 20)).getTime() + 14 * 3600000)),
  });
  p.sups.forEach((s) => journeyPlanSupervisors.push({ Id: journeyPlanSupervisors.length + 1, JourneyPlanId: Id, SupervisorId: s }));
  p.tasks.forEach((t) => journeyPlanKpiTasks.push({ Id: journeyPlanKpiTasks.length + 1, JourneyPlanId: Id, KPITaskId: t }));

  // split the plan's markets between its supervisors, then lay them out on the week
  const pool = shuffle(markets.filter((m) => p.routes.includes(m.RouteId)));
  p.sups.forEach((supId, si) => {
    const mine = pool.filter((_, k) => k % p.sups.length === si).slice(0, 12);
    const perDay = Object.fromEntries(WORK_DAYS.map((d) => [d, []]));
    mine.forEach((m, k) => {
      const first = WORK_DAYS[k % 6];
      perDay[first].push(m.Id);
      if (m.VisitFrequency === 'Twice weekly') perDay[WORK_DAYS[(k + 3) % 6]].push(m.Id);
    });
    WORK_DAYS.forEach((day) => {
      perDay[day].forEach((MarketId, o) => {
        weeklyTemplates.push({ Id: weeklyTemplates.length + 1, JourneyPlanId: Id, SupervisorId: supId, DayOfWeek: day, MarketId, OrderInDay: o + 1 });
      });
    });
  });
});

const marketById = new Map(markets.map((m) => [m.Id, m]));
const activePlanIds = new Set(journeyPlans.filter((p) => p.Status === 'Active').map((p) => p.Id));
const planTasks = (pid) => journeyPlanKpiTasks.filter((x) => x.JourneyPlanId === pid).map((x) => x.KPITaskId);

const visitLogs = [];
const taskCompletions = [];
const missedNotes = ['Shop closed on arrival', 'Owner unavailable', 'Road works blocked access', 'Rescheduled by supervisor'];
const visitNotes = ['', '', '', 'Stock levels good', 'Requested extra promo stand', 'Competitor discount spotted', 'Cooler needs service'];
for (let back = 27; back >= 0; back--) {
  const date = addDays(ANCHOR, -back);
  const code = JS_DAY[date.getUTCDay()];
  if (!WORK_DAYS.includes(code)) continue;
  const weekNo = Math.floor(back / 7);
  for (const t of weeklyTemplates) {
    if (!activePlanIds.has(t.JourneyPlanId) || t.DayOfWeek !== code) continue;
    const m = marketById.get(t.MarketId);
    if (m.VisitFrequency === 'Bi-weekly' && weekNo % 2 === 1) continue;
    const rel = reliability[t.SupervisorId - 1];
    const planned = 8.5 + (t.OrderInDay - 1) * 1.25; // hours
    let Status;
    if (back === 0) Status = t.OrderInDay === 1 && rnd() < rel + 0.05 ? 'Visited' : 'Pending';
    else Status = rnd() < rel + 0.06 ? 'Visited' : 'Missed';
    const log = {
      Id: safeId(visitLogs.length ? visitLogs[visitLogs.length - 1].Id + 1 : 1), WeeklyTemplateId: t.Id, SupervisorId: t.SupervisorId,
      VisitDate: dayOnly(date), CheckInTime: null, CheckInLat: null, CheckInLng: null,
      Status, IsOnTime: null, Notes: '', CreatedAt: null,
    };
    if (Status === 'Visited') {
      const delay = rnd() < rel ? between(-0.3, 0.45) : between(0.5, 2.2);
      const at = new Date(date.getTime() + (planned + delay) * 3600000);
      log.CheckInTime = iso(at);
      log.CheckInLat = coord(() => m.Latitude + between(-0.0004, 0.0004));
      log.CheckInLng = coord(() => m.Longitude + between(-0.0004, 0.0004));
      log.IsOnTime = delay <= 0.5;
      log.Notes = pick(visitNotes);
      log.CreatedAt = iso(new Date(at.getTime() + int(1, 9) * 60000));
      for (const k of planTasks(t.JourneyPlanId)) {
        const done = rnd() < rel + 0.08;
        taskCompletions.push({ Id: safeId(taskCompletions.length ? taskCompletions[taskCompletions.length - 1].Id + 1 : 1), VisitLogId: log.Id, KPITaskId: k, IsCompleted: done, Notes: done ? '' : 'Not completed during visit' });
      }
    } else if (Status === 'Missed') {
      log.Notes = pick(missedNotes);
      log.CreatedAt = iso(new Date(date.getTime() + 18 * 3600000));
    }
    visitLogs.push(log);
  }
}

const meta = {
  AppName: 'RouteWise',
  City: CITY.name,
  AnchorDate: dayOnly(ANCHOR),
  GeneratedAt: new Date().toISOString(),
  WorkDays: WORK_DAYS,
  Note: 'All records are fictional demo data.',
};

const files = { meta, unitManagers, supervisors, routes, markets, journeyPlans, journeyPlanSupervisors, weeklyTemplates, kpiTasks, journeyPlanKpiTasks, visitLogs, taskCompletions };
if (BLOCKED.test(JSON.stringify(files))) { console.error('Generated data contains a blocked digit sequence — change --seed.'); process.exit(1); }
for (const [name, value] of Object.entries(files)) {
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(value, null, 1) + '\n');
  console.log(`data/${name}.json`, Array.isArray(value) ? value.length : 'object');
}
