# MedLead LP（medical-rpo.canvi.co.jp）

STUDIO から Vercel の静的サイトへ作り直したもの。内容は `MedLead_LP_修正指示書`（2026-11-15）のとおり。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 本文と `<head>`（題名・説明文・OGP・canonical・JSON-LD・LP別GA4 `G-X2MWLP4VDM`） |
| `css/style.css` | 見た目。色は先頭の `:root`。768px未満がスマホ |
| `js/main.js` | チップ切り替え／追従ボタン／フォーム送信（`/api/contact`、成功時 `LPAnalytics.lead(lead_id)`） |
| `js/lp-analytics.js` | GA4イベント・流入元の記録（`canvi-lp-analytics` からの自動コピー。直接編集しない） |
| `api/contact.js` | フォーム送信API（メール通知・自動返信 → Canvas登録 → Slack通知） |
| `api/_lib/lp-leads.cjs` | Canvas・Slack の共通処理（`canvi-lp-analytics` からの自動コピー。直接編集しない） |
| `tests/` | 送信APIのテスト（外部送信はモック）。`npm test` |
| `.env.example` | Vercel に登録する環境変数の一覧（値は書かない） |
| `img/fv-team.jpg` | FVの集合写真（今のSTUDIOの素材をJPEG化・約125KB） |
| `img/ogp.png` | OGP画像 1200×630 |
| `favicon.ico`・`apple-touch-icon.png`・`img/favicon-*.png` | アイコン。STUDIO 時代のファビコン（2つの丸 `#316AC3`・`#B0CBF5` のSVG）から作成（2026-11-20）。`favicon.ico` は16・32・48px、`apple-touch-icon.png` は180pxの白地 |
| `vercel.json` | `/privacypolicy` → Canvi のプライバシーポリシーへ。送信APIのタイムアウト30秒 |

## 環境変数

`.env.example` の項目を Vercel（Production / Preview）に登録します。値は Git に入れないでください。

- `RESEND_API_KEY`・`INQUIRY_FROM` が未設定だと送信APIは 503 を返します。`CANVAS_API_KEY`・`SLACK_LEADS_WEBHOOK_URL` は未設定ならその連携だけをスキップします。
- `INQUIRY_FROM` は Resend で認証済みの `lp.canvi.co.jp` のアドレスにします（`MedLead <info@lp.canvi.co.jp>`）。`canvi.co.jp` 本体のアドレスは Resend が 403 で拒否します。
- `INQUIRY_TO` は社内通知の宛先（カンマ区切りで複数可）。未設定なら `info@canvi.co.jp`。
- `SLACK_LEADS_WEBHOOK_URL`・`CANVAS_API_KEY` は他LPと同じもの（Slack は他LPのリード通知と同じチャンネル）。

## フォーム送信

- フォームは `/api/contact` に JSON で送ります。会社名・医院名・お名前・電話番号・メール・採用希望時期（選択）・プライバシーポリシーへの同意が必須、その他は任意です。
- 電話番号は全角数字・ハイフンをそろえ、数字10〜15桁か確認します。送信中・送信後はボタンを押せません（二重登録防止）。
- Resend で社内通知と自動返信 → Canvas にリード登録 → Slack に通知 → `lead_id` を返します（他LPと同じ順序）。
- メール送信の失敗はエラーを返します。Canvas・Slack の失敗はログに残し、メール送信済みの申込は成功扱いです。隠し欄 `_hp` に入力がある送信は破棄します。Preview からのリードは会社名に「【テスト】」が付きます。
- 「採用以外（営業・DX）の相談」も採用希望時期の選択肢として受け付け、メール・Slack・Canvas（`rawData.timing`）にそのまま出します。

## 計測

- GA4：LP別プロパティ `G-X2MWLP4VDM`（STUDIO から引き継ぎ。`index.html` の gtag）と統合プロパティ `G-94VP2CRKS8`（`js/lp-analytics.js` が追加）に並行送信。`lp_name=medlead`（秒速面談と同じ扱い）。
- イベント：`page_view`、`form_view`、`form_start`、送信成功後の `generate_lead`（`lead_id` 付き）。フォームの入力内容は GA4 に送りません。
- UTM・参照元・着地パスを保存し、送信時のURLと合わせて Canvas に渡します。Canvas の `sourceDetail` は「MedLead」。
- 週次レポート・ダッシュボードは `canvi-lp-analytics/lib/ga4.cjs` のホスト対応表で判定します（`medical-rpo.canvi.co.jp` と `medlead-lp.vercel.app`）。
- `js/lp-analytics.js` と `api/_lib/lp-leads.cjs` は `../canvi-lp-analytics/shared/` の正本を `npm run sync` でコピーしたものです。

## 本番DNS（STUDIO → Vercel の切り替え）

管理先はお名前.com。Vercel プロジェクト `medlead-lp` にドメイン追加済み（2026-11-20）。
本番デプロイ（このリポジトリと canvi-lp-analytics のマージ）が済んでから、次のとおり変更する（TTLは3600）。

| 操作 | TYPE | ホスト名 | 値 |
| --- | --- | --- | --- |
| 削除 | A | `medical-rpo` | `34.111.141.225`（STUDIO） |
| 追加 | CNAME | `medical-rpo` | `f1b632a46af70511.vercel-dns-016.com` |
| 追加 | TXT | `_vercel` | `vc-domain-verify=medical-rpo.canvi.co.jp,6757936232329dd6953f` |

- `_vercel` の TXT は他のサブドメイン用の既存レコードを残したまま1件追加する。TXT だけなら先に入れても表示は変わらない
- 切り替え後、Vercel の Settings → Domains で `medlead-lp.vercel.app` を `medical-rpo.canvi.co.jp` へ308転送にする

## ローカル確認

```
npx serve .
```
（`/api/contact` はローカルに無いので、送信すると失敗の案内が出るのが正常。`vercel dev` なら関数も動く）

```
npm test
```
（実際のメール送信・Canvas登録・Slack投稿は行いません）

## 公開前に差し替えるもの

1. ~~`api/contact.js` を他LPと同じ構成に~~（2026-11-20 済み）。Vercel に環境変数を登録する（上記「環境変数」）
2. ~~`js/lp-analytics.js` を正本に~~（2026-11-20 済み。`canvi-lp-analytics/config/lps.json` に追加）
3. ~~アイコン4点をシンボルロゴから作り直す~~（2026-11-20 済み。STUDIO 時代のファビコンの2つの丸から作成）
4. `sitemap.xml` の `lastmod` を公開日に

## 移行手順（指示書より）

1. GitHub の新リポジトリにこのフォルダを置き、Vercel プロジェクトを作成（他LPと同じチーム）。Preview で表示とフォームを確認
2. `medical-rpo.canvi.co.jp` を Vercel に追加し、DNS を STUDIO → Vercel に切り替え。http→https を確認
3. 独自ドメインへの切り替え後、Vercel の Settings → Domains で `○○.vercel.app` を `medical-rpo.canvi.co.jp` へ308転送にする（切り替え前に設定すると、CSS・画像まで独自ドメインに飛ばされて表示が崩れるため、vercel.json には書かない）
4. 切り替え確認後、STUDIO の公開を停止（`○○.studio.site` も残さない）。STUDIO のフォーム通知も停止
5. GTM `GTM-5W7JDC9D` の中身を確認し、必要なタグだけ残す（GA4の二重計測に注意。このサイトには入れていない）
6. Search Console で再クロール申請・`sitemap.xml` 送信。OGPの見え方を確認
7. テスト送信1件 → Canvas・Slack（他LPと同じリード通知チャンネル）・info@・自動返信に届くこと、GA4 に `generate_lead` が出ること（Preview で先に確認できる）
