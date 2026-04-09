<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">组织概览</h2>
    </div>

    <!-- Stats -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in statsCards" :key="stat.label">
        <div class="stat-card" :style="{ borderTop: `3px solid ${stat.color}` }">
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
          <div class="stat-icon-wrapper" :style="{ background: stat.color + '15', color: stat.color }">
            <el-icon><component :is="stat.icon" /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <!-- Quick Navigation -->
      <el-col :span="8">
        <el-card class="nav-card" shadow="never">
          <template #header>快捷导航</template>
          <div class="quick-nav-list">
            <div class="nav-item" v-for="nav in quickNavs" :key="nav.path" @click="router.push(nav.path)">
              <div class="nav-icon" :style="{ background: nav.color + '15', color: nav.color }">
                <el-icon><component :is="nav.icon" /></el-icon>
              </div>
              <span class="nav-label">{{ nav.label }}</span>
              <el-icon class="nav-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- Recent Activity -->
      <el-col :span="16">
        <el-card class="activity-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>最近活动</span>
              <el-button link type="primary" @click="router.push('/org/audit')">查看全部</el-button>
            </div>
          </template>
          <div v-loading="activityLoading">
            <div v-for="activity in activities" :key="activity.id" class="activity-item">
              <div class="activity-avatar">
                <el-avatar :size="32">{{ activity.user?.username?.charAt(0) }}</el-avatar>
              </div>
              <div class="activity-content">
                <div class="activity-text">
                  <span class="activity-user">{{ activity.user?.username }}</span>
                  {{ actionLabel(activity.action) }}
                  <span class="activity-resource">{{ activity.resource_title }}</span>
                </div>
                <div class="activity-time">{{ formatTime(activity.created_at) }}</div>
              </div>
            </div>
            <el-empty v-if="activities.length === 0" description="暂无活动记录" :image-size="80" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { orgApi } from '@/api/org'

const router = useRouter()
const activityLoading = ref(false)
const activities = ref<any[]>([])

const statsCards = ref([
  { label: '组织成员', value: 0, icon: 'UserFilled', color: '#409eff' },
  { label: '部门数量', value: 0, icon: 'Grid', color: '#67c23a' },
  { label: '文档总数', value: 0, icon: 'Document', color: '#e6a23c' },
  { label: '本月新增', value: 0, icon: 'Trend', color: '#f56c6c' },
])

const quickNavs = [
  { label: '成员管理', icon: 'UserFilled', path: '/org/members', color: '#409eff' },
  { label: '部门管理', icon: 'Grid', path: '/org/departments', color: '#67c23a' },
  { label: '组织文档', icon: 'Files', path: '/org/documents', color: '#e6a23c' },
  { label: '版本审计', icon: 'Tickets', path: '/org/audit', color: '#f56c6c' },
]

function actionLabel(action: string) {
  const map: Record<string, string> = {
    create_document: '创建了文档',
    update_document: '更新了文档',
    publish_document: '发布了文档',
    create_version: '保存了版本',
    invite_collaborator: '邀请了协作者',
  }
  return map[action] || action
}

function formatTime(time: string) {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}小时前`
  return date.toLocaleDateString('zh-CN')
}

async function loadStats() {
  try {
    const res = await orgApi.getOrgStats() as any
    const stats = res.data || {}
    statsCards.value[0].value = stats.member_count ?? stats.stats?.member_count ?? 0
    statsCards.value[1].value = stats.dept_count ?? stats.department_count ?? stats.stats?.department_count ?? 0
    statsCards.value[2].value = stats.document_count ?? stats.stats?.document_count ?? 0
    statsCards.value[3].value = stats.new_docs_this_month || 0
  } catch (e) {}
}

async function loadActivities() {
  activityLoading.value = true
  try {
    const res = await orgApi.getVersionAudit({ limit: 10 }) as any
    activities.value = (res.data?.list || []).map((item: any) => ({
      ...item,
      user: { username: item.actor_username || '-' },
      resource_title: item.document_title || item.resource_id || '-'
    }))
  } catch (e) {} finally {
    activityLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadActivities()
})
</script>

<style scoped>
.stats-row { margin-bottom: 20px; }

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: transform 0.2s;
}

.stat-card:hover { transform: translateY(-2px); }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.nav-card, .activity-card {
  border-radius: 12px;
}

.quick-nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.nav-item:hover { background: #f5f7fa; }

.nav-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.nav-label { flex: 1; font-size: 14px; color: #303133; font-weight: 500; }
.nav-arrow { color: #c0c4cc; }

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.activity-item:last-child { border-bottom: none; }
.activity-content { flex: 1; }

.activity-text {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
  line-height: 1.5;
}

.activity-user { font-weight: 600; color: #303133; }
.activity-resource { font-weight: 500; color: #409eff; }
.activity-time { font-size: 11px; color: #c0c4cc; }
</style>
