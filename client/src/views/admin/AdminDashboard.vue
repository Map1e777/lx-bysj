<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">系统概览</h2>
        <div class="page-subtitle">支持按组织切换查看统计、最近用户和审计动态</div>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedOrgId" clearable placeholder="全部组织" style="width: 220px" @change="reloadAll">
          <el-option label="全部组织" :value="undefined" />
          <el-option v-for="org in orgs" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
        <el-tag type="danger" size="large">系统管理员</el-tag>
      </div>
    </div>

    <!-- Platform Stats -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="4" v-for="stat in statsCards" :key="stat.label">
        <div class="stat-card" :style="{ borderTop: `3px solid ${stat.color}` }">
          <div class="stat-icon" :style="{ background: stat.color + '15', color: stat.color }">
            <el-icon><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </el-col>
    </el-row>

    <el-card shadow="never" class="breakdown-card">
      <template #header>
        <div class="card-header">
          <span>{{ selectedOrgId ? '当前组织细分概览' : '组织维度细分概览' }}</span>
          <span class="header-tip">{{ selectedOrgId ? '用于查看当前组织明细' : '展示文档量最高的前 10 个组织' }}</span>
        </div>
      </template>
      <div v-if="orgBreakdown.length > 0" class="breakdown-list">
        <div v-for="org in orgBreakdown" :key="org.id" class="breakdown-item">
          <div>
            <div class="breakdown-name">{{ org.name }}</div>
            <div class="breakdown-meta">成员 {{ org.user_count }} · 文档 {{ org.document_count }} · 版本 {{ org.version_count }}</div>
          </div>
          <el-progress
            :percentage="Math.min(Math.round((Number(org.document_count || 0) / Math.max(maxDocCount, 1)) * 100), 100)"
            :show-text="false"
            :stroke-width="8"
            color="#409eff"
          />
        </div>
      </div>
      <el-empty v-else :image-size="60" description="暂无组织数据" />
    </el-card>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="never" class="data-card">
          <template #header>
            <div class="card-header">
              <span>四角色矩阵</span>
              <span class="header-tip">{{ statsScopeLabel }}</span>
            </div>
          </template>
          <div class="role-grid">
            <div v-for="item in roleDistribution" :key="item.code" class="role-card">
              <div class="role-card-top">
                <el-tag :type="badgeType(item.code)" size="small">{{ item.label }}</el-tag>
                <span class="role-count">{{ item.value }}</span>
              </div>
              <div class="role-desc">{{ item.desc }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- Recent Registrations -->
      <el-col :span="8">
        <el-card shadow="never" class="data-card">
          <template #header>
            <div class="card-header">
              <span>最近注册用户</span>
              <el-button link type="primary" @click="router.push('/admin/users')">查看全部</el-button>
            </div>
          </template>
          <div v-loading="usersLoading">
            <div v-for="user in recentUsers" :key="user.id" class="list-item">
              <el-avatar :size="32">{{ user.username?.charAt(0)?.toUpperCase() }}</el-avatar>
              <div class="item-info">
                <div class="item-name">{{ user.username }}</div>
                <div class="item-sub">{{ user.email }} · {{ user.org_name || '独立用户' }}</div>
              </div>
              <div class="item-right">
                <div class="user-role-tags">
                  <el-tag
                    v-for="badge in user.role_profile?.badges || []"
                    :key="badge.code"
                    :type="badgeType(badge.code)"
                    size="small"
                  >
                    {{ badge.label }}
                  </el-tag>
                </div>
                <div class="item-time">{{ formatTime(user.created_at) }}</div>
              </div>
            </div>
            <el-empty v-if="recentUsers.length === 0" :image-size="60" description="暂无数据" />
          </div>
        </el-card>
      </el-col>

      <!-- Recent Audit Events -->
      <el-col :span="8">
        <el-card shadow="never" class="data-card">
          <template #header>
            <div class="card-header">
              <span>最近审计事件</span>
              <el-button link type="primary" @click="router.push('/admin/audit-logs')">查看全部</el-button>
            </div>
          </template>
          <div v-loading="auditLoading">
            <div v-for="log in recentAuditLogs" :key="log.id" class="list-item">
              <div class="audit-action-icon" :class="getActionClass(log.action)">
                <el-icon><component :is="getActionIcon(log.action)" /></el-icon>
              </div>
              <div class="item-info">
                <div class="item-name">{{ log.actor_username || log.actor_id || '-' }}</div>
                <div class="item-sub">
                  {{ actionLabel(log.action) }} · {{ log.resource_type }}
                  <span v-if="log.org_name"> · {{ log.org_name }}</span>
                  <span v-if="log.document_title"> · {{ log.document_title }}</span>
                </div>
              </div>
              <div class="item-right">
                <div class="item-time">{{ formatTime(log.created_at) }}</div>
              </div>
            </div>
            <el-empty v-if="recentAuditLogs.length === 0" :image-size="60" description="暂无数据" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api/admin'

const router = useRouter()
const usersLoading = ref(false)
const auditLoading = ref(false)
const recentUsers = ref<any[]>([])
const recentAuditLogs = ref<any[]>([])
const orgs = ref<any[]>([])
const selectedOrgId = ref<number | undefined>(undefined)
const orgBreakdown = ref<any[]>([])
const roleDistribution = ref([
  { code: 'system_admin', label: '系统管理员', value: 0, desc: '平台级配置与最高权限' },
  { code: 'org_admin', label: '组织管理员', value: 0, desc: '组织用户、部门与文档治理' },
  { code: 'doc_creator', label: '文档创作者', value: 0, desc: '拥有文档创建与核心管理权限' },
  { code: 'doc_collaborator', label: '文档协作者', value: 0, desc: '按授权参与协作与版本查看' },
  { code: 'user', label: '普通用户', value: 0, desc: '尚未拥有上述管理或协作身份' },
])

const statsCards = ref([
  { label: '总用户数', value: 0, icon: 'UserFilled', color: '#409eff' },
  { label: '总组织数', value: 0, icon: 'OfficeBuilding', color: '#67c23a' },
  { label: '总文档数', value: 0, icon: 'Document', color: '#e6a23c' },
  { label: '总版本数', value: 0, icon: 'Clock', color: '#f56c6c' },
  { label: '存储使用', value: '0 MB', icon: 'Files', color: '#7b2ff7' },
  { label: '今日活跃', value: 0, icon: 'TrendCharts', color: '#00d2ff' },
])
const statsScopeLabel = computed(() => selectedOrgId.value ? '当前组织视角' : '全平台视角')
const maxDocCount = computed(() => Math.max(...orgBreakdown.value.map(item => Number(item.document_count || 0)), 0))

async function loadStats() {
  try {
    const res = await adminApi.getStats({ org_id: selectedOrgId.value }) as any
    const stats = res.data || {}
    statsCards.value[0].value = stats.total_users ?? stats.users?.total ?? 0
    statsCards.value[1].value = stats.total_orgs ?? stats.organizations?.total ?? 0
    statsCards.value[2].value = stats.total_documents ?? stats.documents?.total ?? 0
    statsCards.value[3].value = stats.total_versions ?? stats.versions?.total ?? 0
    statsCards.value[4].value = stats.storage_used || '0 MB'
    statsCards.value[5].value = stats.active_today || 0
    orgBreakdown.value = stats.org_breakdown || []
    const distribution = stats.role_distribution || {}
    roleDistribution.value = roleDistribution.value.map(item => ({
      ...item,
      value: distribution[item.code] || 0
    }))
  } catch (e) {}
}

async function loadRecentUsers() {
  usersLoading.value = true
  try {
    const res = await adminApi.getUsers({ limit: 8, org_id: selectedOrgId.value } as any) as any
    recentUsers.value = res.data?.list || []
  } catch (e) {} finally {
    usersLoading.value = false
  }
}

async function loadRecentAuditLogs() {
  auditLoading.value = true
  try {
    const res = await adminApi.getAuditLogs({ limit: 8, org_id: selectedOrgId.value }) as any
    recentAuditLogs.value = res.data?.list || []
  } catch (e) {} finally {
    auditLoading.value = false
  }
}

async function loadOrgs() {
  try {
    const res = await adminApi.getOrgs({ limit: 1000 }) as any
    orgs.value = res.data?.list || []
  } catch (e) {}
}

function reloadAll() {
  loadStats()
  loadRecentUsers()
  loadRecentAuditLogs()
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

function actionLabel(action: string) {
  const map: Record<string, string> = {
    user_login: '用户登录',
    user_register: '用户注册',
    create_document: '创建文档',
    update_document: '更新文档',
    delete_document: '删除文档',
    create_version: '创建版本',
    restore_version: '恢复版本',
    invite_collaborator: '邀请协作',
  }
  return map[action] || action
}

function getActionIcon(action: string) {
  if (action.includes('login') || action.includes('register')) return 'User'
  if (action.includes('create')) return 'Plus'
  if (action.includes('delete')) return 'Delete'
  if (action.includes('update')) return 'Edit'
  return 'InfoFilled'
}

function getActionClass(action: string) {
  if (action.includes('delete')) return 'action-danger'
  if (action.includes('create')) return 'action-success'
  if (action.includes('update')) return 'action-warning'
  return 'action-info'
}

function formatTime(time: string) {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadOrgs()
  reloadAll()
})
</script>

<style scoped>
.page-subtitle { font-size: 13px; color: #909399; margin-top: 6px; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.stats-row { margin-bottom: 20px; }
.breakdown-card { border-radius: 12px; margin-bottom: 20px; }

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover { transform: translateY(-2px); }

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin: 0 auto 10px;
}

.stat-value { font-size: 24px; font-weight: 700; color: #303133; }
.stat-label { font-size: 12px; color: #909399; margin-top: 4px; }

.data-card { border-radius: 12px; }

.card-header { display: flex; align-items: center; justify-content: space-between; }
.header-tip { font-size: 12px; color: #909399; }
.role-grid { display: grid; gap: 10px; }
.role-card {
  border: 1px solid #eef2f6;
  border-radius: 10px;
  padding: 12px;
  background: #fbfcfe;
}
.role-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.role-count { font-size: 18px; font-weight: 700; color: #303133; }
.role-desc { font-size: 12px; color: #909399; line-height: 1.6; }
.breakdown-list { display: grid; gap: 12px; }
.breakdown-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 16px;
  align-items: center;
}
.breakdown-name { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.breakdown-meta { font-size: 12px; color: #909399; }

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.list-item:last-child { border-bottom: none; }

.item-info { flex: 1; min-width: 0; }
.item-name { font-size: 13px; font-weight: 500; color: #303133; }
.item-sub { font-size: 12px; color: #909399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.item-time { font-size: 11px; color: #c0c4cc; }
.user-role-tags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; max-width: 180px; }

.audit-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.action-success { background: #f0f9eb; color: #67c23a; }
.action-danger { background: #fef0f0; color: #f56c6c; }
.action-warning { background: #fdf6ec; color: #e6a23c; }
.action-info { background: #f4f4f5; color: #909399; }
</style>
