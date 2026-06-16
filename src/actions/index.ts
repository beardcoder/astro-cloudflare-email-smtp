import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import nodemailer from "nodemailer";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURITY,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO,
  FORM_SECRET,
} from "astro:env/server";
import { verifyFormToken } from "../lib/spam-guard";

export const server = {
  sendTestMail: defineAction({
    // `accept: "form"` => the action consumes classic FormData and therefore
    // works even without any JavaScript (progressive enhancement).
    accept: "form",
    input: z.object({
      name: z.string().min(1, "What's your name? 😄").max(80),
      email: z.string().email("That doesn't look like an email 🤔"),
      message: z
        .string()
        .min(5, "A little more prose, please ✍️")
        .max(2000, "Wow, a novel. Please keep it shorter 📚"),
      // Honeypot: real humans leave this empty, bots fill it in.
      website: z.string().max(0, "Caught you, bot 🤖").optional(),
      // Signed time token issued on render (spam protection).
      t: z.string().optional(),
    }),
    handler: async ({ name, email, message, t }) => {
      // GDPR-friendly spam protection: verify the signed time token before
      // doing any work. No personal data, no third party, no storage.
      const guard = await verifyFormToken(FORM_SECRET, t);
      if (!guard.ok) {
        const messages = {
          "too-fast": "Whoa, that was fast — are you a robot? 🤖 Take a breath and try again.",
          expired: "This form has been sitting around too long. Please reload the page 🔄",
          "bad-signature": "That submission looks tampered with. Please reload the page 🔄",
          malformed: "Something's off with the form. Please reload the page 🔄",
        } as const;
        throw new ActionError({ code: "BAD_REQUEST", message: messages[guard.reason] });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURITY === "ssl", // implicit TLS on port 465
        requireTLS: SMTP_SECURITY === "starttls", // force STARTTLS upgrade on 587
        ignoreTLS: SMTP_SECURITY === "none", // plain — dev/testing only
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      try {
        const info = await transporter.sendMail({
          from: MAIL_FROM,
          to: MAIL_TO,
          replyTo: `${name} <${email}>`,
          subject: `📨 New test message from ${name}`,
          text: `${message}\n\n— ${name} <${email}>`,
          html: renderEmail({ name, email, message }),
        });

        return {
          ok: true,
          messageId: info.messageId,
          preview: nodemailer.getTestMessageUrl(info) || null,
        };
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : "Unknown error";
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: `The SMTP server said no: ${reason}`,
        });
      }
    },
  }),
};

function renderEmail({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}) {
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0b0e14;font-family:ui-sans-serif,system-ui,sans-serif;color:#e6edf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#11161f;border:1px solid #1f2733;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7ee787;">📬 New contact form test</td></tr>
          <tr><td style="padding:0 28px 20px;font-size:22px;font-weight:700;">Hey, someone just messaged you!</td></tr>
          <tr><td style="padding:0 28px 24px;">
            <p style="margin:0 0 4px;color:#8b949e;font-size:13px;">From</p>
            <p style="margin:0 0 16px;font-size:15px;">${safe(name)} &lt;${safe(email)}&gt;</p>
            <p style="margin:0 0 4px;color:#8b949e;font-size:13px;">Message</p>
            <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${safe(message)}</p>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #1f2733;font-size:12px;color:#586069;">
            Sent via nodemailer · Astro · Cloudflare Pages 🚀
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
