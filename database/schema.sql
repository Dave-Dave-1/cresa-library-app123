-- Cresa Library / PostgreSQL schema
-- Use a dedicated database user with restricted permissions in production.

-- ---------------------------------------------------------------------------
-- ENUM types  (idempotent via DO $$ ... EXCEPTION WHEN duplicate_object ...)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'lecturer', 'administrator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status_type AS ENUM ('active', 'pending', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resource_type_enum AS ENUM ('book', 'journal', 'article', 'pdf', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resource_status_enum AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE theme_enum AS ENUM ('light', 'dark', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_message_role_enum AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE purpose_enum AS ENUM ('account_verification', 'password_reset', 'email_change');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                     UUID          NOT NULL PRIMARY KEY,
  full_name              VARCHAR(150)  NOT NULL,
  registration_number    VARCHAR(80)   NULL,
  lecturer_id            VARCHAR(80)   NULL,
  lecturer_email         VARCHAR(255)  NULL,
  pending_lecturer_email VARCHAR(255)  NULL,
  role                   user_role     NOT NULL,
  password_hash          VARCHAR(255)  NOT NULL,
  is_verified            BOOLEAN       NOT NULL DEFAULT FALSE,
  account_status         account_status_type NOT NULL DEFAULT 'pending',
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at          TIMESTAMPTZ   NULL,
  CONSTRAINT chk_user_identifier CHECK (
    (role = 'student'      AND registration_number IS NOT NULL AND lecturer_id IS NULL)
    OR
    (role IN ('lecturer', 'administrator') AND lecturer_id IS NOT NULL AND lecturer_email IS NOT NULL AND registration_number IS NULL)
  ),
  CONSTRAINT uq_registration_number UNIQUE (registration_number),
  CONSTRAINT uq_lecturer_id        UNIQUE (lecturer_id),
  CONSTRAINT uq_lecturer_email     UNIQUE (lecturer_email)
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, account_status);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id            BIGSERIAL     NOT NULL PRIMARY KEY,
  user_id       UUID          NOT NULL,
  code_hash     CHAR(64)      NOT NULL,
  purpose       purpose_enum  NOT NULL DEFAULT 'account_verification',
  expires_at    TIMESTAMPTZ   NOT NULL,
  used_at       TIMESTAMPTZ   NULL,
  attempt_count SMALLINT      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_verification_hash UNIQUE (code_hash)
);

CREATE INDEX IF NOT EXISTS idx_verification_user_expiry ON verification_tokens (user_id, expires_at);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id              UUID         NOT NULL PRIMARY KEY,
  avatar_url           VARCHAR(1024) NULL,
  institution          VARCHAR(200) NULL,
  course               VARCHAR(200) NULL,
  language             VARCHAR(10)  NOT NULL DEFAULT 'en',
  theme                theme_enum   NOT NULL DEFAULT 'system',
  notifications_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  ai_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  show_reading_activity BOOLEAN     NOT NULL DEFAULT TRUE,
  save_chat_history    BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGSERIAL    NOT NULL PRIMARY KEY,
  user_id    UUID         NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ  NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_password_reset_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_expiry ON password_reset_tokens (user_id, expires_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID         NOT NULL PRIMARY KEY,
  user_id      UUID         NOT NULL,
  token_hash   CHAR(64)     NOT NULL,
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ  NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_session_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON user_sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS resources (
  id                UUID                 NOT NULL PRIMARY KEY,
  created_by        UUID                 NOT NULL,
  title             VARCHAR(255)         NOT NULL,
  author            VARCHAR(255)         NOT NULL,
  description       TEXT                 NULL,
  resource_type     resource_type_enum   NOT NULL DEFAULT 'book',
  category          VARCHAR(100)         NULL,
  subject           VARCHAR(150)         NULL,
  course            VARCHAR(150)         NULL,
  tags              JSONB                NULL,
  publication_year  SMALLINT             NULL,
  file_path         VARCHAR(1024)        NULL,
  file_size_bytes   BIGINT               NULL,
  page_count        INTEGER              NULL,
  status            resource_status_enum NOT NULL DEFAULT 'draft',
  created_at        TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at      TIMESTAMPTZ          NULL,
  CONSTRAINT fk_resource_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_resources_status_category ON resources (status, category);
CREATE INDEX IF NOT EXISTS idx_resources_created_by      ON resources (created_by);

CREATE TABLE IF NOT EXISTS saved_resources (
  user_id     UUID        NOT NULL,
  resource_id UUID        NOT NULL,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT fk_saved_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_saved_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id          UUID           NOT NULL,
  resource_id      UUID           NOT NULL,
  current_page     INTEGER        NOT NULL DEFAULT 1,
  progress_percent NUMERIC(5,2)   NOT NULL DEFAULT 0.00,
  completed_at     TIMESTAMPTZ    NULL,
  last_read_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT chk_progress_percent CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT fk_progress_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_progress_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lecturer_assignments (
  id          UUID        NOT NULL PRIMARY KEY,
  lecturer_id UUID        NOT NULL,
  resource_id UUID        NOT NULL,
  title       VARCHAR(255) NOT NULL,
  due_at      TIMESTAMPTZ  NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id),
  CONSTRAINT fk_assignment_resource FOREIGN KEY (resource_id) REFERENCES resources(id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_lecturer ON lecturer_assignments (lecturer_id, due_at);

CREATE TABLE IF NOT EXISTS assignment_students (
  assignment_id UUID        NOT NULL,
  student_id    UUID        NOT NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id, student_id),
  CONSTRAINT fk_assignment_students_assignment FOREIGN KEY (assignment_id) REFERENCES lecturer_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_students_student    FOREIGN KEY (student_id)    REFERENCES users(id)               ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL    NOT NULL PRIMARY KEY,
  actor_id    UUID         NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id   UUID         NULL,
  metadata    JSONB        NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs (actor_id, created_at);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID         NOT NULL PRIMARY KEY,
  user_id    UUID         NOT NULL,
  title      VARCHAR(120) NOT NULL DEFAULT 'New academic conversation',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_conversation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_user_updated ON ai_conversations (user_id, updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID                 NOT NULL PRIMARY KEY,
  conversation_id UUID                 NOT NULL,
  role            ai_message_role_enum NOT NULL,
  content         TEXT                 NOT NULL,
  source_context  VARCHAR(255)         NULL,
  created_at      TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_message_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_message_conversation_created ON ai_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS community_posts (
  id         UUID        NOT NULL PRIMARY KEY,
  author_id  UUID        NOT NULL,
  content    TEXT        NOT NULL,
  tags       JSONB       NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_post_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts (created_at);

CREATE TABLE IF NOT EXISTS community_comments (
  id         UUID        NOT NULL PRIMARY KEY,
  post_id    UUID        NOT NULL,
  author_id  UUID        NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_comment_post   FOREIGN KEY (post_id)   REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_comment_author FOREIGN KEY (author_id) REFERENCES users(id)           ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_created ON community_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS community_reactions (
  post_id    UUID        NOT NULL,
  user_id    UUID        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_community_reaction_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_reaction_user FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_circles (
  id          UUID         NOT NULL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_community_circle_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS community_memberships (
  circle_id UUID        NOT NULL,
  user_id   UUID        NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (circle_id, user_id),
  CONSTRAINT fk_community_membership_circle FOREIGN KEY (circle_id) REFERENCES community_circles(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_membership_user   FOREIGN KEY (user_id)   REFERENCES users(id)             ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID         NOT NULL PRIMARY KEY,
  user_id    UUID         NOT NULL,
  actor_id   UUID         NULL,
  type       VARCHAR(40)  NOT NULL,
  message    VARCHAR(255) NOT NULL,
  entity_id  UUID         NULL,
  read_at    TIMESTAMPTZ  NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON notifications (user_id, read_at);
