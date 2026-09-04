# Pegasus Learning Academy - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack tuition agency management system with class scheduling, attendance tracking, and invoice generation.

**Architecture:** Next.js 14 App Router frontend with Supabase (PostgreSQL) backend. Client-side PDF generation with React-PDF. Tailwind CSS + shadcn/ui for UI components, customized to the Pegasus brand palette (teal #54ABA7 primary, Assistant font).

**Tech Stack:** Next.js 14, TypeScript, Supabase, Tailwind CSS, shadcn/ui, React-PDF, Google Fonts (Assistant)

**Node Version:** 18.16.1 (already installed)

**Design Reference:** See `docs/plans/2026-03-07-pegasus-management-system-design.md` and `pegasus_learning_academy_design.jpeg` for brand palette.

**Sample Invoice:** See `Ms Selena ( Student David) Jan'26 Invoice.pdf` for invoice format reference.

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Next.js project with TypeScript and Tailwind

**Files:**
- Create: Project root scaffolded by create-next-app

**Step 1: Create Next.js app**

```bash
cd /Users/jemyap/Projects/pegasus-learning-academy
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Note: When prompted, answer Yes to all defaults. The `.` installs in the current directory.

If it complains the directory is not empty, move the existing files temporarily:
```bash
mkdir /tmp/pegasus-temp
mv *.pdf *.jpeg docs /tmp/pegasus-temp/
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
mv /tmp/pegasus-temp/* .
rm -rf /tmp/pegasus-temp
```

**Step 2: Verify it runs**

```bash
npm run dev
```
Visit http://localhost:3000 — should see the Next.js default page.
Kill the dev server after confirming.

**Step 3: Commit**

```bash
git add -A
git commit -m "Initialize Next.js 14 project with TypeScript and Tailwind"
```

---

### Task 2: Install and configure shadcn/ui with Pegasus theme

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Create: `components.json` (by shadcn init)

**Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

**Step 2: Override CSS variables in `src/app/globals.css` with Pegasus palette**

Replace the `:root` CSS variables block with Pegasus brand colors. Map:
- Primary: #54ABA7 (teal) -> HSL ~176 33% 50%
- Secondary: #8CD5BF (light teal) -> HSL ~157 46% 69%
- Accent: #B9DEE3 (light blue) -> HSL ~187 43% 81%
- Background: #FFFFFF
- Foreground: #515151 (darker gray)
- Muted: #626262 (dark gray)

```css
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;500;600;700;800&display=swap');

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 32%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 32%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 32%;
    --primary: 176 33% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 157 46% 69%;
    --secondary-foreground: 0 0% 32%;
    --muted: 187 43% 81%;
    --muted-foreground: 0 0% 38%;
    --accent: 187 43% 81%;
    --accent-foreground: 0 0% 32%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 187 43% 81%;
    --input: 187 43% 81%;
    --ring: 176 33% 50%;
    --radius: 0.5rem;
  }
}

body {
  font-family: 'Assistant', sans-serif;
}
```

**Step 3: Update `tailwind.config.ts` to add Assistant font**

Add `fontFamily` to the theme extend:
```ts
fontFamily: {
  sans: ['Assistant', 'sans-serif'],
},
```

**Step 4: Install commonly needed shadcn components**

```bash
npx shadcn@latest add button card input label select dialog table tabs badge calendar dropdown-menu separator sheet toast form popover command
```

**Step 5: Commit**

```bash
git add -A
git commit -m "Configure shadcn/ui with Pegasus brand palette and components"
```

---

### Task 3: Install Supabase client and React-PDF

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

**Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @react-pdf/renderer date-fns lucide-react
```

**Step 2: Create `.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Note: The engineer must create a Supabase project at https://supabase.com and fill these in.

**Step 3: Create Supabase browser client at `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create Supabase server client at `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 5: Create database types placeholder at `src/lib/supabase/types.ts`**

```ts
export type Database = {
  public: {
    Tables: Record<string, never>
  }
}
```

This will be replaced with generated types from Supabase later.

**Step 6: Commit**

```bash
git add -A
git commit -m "Install Supabase client, React-PDF, and core dependencies"
```

---

## Phase 2: Database Schema

### Task 4: Create Supabase migration for all tables

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Install Supabase CLI (if not present)**

```bash
npm install -D supabase
npx supabase init
```

**Step 2: Create migration file `supabase/migrations/001_initial_schema.sql`**

```sql
-- ============================================
-- Pegasus Learning Academy - Initial Schema
-- ============================================

-- Reference Tables
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  level_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  capacity INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE class_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hourly_rate DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- People
CREATE TABLE tutors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE parent_students (
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, student_id)
);

-- Scheduling
CREATE TABLE class_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  tutor_id UUID NOT NULL REFERENCES tutors(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  stream_id UUID REFERENCES streams(id),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recurrence_start DATE NOT NULL,
  recurrence_end DATE,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES class_series(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  tutor_id UUID REFERENCES tutors(id),
  classroom_id UUID REFERENCES classrooms(id),
  class_type_id UUID REFERENCES class_types(id),
  stream_id UUID REFERENCES streams(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  is_adhoc BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE session_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT false,
  UNIQUE(session_id, student_id)
);

-- Invoicing
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  subtotal DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, month, year)
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hours DECIMAL(5,2),
  hourly_rate DECIMAL(10,2),
  total DECIMAL(10,2) NOT NULL,
  is_adhoc BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Settings
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  details TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE academy_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Pegasus Learning Academy',
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default academy info
INSERT INTO academy_info (name) VALUES ('Pegasus Learning Academy');

-- Seed default class types
INSERT INTO class_types (name, hourly_rate) VALUES ('1-to-1', 120.00);
INSERT INTO class_types (name, hourly_rate) VALUES ('Group', 80.00);

-- Seed default classrooms
INSERT INTO classrooms (name, capacity) VALUES ('Classroom 1', 10);
INSERT INTO classrooms (name, capacity) VALUES ('Classroom 2', 10);
INSERT INTO classrooms (name, capacity) VALUES ('Classroom 3', 10);

-- Indexes for common queries
CREATE INDEX idx_class_sessions_date ON class_sessions(date);
CREATE INDEX idx_class_sessions_series ON class_sessions(series_id);
CREATE INDEX idx_session_students_session ON session_students(session_id);
CREATE INDEX idx_session_students_student ON session_students(student_id);
CREATE INDEX idx_invoices_parent_month ON invoices(parent_id, year, month);
CREATE INDEX idx_students_stream ON students(stream_id);
```

**Step 3: Apply migration to Supabase**

Option A (remote): `npx supabase db push`
Option B (local): `npx supabase start` then `npx supabase db reset`

**Step 4: Generate TypeScript types**

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "Add database schema migration with all tables and seed data"
```

---

## Phase 3: App Layout and Navigation

### Task 5: Create the app shell with sidebar navigation

**Files:**
- Create: `src/app/layout.tsx` (modify existing)
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/page.tsx` -> redirect to dashboard

**Step 1: Create sidebar component at `src/components/layout/sidebar.tsx`**

Navigation items:
- Dashboard (LayoutDashboard icon)
- Schedule (Calendar icon)
- Students (GraduationCap icon)
- Tutors (Users icon)
- Invoices (FileText icon)
- Settings (Settings icon)

Use lucide-react icons. Sidebar should be:
- Fixed left, 250px width
- Pegasus logo at top
- Nav links with active state highlighting using primary teal
- Teal-tinted left border for active item

**Step 2: Create header component at `src/components/layout/header.tsx`**

- Page title (dynamic based on route)
- Current date display

**Step 3: Create dashboard layout at `src/app/(dashboard)/layout.tsx`**

Wraps all pages with sidebar + header. Uses a route group `(dashboard)`.

**Step 4: Create page stubs**

Create placeholder pages:
- `src/app/(dashboard)/page.tsx` — Dashboard
- `src/app/(dashboard)/schedule/page.tsx` — Schedule
- `src/app/(dashboard)/students/page.tsx` — Students
- `src/app/(dashboard)/tutors/page.tsx` — Tutors
- `src/app/(dashboard)/invoices/page.tsx` — Invoices
- `src/app/(dashboard)/settings/page.tsx` — Settings

Each just shows the page name in an h1 for now.

**Step 5: Verify navigation works**

```bash
npm run dev
```
Click through all nav links — each should highlight and show placeholder content.

**Step 6: Commit**

```bash
git add -A
git commit -m "Add app shell with sidebar navigation and page stubs"
```

---

## Phase 4: Settings Module (build first — other modules depend on this data)

### Task 6: Settings page with CRUD for all configurable entities

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`
- Create: `src/components/settings/subjects-settings.tsx`
- Create: `src/components/settings/streams-settings.tsx`
- Create: `src/components/settings/classrooms-settings.tsx`
- Create: `src/components/settings/class-types-settings.tsx`
- Create: `src/components/settings/payment-methods-settings.tsx`
- Create: `src/components/settings/academy-info-settings.tsx`

**Step 1: Build the settings page with tabs**

Use shadcn Tabs component. Tabs:
- Subjects
- Streams
- Classrooms
- Class Types & Rates
- Payment Methods
- Academy Info

**Step 2: Build each settings tab component**

Each tab follows the same pattern:
1. Fetch data from Supabase on mount
2. Display in a table (shadcn Table)
3. "Add" button opens a Dialog with a form
4. Each row has Edit and Delete actions
5. Inline editing or dialog-based editing

For **Subjects**: name field only
For **Streams**: name + level_order (for sorting, e.g. P1=1, P2=2, ... S1=7)
For **Classrooms**: name + capacity
For **Class Types**: name + hourly_rate (e.g. "1-to-1" at $120/hr)
For **Payment Methods**: name + details + display_order
For **Academy Info**: name, address, phone, email, logo upload (store in Supabase Storage)

**Step 3: Create reusable CRUD helpers at `src/lib/supabase/queries.ts`**

Generic functions for fetching, inserting, updating, deleting from any table.

**Step 4: Verify all CRUD operations work**

Add a subject, edit it, delete it. Same for streams, classrooms, etc.

**Step 5: Commit**

```bash
git add -A
git commit -m "Add settings page with CRUD for subjects, streams, classrooms, rates, and payment methods"
```

---

## Phase 5: People Management

### Task 7: Tutors CRUD page

**Files:**
- Create: `src/app/(dashboard)/tutors/page.tsx`
- Create: `src/components/tutors/tutor-list.tsx`
- Create: `src/components/tutors/tutor-form.tsx`

**Step 1: Build tutor list page**

- Table with columns: Name, Email, Phone, Actions (Edit/Delete)
- "Add Tutor" button at top
- Search/filter by name

**Step 2: Build tutor form (dialog)**

Fields: name (required), email, phone

**Step 3: Wire up Supabase CRUD**

- Fetch all tutors
- Insert new tutor
- Update tutor
- Delete tutor (with confirmation dialog)

**Step 4: Commit**

```bash
git add -A
git commit -m "Add tutors management page with CRUD operations"
```

---

### Task 8: Students & Parents CRUD page

**Files:**
- Create: `src/app/(dashboard)/students/page.tsx`
- Create: `src/components/students/student-list.tsx`
- Create: `src/components/students/student-form.tsx`
- Create: `src/components/students/parent-form.tsx`
- Create: `src/components/students/parent-student-link.tsx`

**Step 1: Build students page with two sections**

Use shadcn Tabs: "Students" and "Parents"

**Step 2: Students tab**

- Table: Name, Stream, Parent(s), Actions
- "Add Student" dialog: name, stream (dropdown from streams table)
- Edit/Delete actions

**Step 3: Parents tab**

- Table: Name, Email, Phone, Children, Actions
- "Add Parent" dialog: name, email, phone
- "Link Student" action: select from existing students to create parent_students relationship
- Display linked children as badges

**Step 4: Test linking**

Create a parent, create a student, link them. Verify the relationship shows correctly.

**Step 5: Commit**

```bash
git add -A
git commit -m "Add students and parents management with linking support"
```

---

## Phase 6: Class Scheduler

### Task 9: Create class series (recurring templates)

**Files:**
- Create: `src/app/(dashboard)/schedule/page.tsx`
- Create: `src/components/schedule/class-series-form.tsx`
- Create: `src/components/schedule/session-generator.ts`

**Step 1: Build "Create Class Series" form (dialog or sheet)**

Fields:
- Subject (dropdown)
- Tutor (dropdown)
- Classroom (dropdown: Classroom 1/2/3)
- Class Type (dropdown: 1-to-1 / Group)
- Stream (dropdown)
- Day of Week (dropdown: Mon-Sun)
- Start Time (time picker)
- End Time (time picker)
- Recurrence Start Date (date picker)
- Recurrence End Date (date picker, optional — null means ongoing)
- Students (multi-select: pick enrolled students)

**Step 2: Build session generator utility `src/components/schedule/session-generator.ts`**

When a series is created, auto-generate `class_sessions` rows:
- From recurrence_start to recurrence_end (or 3 months ahead if no end date)
- For each generated session, create `session_students` rows for enrolled students
- Use date-fns to iterate over weeks

```ts
import { eachWeekOfInterval, addDays, startOfWeek } from 'date-fns'

export function generateSessionDates(
  dayOfWeek: number,
  startDate: Date,
  endDate: Date
): Date[] {
  // Generate all dates matching dayOfWeek in the range
}
```

**Step 3: Wire up to Supabase**

- Insert class_series row
- Batch insert class_sessions
- Batch insert session_students for each session

**Step 4: Commit**

```bash
git add -A
git commit -m "Add class series creation with automatic session generation"
```

---

### Task 10: Calendar view for schedule

**Files:**
- Create: `src/components/schedule/calendar-view.tsx`
- Create: `src/components/schedule/week-view.tsx`
- Create: `src/components/schedule/day-view.tsx`
- Create: `src/components/schedule/session-card.tsx`

**Step 1: Build week view (default)**

- 7 columns (Mon-Sun) x time rows (8am-9pm in 30min slots)
- Each session renders as a colored block showing:
  - Subject name
  - Tutor name
  - Classroom
  - Class type badge (1-1 / Group)
  - Student count
- Color-code by classroom (Classroom 1 = teal, Classroom 2 = light teal, Classroom 3 = light blue)

**Step 2: Build day view**

- 3 columns (one per classroom)
- Time rows on the left
- Sessions as blocks within their classroom column
- Click a session to view/edit details

**Step 3: Build month view**

- Standard calendar grid
- Each day shows session count or compact session list
- Click a day to switch to day view

**Step 4: Add view toggle buttons**

Tabs or button group: Week | Day | Month
Date navigation: < Previous | Today | Next >

**Step 5: Build session card component**

Clickable card that opens a detail sheet/dialog showing:
- Full session details
- Enrolled students with attendance checkboxes
- Edit/Cancel session buttons
- Notes field

**Step 6: Commit**

```bash
git add -A
git commit -m "Add calendar views (week/day/month) with session cards"
```

---

### Task 11: Ad-hoc session creation and session editing

**Files:**
- Create: `src/components/schedule/adhoc-session-form.tsx`
- Create: `src/components/schedule/session-edit-form.tsx`

**Step 1: Build ad-hoc session form**

Similar to series form but for a single date:
- Subject, Tutor, Classroom, Class Type, Stream
- Date (date picker)
- Start Time, End Time
- Students (multi-select)
- `is_adhoc = true`, `series_id = null`

**Step 2: Build session edit form**

When clicking an existing session:
- Can change tutor, classroom, time, status
- Can cancel individual session (set status = 'cancelled')
- Can add/remove students for this specific session
- Shows notes field

**Step 3: Handle session cancellation**

- Set status to 'cancelled'
- Cancelled sessions show with strikethrough/muted styling on calendar
- Cancelled sessions are excluded from invoice calculations

**Step 4: Commit**

```bash
git add -A
git commit -m "Add ad-hoc session creation and session editing/cancellation"
```

---

### Task 12: Attendance tracking

**Files:**
- Modify: `src/components/schedule/session-card.tsx` (add attendance UI)
- Create: `src/components/schedule/attendance-sheet.tsx`

**Step 1: Build attendance sheet component**

When viewing a session, show:
- List of enrolled students with checkboxes
- "Mark All Present" / "Mark All Absent" buttons
- Save button to update `session_students.attended`

**Step 2: Add attendance summary to session card**

Show "3/5 attended" badge on session cards in calendar view.

**Step 3: Add attendance to day view**

Quick attendance mode: in day view, click a session to toggle attendance checkboxes inline.

**Step 4: Commit**

```bash
git add -A
git commit -m "Add attendance tracking with quick-mark and attendance sheet"
```

---

## Phase 7: Invoice Generation

### Task 13: Invoice list page and auto-calculation

**Files:**
- Create: `src/app/(dashboard)/invoices/page.tsx`
- Create: `src/components/invoices/invoice-list.tsx`
- Create: `src/components/invoices/generate-invoice-form.tsx`
- Create: `src/lib/invoices/calculate.ts`

**Step 1: Build invoice calculation utility `src/lib/invoices/calculate.ts`**

```ts
interface InvoiceLineItem {
  description: string
  hours: number
  hourlyRate: number
  total: number
  isAdhoc: boolean
}

export async function calculateInvoiceItems(
  parentId: string,
  month: number,
  year: number,
  supabase: SupabaseClient
): Promise<InvoiceLineItem[]> {
  // 1. Get all students linked to this parent
  // 2. For each student, get all completed sessions in the month where attended=true
  // 3. Group by student + class_type
  // 4. Calculate hours = sum of (end_time - start_time) for each group
  // 5. Look up hourly_rate from class_types
  // 6. Create line items: "[Student] [Subject] ([ClassType]) - Xhrs x $rate"
  // Return the line items
}
```

**Step 2: Build "Generate Invoice" form**

- Select Parent (dropdown with search)
- Select Month/Year (month picker)
- Click "Calculate" → shows preview of line items
- Add ad-hoc line items (description + amount)
- "Generate Invoice" button → saves to invoices + invoice_items tables

**Step 3: Build invoice list page**

- Table: Invoice #, Parent, Month/Year, Subtotal, Status, Actions
- Filter by month/year, status
- Actions: View, Download PDF, Mark as Sent, Mark as Paid, Delete

**Step 4: Commit**

```bash
git add -A
git commit -m "Add invoice generation with auto-calculation from attendance records"
```

---

### Task 14: PDF invoice generation with React-PDF

**Files:**
- Create: `src/components/invoices/invoice-pdf.tsx`
- Create: `src/components/invoices/download-button.tsx`

**Step 1: Build Invoice PDF template `src/components/invoices/invoice-pdf.tsx`**

Using @react-pdf/renderer, create a Document matching the sample invoice:

```tsx
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

// Register Assistant font
import { Font } from '@react-pdf/renderer'
Font.register({
  family: 'Assistant',
  src: 'https://fonts.gstatic.com/s/assistant/v19/2sDPZGJYnIjSi6H75xk7p0SEAG4.ttf'
})

// Styles using Pegasus palette
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Assistant', color: '#515151' },
  header: { flexDirection: 'row', marginBottom: 30 },
  logo: { width: 60, height: 60 },
  academyName: { fontSize: 24, color: '#54ABA7', fontWeight: 'bold' },
  invoiceFor: { fontSize: 14, marginBottom: 5 },
  table: { marginTop: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#54ABA7', color: '#fff', padding: 8 },
  tableRow: { flexDirection: 'row', padding: 8, borderBottom: '1px solid #B9DEE3' },
  colDesc: { flex: 3 },
  colHours: { flex: 1, textAlign: 'right' },
  colRate: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  subtotal: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTop: '2px solid #54ABA7' },
  paymentMethods: { marginTop: 30 },
})
```

Layout:
1. Pegasus logo + "PEGASUS LEARNING ACADEMY" header
2. "Invoice for: [Parent Name]" + "Month: [Month Year]"
3. Table: Description | Hours | Hourly Rate | Total
4. Line items (regular + ad-hoc)
5. Subtotal row
6. Payment Methods section (from payment_methods table)
7. "Total Due: $X,XXX.XX"

**Step 2: Build download button component**

```tsx
import { pdf } from '@react-pdf/renderer'

// Generate PDF blob and trigger download
const blob = await pdf(<InvoicePDF data={invoiceData} />).toBlob()
const url = URL.createObjectURL(blob)
// Trigger download with filename: "[Parent] [Student] [Month] Invoice.pdf"
```

**Step 3: Optionally upload PDF to Supabase Storage**

After generating, upload to `invoices/` bucket and save URL to `invoices.pdf_url`.

**Step 4: Verify PDF output**

Generate a test invoice and compare with the sample PDF format.

**Step 5: Commit**

```bash
git add -A
git commit -m "Add branded PDF invoice generation with React-PDF"
```

---

## Phase 8: Dashboard

### Task 15: Build the dashboard page

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Create: `src/components/dashboard/todays-classes.tsx`
- Create: `src/components/dashboard/revenue-summary.tsx`
- Create: `src/components/dashboard/quick-actions.tsx`
- Create: `src/components/dashboard/stats-cards.tsx`

**Step 1: Build stats cards**

Top row of 4 cards:
- Total Students (count)
- Total Tutors (count)
- Classes Today (count)
- Revenue This Month ($X,XXX)

Each card uses shadcn Card with an icon and the stat.

**Step 2: Build today's classes component**

Table/list showing today's sessions:
- Time, Subject, Tutor, Classroom, Stream, Students (count), Status
- Click to open session detail
- Quick attendance marking

**Step 3: Build revenue summary**

Simple bar chart or table showing monthly revenue for the last 6 months.
Use a lightweight approach — just styled divs as bars, no charting library needed.

**Step 4: Build quick actions**

Buttons:
- "New Class" → opens class series form
- "Generate Invoice" → navigates to invoices page
- "Add Student" → opens student form

**Step 5: Commit**

```bash
git add -A
git commit -m "Add dashboard with stats, today's classes, revenue summary, and quick actions"
```

---

## Phase 9: Polish and Final Integration

### Task 16: Responsive design and mobile support

**Step 1:** Make sidebar collapsible on mobile (hamburger menu)
**Step 2:** Ensure all tables are scrollable on small screens
**Step 3:** Calendar defaults to day view on mobile
**Step 4:** Test on 375px, 768px, 1024px, 1440px widths

**Commit:**
```bash
git add -A
git commit -m "Add responsive design and mobile navigation support"
```

---

### Task 17: Loading states, error handling, and empty states

**Step 1:** Add loading skeletons to all data-fetching pages (use shadcn Skeleton)
**Step 2:** Add error boundaries with user-friendly messages
**Step 3:** Add empty state illustrations/messages (e.g. "No students yet. Add your first student.")
**Step 4:** Add toast notifications for CRUD operations (use shadcn Toast)

**Commit:**
```bash
git add -A
git commit -m "Add loading states, error handling, and empty state messages"
```

---

### Task 18: End-to-end smoke test

**Step 1: Full workflow test**

1. Go to Settings → add subjects (English, Math), streams (Sec 1, Sec 2), verify classrooms exist
2. Go to Tutors → add a tutor
3. Go to Students → add a student, add a parent, link them
4. Go to Schedule → create a recurring class series (every Monday, English, Sec 1, Classroom 1, Group)
5. Verify sessions appear on calendar
6. Open a session → mark student as attended
7. Go to Invoices → generate invoice for the parent for this month
8. Verify line items are correct
9. Download PDF → verify it matches the Pegasus brand format
10. Mark invoice as sent

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "Final polish and integration fixes"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Project scaffolding (Next.js, shadcn, Supabase, React-PDF) |
| 2 | 4 | Database schema migration |
| 3 | 5 | App shell with sidebar navigation |
| 4 | 6 | Settings module (all configurable entities) |
| 5 | 7-8 | People management (tutors, students, parents) |
| 6 | 9-12 | Class scheduler (series, calendar, ad-hoc, attendance) |
| 7 | 13-14 | Invoice generation + PDF |
| 8 | 15 | Dashboard |
| 9 | 16-18 | Polish, responsive design, error handling, smoke test |
