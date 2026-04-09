<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统审计日志</h2>
    </div>

    <!-- Filters -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="5">
          <el-input v-model="filters.actor" placeholder="操作人" clearable prefix-icon="User" />
        </el-col>
        <el-col :span="5">
          <el-select v-model="filters.action" placeholder="操作类型" clearable style="width: 100%">
            <el-option label="用户登录" value="user_login" />
            <el-option label="用户注册" value="user_register" />
            <el-option label="创建文档" value="create_document" />
            <el-option label="更新文档" value="update_document" />
            <el-option label="删除文档" value="delete_document" />
            <el-option label="创建版本" value="create_version" />
            <el-option label="恢复版本" value="restore_version" />
            <el-option label="邀请协作" value="invite_collaborator" />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-select v-model="filters.resource_type" placeholder="资源类型" clearable style="width: 100%">
            <el-option label="用户" value="user" />
            <el-option label="文档" value="document" />
            <el-option label="版本" value="version" />
            <el-option label="组织" value="org" />
          </el-select>
        </el-col>
        <el-col :span="7">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="2">
          <el-button type="primary" @click="loadLogs">查询</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="logs" v-loading="loading" size="small">
        <el-table-column label="时间" width="155">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="130">
          <template #default="{ row }">
            <div class="actor-cell">
              <el-avatar :size="22">{{ row.actor_username?.charAt(0) }}</el-avatar>
              <span>{{ row.actor_username || row.actor_id }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-tag :type="actionTagType(row.action)" size="small">
              {{ actionLabel(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="资源类型" width="100">
          <template #default="{ row }">
            <span>{{ resourceLabel(row.resource_type) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="资源ID" width="90">
          <template #default="{ row }">
            <span class="id-text">{{ row.resource_id || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="IP地址" width="130">
          <template #default="{ row }">
            <span class="ip-text">{{ row.ip_address || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="详情" min-width="200">
          <template #default="{ row }">
            <span class="detail-text">{{ row.new_value || row.old_value || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'

const loading = ref(false)
const logs = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const dateRange = ref<Date[]>([])
const filters = reactive({ actor: '', action: '', resource_type: '' })

async function loadLogs() {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      limit: pageSize.value,
      actor: filters.actor || undefined,
      action: filters.action || undefined,
      resource_type: filters.resource_type || undefined,
    }
    if (dateRange.value?.length === 2) {
      params.from_date = dateRange.value[0].toISOString().split('T')[0]
      params.to_date = dateRange.value[1].toISOString().split('T')[0]
    }
    const res = await adminApi.getAuditLogs(params) as any
    logs.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error('加载审计日志失败')
  } finally {
    loading.value = false
  }
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    user_login: '用户登录', user_register: '用户注册',
    create_document: '创建文档', update_document: '更新文档',
    delete_document: '删除文档', publish_document: '发布文档',
    create_version: '创建版本', restore_version: '恢复版本',
    delete_version: '删除版本', invite_collaborator: '邀请协作',
    create_user: '创建用户', delete_user: '删除用户',
    create_org: '创建组织', delete_org: '删除组织',
  }
  return map[action] || action
}

function actionTagType(action: string) {
  if (action.includes('delete')) return 'danger'
  if (action.includes('restore') || action.includes('login')) return 'warning'
  if (action.includes('create') || action.includes('register')) return 'success'
  return 'info'
}

function resourceLabel(type: string) {
  const map: Record<string, string> = { user: '用户', document: '文档', version: '版本', org: '组织', template: '模板' }
  return map[type] || type || '-'
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

onMounted(() => loadLogs())
</script>

<style scoped>
.filter-card { border-radius: 12px; margin-bottom: 16px; }
.table-card { border-radius: 12px; }
.time-text { font-size: 12px; color: #606266; }
.actor-cell { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.id-text, .ip-text { font-size: 12px; color: #909399; font-family: monospace; }
.detail-text { font-size: 12px; color: #606266; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
