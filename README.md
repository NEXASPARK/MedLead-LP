# MedLead LP（medical-rpo.canvi.co.jp）

STUDIO から Vercel の静的サイトへ作り直したもの。内容は `MedLead_LP_修正指示書`（2026-11-15）のとおり。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 本文と `<head>`（題名・説明文・OGP・canonical・JSON-LD・GA4 `G-X2MWLP4VDM`） |
| `css/style.css` | 見た目。色は先頭の `:root`。768px未満がスマホ |
| `js/main.js` | チップ切り替え／追従ボタン／フォーム送信（`/api/contact`、成功時 `LPAnalytics.lead()`） |
| `js/lp-analytics.js` | **仮版**。正本 `canvi-lp-analytics/shared/lp-analytics.js` で上書きする |
| `api/contact.js` | **仮版**。サイヨウ90・テレアポ90 の `api/contact.js` で置き換える |
| `img/fv-team.jpg` | FVの集合写真（今のSTUDIOの素材をJPEG化・約125KB） |
| `img/ogp.png` | OGP画像 1200×630 |
| `favicon.ico`・`apple-touch-icon.png`・`img/favicon-*.png` | **仮のアイコン**。共有ドライブ「各種ロゴ/メドリード」のシンボルロゴで作り直す |
| `vercel.json` | `/privacypolicy` → Canvi のプライバシーポリシーへ |

## ローカル確認

```
npx serve .
```
（`/api/contact` はローカルに無いので、送信すると失敗の案内が出るのが正常。`vercel dev` なら関数も動く）

## 公開前に差し替えるもの

1. `api/contact.js` を他LPの流用版に（Canvas・#canvi_lp_notify・info@ の3か所）。LP名 `medlead`、form `contact`。
   仮版のまま使う場合は環境変数 `CANVAS_LEAD_ENDPOINT` / `SLACK_WEBHOOK_URL` / `RESEND_API_KEY`・`MAIL_FROM` を設定
2. `js/lp-analytics.js` を正本に（`npm run sync` の対象に MedLead を追加）
3. アイコン4点をシンボルロゴから作り直す
4. `sitemap.xml` の `lastmod` を公開日に

## 移行手順（指示書より）

1. GitHub の新リポジトリにこのフォルダを置き、Vercel プロジェクトを作成（他LPと同じチーム）。Preview で表示とフォームを確認
2. `medical-rpo.canvi.co.jp` を Vercel に追加し、DNS を STUDIO → Vercel に切り替え。http→https を確認
3. 独自ドメインへの切り替え後、Vercel の Settings → Domains で `○○.vercel.app` を `medical-rpo.canvi.co.jp` へ308転送にする（切り替え前に設定すると、CSS・画像まで独自ドメインに飛ばされて表示が崩れるため、vercel.json には書かない）
4. 切り替え確認後、STUDIO の公開を停止（`○○.studio.site` も残さない）。STUDIO のフォーム通知も停止
5. GTM `GTM-5W7JDC9D` の中身を確認し、必要なタグだけ残す（GA4の二重計測に注意。このサイトには入れていない）
6. Search Console で再クロール申請・`sitemap.xml` 送信。OGPの見え方を確認
7. テスト送信1件 → Canvas・#canvi_lp_notify・info@ に届くこと、GA4 に `generate_lead` が出ること
