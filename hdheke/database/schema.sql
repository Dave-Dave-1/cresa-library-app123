-- Cresa Library / MySQL 8 schema
-- Use a dedicated database user with restricted permissions in production.

CREATE DATABASE IF NOT EXISTS cresa_library
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cresa_library;

CREATE TABLE IF NOT EXISTS users (
  id BINARY(16) NOT NULL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  registration_number VARCHAR(80) NULL,
  lecturer_id VARCHAR(80) NULL,
  lecturer_email VARCHAR(255) NULL,
  pending_lecturer_email VARCHAR(255) NULL,
  role ENUM('student', 'lecturer', 'administrator') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status ENUM('active', 'pending', 'suspended') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,
  CONSTRAINT chk_user_identifier CHECK (
    (role = 'student' AND registration_number IS NOT NULL AND lecturer_id IS NULL)
    OR
    (role IN ('lecturer', 'administrator') AND lecturer_id IS NOT NULL AND lecturer_email IS NOT NULL AND registration_number IS NULL)
  ),
  UNIQUE KEY uq_registration_number (registration_number),
  UNIQUE KEY uq_lecturer_id (lecturer_id),
  UNIQUE KEY uq_lecturer_email (lecturer_email),
  KEY idx_users_role_status (role, account_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verification_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BINARY(16) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  purpose ENUM('account_verification', 'password_reset', 'email_change') NOT NULL DEFAULT 'account_verification',
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_verification_hash (code_hash),
  KEY idx_verification_user_expiry (user_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BINARY(16) NOT NULL PRIMARY KEY,
  avatar_url VARCHAR(1024) NULL,
  institution VARCHAR(200) NULL,
  course VARCHAR(200) NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  theme ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  show_reading_activity BOOLEAN NOT NULL DEFAULT TRUE,
  save_chat_history BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BINARY(16) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_password_reset_hash (token_hash),
  KEY idx_password_reset_user_expiry (user_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BINARY(16) NOT NULL PRIMARY KEY,
  user_id BINARY(16) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_session_token_hash (token_hash),
  KEY idx_sessions_user_expiry (user_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resources (
  id BINARY(16) NOT NULL PRIMARY KEY,
  created_by BINARY(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  description TEXT NULL,
  resource_type ENUM('book', 'journal', 'article', 'pdf', 'other') NOT NULL DEFAULT 'book',
  category VARCHAR(100) NULL,
  subject VARCHAR(150) NULL,
  course VARCHAR(150) NULL,
  tags JSON NULL,
  publication_year SMALLINT UNSIGNED NULL,
  file_path VARCHAR(1024) NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  page_count INT UNSIGNED NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  CONSTRAINT fk_resource_creator FOREIGN KEY (created_by) REFERENCES users(id),
  KEY idx_resources_status_category (status, category),
  KEY idx_resources_created_by (created_by)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_resources (
  user_id BINARY(16) NOT NULL,
  resource_id BINARY(16) NOT NULL,
  saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id BINARY(16) NOT NULL,
  resource_id BINARY(16) NOT NULL,
  current_page INT UNSIGNED NOT NULL DEFAULT 1,
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  completed_at TIMESTAMP NULL,
  last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT chk_progress_percent CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lecturer_assignments (
  id BINARY(16) NOT NULL PRIMARY KEY,
  lecturer_id BINARY(16) NOT NULL,
  resource_id BINARY(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  due_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id),
  CONSTRAINT fk_assignment_resource FOREIGN KEY (resource_id) REFERENCES resources(id),
  KEY idx_assignments_lecturer (lecturer_id, due_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignment_students (
  assignment_id BINARY(16) NOT NULL,
  student_id BINARY(16) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id, student_id),
  CONSTRAINT fk_assignment_students_assignment FOREIGN KEY (assignment_id) REFERENCES lecturer_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_students_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BINARY(16) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BINARY(16) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor_created (actor_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id BINARY(16) NOT NULL PRIMARY KEY,
  user_id BINARY(16) NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT 'New academic conversation',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_conversation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_ai_conversation_user_updated (user_id, updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_messages (
  id BINARY(16) NOT NULL PRIMARY KEY,
  conversation_id BINARY(16) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  source_context VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_message_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  KEY idx_ai_message_conversation_created (conversation_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_posts (
  id BINARY(16) NOT NULL PRIMARY KEY,
  author_id BINARY(16) NOT NULL,
  content TEXT NOT NULL,
  tags JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_post_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_community_posts_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_comments (
  id BINARY(16) NOT NULL PRIMARY KEY,
  post_id BINARY(16) NOT NULL,
  author_id BINARY(16) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_comment_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_comment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_community_comments_post_created (post_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_reactions (
  post_id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_community_reaction_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_reaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_circles (
  id BINARY(16) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS community_memberships (
  circle_id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (circle_id, user_id),
  CONSTRAINT fk_community_membership_circle FOREIGN KEY (circle_id) REFERENCES community_circles(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_membership_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BINARY(16) NOT NULL PRIMARY KEY,
  user_id BINARY(16) NOT NULL,
  actor_id BINARY(16) NULL,
  type VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  entity_id BINARY(16) NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_read (user_id, read_at)
) ENGINE=InnoDB;
