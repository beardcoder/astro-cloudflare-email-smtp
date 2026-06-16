# 📮 astro-cloudflare-email-smtp

A tiny, silly test page showing how to send emails from an **Astro** contact form
over **SMTP** (`nodemailer`) — deployable to **Cloudflare Pages**.

Bleeding-edge stack:

- **Astro 5** with `output: "server"`
- **Astro Actions** (`astro:actions`) — typed form handler, works without JS too (progressive enhancement)
- **`astro:env`** — validated, typed secrets instead of `process.env`
- **`@astrojs/cloudflare`** adapter + `nodejs_compat` (deploys as a Cloudflare Worker)
- **nodemailer** over SMTP (STARTTLS 587 / TLS 465)

---

## ⚡ Quick start (local)

```bash
bun install
cp .dev.vars.example .dev.vars   # fill in your SMTP credentials
bun run dev                      # http://localhost:4321
```

> No real SMTP server at hand? Grab throwaway credentials in 5 seconds from
> [Ethereal Email](https://ethereal.email) and drop them into `.dev.vars`.

---

## ☁️ Deploying to Cloudflare Workers

This deploys as a **Cloudflare Worker** (the path Cloudflare now steers everyone to —
Pages and Workers have merged). The `@astrojs/cloudflare` adapter emits
`dist/_worker.js/index.js`, wired up in [`wrangler.jsonc`](./wrangler.jsonc).

```bash
bun run deploy          # = astro build && wrangler deploy
```

Then add the same variables as in `.dev.vars` as **secrets**, either via the dashboard
(**Workers & Pages → your Worker → Settings → Variables and Secrets**) or the CLI:

```bash
wrangler secret put SMTP_HOST
wrangler secret put SMTP_PORT
wrangler secret put SMTP_SECURE
wrangler secret put SMTP_USER
wrangler secret put SMTP_PASS
wrangler secret put MAIL_FROM
wrangler secret put MAIL_TO
```

> If you connect this repo via Git in the dashboard, set the build command to
> `bun run build` — Cloudflare picks up `main` + `assets` from `wrangler.jsonc`.

---

## ⚠️ Important: SMTP on Cloudflare

Cloudflare's runtime (workerd) is **not** Node. `nodemailer` needs TCP sockets,
which are only available via the **`nodejs_compat`** flag — already set in
[`wrangler.jsonc`](./wrangler.jsonc):

```jsonc
"compatibility_date": "2025-05-05",
"compatibility_flags": ["nodejs_compat"]
```

Also:

- **Port 25 is blocked on Cloudflare.** Use **587** (STARTTLS) or **465** (TLS).
- Set `SMTP_SECURE="true"` only for port 465, otherwise `"false"`.
- If outbound SMTP misbehaves with your provider: for production Cloudflare
  recommends an HTTP email service (Resend, Postmark, MailChannels …). For a
  **contact-form test**, classic SMTP via `nodemailer` is exactly right. 👍

---

## 🗂️ Structure

```
src/
├─ actions/index.ts   # sendTestMail – validation (zod) + nodemailer
├─ pages/index.astro  # the form & UI
└─ env.d.ts
astro.config.mjs       # adapter + astro:env schema
wrangler.jsonc         # nodejs_compat + Workers config (main + assets)
```
