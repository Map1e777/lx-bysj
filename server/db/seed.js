require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const { db, initDB } = require('./index')

async function seed() {
  console.log('Initializing database...')
  await initDB()

  console.log('Seeding database...')

  const adminHash = await bcrypt.hash('admin123', 12)
  const userHash = await bcrypt.hash('admin123', 12)

  await db.transaction(async (conn) => {
    const q = async (sql, params = []) => (await conn.query(sql, params))[0]
    const qOne = async (sql, params = []) => (await conn.query(sql, params))[0][0]

    // ── 1. System admin ──────────────────────────────────────────────────
    let adminUser = await qOne('SELECT id FROM users WHERE email = ?', ['admin@example.com'])
    if (!adminUser) {
      const r = await q(
        'INSERT INTO users (username, email, password_hash, system_role, is_active) VALUES (?, ?, ?, ?, 1)',
        ['admin', 'admin@example.com', adminHash, 'system_admin']
      )
      adminUser = { id: r.insertId }
      console.log('Created system admin user')
    }

    // ── 2. Organization ──────────────────────────────────────────────────
    let org = await qOne('SELECT id FROM orgs WHERE slug = ?', ['example-org'])
    if (!org) {
      const r = await q(
        'INSERT INTO orgs (name, slug, description, owner_id, settings) VALUES (?, ?, ?, ?, ?)',
        ['示例组织', 'example-org', '这是一个示例组织，用于演示文档协作系统的各项功能', adminUser.id,
          JSON.stringify({ allow_public_docs: true, default_doc_visibility: 'org' })]
      )
      org = { id: r.insertId }
      console.log('Created example organization')
    }

    // ── 3. Departments ───────────────────────────────────────────────────
    const deptMap = {}
    const depts = [
      { key: 'tech',    name: '技术部',  parent: null },
      { key: 'product', name: '产品部',  parent: null },
      { key: 'ops',     name: '运营部',  parent: null },
      { key: 'frontend',name: '前端组',  parent: 'tech' },
    ]
    for (const d of depts) {
      let dept = await qOne('SELECT id FROM departments WHERE name = ? AND org_id = ?', [d.name, org.id])
      if (!dept) {
        const parentId = d.parent ? deptMap[d.parent]?.id : null
        const r = await q(
          'INSERT INTO departments (org_id, parent_id, name) VALUES (?, ?, ?)',
          [org.id, parentId, d.name]
        )
        dept = { id: r.insertId }
        console.log(`Created department: ${d.name}`)
      }
      deptMap[d.key] = dept
    }

    // ── 4. Users ─────────────────────────────────────────────────────────
    const userDefs = [
      { key: 'orgadmin', username: 'orgadmin',  email: 'orgadmin@example.com', role: 'user', orgRole: 'org_admin', dept: 'tech' },
      { key: 'creator',  username: 'creator1',  email: 'creator@example.com',  role: 'user', orgRole: 'member',   dept: 'tech' },
      { key: 'collab',   username: 'collab1',   email: 'collab@example.com',   role: 'user', orgRole: 'member',   dept: 'product' },
      { key: 'user2',    username: 'user2',     email: 'user2@example.com',    role: 'user', orgRole: 'member',   dept: 'ops' },
      { key: 'user3',    username: 'user3',     email: 'user3@example.com',    role: 'user', orgRole: 'member',   dept: 'frontend' },
    ]
    const userMap = {}
    for (const u of userDefs) {
      let user = await qOne('SELECT id FROM users WHERE email = ?', [u.email])
      if (!user) {
        const r = await q(
          'INSERT INTO users (username, email, password_hash, system_role, org_id, org_role, dept_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          [u.username, u.email, userHash, u.role, org.id, u.orgRole, deptMap[u.dept].id]
        )
        user = { id: r.insertId }
        console.log(`Created user: ${u.username}`)
      }
      userMap[u.key] = user
    }

    // ── 5. Version rules & system config ─────────────────────────────────
    const existingRules = await qOne("SELECT id FROM version_rules WHERE scope = 'global'")
    if (!existingRules) {
      await q('INSERT INTO version_rules (scope, auto_save_interval, max_versions_per_doc, auto_version_on_save, version_retention_days) VALUES (?, ?, ?, ?, ?)',
        ['global', 300, 100, 1, 365])
      console.log('Created default version rules')
    }

    const configEntries = [
      { key: 'site_name',             value: JSON.stringify('文档协作系统') },
      { key: 'allow_registration',    value: JSON.stringify(true) },
      { key: 'max_file_size',         value: JSON.stringify(10485760) },
      { key: 'allowed_file_types',    value: JSON.stringify(['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','png','jpg','jpeg','gif']) },
      { key: 'default_doc_visibility',value: JSON.stringify('private') },
      { key: 'maintenance_mode',      value: JSON.stringify(false) },
    ]
    for (const entry of configEntries) {
      const existing = await qOne('SELECT `key` FROM system_config WHERE `key` = ?', [entry.key])
      if (!existing) await q('INSERT INTO system_config (`key`, value) VALUES (?, ?)', [entry.key, entry.value])
    }
    console.log('Created default system config')

    // ── 6. Permission templates ───────────────────────────────────────────
    const tplDefs = [
      {
        name: '全局只读模板',
        description: '仅允许查看文档内容，不允许编辑或评论',
        scope: 'global',
        orgId: null,
        rules: JSON.stringify({ view: true, comment: false, edit: false, manage: false })
      },
      {
        name: '组织协作模板',
        description: '允许组织成员查看、评论和编辑文档',
        scope: 'org',
        orgId: org.id,
        rules: JSON.stringify({ view: true, comment: true, edit: true, manage: false })
      },
    ]
    for (const tpl of tplDefs) {
      const existing = await qOne('SELECT id FROM permission_templates WHERE name = ?', [tpl.name])
      if (!existing) {
        await q(
          'INSERT INTO permission_templates (name, description, scope, org_id, rules, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [tpl.name, tpl.description, tpl.scope, tpl.orgId, tpl.rules, adminUser.id]
        )
        console.log(`Created permission template: ${tpl.name}`)
      }
    }

    // ── 7. Documents ──────────────────────────────────────────────────────
    const docDefs = [
      {
        key: 'welcome',
        title: '欢迎使用文档协作系统',
        owner: 'creator',
        status: 'published',
        visibility: 'org',
        tags: ['入门', '示例'],
        content: `<h1>欢迎使用文档协作系统</h1>
<p>这是一个功能强大的文档协作平台，支持以下功能：</p>
<ul>
  <li>多人实时协作编辑</li>
  <li>版本管理与历史追踪</li>
  <li>评论与批注功能</li>
  <li>文件附件上传</li>
  <li>灵活的权限管理</li>
  <li>组织与部门管理</li>
</ul>
<h2>快速开始</h2>
<p>您可以通过左侧导航栏创建新文档，或者浏览已有文档。如需邀请他人协作，请使用文档详情页面的"邀请协作者"功能。</p>
<h2>联系支持</h2>
<p>如有任何问题，请联系系统管理员或查阅帮助文档。</p>`,
      },
      {
        key: 'roadmap',
        title: '2024 年度产品路线图',
        owner: 'orgadmin',
        status: 'published',
        visibility: 'org',
        tags: ['产品', '规划'],
        content: `<h1>2024 年度产品路线图</h1>
<h2>Q1 目标</h2>
<ul>
  <li>上线文档协作 MVP 版本</li>
  <li>完成用户权限管理系统</li>
  <li>支持组织与部门架构</li>
</ul>
<h2>Q2 目标</h2>
<ul>
  <li>实时协作编辑功能优化</li>
  <li>移动端适配</li>
  <li>附件管理功能增强</li>
</ul>
<h2>Q3 目标</h2>
<ul>
  <li>AI 辅助写作功能</li>
  <li>文档模板库</li>
  <li>第三方集成（飞书、钉钉）</li>
</ul>
<h2>Q4 目标</h2>
<ul>
  <li>性能优化与稳定性提升</li>
  <li>数据分析与报表功能</li>
</ul>`,
      },
      {
        key: 'arch',
        title: '技术架构设计文档',
        owner: 'creator',
        status: 'draft',
        visibility: 'private',
        tags: ['技术', '架构'],
        content: `<h1>技术架构设计文档</h1>
<p>本文档描述系统的整体技术架构设计方案（草稿）。</p>
<h2>技术栈</h2>
<ul>
  <li>前端：Vue 3 + Pinia + Vite</li>
  <li>后端：Node.js + Express</li>
  <li>数据库：MySQL 8.0</li>
  <li>实时通信：Socket.IO</li>
</ul>
<h2>系统架构</h2>
<p>采用前后端分离架构，RESTful API 设计，WebSocket 用于实时协作。</p>
<h2>待完善</h2>
<p>部署方案、容灾设计、安全加固……</p>`,
      },
      {
        key: 'report',
        title: '季度运营报告',
        owner: 'user2',
        status: 'published',
        visibility: 'public',
        tags: ['运营', '报告'],
        content: `<h1>季度运营报告</h1>
<h2>概述</h2>
<p>本季度系统运营整体稳定，用户活跃度持续提升。</p>
<h2>关键指标</h2>
<ul>
  <li>注册用户数：1,234 人</li>
  <li>月活跃用户：856 人</li>
  <li>创建文档总数：4,521 篇</li>
  <li>协作编辑次数：12,890 次</li>
</ul>
<h2>问题与改进</h2>
<p>部分用户反映编辑器加载较慢，已列入下季度优化计划。</p>`,
      },
      {
        key: 'training',
        title: '内部培训材料',
        owner: 'orgadmin',
        status: 'archived',
        visibility: 'org',
        tags: ['培训', '内部'],
        content: `<h1>内部培训材料</h1>
<p>本文档为新员工入职培训使用，已归档。</p>
<h2>系统使用规范</h2>
<ol>
  <li>文档命名规范：[部门]-[项目]-[文档类型]-[日期]</li>
  <li>版本管理：每次重大修改前需创建版本快照</li>
  <li>权限申请：如需访问其他部门文档，联系部门管理员</li>
</ol>
<h2>常见问题</h2>
<p>Q: 如何恢复误删的文档？<br>A: 联系系统管理员，文档有 30 天回收站保留期。</p>`,
      },
    ]

    const docMap = {}
    for (const d of docDefs) {
      const ownerId = userMap[d.owner].id

      let doc = await qOne('SELECT id FROM documents WHERE title = ? AND owner_id = ?', [d.title, ownerId])
      if (!doc) {
        const wordCount = d.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length
        const r = await q(
          'INSERT INTO documents (title, content, owner_id, org_id, status, visibility, tags, word_count, current_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [d.title, d.content, ownerId, org.id, d.status, d.visibility, JSON.stringify(d.tags), wordCount, 1]
        )
        doc = { id: r.insertId }
        console.log(`Created document: ${d.title}`)

        // creator permission
        await q("INSERT INTO document_permissions (document_id, user_id, role, granted_by) VALUES (?, ?, 'creator', ?)",
          [doc.id, ownerId, ownerId])

        // give collab editor access on welcome and roadmap
        if (d.key === 'welcome' || d.key === 'roadmap') {
          await q("INSERT INTO document_permissions (document_id, user_id, role, granted_by) VALUES (?, ?, 'editor', ?)",
            [doc.id, userMap.collab.id, ownerId])
          await q("INSERT INTO document_permissions (document_id, user_id, role, granted_by) VALUES (?, ?, 'viewer', ?)",
            [doc.id, userMap.user3.id, ownerId])
        }
        if (d.key === 'arch') {
          await q("INSERT INTO document_permissions (document_id, user_id, role, granted_by) VALUES (?, ?, 'viewer', ?)",
            [doc.id, userMap.orgadmin.id, ownerId])
        }
      }
      docMap[d.key] = doc
    }

    // ── 8. Document versions ──────────────────────────────────────────────
    const versionSets = [
      {
        docKey: 'welcome',
        ownerId: userMap.creator.id,
        versions: [
          { num: 1, summary: '初始版本', isMajor: 1 },
          { num: 2, summary: '补充了联系支持章节', isMajor: 0 },
          { num: 3, summary: '内容结构调整，新增快速开始章节', isMajor: 1 },
        ]
      },
      {
        docKey: 'roadmap',
        ownerId: userMap.orgadmin.id,
        versions: [
          { num: 1, summary: '初始版本', isMajor: 1 },
          { num: 2, summary: '补充 Q3/Q4 目标', isMajor: 0 },
          { num: 3, summary: '根据评审意见修订目标优先级', isMajor: 1 },
        ]
      },
      {
        docKey: 'arch',
        ownerId: userMap.creator.id,
        versions: [
          { num: 1, summary: '初始草稿', isMajor: 1 },
          { num: 2, summary: '补充技术栈说明', isMajor: 0 },
        ]
      },
      {
        docKey: 'report',
        ownerId: userMap.user2.id,
        versions: [
          { num: 1, summary: '初始版本', isMajor: 1 },
          { num: 2, summary: '更新关键指标数据', isMajor: 0 },
        ]
      },
      {
        docKey: 'training',
        ownerId: userMap.orgadmin.id,
        versions: [
          { num: 1, summary: '初始版本', isMajor: 1 },
          { num: 2, summary: '归档前最终版本', isMajor: 1 },
        ]
      },
    ]

    for (const vs of versionSets) {
      const docId = docMap[vs.docKey].id
      for (const v of vs.versions) {
        const existing = await qOne('SELECT id FROM document_versions WHERE document_id = ? AND version_num = ?', [docId, v.num])
        if (!existing) {
          const doc = await qOne('SELECT title, content, word_count FROM documents WHERE id = ?', [docId])
          await q(
            'INSERT INTO document_versions (document_id, version_num, title, content, word_count, created_by, change_summary, is_major) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [docId, v.num, doc.title, doc.content, doc.word_count, vs.ownerId, v.summary, v.isMajor]
          )
        }
      }
      // update current_version to max
      await q('UPDATE documents SET current_version = ? WHERE id = ?', [vs.versions[vs.versions.length - 1].num, docMap[vs.docKey].id])
    }
    console.log('Created document versions')

    // ── 9. Comments on welcome doc ────────────────────────────────────────
    const welcomeDocId = docMap.welcome.id
    const existingComments = await qOne('SELECT id FROM comments WHERE document_id = ? LIMIT 1', [welcomeDocId])
    if (!existingComments) {
      // comment 1 (resolved thread)
      const c1r = await q(
        'INSERT INTO comments (document_id, author_id, content, is_resolved, resolved_by, resolved_at) VALUES (?, ?, ?, 1, ?, NOW())',
        [welcomeDocId, userMap.collab.id, '这里的权限管理部分能详细说明一下吗？', userMap.creator.id]
      )
      const c1Id = c1r.insertId
      // reply to comment 1
      await q(
        'INSERT INTO comments (document_id, parent_id, author_id, content) VALUES (?, ?, ?, ?)',
        [welcomeDocId, c1Id, userMap.creator.id, '已在文档中补充了权限管理的详细说明，请查阅。']
      )
      // comment 2
      await q(
        'INSERT INTO comments (document_id, author_id, content) VALUES (?, ?, ?)',
        [welcomeDocId, userMap.user3.id, '文档写得很清晰，新手也能快速上手！']
      )
      // comment 3
      await q(
        'INSERT INTO comments (document_id, author_id, content) VALUES (?, ?, ?)',
        [welcomeDocId, userMap.orgadmin.id, '建议增加视频教程链接，方便新员工学习。']
      )
      console.log('Created comments')
    }

    // ── 10. Invitations ───────────────────────────────────────────────────
    const { v4: uuidv4 } = require('uuid')
    const roadmapDocId = docMap.roadmap.id

    const pendingInv = await qOne("SELECT id FROM invitations WHERE document_id = ? AND status = 'pending'", [roadmapDocId])
    if (!pendingInv) {
      await q(
        "INSERT INTO invitations (document_id, inviter_id, invitee_email, invitee_id, role, token, status, expires_at) VALUES (?, ?, ?, ?, 'editor', ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))",
        [roadmapDocId, userMap.orgadmin.id, 'user2@example.com', userMap.user2.id, uuidv4()]
      )
      console.log('Created pending invitation')
    }

    const archDocId = docMap.arch.id
    const acceptedInv = await qOne("SELECT id FROM invitations WHERE document_id = ? AND status = 'accepted'", [archDocId])
    if (!acceptedInv) {
      await q(
        "INSERT INTO invitations (document_id, inviter_id, invitee_email, invitee_id, role, token, status, responded_at) VALUES (?, ?, ?, ?, 'viewer', ?, 'accepted', NOW())",
        [archDocId, userMap.creator.id, 'orgadmin@example.com', userMap.orgadmin.id, uuidv4()]
      )
      console.log('Created accepted invitation')
    }

    // ── 11. Notifications ─────────────────────────────────────────────────
    const existingNotifs = await qOne('SELECT id FROM notifications WHERE user_id = ? LIMIT 1', [userMap.creator.id])
    if (!existingNotifs) {
      const notifDefs = [
        {
          userId: userMap.creator.id,
          type: 'document_shared',
          payload: JSON.stringify({ document_id: roadmapDocId, document_title: '2024 年度产品路线图', sharer_name: 'orgadmin', role: 'editor' }),
          isRead: 0
        },
        {
          userId: userMap.creator.id,
          type: 'comment_added',
          payload: JSON.stringify({ document_id: welcomeDocId, document_title: '欢迎使用文档协作系统', commenter_name: 'collab1', comment_preview: '这里的权限管理部分能详细说明一下吗？' }),
          isRead: 1
        },
        {
          userId: userMap.creator.id,
          type: 'comment_added',
          payload: JSON.stringify({ document_id: welcomeDocId, document_title: '欢迎使用文档协作系统', commenter_name: 'user3', comment_preview: '文档写得很清晰，新手也能快速上手！' }),
          isRead: 0
        },
        {
          userId: userMap.collab.id,
          type: 'document_shared',
          payload: JSON.stringify({ document_id: welcomeDocId, document_title: '欢迎使用文档协作系统', sharer_name: 'creator1', role: 'editor' }),
          isRead: 1
        },
        {
          userId: userMap.collab.id,
          type: 'invitation_accepted',
          payload: JSON.stringify({ document_id: archDocId, document_title: '技术架构设计文档', invitee_name: 'orgadmin' }),
          isRead: 0
        },
      ]
      for (const n of notifDefs) {
        await q('INSERT INTO notifications (user_id, type, payload, is_read) VALUES (?, ?, ?, ?)',
          [n.userId, n.type, n.payload, n.isRead])
      }
      console.log('Created notifications')
    }

    // ── 12. Audit logs ────────────────────────────────────────────────────
    const existingAudit = await qOne('SELECT id FROM audit_logs LIMIT 1')
    if (!existingAudit) {
      const auditEntries = [
        { actorId: adminUser.id,         action: 'user.login',       resourceType: 'user',     resourceId: String(adminUser.id),         oldValue: null, newValue: null,                 ip: '127.0.0.1' },
        { actorId: userMap.creator.id,   action: 'document.create',  resourceType: 'document', resourceId: String(docMap.welcome.id),    oldValue: null, newValue: JSON.stringify({ title: '欢迎使用文档协作系统' }), ip: '127.0.0.1' },
        { actorId: userMap.creator.id,   action: 'document.publish', resourceType: 'document', resourceId: String(docMap.welcome.id),    oldValue: JSON.stringify({ status: 'draft' }), newValue: JSON.stringify({ status: 'published' }), ip: '127.0.0.1' },
        { actorId: userMap.orgadmin.id,  action: 'document.create',  resourceType: 'document', resourceId: String(docMap.roadmap.id),    oldValue: null, newValue: JSON.stringify({ title: '2024 年度产品路线图' }), ip: '127.0.0.1' },
        { actorId: userMap.orgadmin.id,  action: 'org.update',       resourceType: 'org',      resourceId: String(org.id),               oldValue: JSON.stringify({ name: '示例组织' }), newValue: JSON.stringify({ name: '示例组织', description: '更新了组织描述' }), ip: '127.0.0.1' },
        { actorId: adminUser.id,         action: 'user.create',      resourceType: 'user',     resourceId: String(userMap.user2.id),     oldValue: null, newValue: JSON.stringify({ username: 'user2', email: 'user2@example.com' }), ip: '127.0.0.1' },
      ]
      for (const a of auditEntries) {
        await q(
          'INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [a.actorId, a.action, a.resourceType, a.resourceId, a.oldValue, a.newValue, a.ip]
        )
      }
      console.log('Created audit logs')
    }
  })

  console.log('\nSeed completed successfully!')
  console.log('\nTest accounts (all passwords: admin123):')
  console.log('  System Admin:  admin@example.com')
  console.log('  Org Admin:     orgadmin@example.com')
  console.log('  Creator:       creator@example.com')
  console.log('  Collaborator:  collab@example.com')
  console.log('  User2:         user2@example.com')
  console.log('  User3:         user3@example.com')

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
