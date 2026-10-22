/* RouteWise demo auth: PBKDF2-SHA256 verification via WebCrypto + sessionStorage session.
   This is an access gate for a static demo, not real security — everything runs client-side. */
(function () {
  'use strict';
  var RW = (window.RW = window.RW || {});
  var CFG = window.RW_AUTH_CONFIG;
  var KEY = 'rw.session';
  var FAIL_KEY = 'rw.loginFails';

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function cryptoAvailable() {
    return !!(window.isSecureContext && window.crypto && window.crypto.subtle);
  }
  function findUser(username) {
    if (!CFG || !Array.isArray(CFG.users)) return null;
    for (var i = 0; i < CFG.users.length; i++) if (CFG.users[i].username === username) return CFG.users[i];
    return null;
  }

  async function verify(username, password) {
    if (!cryptoAvailable()) throw new Error('insecure-context');
    var user = findUser(username);
    // Always derive (even for unknown users) so timing does not reveal valid usernames.
    var salt = user ? b64ToBytes(user.salt) : new Uint8Array(16);
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: CFG.hash, salt: salt, iterations: CFG.iterations }, key, CFG.keyLength * 8);
    var derived = new Uint8Array(bits);
    if (!user) return null;
    return timingSafeEqual(derived, b64ToBytes(user.hash)) ? user : null;
  }

  function readSession() {
    var raw;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    var s;
    try { s = JSON.parse(raw); } catch (e) { return null; }
    if (!s || typeof s !== 'object' || typeof s.u !== 'string' || typeof s.exp !== 'number') return null;
    var user = findUser(s.u);
    // role is always taken from the config, never trusted from storage
    if (!user || Date.now() > s.exp) return null;
    return { username: user.username, role: user.role, displayName: user.displayName, exp: s.exp };
  }
  function writeSession(user) {
    var exp = Date.now() + (CFG.sessionMinutes || 60) * 60000;
    try { sessionStorage.setItem(KEY, JSON.stringify({ u: user.username, exp: exp, v: 1 })); } catch (e) { /* ignore */ }
  }
  function clearSession() {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function touch() {
    var s = readSession();
    if (s) writeSession(findUser(s.username));
    return s;
  }

  function failures() {
    try { var v = JSON.parse(sessionStorage.getItem(FAIL_KEY) || '{}'); return { n: Number(v.n) || 0, until: Number(v.until) || 0 }; }
    catch (e) { return { n: 0, until: 0 }; }
  }
  function recordFailure() {
    var f = failures();
    f.n += 1;
    if (f.n >= 5) { f.until = Date.now() + 30000; f.n = 0; }
    try { sessionStorage.setItem(FAIL_KEY, JSON.stringify(f)); } catch (e) { /* ignore */ }
  }
  function resetFailures() { try { sessionStorage.removeItem(FAIL_KEY); } catch (e) { /* ignore */ } }

  function redirectToLogin(reason) {
    var target = 'login.html' + (reason === 'expired' ? '?r=expired' : '');
    window.location.replace(target);
  }
  function requireSession() {
    var s = readSession();
    if (!s) {
      var had = false;
      try { had = !!sessionStorage.getItem(KEY); } catch (e) { had = false; }
      clearSession();
      redirectToLogin(had ? 'expired' : '');
      return null;
    }
    return s;
  }

  RW.auth = {
    cryptoAvailable: cryptoAvailable,
    verify: verify,
    session: readSession,
    touch: touch,
    login: function (user) { writeSession(user); resetFailures(); },
    logout: function () { clearSession(); window.location.replace('login.html'); },
    isAdmin: function () { var s = readSession(); return !!s && s.role === 'admin'; },
    requireSession: requireSession,
    failures: failures,
    recordFailure: recordFailure,
  };

  // Page guard: every page except the login page requires a valid session.
  if (document.documentElement.getAttribute('data-page') !== 'login') {
    if (requireSession()) document.documentElement.classList.remove('rw-locked');
  }
})();
