<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">版本审计</h2>
      <el-button @click="exportReport">
        <el-icon><Download /></el-icon>
        导出报告
      </el-button>
    </div>

    <!-- Filters -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="文档">
            <el-input v-model="filters.doc_title" placeholder="文档标题" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="操作人">
            <el-input v-model="filters.user_name" placeholder="用户名" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="日期范围">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <div class="filter-actions">
        <el-button type="primary" @click="loadAudit">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="auditLogs" v-loading="loading" row-class-name="audit-row">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="130">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="24">{{ row.user?.username?.charAt(0) }}</el-avatar>
              <span>{{ row.user?.username }}</span>
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
        <el-table-column label="文档" min-width="200">
          <template #default="{ row }">
            <span class="doc-link" @click="router.push(`/documents/${row.document_id}/view`)">
              {{ row.document_title }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="版本号" width="100">
          <template #default="{ row }">
            <span v-if="row.version_number">v{{ row.version_number }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="版本标签" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.version_label" type="warning" size="small">{{ row.version_label }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="变更说明" min-width="200">
          <template #default="{ row }">
            <span class="change-summary">{{ row.change_summary || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :total="total"
          :page-size="pageSize"
          layout="total, prev, pager, next"
          @current-change="loadAudit"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { orgApi } from '@/api/org'

const router = useRouter()
const loading = ref(false)
const auditLogs = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const dateRange = ref<Date[]>([])

const filters = reactive({
  doc_title: '',
  user_name: '',
})

async function loadAudit() {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      limit: pageSize.value,
    }
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0].toISOString().split('T')[0]
      params.end_date = dateRange.value[1].toISOString().split('T')[0]
    }
    const res = await orgApi.getVersionAudit(params) as any
    auditLogs.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error('加载审计日志失败')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { doc_title: '', user_name: '' })
  dateRange.value = []
  loadAudit()
}

async function exportReport() {
  try {
    const params: any = {}
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0].toISOString().split('T')[0]
      params.end_date = dateRange.value[1].toISOString().split('T')[0]
    }
    const blob = await orgApi.exportAuditReport(params) as any
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `版本审计报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    create_version: '创建版本',
    restore_version: '恢复版本',
    delete_version: '删除版本',
    create_document: '创建文档',
    update_document: '更新文档',
    publish_document: '发布文档',
    archive_document: '归档文档',
  }
  return map[action] || action
}

function actionTagType(action: string) {
  if (action.includes('delete') || action.includes('archive')) return 'danger'
  if (action.includes('restore')) return 'warning'
  if (action.includes('create')) return 'success'
  return 'info'
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(() => loadAudit())
</script>

<style scoped>
.filter-card { border-radius: 12px; margin-bottom: 16px; }
.filter-actions { display: flex; gap: 8px; }
.table-card { border-radius: 12px; }
.time-text { font-size: 13px; color: #606266; }
.user-cell { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.doc-link { color: #409eff; cursor: pointer; font-weight: 500; }
.doc-link:hover { text-decoration: underline; }
.change-summary { font-size: 13px; color: #606266; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
