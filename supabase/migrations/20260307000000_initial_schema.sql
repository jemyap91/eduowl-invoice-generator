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
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
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

-- Seed data
INSERT INTO academy_info (name) VALUES ('Pegasus Learning Academy');
INSERT INTO class_types (name, hourly_rate) VALUES ('1-to-1', 120.00);
INSERT INTO class_types (name, hourly_rate) VALUES ('Group', 80.00);
INSERT INTO classrooms (name, capacity) VALUES ('Classroom 1', 10);
INSERT INTO classrooms (name, capacity) VALUES ('Classroom 2', 10);
INSERT INTO classrooms (name, capacity) VALUES ('Classroom 3', 10);

-- Indexes
CREATE INDEX idx_class_sessions_date ON class_sessions(date);
CREATE INDEX idx_class_sessions_series ON class_sessions(series_id);
CREATE INDEX idx_session_students_session ON session_students(session_id);
CREATE INDEX idx_session_students_student ON session_students(student_id);
CREATE INDEX idx_invoices_parent_month ON invoices(parent_id, year, month);
CREATE INDEX idx_students_stream ON students(stream_id);
