const { db } = require('../db')
const { computeDiff } = require('../utils/diff')

async function saveVersion(documentId, userId, options = {}) {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId])
  if (!doc) throw new Error('Document not found')

  const lastVersion = await db.get(
    'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_num DESC LIMIT 1',
    [documentId]
  )

  const versionNum = (doc.current_version || 0) + 1
  const diff = lastVersion ? computeDiff(lastVersion.content, doc.content) : null
  const wordCount = doc.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length

  await db.run(
    'INSERT INTO document_versions (document_id, version_num, title, content, content_diff, word_count, label, created_by, change_summary, is_major) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [documentId, versionNum, doc.title, doc.content, diff, wordCount, options.label || null, userId, options.summary || '自动保存', options.isMajor ? 1 : 0]
  )

  await db.run(
    'UPDATE documents SET current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [versionNum, documentId]
  )

  // Enforce max versions limit
  const rules = await db.get("SELECT * FROM version_rules WHERE scope = 'global' LIMIT 1")
  if (rules && rules.max_versions_per_doc) {
    const allVersions = await db.all(
      'SELECT id FROM document_versions WHERE document_id = ? ORDER BY version_num ASC',
      [documentId]
    )

    if (allVersions.length > rules.max_versions_per_doc) {
      const excessCount = allVersions.length - rules.max_versions_per_doc
      const excessIds = allVersions.slice(0, excessCount).map(r => r.id)
      const placeholders = excessIds.map(() => '?').join(',')
      await db.run(`DELETE FROM document_versions WHERE id IN (${placeholders})`, excessIds)
    }
  }

  return versionNum
}

module.exports = { saveVersion }
