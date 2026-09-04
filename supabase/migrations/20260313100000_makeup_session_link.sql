-- Add makeup_for_session_id to link makeup sessions to cancelled sessions
ALTER TABLE class_sessions ADD COLUMN makeup_for_session_id UUID REFERENCES class_sessions(id) ON DELETE SET NULL;
CREATE INDEX idx_class_sessions_makeup ON class_sessions(makeup_for_session_id) WHERE makeup_for_session_id IS NOT NULL;
