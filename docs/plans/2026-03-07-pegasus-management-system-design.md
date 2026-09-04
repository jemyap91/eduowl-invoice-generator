# Pegasus Learning Academy Management System - Design Document

**Date:** 2026-03-07
**Status:** Approved

## Overview

A full-stack web application for Pegasus Learning Academy (Singapore tuition agency) to manage class scheduling, attendance tracking, and invoice generation.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **PDF Generation:** React-PDF (client-side)
- **Font:** Assistant (Google Fonts)

## Brand Palette

| Color        | Hex       | Usage                     |
|-------------|-----------|---------------------------|
| Primary Teal | `#54ABA7` | Buttons, headers, accents |
| Light Teal   | `#8CD5BF` | Hover states, badges      |
| Light Blue   | `#B9DEE3` | Backgrounds, cards        |
| White        | `#FFFFFF` | Page backgrounds          |
| Dark Gray    | `#626262` | Secondary text            |
| Darker Gray  | `#515151` | Primary text              |

## Core Modules

### 1. Dashboard
- Today's classes at a glance (tutor, subject, classroom, students)
- Monthly revenue summary
- Quick actions: "Add Class", "Generate Invoice"

### 2. Class Scheduler
- Calendar view (week/day/month) with 3 classrooms as columns
- Recurring events: "Every Monday 3-5pm" creates weekly instances, each individually editable/cancellable
- One-off sessions: trial lessons, makeup classes
- Each class has: tutor, subject, stream, classroom (1-3), class type (1-1/group), enrolled students
- Attendance tracking: mark students present/absent per session

### 3. Students & Parents
- Student profile: name, stream, subjects enrolled
- Parent profile: name, contact, email, billing info
- A parent can have multiple students (siblings)

### 4. Tutors
- Tutor profile: name, contact, subjects they teach
- View tutor's weekly schedule

### 5. Invoice Generation
- Select parent -> pick billing month -> system auto-calculates:
  - Hours attended per student per class type
  - Applies correct hourly rate (1-1 vs group)
  - Lists each line item (e.g. "David English Lesson (1-1) - 6hrs x $120")
- Add ad-hoc line items (textbooks, materials, registration)
- One-click PDF generation via React-PDF (Pegasus branded)
- Store generated invoices in Supabase Storage

### 6. Settings (Configurable)
- Subjects (English, Math, Science, etc.)
- Streams (Primary 1-6, Secondary 1-5, JC, etc.)
- Classrooms (names/labels for 3 rooms)
- Hourly rates per class type (1-1, Group)
- Payment methods (PayNow, bank transfer, etc.)
- Academy info (name, logo, address, contact)

## Database Schema

### Reference Tables
- `subjects` (id, name, created_at)
- `streams` (id, name, level_order, created_at)
- `classrooms` (id, name, capacity, created_at)
- `class_types` (id, name, hourly_rate, created_at) -- "1-1", "Group"

### People
- `tutors` (id, name, email, phone, created_at)
- `students` (id, name, stream_id, created_at)
- `parents` (id, name, email, phone, created_at)
- `parent_students` (parent_id, student_id) -- siblings support

### Scheduling
- `class_series` (id, subject_id, tutor_id, classroom_id, class_type_id, stream_id, day_of_week, start_time, end_time, recurrence_start, recurrence_end)
- `class_sessions` (id, series_id, date, start_time, end_time, status, notes) -- individual instances (auto-generated or ad-hoc)
- `session_students` (session_id, student_id, attended) -- attendance

### Invoicing
- `invoices` (id, parent_id, month, year, subtotal, status, created_at, pdf_url)
- `invoice_items` (id, invoice_id, description, hours, hourly_rate, total, is_adhoc)

### Settings
- `payment_methods` (id, name, details, display_order, created_at)
- `academy_info` (id, name, address, phone, email, logo_url)

## Invoice PDF Layout

Matches sample format:
- Pegasus logo + academy name header
- "Invoice for: [Parent Name]"
- "Month: [Month Year]"
- Table: Description | Hours | Hourly Rate | Total
- Line items per student per class type
- Ad-hoc items (textbooks, etc.)
- Subtotal
- Configured payment methods
- Total due

## Key Design Decisions

1. **Supabase over Firebase** - Relational data model (tutors <-> classes <-> students <-> invoices) is a natural fit for PostgreSQL. Complex queries (monthly revenue, attendance reports) are trivial in SQL.
2. **React-PDF over server-side** - No extra server infrastructure. Instant generation. Data is already in the browser.
3. **Configurable settings** - Subjects, streams, rates, payment methods are all editable by the agency owner. No developer needed to add a new subject.
4. **Recurring + ad-hoc scheduling** - class_series defines recurring templates; class_sessions are individual instances that can be modified independently.
5. **Attendance-driven invoicing** - Invoices calculate from actual attendance records, ensuring accuracy.
