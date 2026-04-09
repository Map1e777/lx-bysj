<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">组织文档管理</h2>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <el-input v-model="search" placeholder="搜索文档..." prefix-icon="Search" clearable class="search-input" @input="handleSearch" />
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px" @change="loadDocs">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已归档" value="archived" />
      </el-select>
      <el-select v-model="deptFilter" placeholder="部门" clearable style="width: 150px" @change="loadDocs">
        <el-option v-for="dept in departments" :key="dept.id" :label="dept.name" :value="dept.id" />
      </el-select>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="documents" v-loading="loading">
        <el-table-column label="文档标题" min-width="240">
          <template #default="{ row }">
            <div class="doc-title-cell">
              <el-icon class="doc-icon"><Document /></el-icon>
              <span class="doc-name">{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="创建者" width="130">
          <template #default="{ row }">
            <div class="owner-cell">
              <el-avatar :size="24">{{ row.owner_username?.charAt(0) }}</el-avatar>
              <span>{{ row.owner_username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="部门" width="120">
          <template #default="{ row }">
            {{ row.dept_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="协作者" width="80">
          <template #default="{ row }">
            <span class="collab-count">{{ row.collaborator_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最后修改" width="140">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.updated_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="router.push(`/documents/${row.id}/view`)">
              查看
            </el-button>
            <el-button link type="primary" size="small" @click="router.push(`/documents/${row.id}/versions`)">
              版本
            </el-button>
            <el-button
              link
              type="warning"
              size="small"
              v-if="row.status !== 'archived'"
              @click="forceArchive(row)"
            >
              强制归档
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :total="total"
          :page-size="pageSize"
          layout="total, prev, pager, next"
          @current-change="loadDocs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orgApi } from '@/api/org'

const router = useRouter()
const loading = ref(false)
const documents = ref<any[]>([])
const departments = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const search = ref('')
const statusFilter = ref('')
const deptFilter = ref<number | null>(null)

let searchTimer: any = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadDocs, 300)
}

async function loadDocs() {
  loading.value = true
  try {
    const res = await orgApi.getOrgDocuments({
      page: currentPage.value,
      limit: pageSize.value,
      status: statusFilter.value || undefined,
      dept_id: deptFilter.value || undefined,
      search: search.value || undefined,
    }) as any
    documents.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {} finally {
    loading.value = false
  }
}

async function loadDepts() {
  try {
    const res = await orgApi.getDepartments() as any
    departments.value = res.data || []
  } catch (e) {}
}

async function forceArchive(doc: any) {
  try {
    await ElMessageBox.confirm(`确定要强制归档文档 "${doc.title}" 吗？`, '强制归档', { type: 'warning' })
    await orgApi.forceArchiveDocument(doc.id)
    ElMessage.success('文档已归档')
    loadDocs()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('操作失败')
  }
}

function statusTagType(status: string) {
  const map: Record<string, string> = { draft: 'info', published: 'success', archived: 'warning' }
  return map[status] || 'info'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' }
  return map[status] || status
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(() => {
  loadDocs()
  loadDepts()
})
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { width: 260px; }
.table-card { border-radius: 12px; }
.doc-title-cell { display: flex; align-items: center; gap: 8px; }
.doc-icon { font-size: 18px; color: #409eff; }
.doc-name { font-weight: 500; color: #303133; }
.owner-cell { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.collab-count { font-size: 13px; color: #606266; }
.time-text { font-size: 13px; color: #909399; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
