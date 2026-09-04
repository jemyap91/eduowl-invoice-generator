-- Create subject_streams many-to-many join table
CREATE TABLE subject_streams (
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, stream_id)
);
CREATE INDEX idx_subject_streams_subject ON subject_streams(subject_id);
CREATE INDEX idx_subject_streams_stream ON subject_streams(stream_id);

-- Rows this migration depends on. The original seed has no JC streams and no H1 Mathematics.
INSERT INTO subjects (name, level) VALUES ('H1 Mathematics', 'all') ON CONFLICT (name) DO NOTHING;
INSERT INTO streams (name, level_order) VALUES ('JC 1', 12), ('JC 2', 13) ON CONFLICT (name) DO NOTHING;

-- Populate subject_streams mappings by name, so the migration works on any database.

-- English, Chinese, Higher Chinese -> all streams (Primary 1-6, Secondary 1-5, JC 1-2)
INSERT INTO subject_streams (subject_id, stream_id)
SELECT s.id, st.id FROM subjects s CROSS JOIN streams st
WHERE s.name IN ('English', 'Chinese', 'Higher Chinese')
  AND st.name IN ('Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
                  'Secondary 1', 'Secondary 2', 'Secondary 3', 'Secondary 4', 'Secondary 5',
                  'JC 1', 'JC 2')
ON CONFLICT DO NOTHING;

-- Mathematics -> Primary 1-6 only
INSERT INTO subject_streams (subject_id, stream_id)
SELECT s.id, st.id FROM subjects s CROSS JOIN streams st
WHERE s.name = 'Mathematics'
  AND st.name IN ('Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6')
ON CONFLICT DO NOTHING;

-- Elementary Mathematics -> Secondary 1-5 only
INSERT INTO subject_streams (subject_id, stream_id)
SELECT s.id, st.id FROM subjects s CROSS JOIN streams st
WHERE s.name = 'Elementary Mathematics'
  AND st.name IN ('Secondary 1', 'Secondary 2', 'Secondary 3', 'Secondary 4', 'Secondary 5')
ON CONFLICT DO NOTHING;

-- Additional Mathematics, Combined Science -> Secondary 3-5 only
INSERT INTO subject_streams (subject_id, stream_id)
SELECT s.id, st.id FROM subjects s CROSS JOIN streams st
WHERE s.name IN ('Additional Mathematics', 'Combined Science')
  AND st.name IN ('Secondary 3', 'Secondary 4', 'Secondary 5')
ON CONFLICT DO NOTHING;

-- H1 Mathematics -> JC 1-2 only
INSERT INTO subject_streams (subject_id, stream_id)
SELECT s.id, st.id FROM subjects s CROSS JOIN streams st
WHERE s.name = 'H1 Mathematics'
  AND st.name IN ('JC 1', 'JC 2')
ON CONFLICT DO NOTHING;
