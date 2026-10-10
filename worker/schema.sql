-- Classroom mode for the eCTD Dossier Builder (Cloudflare D1).
-- Tables carry an ectd_ prefix so they can live in a D1 database shared with other apps.

CREATE TABLE IF NOT EXISTS ectd_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  instructor_name TEXT NOT NULL,
  instructor_email TEXT,
  instructor_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ectd_members (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES ectd_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  user_id TEXT,
  token_hash TEXT NOT NULL,
  joined_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ectd_members_class ON ectd_members(class_id);

CREATE TABLE IF NOT EXISTS ectd_assignments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES ectd_classes(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  due_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ectd_assignments_class ON ectd_assignments(class_id);

CREATE TABLE IF NOT EXISTS ectd_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES ectd_assignments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES ectd_members(id) ON DELETE CASCADE,
  submitted_at TEXT NOT NULL,
  score INTEGER NOT NULL,
  verified_score INTEGER,
  axes TEXT,
  counts TEXT,
  checks TEXT,
  project TEXT NOT NULL,
  size INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ectd_submissions_assignment ON ectd_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS ectd_submissions_member ON ectd_submissions(member_id);

CREATE TABLE IF NOT EXISTS ectd_comments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES ectd_submissions(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ectd_comments_submission ON ectd_comments(submission_id);

CREATE TABLE IF NOT EXISTS ectd_reminders (
  assignment_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (assignment_id, member_id)
);
