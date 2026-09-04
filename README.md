# EduOwl

Management platform for EduOwl English Academy (classroom scheduling, attendance, invoicing) and EduOwl Tutor Matching (home tutoring timesheets, approvals, invoicing).

Built with Next.js, Supabase, Tailwind CSS, and shadcn/ui.

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- A Supabase project

### Setup

```bash
nvm use 22
npm install
cp .env.example .env.local   # then fill in your Supabase credentials
npm run dev
```

Local Supabase reads the Google OAuth env vars from your shell when it starts:

    set -a; source .env.local; set +a
    npx supabase start

Google sign-in is disabled in the local config by default so the stack starts without credentials; the e2e suite signs in with password-grant test users (`npm run seed:test-users`). To test Google locally, put real values in `.env.local`, set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`, and restart the stack.

## User Guide

### Step 1: Configure Your Academy

Go to **Settings** and set up your foundation data:

- Add your **subjects** (English, Mathematics, etc.) and **streams** (Primary 1-6, Secondary 1-5)
- Name your **classrooms** and set **class types & rates** (e.g. 1-to-1 at $120/hr, Group at $80/hr)
- Add your **payment methods** (PayNow, bank transfer) and fill in your **academy info** (name, address, phone) — this appears on invoices

### Step 2: Add Your People

- **Tutors** — Add each tutor with their name, email, phone, subjects, and levels they teach
- **Students** — Add each student with their name and stream
- **Parents** — Add parent contact details, then link them to their children

### Step 3: Schedule Classes

- **Recurring classes**: Go to **Schedule > Class Series**, create a series by picking the subject, tutor, classroom, day/time, and enrolled students — the system generates all sessions automatically
- **One-off classes**: Use the **Extra Class** button on the calendar for trial lessons or make-up classes

### Step 4: Track Attendance

Click any class on the **Calendar** to open its details. Check off which students attended, then hit **Save Attendance & Complete**. Use the **All Classes** tab to search and filter across all past and upcoming sessions.

### Step 5: Generate Invoices

Go to **Invoices > Generate Invoice**, select a parent and billing month. The system calculates hours attended per student automatically. Add any extra items (textbooks, materials), then preview, download the PDF, and mark as sent or paid. Need to make changes later? Click **Edit** on any unpaid invoice to modify descriptions, adjust totals, delete line items, or use **Add Line Item** to append additional charges.
