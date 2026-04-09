function formatRoleProfile(user, ownedDocumentCount = 0, collaboratedDocumentCount = 0) {
  const badges = []

  if (user.system_role === 'system_admin') {
    badges.push({ code: 'system_admin', label: '系统管理员', scope: 'system' })
  }

  if (user.org_role === 'org_admin') {
    badges.push({ code: 'org_admin', label: '组织管理员', scope: 'org' })
  }

  if ((ownedDocumentCount || 0) > 0) {
    badges.push({ code: 'doc_creator', label: '文档创作者', scope: 'document' })
  }

  if ((collaboratedDocumentCount || 0) > 0) {
    badges.push({ code: 'doc_collaborator', label: '文档协作者', scope: 'document' })
  }

  if (badges.length === 0) {
    badges.push({ code: 'user', label: '普通用户', scope: 'system' })
  }

  const primary =
    badges.find(item => item.code === 'system_admin') ||
    badges.find(item => item.code === 'org_admin') ||
    badges.find(item => item.code === 'doc_creator') ||
    badges.find(item => item.code === 'doc_collaborator') ||
    badges[0]

  return {
    primary_code: primary.code,
    primary_label: primary.label,
    badges,
    stats: {
      owned_document_count: ownedDocumentCount || 0,
      collaborated_document_count: collaboratedDocumentCount || 0
    }
  }
}

async function buildRoleProfile(db, user) {
  if (!user?.id) {
    return {
      primary_code: 'guest',
      primary_label: '访客',
      badges: []
    }
  }

  const [ownedDocs, collaboratedDocs] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM documents WHERE owner_id = ? AND deleted_at IS NULL', [user.id]),
    db.get("SELECT COUNT(*) as count FROM document_permissions WHERE user_id = ? AND role IN ('editor', 'commenter', 'viewer')", [user.id])
  ])

  return formatRoleProfile(user, ownedDocs?.count || 0, collaboratedDocs?.count || 0)
}

module.exports = { buildRoleProfile, formatRoleProfile }
