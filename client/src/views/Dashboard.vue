<template>
  <div class="page-container">
    <!-- Welcome Header -->
    <div class="welcome-section">
      <div class="welcome-text">
        <h2 class="welcome-title">你好，{{ authStore.user?.username }} 👋</h2>
        <p class="welcome-sub">
          <el-tag :type="roleTagType" size="small">{{ roleLabel }}</el-tag>
          今天是 {{ today }}，专注工作，高效协作！
        </p>
        <div class="role-matrix-line">
          <el-tag
            v-for="badge in authStore.roleBadges"
            :key="badge.code"
            :type="badgeType(badge.code)"
            effect="plain"
            size="small"
          >
            {{ badge.label }}
          </el-tag>
          <span class="matrix-hint">
            创作 {{ authStore.user?.role_profile?.stats?.owned_document_count || 0 }} 篇 ·
            协作 {{ authStore.user?.role_profile?.stats?.collaborated_document_count || 0 }} 篇
          </span>
        </div>
      </div>
      <el-button type="primary" @click="router.push('/documents/new')">
        <el-icon><Plus /></el-icon>
        新建文档
      </el-button>
    </div>

    <!-- Stats Cards -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in statsCards" :key="stat.key">
        <div class="stat-card" :style="{ borderTop: `3px solid ${stat.color}` }">
          <div class="stat-content">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
          <div class="stat-icon" :style="{ background: stat.color + '20', color: stat.color }">
            <el-icon><component :is="stat.icon" /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Quick Actions -->
    <div class="section-card">
      <h3 class="section-title">快捷操作</h3>
      <div class="quick-actions">
        <div
          v-for="action in quickActions"
          :key="action.label"
          class="quick-action-item"
          @click="router.push(action.path)"
        >
          <div class="qa-icon" :style="{ background: action.color + '15', color: action.color }">
            <el-icon><component :is="action.icon" /></el-icon>
          </div>
          <span class="qa-label">{{ action.label }}</span>
        </div>
      </div>
    </div>

    <el-row :gutter="20">
      <!-- Recent Documents -->
      <el-col :span="14">
        <div class="section-card">
          <div class="section-header">
            <h3 class="section-title">最近文档</h3>
            <el-button link type="primary" @click="router.push('/documents')">查看全部</el-button>
          </div>

          <div v-loading="docsLoading">
            <template v-if="recentDocs.length > 0">
              <div
                v-for="doc in recentDocs"
                :key="doc.id"
                class="doc-item"
                @click="router.push(`/documents/${doc.id}/edit`)"
              >
                <div class="doc-icon">
                  <el-icon><Document /></el-icon>
                </div>
                <div class="doc-info">
                  <div class="doc-title">{{ doc.title }}</div>
                  <div class="doc-meta">
                    <el-tag :type="statusTagType(doc.status)" size="small">{{ statusLabel(doc.status) }}</el-tag>
                    <span class="doc-time">{{ formatTime(doc.updated_at) }}</span>
                  </div>
                </div>
                <el-icon class="doc-arrow"><ArrowRight /></el-icon>
              </div>
            </template>
            <el-empty v-else description="暂无文档" :image-size="80" />
          </div>
        </div>
      </el-col>

      <!-- Recent Activity / System Stats -->
      <el-col :span="10">
        <div class="section-card" v-if="authStore.isSystemAdmin">
          <h3 class="section-title">平台概况</h3>
          <div v-loading="adminStatsLoading">
            <div v-for="stat in adminStats" :key="stat.label" class="progress-stat">
              <div class="progress-label">
                <span>{{ stat.label }}</span>
                <span class="progress-value">{{ stat.value }}</span>
              </div>
              <el-progress
                :percentage="stat.percentage"
                :color="stat.color"
                :show-text="false"
                :stroke-width="8"
              />
            </div>
          </div>
        </div>

        <div class="section-card" v-else-if="authStore.isOrgAdmin">
          <h3 class="section-title">组织概况</h3>
          <div v-loading="orgStatsLoading">
            <div v-for="stat in orgStats" :key="stat.label" class="org-stat-item">
              <div class="org-stat-label">{{ stat.label }}</div>
              <div class="org-stat-value">{{ stat.value }}</div>
            </div>
          </div>
        </div>

        <div class="section-card" v-else>
          <h3 class="section-title">待处理事项</h3>
          <div v-loading="pendingLoading">
            <template v-if="pendingInvitations.length > 0">
              <div
                v-for="inv in pendingInvitations.slice(0, 5)"
                :key="inv.id"
                class="invite-item"
              >
                <div class="invite-icon">
                  <el-icon><Message /></el-icon>
                </div>
                <div class="invite-info">
                  <div class="invite-title">{{ inv.document_title }}</div>
                  <div class="invite-meta">{{ inv.inviter_name || inv.inviter_username }} 邀请您协作</div>
                </div>
                <div class="invite-actions">
                  <el-button size="small" type="success" @click.stop="acceptInvitation(inv.id)">接受</el-button>
                </div>
              </div>
              <div class="view-all-link" @click="router.push('/invitations')">
                查看全部邀请 →
              </div>
            </template>
            <el-empty v-else description="暂无待处理邀请" :image-size="80" />
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/useAuthStore'
import { documentApi } from '@/api/document'
import { collaborationApi } from '@/api/collaboration'
import { adminApi } from '@/api/admin'
import { orgApi } from '@/api/org'

const router = useRouter()
const authStore = useAuthStore()

const docsLoading = ref(false)
const adminStatsLoading = ref(false)
const orgStatsLoading = ref(false)
const pendingLoading = ref(false)

const recentDocs = ref<any[]>([])
const pendingInvitations = ref<any[]>([])
const adminStats = ref<any[]>([])
const orgStats = ref<any[]>([])

const statsCards = ref([
  { key: 'docs', label: '我的文档', value: 0, icon: 'Document', color: '#409eff' },
  { key: 'shared', label: '共享文档', value: 0, icon: 'Share', color: '#67c23a' },
  { key: 'invitations', label: '待处理邀请', value: 0, icon: 'Bell', color: '#e6a23c' },
  { key: 'versions', label: '版本总数', value: 0, icon: 'Clock', color: '#f56c6c' },
])

const today = computed(() => {
  return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
})

const roleLabel = computed(() => {
  return authStore.primaryRoleLabel
})

const roleTagType = computed(() => {
  if (authStore.isSystemAdmin) return 'danger'
  if (authStore.isOrgAdmin) return 'warning'
  return 'info'
})

const quickActions = computed(() => {
  const actions = [
    { label: '新建文档', icon: 'DocumentAdd', path: '/documents/new', color: '#409eff' },
    { label: '我的文档', icon: 'Files', path: '/documents', color: '#67c23a' },
    { label: '共享文档', icon: 'Share', path: '/shared', color: '#e6a23c' },
    { label: '待处理邀请', icon: 'Bell', path: '/invitations', color: '#f56c6c' },
  ]
  if (authStore.isOrgAdmin) {
    actions.push(
      { label: '成员管理', icon: 'UserFilled', path: '/org/members', color: '#7b2ff7' },
      { label: '版本审计', icon: 'Tickets', path: '/org/audit', color: '#00d2ff' },
    )
  }
  if (authStore.isSystemAdmin) {
    actions.push(
      { label: '用户管理', icon: 'Avatar', path: '/admin/users', color: '#7b2ff7' },
      { label: '系统配置', icon: 'Setting', path: '/admin/config', color: '#00d2ff' },
    )
  }
  return actions
})

function statusTagType(status: string) {
  const map: Record<string, string> = { draft: 'info', published: 'success', archived: 'warning' }
  return map[status] || 'info'
}

function badgeType(code: string) {
  const map: Record<string, string> = {
    system_admin: 'danger',
    org_admin: 'warning',
    doc_creator: 'success',
    doc_collaborator: 'primary',
    user: 'info'
  }
  return map[code] || 'info'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' }
  return map[status] || status
}

function formatTime(time: string) {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

async function loadRecentDocs() {
  docsLoading.value = true
  try {
    const res = await documentApi.getDocuments({ limit: 5, sort: 'updated_at' }) as any
    recentDocs.value = res.data?.list || []
    statsCards.value[0].value = res.data?.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    docsLoading.value = false
  }
}

async function loadPendingInvitations() {
  pendingLoading.value = true
  try {
    const res = await collaborationApi.getMyInvitations({ status: 'pending' }) as any
    pendingInvitations.value = res.data?.list || []
    statsCards.value[2].value = res.data?.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    pendingLoading.value = false
  }
}

async function loadSharedDocs() {
  try {
    const res = await collaborationApi.getSharedDocuments({ limit: 1 }) as any
    statsCards.value[1].value = res.data?.total || 0
  } catch (e) {
    console.error(e)
  }
}

async function loadAdminStats() {
  if (!authStore.isSystemAdmin) return
  adminStatsLoading.value = true
  try {
    const res = await adminApi.getStats() as any
    const stats = res.data || {}
    adminStats.value = [
      { label: '总用户数', value: stats.total_users || 0, percentage: Math.min((stats.total_users / 1000) * 100, 100), color: '#409eff' },
      { label: '总组织数', value: stats.total_orgs || 0, percentage: Math.min((stats.total_orgs / 100) * 100, 100), color: '#67c23a' },
      { label: '总文档数', value: stats.total_documents || 0, percentage: Math.min((stats.total_documents / 10000) * 100, 100), color: '#e6a23c' },
      { label: '总版本数', value: stats.total_versions || 0, percentage: Math.min((stats.total_versions / 100000) * 100, 100), color: '#f56c6c' },
    ]
  } catch (e) {
    console.error(e)
  } finally {
    adminStatsLoading.value = false
  }
}

async function loadOrgStats() {
  if (!authStore.isOrgAdmin || authStore.isSystemAdmin) return
  orgStatsLoading.value = true
  try {
    const res = await orgApi.getOrgStats() as any
    const stats = res.data || {}
    orgStats.value = [
      { label: '组织成员', value: stats.member_count || 0 },
      { label: '部门数量', value: stats.dept_count || 0 },
      { label: '文档总数', value: stats.document_count || 0 },
      { label: '本月新增', value: stats.new_docs_this_month || 0 },
    ]
  } catch (e) {
    console.error(e)
  } finally {
    orgStatsLoading.value = false
  }
}

async function acceptInvitation(id: number) {
  try {
    const invitation = pendingInvitations.value.find(item => item.id === id)
    if (!invitation?.token) throw new Error('邀请信息不完整')
    await collaborationApi.acceptInvitation(invitation.token)
    ElMessage.success('已接受邀请')
    await loadPendingInvitations()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadRecentDocs()
  loadPendingInvitations()
  loadSharedDocs()
  loadAdminStats()
  loadOrgStats()
})
</script>

<style scoped>
.welcome-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.welcome-title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px;
}

.welcome-sub {
  font-size: 14px;
  color: #909399;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-matrix-line {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.matrix-hint {
  font-size: 12px;
  color: #909399;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.section-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px;
}

.section-header .section-title {
  margin: 0;
}

.quick-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.quick-action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 14px 20px;
  border-radius: 10px;
  border: 1px solid #e4e7ed;
  transition: all 0.2s;
  min-width: 90px;
}

.quick-action-item:hover {
  border-color: #409eff;
  background: #f0f7ff;
}

.qa-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.qa-label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}

.doc-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;
}

.doc-item:hover {
  background: #f5f7fa;
}

.doc-icon {
  width: 40px;
  height: 40px;
  background: #ecf5ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #409eff;
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-time {
  font-size: 12px;
  color: #c0c4cc;
}

.doc-arrow {
  color: #c0c4cc;
  font-size: 12px;
}

.progress-stat {
  margin-bottom: 16px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}

.progress-value {
  font-weight: 600;
  color: #303133;
}

.org-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f7fa;
}

.org-stat-item:last-child {
  border-bottom: none;
}

.org-stat-label {
  font-size: 14px;
  color: #606266;
}

.org-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.invite-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.invite-item:last-of-type {
  border-bottom: none;
}

.invite-icon {
  width: 36px;
  height: 36px;
  background: #fdf6ec;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e6a23c;
  flex-shrink: 0;
}

.invite-info {
  flex: 1;
  min-width: 0;
}

.invite-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.invite-meta {
  font-size: 12px;
  color: #909399;
}

.view-all-link {
  text-align: center;
  font-size: 13px;
  color: #409eff;
  cursor: pointer;
  padding: 8px;
  margin-top: 8px;
}

.view-all-link:hover {
  color: #66b1ff;
}
</style>
