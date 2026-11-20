/** Resend通知・自動返信 → 共通のCanvas登録・Slack通知 → lead_idを返す。 */
'use strict';

const lpLeads = require('./_lib/lp-leads.cjs');

// index.html の「採用希望時期」の選択肢と合わせる
const TIMINGS = ['今すぐに採用したい', '3ヶ月以内に採用したい', '半年以内に採用したい', 'まだ決めていない', '採用以外（営業・DX）の相談'];

function clean(value) {
  return String(value == null ? '' : value).trim().slice(0, 2000);
}

async function sendMail(payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY.trim(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) {
    // Resend のエラー内容（未認証ドメインなど）を原因調査のためにログへ残す。APIキーは含まれない
    const detail = await response.text().catch(() => '');
    throw new Error('Resend ' + response.status + ' ' + detail.replace(/\s+/g, ' ').slice(0, 300));
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const p = req.body || {};
  if (p._hp) return res.status(200).json({ ok: true });

  const data = {};
  ['company', 'name', 'email', 'timing', 'message'].forEach((key) => {
    data[key] = clean(p[key]);
  });
  data.tel = lpLeads.normalizeTel(p.tel);
  if (!data.company || !data.name || !lpLeads.isValidTel(data.tel) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !TIMINGS.includes(data.timing) || p.agree !== 'on') {
    return res.status(400).json({ ok: false, error: 'missing fields' });
  }

  const { RESEND_API_KEY, INQUIRY_FROM } = process.env;
  if (!RESEND_API_KEY || !INQUIRY_FROM) {
    console.error('contact: RESEND_API_KEY / INQUIRY_FROM is not configured');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const formLabel = '無料相談フォーム';
  const items = [
    ['会社名・医院名', data.company], ['お名前', data.name], ['電話番号', data.tel],
    ['メールアドレス', data.email], ['採用希望時期', data.timing], ['その他', data.message]
  ];
  const details = items.map(([label, value]) => label + '：' + (value || '（未入力）'));
  const notifyTo = (process.env.INQUIRY_TO || 'info@canvi.co.jp').split(',').map((s) => s.trim()).filter(Boolean);

  try {
    if (notifyTo.length) {
      await sendMail({
        from: INQUIRY_FROM, to: notifyTo, reply_to: data.email,
        subject: '【MedLead】お問い合わせ：' + data.company.replace(/[\r\n]/g, ' '),
        text: [
          'MedLead LPからお問い合わせがありました。', '',
          ...details, '送信元：' + clean(p.page_url || p.page)
        ].join('\n')
      });
    }
    await sendMail({
      from: INQUIRY_FROM, to: [data.email],
      subject: '【MedLead・受付完了】お問い合わせありがとうございます',
      text: [
        data.company, data.name + ' 様', '',
        'このたびはMedLead（メドリード）へお問い合わせいただき、ありがとうございます。',
        '以下の内容で受け付けました。担当者より折り返しご連絡いたします。', '',
        '────────────', ...details, '────────────', '', '※本メールは送信専用です。'
      ].join('\n')
    });
  } catch (err) {
    console.error('contact: send failed', err.message);
    return res.status(500).json({ ok: false, error: 'send failed' });
  }

  // Canvas・Slackが失敗しても、共通モジュールがログを残し送信成功を返す。
  const lead = await lpLeads.recordLead({
    req, body: { ...p, ...data }, lpName: 'medlead',
    contact: { company: data.company, name: data.name, email: data.email, tel: data.tel },
    formLabel, items
  });
  return res.status(200).json({ ok: true, lead_id: lead.leadId });
};
