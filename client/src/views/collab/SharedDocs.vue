<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">共享文档</h2>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索文档标题..."
        prefix-icon="Search"
        clearable
        class="search-input"
        @input="handleSearch"
      />
      <el-select v-model="roleFilter" placeholder="我的角色" clearable style="width: 140px" @change="loadDocs">
        <el-option label="编辑者" value="editor" />
        <el-option label="评论者" value="commenter" />
        <el-option label="查看者" value="viewer" />
      </el-select>
    </div>

    <div v-loading="loading" class="docs-content">
      <el-table v-if="documents.length > 0" :data="documents" @row-click="handleRowClick" row-class-name="table-row">
        <el-table-column label="文档标题" min-width="280">
          <template #default="{ row }">
            <div class="doc-title-cell">
              <el-icon class="doc-icon"><Document /></el-icon>
              <span class="doc-name">{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="所有者" width="130">
          <template #default="{ row }">
            <div class="owner-cell">
              <el-avatar :size="24">{{ row.owner?.username?.charAt(0) }}</el-avatar>
              <span>{{ row.owner?.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="我的角色" width="100">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.my_role)" size="small">
              {{ roleLabel(row.my_role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后修改" width="150">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.updated_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="openDoc(row)">
              {{ row.my_role === 'viewer' ? '查看' : '编辑' }}
            </el-button>
            <el-button link type="info" size="small" @click.stop="router.push(`/documents/${row.id}/versions`)">
              版本
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else description="暂无共享文档" :image-size="120">
        <template #extra>
          <el-button type="primary" @click="router.push('/invitations')">查看待处理邀请</el-button>
        </template>
      </el-empty>
    </div>

    <div class="pagination-wrapper" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        :total="total"
        :page-size="pageSize"
        layout="total, prev, pager, next"
        @current-change="loadDocs"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { collaborationApi } from '@/api/collaboration'

const router = useRouter()

const loading = ref(false)
const documents = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')
const roleFilter = ref('')

let searchTimer: any = null

function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadDocs, 300)
}

async function loadDocs() {
  loading.value = true
  try {
    const res = await collaborationApi.getSharedDocuments({
      page: currentPage.value,
      limit: pageSize.value,
    }) as any
    documents.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

function handleRowClick(row: any) {
  openDoc(row)
}

function openDoc(row: any) {
  if (row.my_role === 'viewer') {
    router.push(`/documents/${row.id}/view`)
  } else {
    router.push(`/documents/${row.id}/edit`)
  }
}

function roleTagType(role: string) {
  const map: Record<string, string> = { editor: 'success', commenter: 'primary', viewer: 'info' }
  return map[role] || 'info'
}

function roleLabel(role: string) {
  const map: Record<string, string> = { editor: '编辑者', commenter: '评论者', viewer: '查看者' }
  return map[role] || role
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
  return new Date(time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => loadDocs())
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input { width: 280px; }

.docs-content {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  min-height: 300px;
}

.doc-title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-icon { font-size: 18px; color: #409eff; }

.doc-name {
  font-weight: 500;
  color: #303133;
  cursor: pointer;
}

.doc-name:hover { color: #409eff; }

.owner-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.time-text { font-size: 13px; color: #909399; }

:deep(.table-row) { cursor: pointer; }

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
