# Openleaf Frontend 🍃

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v1.0.0-blue.svg)](https://github.com/saranshhalwai/openleaf-frontend/releases)

The modern, ultra-responsive web application for **Openleaf** — an open-source collaborative LaTeX editor. Built on **SvelteKit 2** (with Svelte 5 runes) and deployed globally to **Cloudflare Workers**.

---

## ⚡ Features

- **Full-Featured LaTeX Workspace**:
  - Split-view editor and real-time PDF preview.
  - CodeMirror 6 editor with LaTeX syntax highlighting, line numbers, and theme integration.
  - Real-time Yjs CRDT collaborative editing with multi-user cursor tracking and presence badges.
  - Strict read-only mode for viewers with dedicated UI indicators.
  - Debounced 1-second autosave to persistent storage.
- **Starter Templates**:
  - Interactive template picker in the "New Project" modal.
  - Supports Standard Article, IEEE Conference Paper (with `references.bib`), Resume/CV, and Beamer Presentation Slides.
- **Project Export**:
  - One-click source ZIP archive download directly from workspace or dashboard.
  - Direct PDF download from the preview pane.
- **Authentication**:
  - Powered by [Better-Auth](https://www.better-auth.com).
  - Social OAuth (GitHub & Google) with native navigation redirects.
  - Email/password authentication with Resend email verification.
- **Collaborator Management**:
  - Dedicated Share dialog to invite members and assign `owner`, `editor`, or `viewer` roles.

---

## 🛠️ Tech Stack

- **Framework**: [SvelteKit 2](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) (Runes)
- **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com) via `@sveltejs/adapter-cloudflare`
- **Editor**: [CodeMirror 6](https://codemirror.net) + `@codemirror/lang-lezer`
- **Collaboration**: [Yjs](https://yjs.dev) CRDT + `y-codemirror.next` + `y-protocols`
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) + Lucide Icons
- **Database ORM**: [Drizzle ORM](https://orm.drizzle.team) + Neon Serverless PostgreSQL

---

## 💻 Local Development

### Prerequisites
- [Bun](https://bun.sh) (or Node.js 20+)
- Running Openleaf Go Backend (default: `http://localhost:8080`)
- Neon PostgreSQL connection string

### Setup

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure environment variables**:
   Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

   ```ini
   DATABASE_URL="postgres://user:password@host:port/db-name"
   BETTER_AUTH_SECRET="your-32-character-secret-key"
   ORIGIN="http://localhost:5173"
   PUBLIC_BACKEND_URL="http://localhost:8080"
   ```

3. **Start local development server**:
   ```bash
   bun run dev
   ```

4. **Build production bundle**:
   ```bash
   bun run build
   ```

---

## 🚀 Production Deployment

Deployed to Cloudflare Workers using Wrangler:

```bash
bun x wrangler deploy
```

Runtime environment variables are configured in `wrangler.jsonc` and Cloudflare dashboard secrets.

---

## 📄 License

This project is licensed under the [Apache License, Version 2.0](LICENSE).
