/* Login page controller. */
(function () {
  'use strict';
  var auth = window.RW.auth;
  var form = document.getElementById('login-form');
  var user = document.getElementById('username');
  var pass = document.getElementById('password');
  var err = document.getElementById('error');
  var btn = document.getElementById('submit');
  var notice = document.getElementById('notice');

  function showNotice(text, tone) {
    notice.textContent = text;
    notice.className = 'alert mt-6 text-sm ' + (tone === 'info' ? 'alert-info' : 'alert-warning');
  }

  if (auth.session()) { window.location.replace('index.html'); return; }

  var params = new URLSearchParams(window.location.search);
  if (params.get('r') === 'expired') showNotice('Your session expired. Please sign in again.', 'info');

  if (!auth.cryptoAvailable()) {
    showNotice('Sign-in needs a secure context (WebCrypto), which this page does not have. Serve the folder over http://localhost (e.g. "npx serve .") or HTTPS — plain http on a LAN IP, and file:// in some browsers, will not work.', 'warn');
    btn.disabled = true;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.textContent = '';
    var u = user.value.trim();
    var p = pass.value;
    if (!/^[a-z0-9._-]{3,32}$/i.test(u)) { err.textContent = 'Enter a valid username.'; user.focus(); return; }
    if (p.length < 1 || p.length > 128) { err.textContent = 'Enter your password.'; pass.focus(); return; }
    var f = auth.failures();
    if (f.until > Date.now()) {
      err.textContent = 'Too many attempts. Try again in ' + Math.ceil((f.until - Date.now()) / 1000) + ' s.';
      return;
    }
    btn.disabled = true;
    btn.classList.add('btn-disabled');
    var label = btn.textContent;
    btn.textContent = 'Checking…';
    try {
      var ok = await auth.verify(u.toLowerCase(), p);
      if (ok) {
        auth.login(ok);
        window.location.replace('index.html');
        return;
      }
      auth.recordFailure();
      err.textContent = 'Incorrect username or password.';
      pass.value = '';
      pass.focus();
    } catch (ex) {
      err.textContent = ex && ex.message === 'insecure-context'
        ? 'WebCrypto is unavailable here. Open the app via http://localhost or HTTPS.'
        : 'Sign-in failed. Please try again.';
    } finally {
      btn.disabled = !auth.cryptoAvailable();
      btn.classList.remove('btn-disabled');
      btn.textContent = label;
    }
  });
})();
