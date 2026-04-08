const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'doccollab',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
})

const db = {
  async get(sql, params = []) {
    const [rows] = await pool.query(sql, params)
    return rows[0] || null
  },

  async all(sql, params = []) {
    const [rows] = await pool.query(sql, params)
    return rows
  },

  async run(sql, params = []) {
    const [result] = await pool.query(sql, params)
    return { insertId: result.insertId, affectedRows: result.affectedRows }
  },

  async transaction(fn) {
    const conn = await pool.getConnection()
    await conn.beginTransaction()
    try {
      const result = await fn(conn)
      await conn.commit()
      return result
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}

async function initDB() {
  await createTables()
  console.log('Database connected and tables initialized')
}

async function createTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS orgs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE,
      description TEXT,
      logo_url VARCHAR(500),
      owner_id INT,
      settings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      parent_id INT,
      name VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(500),
      system_role VARCHAR(50) DEFAULT 'user',
      org_id INT,
      dept_id INT,
      org_role VARCHAR(50),
      is_active TINYINT(1) DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE SET NULL,
      FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL DEFAULT 'Untitled Document',
      content LONGTEXT NOT NULL,
      owner_id INT NOT NULL,
      org_id INT,
      dept_id INT,
      status VARCHAR(50) DEFAULT 'draft',
      visibility VARCHAR(50) DEFAULT 'private',
      share_token VARCHAR(255) UNIQUE,
      share_expires_at DATETIME,
      tags TEXT,
      word_count INT DEFAULT 0,
      current_version INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE SET NULL,
      FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL,
      FULLTEXT INDEX ft_documents (title, content)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS document_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      version_num INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      content LONGTEXT NOT NULL,
      content_diff LONGTEXT,
      word_count INT DEFAULT 0,
      label VARCHAR(255),
      created_by INT NOT NULL,
      change_summary VARCHAR(500),
      is_major TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_doc_version (document_id, version_num),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS document_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(50) NOT NULL,
      granted_by INT NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      UNIQUE KEY uniq_doc_user (document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS invitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      inviter_id INT NOT NULL,
      invitee_email VARCHAR(255) NOT NULL,
      invitee_id INT,
      role VARCHAR(50) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      responded_at DATETIME,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (inviter_id) REFERENCES users(id),
      FOREIGN KEY (invitee_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      parent_id INT,
      author_id INT NOT NULL,
      content TEXT NOT NULL,
      selection_ref TEXT,
      is_resolved TINYINT(1) DEFAULT 0,
      resolved_by INT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      uploader_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(500) NOT NULL,
      mime_type VARCHAR(255) NOT NULL,
      file_size INT NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(100) NOT NULL,
      payload TEXT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_id INT,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS permission_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      scope VARCHAR(50) DEFAULT 'global',
      org_id INT,
      rules TEXT NOT NULL,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS version_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scope VARCHAR(50) DEFAULT 'global',
      org_id INT,
      auto_save_interval INT DEFAULT 300,
      max_versions_per_doc INT DEFAULT 100,
      auto_version_on_save TINYINT(1) DEFAULT 1,
      version_retention_days INT DEFAULT 365,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS system_config (
      \`key\` VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by INT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  ]

  for (const sql of queries) {
    await pool.query(sql)
  }
}

module.exports = { db, initDB }
