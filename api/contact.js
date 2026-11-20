/*
 * /api/contact（Vercel の関数）MedLead 用の仮版
 *
 * ※ 指示書どおり、本番ではサイヨウ90・テレアポ90 の api/contact.js をそのまま流用してください
 *    （①Canvas へのリード登録 ②Slack #canvi_lp_notify ③info@canvi.co.jp への通知メール）。
 *    このファイルは流用版が入るまでの仮版で、同じ項目を受け取り、次の環境変数がある所だけ送ります。
 *
 *   CANVAS_LEAD_ENDPOINT / CANVAS_API_KEY … Canvas のリード登録API（JSONでPOST）
 *   SLACK_WEBHOOK_URL                     … #canvi_lp_notify の Incoming Webhook
 *   RESEND_API_KEY / MAIL_TO / MAIL_FROM   … 通知メール（Resend）。MAIL_TO の既定は info@canvi.co.jp
 *
 * 受け取る項目：company, name, tel, email, timing, message, agree, _hp, form, lp
 *               ＋ lp-analytics.js が足す utm_*, referrer, landing_path, page_url
 */
const LP_NAME = 'medlead';
const REQUIRED = ['company', 'name', 'tel', 'email', 'timing'];
const MAX_LEN = 2000;

function clean(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, MAX_LEN);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return Object.fromEntries(new URLSearchParams(req.body)); }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const raw = await readBody(req);
  const d = {};
  for (const k of Object.keys(raw)) d[k] = clean(raw[k]);

  // 迷惑送信よけ：隠し欄が埋まっていたら、成功を装って捨てる（他のLPと同じ）
  if (d._hp) return res.status(200).json({ ok: true });

  const missing = REQUIRED.filter((k) => !d[k]);
  if (missing.length || !d.agree) {
    return res.status(400).json({ ok: false, error: 'missing_fields', fields: missing.concat(d.agree ? [] : ['agree']) });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  // 「採用以外（営業・DX）の相談」を選んだ場合は、種別として分けて渡す【エンジニアと相談】
  const inquiryType = /採用以外/.test(d.timing) ? '営業・DXの相談' : '採用の相談';

  const lead = {
    lp: LP_NAME,
    form: d.form || 'contact',
    inquiry_type: inquiryType,
    company: d.company,
    name: d.name,
    tel: d.tel,
    email: d.email,
    timing: d.timing,
    message: d.message,
    utm_source: d.utm_source, utm_medium: d.utm_medium, utm_campaign: d.utm_campaign,
    utm_term: d.utm_term, utm_content: d.utm_content,
    referrer: d.referrer, landing_path: d.landing_path, page_url: d.page_url,
    received_at: new Date().toISOString()
  };

  const text = [
    `【MedLead】お問い合わせ（${inquiryType}）`,
    `会社名・医院名：${lead.company}`,
    `お名前：${lead.name}`,
    `電話番号：${lead.tel}`,
    `メール：${lead.email}`,
    `採用希望時期：${lead.timing}`,
    `その他：${lead.message || '（なし）'}`,
    `着地：${lead.landing_path || '-'} / 参照元：${lead.referrer || '-'}`,
    `UTM：${[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ') || '-'}`
  ].join('\n');

  const jobs = [];
  const env = process.env;

  if (env.CANVAS_LEAD_ENDPOINT) {
    jobs.push(fetch(env.CANVAS_LEAD_ENDPOINT, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, env.CANVAS_API_KEY ? { Authorization: `Bearer ${env.CANVAS_API_KEY}` } : {}),
      body: JSON.stringify(lead)
    }).then((r) => { if (!r.ok) throw new Error(`canvas ${r.status}`); }));
  }
  if (env.SLACK_WEBHOOK_URL) {
    jobs.push(fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).then((r) => { if (!r.ok) throw new Error(`slack ${r.status}`); }));
  }
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    jobs.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: (env.MAIL_TO || 'info@canvi.co.jp').split(',').map((s) => s.trim()),
        reply_to: lead.email,
        subject: `【MedLead】お問い合わせ：${lead.company} ${lead.name}様`,
        text
      })
    }).then((r) => { if (!r.ok) throw new Error(`mail ${r.status}`); }));
  }

  if (!jobs.length) {
    console.error('[contact] 送信先の環境変数が1つも設定されていません');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === 'rejected');
  failed.forEach((f) => console.error('[contact]', f.reason && f.reason.message));
  // 1か所でも届いていれば受付済みとする（取りこぼしを防ぐため、失敗はログで確認）
  if (failed.length === results.length) return res.status(502).json({ ok: false, error: 'delivery_failed' });
  return res.status(200).json({ ok: true });
};
