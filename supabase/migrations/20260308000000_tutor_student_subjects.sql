-- Tutor-Subject associations (which subjects a tutor teaches)
CREATE TABLE tutor_subjects (
  tutor_id UUID REFERENCES tutors(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (tutor_id, subject_id)
);

-- Tutor-Stream associations (which levels/streams a tutor teaches)
CREATE TABLE tutor_streams (
  tutor_id UUID REFERENCES tutors(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  PRIMARY KEY (tutor_id, stream_id)
);

-- Student-Subject associations (which subjects a student takes)
CREATE TABLE student_subjects (
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, subject_id)
);

-- Indexes
CREATE INDEX idx_tutor_subjects_tutor ON tutor_subjects(tutor_id);
CREATE INDEX idx_tutor_subjects_subject ON tutor_subjects(subject_id);
CREATE INDEX idx_tutor_streams_tutor ON tutor_streams(tutor_id);
CREATE INDEX idx_student_subjects_student ON student_subjects(student_id);
