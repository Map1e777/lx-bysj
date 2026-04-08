-- Organizations (defined before users due to FK reference)
CREATE TABLE IF NOT EXISTS orgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  owner_id INTEGER REFERENCES users(id),
  settings TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  system_role TEXT DEFAULT 'user',
  org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL,
  dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  org_role TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  org_id INTEGER REFERENCES orgs(id) ON DELETE SET NULL,
  dept_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  visibility TEXT DEFAULT 'private',
  share_token TEXT UNIQUE,
  share_expires_at DATETIME,
  tags TEXT DEFAULT '[]',
  word_count INTEGER DEFAULT 0,
  current_version INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);

-- Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_num INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_diff TEXT,
  word_count INTEGER DEFAULT 0,
  label TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  change_summary TEXT,
  is_major INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, version_num)
);

-- Document Permissions
CREATE TABLE IF NOT EXISTS document_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_by INTEGER NOT NULL REFERENCES users(id),
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  UNIQUE(document_id, user_id)
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  inviter_id INTEGER NOT NULL REFERENCES users(id),
  invitee_email TEXT NOT NULL,
  invitee_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  responded_at DATETIME
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  selection_ref TEXT,
  is_resolved INTEGER DEFAULT 0,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Permission Templates
CREATE TABLE IF NOT EXISTS permission_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT DEFAULT 'global',
  org_id INTEGER REFERENCES orgs(id) ON DELETE CASCADE,
  rules TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Version Rules
CREATE TABLE IF NOT EXISTS version_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT DEFAULT 'global',
  org_id INTEGER REFERENCES orgs(id) ON DELETE CASCADE,
  auto_save_interval INTEGER DEFAULT 300,
  max_versions_per_doc INTEGER DEFAULT 100,
  auto_version_on_save INTEGER DEFAULT 1,
  version_retention_days INTEGER DEFAULT 365,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System Config
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}',
  updated_by INTEGER REFERENCES users(id),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FTS virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title,
  content,
  content=documents,
  content_rowid=id
);
