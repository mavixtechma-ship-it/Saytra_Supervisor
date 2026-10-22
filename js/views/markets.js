/* Markets: filter bar → map (Leaflet + OSM tiles) → table → detail drawer. */
(function () {
  'use strict';
  var RW = window.RW, ui = RW.ui, data = RW.data, h = ui.h, fmt = ui.fmt;
  RW.views = RW.views || {};
  var FREQS = ['Weekly', 'Twice weekly', 'Bi-weekly'];

  function marketStats(today) {
    var from = data.addDays(today, -27);
    var map = new Map();
    data.logsBetween(from, today).forEach(function (l) {
      var e = map.get(l.MarketId) || { visits: 0, missed: 0, last: null };
      if (l.Status === 'Visited') { e.visits++; if (!e.last || l.VisitDate > e.last.VisitDate) e.last = l; }
      if (l.Status === 'Missed') e.missed++;
      map.set(l.MarketId, e);
    });
    return map;
  }

  RW.views.markets = function (ctx) {
    var db = data.db, today = data.today(), q = ctx.query;
    var stats = marketStats(today);
    var search = h('input', { type: 'search', class: 'input input-bordered input-sm w-full sm:w-64', placeholder: 'Search name, code, street…', maxlength: 60, 'aria-label': 'Search markets', value: (q.get('q') || '').slice(0, 60) });
    var routeQ = Number(q.get('route'));
    var route = ui.select([{ value: '', label: 'All routes' }].concat(db.routes.map(function (r) { return { value: r.Id, label: r.Code + ' · ' + r.Name }; })), data.idx.routes.has(routeQ) ? routeQ : '', { 'aria-label': 'Filter by route' });
    var freq = ui.select([{ value: '', label: 'Any frequency' }].concat(FREQS.map(function (f) { return { value: f, label: f }; })), FREQS.indexOf(q.get('freq')) > -1 ? q.get('freq') : '', { 'aria-label': 'Filter by frequency' });

    function rows() {
      var term = search.value.trim().toLowerCase();
      var rid = Number(route.value) || null;
      return db.markets.filter(function (m) {
        return (!rid || m.RouteId === rid) && (!freq.value || m.VisitFrequency === freq.value) &&
          (!term || (m.Name + ' ' + m.Code + ' ' + m.Location).toLowerCase().indexOf(term) > -1);
      });
    }

    var map = null, layer = null;
    function openMarket(m) {
      var r = data.idx.routes.get(m.RouteId);
      var logs = data.logsBetween(data.addDays(today, -27), today, { marketId: m.Id }).sort(function (a, b) { return b.VisitDate.localeCompare(a.VisitDate); });
      var plans = new Set(data.templates().filter(function (t) { return t.MarketId === m.Id; }).map(function (t) { return t.JourneyPlanId; }));
      var st = data.summarize(logs);
      ui.drawer(m.Name, [
        h('dl', { class: 'grid grid-cols-2 gap-3 text-sm' }, [
          ['Code', m.Code], ['Route', r.Code + ' · ' + r.Name], ['Address', m.Location], ['Frequency', m.VisitFrequency],
          ['Coordinates', m.Latitude.toFixed(4) + ', ' + m.Longitude.toFixed(4)], ['Completion (4 wk)', fmt.pct(st.completion)],
        ].map(function (p) { return h('div', null, h('dt', { class: 'rw-kpi-label', text: p[0] }), h('dd', { class: 'font-semibold', text: p[1] })); })),
        h('div', null, h('h3', { class: 'font-bold text-sm mb-2', text: 'Journey plans' }),
          plans.size ? h('div', { class: 'flex flex-wrap gap-2' }, Array.from(plans).map(function (pid) { var p = data.idx.plans.get(pid); return p ? h('a', { href: '#/plans/' + p.Id, class: 'badge badge-primary badge-outline', text: p.Name }) : null; }))
            : h('p', { class: 'text-sm rw-muted', text: 'Not scheduled in any plan.' })),
        h('div', null, h('h3', { class: 'font-bold text-sm mb-2', text: 'Recent visits' }),
          logs.length ? h('ul', { class: 'space-y-2' }, logs.slice(0, 10).map(function (l) {
            return h('li', { class: 'flex items-center gap-2 text-sm' },
              h('span', { class: 'w-28 rw-muted', text: fmt.day(l.VisitDate) }),
              h('span', { class: 'flex-1 truncate', text: data.idx.supervisors.get(l.SupervisorId).Name }), ui.badge(l.Status));
          })) : h('p', { class: 'text-sm rw-muted', text: 'No visits in the last 4 weeks.' })),
        map ? ui.button('Show on map', { class: 'btn-outline w-full', icon: 'pin', onClick: function () { ui.closeDrawer(); map.flyTo([m.Latitude, m.Longitude], 16); } }) : null,
      ], m.Code + ' · ' + r.Name);
    }

    var table = ui.dataTable({
      rows: rows(), sortKey: 'code', pageSize: 12, onRowClick: openMarket,
      columns: [
        { key: 'code', label: 'Code', sort: function (m) { return m.Code; }, render: function (m) { return h('span', { class: 'font-mono text-xs', text: m.Code }); } },
        { key: 'name', label: 'Market', sort: function (m) { return m.Name; }, render: function (m) { return h('span', { class: 'font-semibold', text: m.Name }); } },
        { key: 'loc', label: 'Address', render: function (m) { return h('span', { class: 'text-xs rw-muted', text: m.Location }); } },
        { key: 'route', label: 'Route', sort: function (m) { return m.RouteId; }, render: function (m) { return data.idx.routes.get(m.RouteId).Code; } },
        { key: 'freq', label: 'Frequency', sort: function (m) { return m.VisitFrequency; }, render: function (m) { return h('span', { class: 'badge badge-sm badge-ghost', text: m.VisitFrequency }); } },
        { key: 'visits', label: 'Visits (4 wk)', align: 'right', sort: function (m) { return (stats.get(m.Id) || {}).visits || 0; }, render: function (m) { return fmt.num((stats.get(m.Id) || {}).visits || 0); } },
        { key: 'missed', label: 'Missed', align: 'right', sort: function (m) { return (stats.get(m.Id) || {}).missed || 0; }, render: function (m) { var n = (stats.get(m.Id) || {}).missed || 0; return h('span', { class: n ? 'text-error font-semibold' : 'rw-muted', text: fmt.num(n) }); } },
        { key: 'last', label: 'Last visit', sort: function (m) { var e = stats.get(m.Id); return e && e.last ? e.last.VisitDate : null; }, render: function (m) { var e = stats.get(m.Id); return e && e.last ? fmt.day(e.last.VisitDate) : '—'; } },
      ],
    });

    var mapHost = h('div', { class: 'rw-map', role: 'region', 'aria-label': 'Map of markets' }, ui.skeleton(3));
    function drawMarkers(list) {
      if (!map) return;
      if (layer) layer.remove();
      var L = window.L, p = RW.charts.palette();
      layer = L.featureGroup();
      list.forEach(function (m) {
        var e = stats.get(m.Id);
        var color = e && e.missed > 1 ? p.err : p.primary;
        var popup = h('div', null, h('strong', { text: m.Name }), h('br'), h('span', { text: m.Code + ' · ' + m.VisitFrequency }));
        L.circleMarker([m.Latitude, m.Longitude], { radius: 6, color: color, weight: 2, fillColor: color, fillOpacity: 0.55 })
          .bindPopup(popup).on('dblclick', function () { openMarket(m); }).addTo(layer);
      });
      layer.addTo(map);
      if (list.length) map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 15 });
    }
    function sync() {
      var r = rows();
      table.update(r);
      drawMarkers(r);
      var params = new URLSearchParams();
      if (search.value.trim()) params.set('q', search.value.trim());
      if (route.value) params.set('route', route.value);
      if (freq.value) params.set('freq', freq.value);
      history.replaceState(null, '', '#/markets' + (params.toString() ? '?' + params.toString() : ''));
    }
    search.addEventListener('input', sync);
    route.addEventListener('change', sync);
    freq.addEventListener('change', sync);

    var dead = false;
    ui.loadStyle(RW.CDN.leafletCss.url, RW.CDN.leafletCss.sri);
    ui.loadScript(RW.CDN.leafletJs.url, RW.CDN.leafletJs.sri).then(function () {
      if (dead) return;
      mapHost.replaceChildren();
      var L = window.L;
      map = L.map(mapHost, { scrollWheelZoom: false, doubleClickZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      drawMarkers(rows());
    }).catch(function () {
      mapHost.replaceChildren(ui.empty('Map unavailable (offline or blocked). The table below still works.', 'pin'));
    });

    var withMissed = db.markets.filter(function (m) { var e = stats.get(m.Id); return e && e.missed > 1; }).length;
    ctx.el.append(
      ui.pageHeader({ title: 'Markets', subtitle: fmt.num(db.markets.length) + ' outlets across ' + db.routes.length + ' routes in ' + db.meta.City + ' (fictional).' }),
      h('div', { class: 'grid grid-cols-1 gap-4' },
        ui.card({ title: 'Coverage map', subtitle: 'Red = 2+ missed visits in 4 weeks (' + withMissed + ' markets). Click a pin for details.', bodyClass: 'p-0', body: mapHost }),
        ui.card({ bodyClass: 'p-0', body: [h('div', { class: 'flex flex-wrap gap-2 p-3 border-b border-base-300' }, search, route, freq), table] })));
    return function () { dead = true; if (map) map.remove(); };
  };
})();
