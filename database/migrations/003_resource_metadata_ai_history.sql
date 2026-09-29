-- Apply to databases created before resource metadata and private AI history.
USE cresa_library;

ALTER TABLE resources ADD COLUMN subject VARCHAR(150) NULL AFTER category;
ALTER TABLE resources ADD COLUMN course VARCHAR(150) NULL AFTER subject;
ALTER TABLE resources ADD COLUMN tags JSON NULL AFTER course;

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
