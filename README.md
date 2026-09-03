<!-- TODO: replace assets/logo-preview.webp and assets/logo.svg with the Grocery logo. -->
<p align="center">
  <img src="./assets/logo-preview.webp" alt="Grocery" width="200">
</p>

# Grocery

Grocery is a monorepo containing a NestJS API and a React single-page application. It was
generated from the [Lonestone boilerplate](https://github.com/lonestone/lonestone-boilerplate)
and keeps that stack's tooling and conventions.

[![CI ✨](https://github.com/tatiana-grange/grocery/actions/workflows/ci.yml/badge.svg)](https://github.com/tatiana-grange/grocery/actions/workflows/ci.yml)

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Docker Services](#-docker-services)
- [Useful Commands](#️-useful-commands)
- [Development](#-development)
- [Continuous Integration (CI)](#-continuous-integration-ci)
- [Contributing](#-contributing)
- [Documentation](#-documentation)
- [Deployment](#-deployment)

## 🔍 Overview

This project uses a monorepo architecture. The main advantages:

- Full-stack features developed without context switching, in a single PR;
- Easier deployment: no need to synchronize multiple separate deployments;
- Strong end-to-end typing, easier refactoring;
- Unified tooling (linter, build, etc.).

## 🛠️ Tech Stack

See the [Architecture](apps/documentation/src/content/docs/explanations/1_architecture.mdx) page for more details.

## 📁 Project Structure

See the [Architecture](apps/documentation/src/content/docs/explanations/1_architecture.mdx) page for more details.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (version 24.13.0)
- [PNPM](https://pnpm.io/) (version 10.28.2)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

You can use [fnm](https://github.com/Schniz/fnm) to manage your Node version:

```bash
fnm use 24.13.0
npm i -g pnpm@10.28.2
```

## 🚀 Installation

Install dependencies:

```bash
pnpm install
```

Then run the setup script. It detects the apps, prompts for database and port configuration,
configures SMTP (MailDev), copies and fills the `.env` files, and can start Docker services
and run migrations:

```bash
pnpm rock
```

Start the applications in development mode:

```bash
pnpm dev
```

### Manual Setup (Alternative)

1. Copy environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web-spa/.env.example apps/web-spa/.env
cp packages/openapi-generator/.env.example packages/openapi-generator/.env
```

⚠️ In most of those `.env` files, the API url and port are used. Update all of them to match
your API url and port.

2. Start Docker services:

```bash
pnpm docker:up
```

3. Run migrations or set up your schema following the [API README](apps/api/README.md).

## 🐳 Docker Services

Docker Compose provides:

- PostgreSQL — database server
- MailDev — SMTP server for development (not for production)

## ⌨️ Useful Commands

### Docker

- **Start Docker services**: `pnpm docker:up`
- **Stop Docker services**: `pnpm docker:down`
- **View Docker logs**: `pnpm docker:logs`

### Development

- **Start development**: `pnpm dev`
- **Build applications**: `pnpm build`
- **Lint applications**: `pnpm lint`
- **Format code**: `pnpm fmt`
- **Generate OpenAPI clients**: `pnpm generate`

### Database (API)

- **Create migration**: `pnpm --filter=api db:migrate:create`
- **Run migrations**: `pnpm --filter=api db:migrate:up`
- **Rollback last migration**: `pnpm --filter=api db:migrate:down`
- **Initialize data**: `pnpm --filter=api db:fresh:seed`

### Tests

- **Run unit + API tests**: `pnpm test`
- **Run the web-spa end-to-end suite** (Playwright, real API + SPA, disposable Docker infra):
  `pnpm e2e` — see [Web SPA E2E](apps/documentation/src/content/docs/guides/web-spa-e2e.mdx)

## 💻 Development

### Applications

- The API is built with NestJS and provides a REST API. See the [API README](apps/api/README.md).
- The web-spa is built with React and provides a single-page application. See the [Web SPA README](apps/web-spa/README.md).

Start each application in development mode:

```bash
# From the root folder
pnpm --filter=api dev

# From its own folder
cd apps/api && pnpm dev
```

### Shared Packages

- `@grocery/ui` — reusable UI components built with shadcn/ui.
- `@grocery/openapi-generator` — the generator plus the generated types, validators, and SDK
  for frontend-backend communication. Imported by the frontend app.
- `@grocery/i18n` — shared internationalization.

## 🔄 Continuous Integration (CI)

GitHub Actions workflows live in `.github/workflows/`. The CI workflow (`ci.yml`) runs on
pushes and pull requests and checks lint and format (oxlint / oxfmt), TypeScript types, and
the build.

For more information, see the [GitHub Actions documentation](.github/ACTIONS.md).

### CD Workflow

The CD workflow (`push-to-ghcr.yml`) builds an image per runnable app (API, web-spa) and
pushes them to GHCR. A push to `main` produces a SHA-tagged image for each app; a `v*` tag
produces versioned images.

See [Release and versioning](apps/documentation/src/content/docs/references/1_release_and_versionning.mdx)
for how the project versions and what each environment runs.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how we write commits and pull requests.

## 📚 Documentation

The technical documentation lives in `apps/documentation/`. An index of every page is at
[`apps/documentation/INDEX.md`](apps/documentation/INDEX.md).

- [General Guidelines](apps/documentation/src/content/docs/references/general.mdx)
- [Frontend Guidelines](apps/documentation/src/content/docs/references/frontend.mdx)
- [Backend Guidelines](apps/documentation/src/content/docs/references/backend.mdx)
- [API Readme](apps/api/README.md)
- [Frontend Readme](apps/web-spa/README.md)

## 🔍 Tracing Architecture

The API traces application spans (controllers, services, database queries) to Sentry for
performance monitoring and error tracking. Tracing is initialized in
`apps/api/src/instrument.ts` and started when the API server boots. See the
[monitoring documentation](apps/documentation/src/content/docs/core-features/2_monitoring.mdx)
for details.

## 🚀 Deployment

Your options for deploying the applications:

- Use a PaaS such as Render or Dokploy to build and host the services;
- Build the applications via Docker and publish their images to a registry;
- Use docker-compose (not recommended).

An example Docker Compose configuration is in `docker-compose.yml` at the project root. See
the per-app README files for how to build and run Docker images.
