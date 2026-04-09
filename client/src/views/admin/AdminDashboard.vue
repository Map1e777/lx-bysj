<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统概览</h2>
      <el-tag type="danger" size="large">系统管理员</el-tag>
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

    <el-row :gutter="20">
      <!-- Recent Registrations -->
      <el-col :span="12">
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
                <div class="item-sub">{{ user.email }}</div>
              </div>
              <div class="item-right">
                <el-tag :type="user.system_role === 'system_admin' ? 'danger' : 'info'" size="small">
                  {{ user.system_role === 'system_admin' ? '系统管理员' : '普通用户' }}
                </el-tag>
                <div class="item-time">{{ formatTime(user.created_at) }}</div>
              </div>
            </div>
            <el-empty v-if="recentUsers.length === 0" :image-size="60" description="暂无数据" />
          </div>
        </el-card>
      </el-col>

      <!-- Recent Audit Events -->
      <el-col :span="12">
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
                <div class="item-sub">{{ actionLabel(log.action) }} · {{ log.resource_type }}</div>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api/admin'

const router = useRouter()
const usersLoading = ref(false)
const auditLoading = ref(false)
const recentUsers = ref<any[]>([])
const recentAuditLogs = ref<any[]>([])

const statsCards = ref([
  { label: '总用户数', value: 0, icon: 'UserFilled', color: '#409eff' },
  { label: '总组织数', value: 0, icon: 'OfficeBuilding', color: '#67c23a' },
  { label: '总文档数', value: 0, icon: 'Document', color: '#e6a23c' },
  { label: '总版本数', value: 0, icon: 'Clock', color: '#f56c6c' },
  { label: '存储使用', value: '0 MB', icon: 'Files', color: '#7b2ff7' },
  { label: '今日活跃', value: 0, icon: 'TrendCharts', color: '#00d2ff' },
])

async function loadStats() {
  try {
    const res = await adminApi.getStats() as any
    const stats = res.data || {}
    statsCards.value[0].value = stats.total_users ?? stats.users?.total ?? 0
    statsCards.value[1].value = stats.total_orgs ?? stats.organizations?.total ?? 0
    statsCards.value[2].value = stats.total_documents ?? stats.documents?.total ?? 0
    statsCards.value[3].value = stats.total_versions ?? stats.versions?.total ?? 0
    statsCards.value[4].value = stats.storage_used || '0 MB'
    statsCards.value[5].value = stats.active_today || 0
  } catch (e) {}
}

async function loadRecentUsers() {
  usersLoading.value = true
  try {
    const res = await adminApi.getUsers({ limit: 8, sort: 'created_at' } as any) as any
    recentUsers.value = res.data?.list || []
  } catch (e) {} finally {
    usersLoading.value = false
  }
}

async function loadRecentAuditLogs() {
  auditLoading.value = true
  try {
    const res = await adminApi.getAuditLogs({ limit: 8 }) as any
    recentAuditLogs.value = res.data?.list || []
  } catch (e) {} finally {
    auditLoading.value = false
  }
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
  loadStats()
  loadRecentUsers()
  loadRecentAuditLogs()
})
</script>

<style scoped>
.stats-row { margin-bottom: 20px; }

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
