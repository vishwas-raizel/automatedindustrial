# Libraries Required to Run in VS Code

Good news: you don't install them one-by-one. All 75 npm packages are listed in package.json and installed with a single command. Plus 2 system-level tools.

## 1. System-Level Requirements (install these first)

| Tool | Why | Install |
| --- | --- | --- |
| Node.js 18+ | Runs the Next.js dev server | nodejs.org |
| Bun (recommended) or npm/yarn | Package manager + faster dev server | npm i -g bun |
| Python 3.10+ | Generates Excel reports (openpyxl) | python.org |
| openpyxl (Python lib) | Excel report generation | pip install openpyxl |
| Playwright (Node) | Generates PDF reports | auto-installed, but run npx playwright install chromium once |
| GitVersion control (optional) | Source control | git-scm.com |

## 2. VS Code Extensions (recommended)

Install these from the VS Code Extensions panel (Ctrl+Shift+X):

- ESLint (Microsoft) — Linting — matches our eslint.config.mjs
- Prettier (Prettier) — Code formatting
- Tailwind CSS IntelliSense (Tailwind Labs) — Autocomplete for Tailwind classes
- Prisma (Prisma) — Schema highlighting + formatting for prisma/schema.prisma
- TypeScript Vue Plugin or just built-in TS — TS support (built into VS Code)
- PostCSS Language Support — For editing globals.css

## 3. npm Libraries (auto-installed via bun install)

These are the key libraries the project actually uses (full list in package.json — 66 runtime + 9 dev):

### Core Framework
- next ^16.1.1 — Next.js 16 App Router
- react ^19 + react-dom ^19
- typescript ^5

### Styling & UI
- tailwindcss ^4 + @tailwindcss/postcss + tailwind-merge + tailwindcss-animate + tw-animate-css
- class-variance-authority + clsx — shadcn/ui class utilities
- lucide-react ^0.525 — icons
- framer-motion ^12 — animations

### shadcn/ui Components (Radix UI primitives — 28 packages)
- @radix-ui/react-* (accordion, dialog, select, tabs, slider, switch, tooltip, etc.)

### Data & Charts
- recharts ^2.15 — all dashboard charts (area, bar, pie, radar, scatter)
- @tanstack/react-query ^5 — server state
- @tanstack/react-table ^8 — inspection log table
- date-fns ^4 — date formatting

### Forms & Inputs
- react-hook-form ^7 + @hookform/resolvers + zod ^4
- react-day-picker, cmdk, input-otp, embla-carousel-react, vaul

### Database
- prisma ^6.11 + @prisma/client ^6.11 — ORM (SQLite)

### AI / Vision
- z-ai-web-dev-sdk ^0.0.18 — the VLM that powers defect detection (must stay server-side)

### Auth & State
- next-auth ^4 — authentication
- next-themes ^0.4 — dark/light mode
- zustand ^5 — client state
- sonner ^2 — toast notifications

### Utilities
- uuid ^11, sharp ^0.34 (image processing), next-intl, react-markdown, react-syntax-highlighter, @mdxeditor/editor, @reactuses/core, react-resizable-panels

## 4. Quick-Start Commands

```bash
# 1. Unzip
unzip project.zip -d defectvision-aicd defectvision-ai

# 2. Install ALL npm libraries at once (this reads package.json)
bun install            # or: npm install

# 3. Install Python lib for Excel reports
pip install openpyxl

# 4. Install Playwright browser (for PDF reports) — one time
npx playwright install chromium

# 5. Create .env file
echo 'DATABASE_URL="file:./db/custom.db"' > .env
echo 'ZAI_API_KEY="your-zai-api-key-here"' >> .env

# 6. Create the database
bun run db:push

# 7. Run it!
bun run dev
```

Then open http://localhost:3000 in your browser.

## Important Notes

| Library | Critical? | Notes |
| --- | --- | --- |
| z-ai-web-dev-sdk | Yes | The AI defect detection won't work without a valid ZAI_API_KEY in .env. Get one from the Z.ai platform. |
| openpyxl (Python) | Optional | Only needed for Excel report generation. PDF reports still work without it. |
| Playwright | Optional | Only needed for PDF report generation. Other features work without it. |
| sharp | Yes | Used for image processing — auto-installed with bun install. |
| All Radix UI packages | Yes | These are the shadcn/ui component primitives — already in package.json. |

The single most important thing: get a ZAI_API_KEY — without it, the Live Inspection feature (the AI defect detection) will fail, but all other views (Overview, History, Analytics, Reports, Audit, Settings) will still work since they use the seeded database.
