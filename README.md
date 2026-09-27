# BitLab: a Computer Engineering Playground

BitLab is a Next.js web app with three interactive tools for learning how computers work. It uses cloud services for user accounts, a database, and file storage.

| Tool | What it does |
| --- | --- |
| **Logic Circuit Simulator** (`/logic`) | Drag gates (AND, OR, NOT, NAND, NOR, XOR, XNOR) onto a board, wire them up and toggle switches. It builds a live truth table and Boolean expression. Supports feedback circuits such as the SR latch. |
| **Bit Lab** (`/bits`) | Converts between binary, hex, octal and decimal in 8, 16 or 32 bits. Shows two's complement and the IEEE-754 float layout, and runs bitwise and arithmetic operations with carry and overflow flags. |
| **8-bit CPU Emulator** (`/cpu`) | A two-pass assembler and emulator for a small ISA with 4 registers, Z/C/N flags, a stack, CALL/RET and 256 bytes of memory. You can step through programs and watch the registers and memory change. |

## Cloud architecture

```
Browser ──► Next.js on Vercel (App Router, Server Components, Server Actions, Proxy)
                 │
                 ▼
             Supabase
             ├── Auth      : email/password accounts, cookie sessions (@supabase/ssr)
             ├── Postgres  : `projects` table (saved circuits and programs as JSONB)
             └── Storage   : private `files` bucket, one folder per user
```

- **Authentication**: sign-up and sign-in with Supabase Auth. [src/proxy.ts](src/proxy.ts) refreshes the session cookie on every request and protects `/dashboard`.
- **Cloud database**: "Save to cloud" in the simulator and the emulator writes to `public.projects`. Row-level security means each user can only read or change their own rows.
- **File storage**: the "My Cloud" dashboard lets users upload, download (through short-lived signed URLs) and delete files in a private bucket. Storage policies restrict each user to their own `<user-id>/` folder.
- **Hosting**: deployed on Vercel.

All the tools still work if Supabase isn't configured. Only the cloud features are turned off.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
```

## Setting up Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [supabase/schema.sql](supabase/schema.sql), and click **Run**. This creates the table, the security policies and the storage bucket.
3. Open **Project Settings → API** and copy the **Project URL** and the **publishable (anon) key**.
4. Copy `.env.example` to `.env.local` and fill in both values, then restart `npm run dev`.
5. Optional: to skip confirmation emails while testing, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**.
6. Open **Authentication → URL Configuration** and add `http://localhost:3000/auth/callback`, plus your Vercel URL followed by `/auth/callback` once you've deployed, to the **Redirect URLs**.

## Deploying to Vercel

1. Push this repository to GitHub.
2. At [vercel.com/new](https://vercel.com/new), import the repository. Vercel detects Next.js automatically.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Click **Deploy**. Then set your Vercel URL as the **Site URL** in Supabase and add it to the redirect URLs (step 6 above).

## Project structure

```
src/
  app/                 routes: /, /logic, /bits, /cpu, /login, /dashboard, /auth/callback
  components/          LogicSim, BitLab, CpuEmulator, CloudSave, FileManager, LoginForm, Nav
  lib/logic.ts         circuit simulation engine and example circuits
  lib/cpu.ts           ISA definition, assembler, emulator and example programs
  lib/supabase/        browser and server Supabase clients, config
  proxy.ts             session refresh and route protection
supabase/schema.sql    database tables, row-level security and storage policies
```
