# 01 BitLab: a Computer Engineering Playground

**Build logic circuits, experiment with binary, and program an 8-bit CPU, all in the browser.**

🔗 **Live demo:** [vercelapp-pi-lake.vercel.app](https://vercelapp-pi-lake.vercel.app)

BitLab is an interactive lab for learning how computers work at the lowest level, from single logic gates up to a working processor. All three tools work without an account. If you sign in, you can save circuits and programs to the cloud, open them again on any device, and store your own lab files.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres%20%7C%20Storage-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)

---

## ✨ Features

### ⊕ Logic Circuit Simulator (`/logic`)
- Add switches, LEDs and gates (**AND, OR, NOT, NAND, NOR, XOR, XNOR**), then drag them around and wire them together.
- Toggle the inputs and watch signals flow through the circuit in real time.
- A **truth table** and **Boolean expressions** are built automatically. Click a row of the truth table to set the switches to match.
- Circuits with feedback, such as the **SR latch**, are supported.
- Built-in examples: half adder, full adder, SR latch and 2:1 multiplexer.

### 🔢 Bit Lab (`/bits`)
- Converts numbers between **binary, hexadecimal, octal and decimal**, in 8, 16 or 32 bits.
- Shows **two's complement** for signed values and the layout of an **IEEE-754** floating-point number.
- Runs bitwise and arithmetic operations (AND, OR, XOR, shifts, add, subtract) and shows the **carry and overflow flags**.

### ⚙ 8-bit CPU Emulator (`/cpu`)
- A **two-pass assembler** and emulator for a small instruction set that is easy to learn.
- Four registers (`A`–`D`), **Z/C/N flags**, a stack, `CALL`/`RET` and 256 bytes of memory.
- Run a whole program or **step through it one instruction at a time**, and watch the registers, flags and memory change.
- Example programs: Countdown, Hello World, Fibonacci, Multiply (using a subroutine) and Bubble sort.

### ☁ My Cloud (`/dashboard`)
- Sign up and sign in with an email and password.
- Click **Save to cloud** in the simulator or the emulator to save your work, and reopen it from any device.
- Upload, download and delete your own files (lab reports, schematics, datasheets, `.asm` files; up to 10 MB each).
- Every user's data is private, which the database itself enforces with row-level security.

---

## 🧠 CPU instruction set

| Group | Instructions |
| --- | --- |
| Data movement | `MOV`, `LD`, `ST`, `PUSH`, `POP` |
| Arithmetic and logic | `ADD`, `SUB`, `AND`, `OR`, `XOR`, `NOT`, `INC`, `DEC`, `SHL`, `SHR`, `CMP` |
| Control flow | `JMP`, `JZ`, `JNZ`, `JC`, `JNC`, `JN`, `CALL`, `RET`, `NOP`, `HLT` |
| Output | `OUT` (print a number), `OUTC` (print a character) |
| Data | `DB` (define bytes and strings) |

Operands can be a register (`A`), a constant or label (`10`, `loop`), a memory address (`[0x80]`) or a register used as a pointer (`[B]`).

For example, this program prints "Hello, World!":

```asm
        MOV B, msg    ; B = address of the string
loop:   LD A, [B]     ; A = memory[B]
        CMP A, 0
        JZ done       ; stop at the 0 terminator
        OUTC A
        INC B         ; move to the next character
        JMP loop
done:   HLT

msg:    DB "Hello, World!", '\n', 0
```

---

## 🏗 Architecture

```
Browser ──► Next.js on Vercel (App Router, Server Components, Server Actions, Proxy)
                 │
                 ▼
             Supabase
             ├── Auth      : email/password accounts, cookie sessions (@supabase/ssr)
             ├── Postgres  : `projects` table (saved circuits and programs as JSONB)
             └── Storage   : private `files` bucket, one folder per user
```

- **Authentication.** Supabase Auth with cookie-based sessions. [`src/proxy.ts`](src/proxy.ts) refreshes the session on every request and protects `/dashboard`.
- **Database.** Saved circuits and programs are rows in `public.projects`. **Row-level security** lets each user read and change only their own rows.
- **File storage.** Files are kept in a private bucket, and storage policies limit each user to their own `<user-id>/` folder. Downloads use signed links that expire after 60 seconds.
- **Safe redirects.** After sign-in, users can only be sent to pages on this site, so the login page can't be used to redirect people to another website ([`src/lib/safe-next.ts`](src/lib/safe-next.ts)).
- **Works offline.** All the tools work if Supabase isn't configured. Only the cloud features are turned off.

---

## 🚀 Getting started

### Prerequisites
- [Node.js](https://nodejs.org) 20 or later
- A free [Supabase](https://supabase.com) account (only needed for the cloud features)

### 1. Clone and install

```bash
git clone https://github.com/Ahmad980-code/bitlab.git
cd bitlab
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the table, the security policies and the storage bucket.
3. Go to **Project Settings → API Keys** and copy the **Project URL** and the **publishable key**.
4. Go to **Authentication → URL Configuration** and add `http://localhost:3000/auth/callback` to **Redirect URLs**.
5. Optional: to skip confirmation emails while testing, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**.

### 3. Add your environment variables

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## ☁ Deploying to Vercel

1. Push this repository to GitHub.
2. At [vercel.com/new](https://vercel.com/new), import the repository. Vercel detects Next.js automatically.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Click **Deploy**.
5. In Supabase, go to **Authentication → URL Configuration**. Set the **Site URL** to your Vercel URL, and add `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**.

You can also deploy from the terminal with the Vercel CLI by running `npx vercel --prod`.

---

## 📁 Project structure

```
src/
├── app/
│   ├── page.tsx              landing page
│   ├── logic/                logic circuit simulator
│   ├── bits/                 Bit Lab
│   ├── cpu/                  CPU emulator
│   ├── login/                sign in / sign up
│   ├── dashboard/            My Cloud: saved projects and files
│   ├── auth/callback/        email-confirmation handler
│   └── actions.ts            server actions (sign out, delete project)
├── components/               LogicSim, BitLab, CpuEmulator, CloudSave, FileManager, LoginForm, Nav
├── lib/
│   ├── logic.ts              circuit simulation engine and example circuits
│   ├── cpu.ts                instruction set, assembler, emulator and example programs
│   ├── safe-next.ts          redirect checking
│   └── supabase/             browser and server Supabase clients, config
└── proxy.ts                  session refresh and route protection
supabase/
└── schema.sql                tables, row-level security and storage policies
```

---

## 🛣 Ideas for the future

- Password reset ("Forgot password?")
- Exporting circuits as images and sharing them with a link
- More components: clocked flip-flops and a 7-segment display
- Showing CPU output in a memory-mapped screen

---

## 👤 Author

**Ahmad Saleem Awan**, [@Ahmad980-code](https://github.com/Ahmad980-code)<br>
Computer Engineering Student at COMSATS University Islamabad, Abbottabad Campus

If you find BitLab useful, consider giving the repo a ⭐.

Built with Next.js, Supabase and Vercel.
