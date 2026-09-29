-- Run once against an existing cresa_library database created before profile support.
USE cresa_library;

ALTER TABLE users
  MODIFY role ENUM('student', 'lecturer', 'administrator') NOT NULL,
  ADD COLUMN pending_lecturer_email VARCHAR(255) NULL AFTER lecturer_email;

ALTER TABLE verification_tokens
  MODIFY purpose ENUM('account_verification', 'password_reset', 'email_change') NOT NULL DEFAULT 'account_verification';

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

INSERT IGNORE INTO user_profiles (user_id)
SELECT id FROM users;

-- There is no public administrator signup. Promote a trusted lecturer only:
-- UPDATE users
-- SET role = 'administrator', account_status = 'active', is_verified = TRUE
-- WHERE lecturer_id = 'YOUR_LECTURER_ID';
