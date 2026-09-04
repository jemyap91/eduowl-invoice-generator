-- Create subject_streams many-to-many join table
CREATE TABLE subject_streams (
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, stream_id)
);
CREATE INDEX idx_subject_streams_subject ON subject_streams(subject_id);
CREATE INDEX idx_subject_streams_stream ON subject_streams(stream_id);

-- Insert new subject: H1 Mathematics
INSERT INTO subjects (name, level) VALUES ('H1 Mathematics', 'all');

-- Populate subject_streams mappings

-- English → ALL streams (Primary 1-6, Secondary 1-5, JC 1-2)
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('1aa896ee-229b-4238-901a-86c7c7648463', '63168894-5977-4b8a-91be-e3fad2226c1f'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '8d8d7860-8e60-44d9-a29c-43e646805771'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', 'cbb92f2d-e12a-434b-a879-24f4ffc27ef6'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '41e66993-f0f1-4f85-8142-8534349445df'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', 'febade0a-df19-4785-9c8e-f27f0a2e3212'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '078e19c6-4ed7-4a57-a983-ad211d101e8f'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', 'abc9b0f5-1ed7-450f-b7ca-32e48d9b7ccb'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', 'a172be4e-e172-4b9b-afa9-f5f591069152'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '386a46c6-856c-457d-92fd-f161dd982c15'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '67178495-c886-4d00-9a15-07af68f9d383'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '6c62d890-8714-433e-8b1f-4c585de8e745'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '7bc3bbc4-5dcc-406a-ae4b-ec8257f3e413'),
  ('1aa896ee-229b-4238-901a-86c7c7648463', '8e2debbf-77e4-44e3-8bdf-ab908df18134');

-- Chinese → ALL streams (Primary 1-6, Secondary 1-5, JC 1-2)
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '63168894-5977-4b8a-91be-e3fad2226c1f'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '8d8d7860-8e60-44d9-a29c-43e646805771'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', 'cbb92f2d-e12a-434b-a879-24f4ffc27ef6'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '41e66993-f0f1-4f85-8142-8534349445df'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', 'febade0a-df19-4785-9c8e-f27f0a2e3212'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '078e19c6-4ed7-4a57-a983-ad211d101e8f'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', 'abc9b0f5-1ed7-450f-b7ca-32e48d9b7ccb'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', 'a172be4e-e172-4b9b-afa9-f5f591069152'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '386a46c6-856c-457d-92fd-f161dd982c15'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '67178495-c886-4d00-9a15-07af68f9d383'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '6c62d890-8714-433e-8b1f-4c585de8e745'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '7bc3bbc4-5dcc-406a-ae4b-ec8257f3e413'),
  ('d90c8a5c-443e-44cc-a11d-beb7fcf33f41', '8e2debbf-77e4-44e3-8bdf-ab908df18134');

-- Higher Chinese → ALL streams (Primary 1-6, Secondary 1-5, JC 1-2)
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '63168894-5977-4b8a-91be-e3fad2226c1f'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '8d8d7860-8e60-44d9-a29c-43e646805771'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', 'cbb92f2d-e12a-434b-a879-24f4ffc27ef6'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '41e66993-f0f1-4f85-8142-8534349445df'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', 'febade0a-df19-4785-9c8e-f27f0a2e3212'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '078e19c6-4ed7-4a57-a983-ad211d101e8f'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', 'abc9b0f5-1ed7-450f-b7ca-32e48d9b7ccb'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', 'a172be4e-e172-4b9b-afa9-f5f591069152'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '386a46c6-856c-457d-92fd-f161dd982c15'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '67178495-c886-4d00-9a15-07af68f9d383'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '6c62d890-8714-433e-8b1f-4c585de8e745'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '7bc3bbc4-5dcc-406a-ae4b-ec8257f3e413'),
  ('92f41570-a78d-4dca-8d46-06169e12ddec', '8e2debbf-77e4-44e3-8bdf-ab908df18134');

-- Mathematics → Primary 1-6 only
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('e970f3a1-a8c7-4dfd-8f4a-756efe074b04', '63168894-5977-4b8a-91be-e3fad2226c1f'),
  ('e970f3a1-a8c7-4dfd-8f4a-756efe074b04', '8d8d7860-8e60-44d9-a29c-43e646805771'),
  ('e970f3a1-a8c7-4dfd-8f4a-756efe074b04', 'cbb92f2d-e12a-434b-a879-24f4ffc27ef6'),
  ('e970f3a1-a8c7-4dfd-8f4a-756efe074b04', '41e66993-f0f1-4f85-8142-8534349445df'),
  ('e970f3a1-a8c7-4dfd-8f4a-756efe074b04', 'febade0a-df19-4785-9c8e-f27f0a2e3212'),
  ('e970f3a1-a8c7-4dfd-8f4a-756efe074b04', '078e19c6-4ed7-4a57-a983-ad211d101e8f');

-- Elementary Mathematics → Secondary 1-5 only
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('855fee04-b11b-4cfd-a545-0ee95b0fa3da', 'abc9b0f5-1ed7-450f-b7ca-32e48d9b7ccb'),
  ('855fee04-b11b-4cfd-a545-0ee95b0fa3da', 'a172be4e-e172-4b9b-afa9-f5f591069152'),
  ('855fee04-b11b-4cfd-a545-0ee95b0fa3da', '386a46c6-856c-457d-92fd-f161dd982c15'),
  ('855fee04-b11b-4cfd-a545-0ee95b0fa3da', '67178495-c886-4d00-9a15-07af68f9d383'),
  ('855fee04-b11b-4cfd-a545-0ee95b0fa3da', '6c62d890-8714-433e-8b1f-4c585de8e745');

-- Additional Mathematics → Secondary 3-5 only
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('da5af128-a9ea-4ed4-aa2f-d8c78c30f3c9', '386a46c6-856c-457d-92fd-f161dd982c15'),
  ('da5af128-a9ea-4ed4-aa2f-d8c78c30f3c9', '67178495-c886-4d00-9a15-07af68f9d383'),
  ('da5af128-a9ea-4ed4-aa2f-d8c78c30f3c9', '6c62d890-8714-433e-8b1f-4c585de8e745');

-- Combined Science → Secondary 3-5 only
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ('eba0ce78-f490-460d-8360-cb45279de418', '386a46c6-856c-457d-92fd-f161dd982c15'),
  ('eba0ce78-f490-460d-8360-cb45279de418', '67178495-c886-4d00-9a15-07af68f9d383'),
  ('eba0ce78-f490-460d-8360-cb45279de418', '6c62d890-8714-433e-8b1f-4c585de8e745');

-- H1 Mathematics → JC 1-2 only (use subquery for the newly inserted subject)
INSERT INTO subject_streams (subject_id, stream_id) VALUES
  ((SELECT id FROM subjects WHERE name = 'H1 Mathematics'), '7bc3bbc4-5dcc-406a-ae4b-ec8257f3e413'),
  ((SELECT id FROM subjects WHERE name = 'H1 Mathematics'), '8e2debbf-77e4-44e3-8bdf-ab908df18134');
