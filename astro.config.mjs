import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // Server-rendered: we need a real request handler for the SMTP action.
  output: "server",

  adapter: cloudflare({
    // platformProxy mirrors the Cloudflare bindings (env vars from .dev.vars)
    // into `astro dev`, so local dev behaves like Cloudflare Pages.
    platformProxy: { enabled: true },
  }),

  // astro:env – typed, validated secrets. No more process.env juggling.
  env: {
    schema: {
      SMTP_HOST: envField.string({ context: "server", access: "secret" }),
      SMTP_PORT: envField.number({ context: "server", access: "secret", default: 587 }),
      // "starttls" (port 587), "ssl" (port 465) or "none" (plain, dev only)
      SMTP_SECURITY: envField.enum({
        context: "server",
        access: "secret",
        values: ["starttls", "ssl", "none"],
        default: "starttls",
      }),
      SMTP_USER: envField.string({ context: "server", access: "secret" }),
      SMTP_PASS: envField.string({ context: "server", access: "secret" }),
      MAIL_FROM: envField.string({ context: "server", access: "secret" }),
      MAIL_TO: envField.string({ context: "server", access: "secret" }),
      // HMAC key for the spam-protection time token. Optional — falls back to a
      // dev value, but set a real secret in production to prevent token forging.
      FORM_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
