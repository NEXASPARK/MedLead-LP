/*
 * MedLead LP
 *  1. 対応のイメージのチップ切り替え
 *  2. 追従ボタンの出し入れ（ファーストビューと相談フォームが見えている間は隠す）
 *  3. フォーム送信（/api/contact へ。成功したら LPAnalytics.lead()）
 */
(function () {
  'use strict';

  /* 1. チップ切り替え ------------------------------------------------------ */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.chips [role="tab"]'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = document.querySelector('.case[data-panel="' + t.dataset.tab + '"]');
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectTab(next, true); }
    });
  });

  /* 2. 追従ボタン ---------------------------------------------------------- */
  var follow = document.getElementById('follow');
  var watch = [document.getElementById('top'), document.getElementById('contact')].filter(Boolean);
  if (follow) {
    var followLink = follow.querySelector('a');
    var setFollow = function (show) {
      follow.classList.toggle('is-hidden', !show);
      follow.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (followLink) followLink.tabIndex = show ? 0 : -1;
    };
    setFollow(false);
    if ('IntersectionObserver' in window) {
      var visible = new Map();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible.set(en.target, en.isIntersecting); });
        var anyVisible = false;
        visible.forEach(function (v) { if (v) anyVisible = true; });
        setFollow(!anyVisible);
      }, { threshold: 0 });
      watch.forEach(function (el) { io.observe(el); });
    } else {
      setFollow(true);
    }
  }

  /* 3. フォーム送信 -------------------------------------------------------- */
  var form = document.getElementById('contact-form');
  if (!form) return;
  var errBox = document.getElementById('form-error');
  var done = document.getElementById('form-done');
  var submit = form.querySelector('[type="submit"]');

  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.hidden = true;

    var firstInvalid = null;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '' && el.checkValidity();
      el.classList.toggle('is-invalid', !ok);
      if (!ok && !firstInvalid) firstInvalid = el;
    });
    if (firstInvalid) {
      showError(firstInvalid.type === 'checkbox'
        ? 'プライバシーポリシーへの同意が必要です。'
        : '必須の項目を正しくご入力ください。');
      firstInvalid.focus();
      return;
    }

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
    data.lp = 'medlead';

    submit.disabled = true;
    submit.textContent = '送信中…';

    fetch(form.getAttribute('action') || '/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      form.hidden = true;
      done.hidden = false;
      done.setAttribute('tabindex', '-1');
      done.focus();
      if (window.LPAnalytics && typeof window.LPAnalytics.lead === 'function') {
        window.LPAnalytics.lead({ form: 'contact' });
      }
    }).catch(function () {
      showError('送信できませんでした。時間をおいてもう一度お試しいただくか、info@canvi.co.jp までご連絡ください。');
      submit.disabled = false;
      submit.textContent = '送信する';
    });
  });

  form.addEventListener('input', function (e) {
    if (e.target.classList.contains('is-invalid')) e.target.classList.remove('is-invalid');
  });
})();
