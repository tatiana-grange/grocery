# Email Module

Sends every e-mail of the API through SMTP with nodemailer (`email.service.ts`). The mails are
React Email templates under `templates/`, all in French, on one shared layout.

The settings, the templates, the logo and the preview command are described in the documentation
app: `apps/documentation/src/content/docs/core-features/5_email.mdx`.

Quick start: run `pnpm --filter=api email:preview` and open `http://localhost:3090` to see every
template.
