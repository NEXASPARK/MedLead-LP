/*
 * lp-analytics.js（MedLead 用の仮版）
 *
 * ※ 本来は他のLPと同じ正本 canvi-lp-analytics/shared/lp-analytics.js のコピーを置きます。
 *    正本の `npm run sync` の対象に MedLead を足し、このファイルを正本で上書きしてください。
 *    この仮版は正本と同じ使い方（data-lp-name / data-ga-hosts、LPAnalytics.lead()）で動くように作ってあります。
 *
 * やること
 *  - 統合プロパティ G-94VP2CRKS8 に送る（data-ga-hosts のホストでだけ）
 *  - フォームに UTM・参照元・着地パス・page_url の隠し欄を足す
 *  - form_view / form_start / generate_lead（LPAnalytics.lead() で送信成功時）を出す
 */
(function () {
  'use strict';
  var GA_ID = 'G-94VP2CRKS8';
  var me = document.currentScript;
  var lpName = (me && me.dataset.lpName) || 'unknown';
  var hosts = ((me && me.dataset.gaHosts) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var enabled = hosts.indexOf(location.hostname) !== -1;
  var KEY = 'lpa_' + lpName;

  /* 着地時の情報（同じタブ内で保持） */
  var params = new URLSearchParams(location.search);
  var first = {};
  try { first = JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}; } catch (e) { first = {}; }
  if (!first.landing_path) {
    first = {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
      referrer: document.referrer || '',
      landing_path: location.pathname + location.search
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(first)); } catch (e) { /* 保存できなくても動く */ }
  }

  /* GA4 */
  function gtagSafe() {
    if (!enabled) return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag.apply(null, arguments);
  }
  if (enabled) {
    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      document.head.appendChild(s);
      gtagSafe('js', new Date());
    }
    gtagSafe('config', GA_ID, { lp_name: lpName });
  }
  function track(name, extra) {
    var p = { lp_name: lpName, send_to: GA_ID };
    if (extra) for (var k in extra) p[k] = extra[k];
    gtagSafe('event', name, p);
  }

  function setup() {
    var forms = document.querySelectorAll('form');
    Array.prototype.forEach.call(forms, function (form) {
      var formName = (form.querySelector('[name="form"]') || {}).value || form.id || 'form';
      var add = function (name, value) {
        var el = form.querySelector('input[name="' + name + '"]');
        if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
        el.value = value;
      };
      Object.keys(first).forEach(function (k) { add(k, first[k]); });
      add('page_url', location.href);

      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          if (es.some(function (e) { return e.isIntersecting; })) { track('form_view', { form: formName }); io.disconnect(); }
        });
        io.observe(form);
      }
      var started = false;
      form.addEventListener('input', function () {
        if (started) return;
        started = true;
        track('form_start', { form: formName });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();

  window.LPAnalytics = {
    lead: function (extra) { track('generate_lead', extra || {}); },
    track: track
  };
})();
