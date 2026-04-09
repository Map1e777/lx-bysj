<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">文档管理</h2>
      <el-button type="primary" @click="router.push('/documents/new')">
        <el-icon><Plus /></el-icon>
        新建文档
      </el-button>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange" class="doc-tabs">
      <el-tab-pane label="我的文档" name="mine" />
      <el-tab-pane label="共享给我的" name="shared" />
      <el-tab-pane label="公开文档" name="public" />
    </el-tabs>

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
      <el-select v-model="statusFilter" placeholder="文档状态" clearable class="filter-select" @change="loadDocuments">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已归档" value="archived" />
      </el-select>
      <el-select v-model="sortBy" class="filter-select" @change="loadDocuments">
        <el-option label="最近更新" value="updated_at" />
        <el-option label="最近创建" value="created_at" />
        <el-option label="标题 A-Z" value="title" />
      </el-select>
      <el-radio-group v-model="viewMode" size="small">
        <el-radio-button value="list"><el-icon><List /></el-icon></el-radio-button>
        <el-radio-button value="grid"><el-icon><Grid /></el-icon></el-radio-button>
      </el-radio-group>
    </div>

    <!-- Document List/Grid -->
    <div v-loading="loading" class="doc-content">
      <!-- List View -->
      <template v-if="viewMode === 'list'">
        <el-table
          v-if="documents.length > 0"
          :data="documents"
          row-class-name="doc-table-row"
          @row-click="handleRowClick"
        >
          <el-table-column label="文档标题" min-width="280">
            <template #default="{ row }">
              <div class="doc-title-cell">
                <el-icon class="doc-file-icon"><Document /></el-icon>
                <div>
                  <div class="doc-name">{{ row.title }}</div>
                  <div v-if="row.tags?.length" class="doc-tags">
                    <el-tag
                      v-for="tag in row.tags.slice(0, 3)"
                      :key="tag"
                      size="small"
                      type="info"
                    >{{ tag }}</el-tag>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="所有者" width="130">
            <template #default="{ row }">
              <div class="owner-cell">
                <el-avatar :size="24">{{ row.owner_username?.charAt(0) }}</el-avatar>
                <span>{{ row.owner_username }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="协作者" width="100">
            <template #default="{ row }">
              <span class="collab-count">
                <el-icon><UserFilled /></el-icon>
                {{ row.collaborator_count || 0 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="最后修改" width="140">
            <template #default="{ row }">
              <span class="time-text">{{ formatTime(row.updated_at) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <div style="display:flex;align-items:center;gap:4px;">
              <el-button link type="primary" size="small" @click.stop="router.push(`/documents/${row.id}/edit`)">
                编辑
              </el-button>
              <el-dropdown trigger="click" @command="(cmd: string) => handleDocCommand(cmd, row)">
                <el-button link type="primary" size="small" @click.stop>
                  更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="view">查看</el-dropdown-item>
                    <el-dropdown-item command="versions">版本历史</el-dropdown-item>
                    <el-dropdown-item command="permissions">协作管理</el-dropdown-item>
                    <el-dropdown-item command="publish" v-if="row.status === 'draft'">发布</el-dropdown-item>
                    <el-dropdown-item command="archive" v-if="row.status !== 'archived'">归档</el-dropdown-item>
                    <el-dropdown-item command="delete" divided style="color: #f56c6c">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无文档" :image-size="120" />
      </template>

      <!-- Grid View -->
      <template v-else>
        <div v-if="documents.length > 0" class="doc-grid">
          <div
            v-for="doc in documents"
            :key="doc.id"
            class="doc-card"
            @click="router.push(`/documents/${doc.id}/edit`)"
          >
            <div class="doc-card-header">
              <el-icon class="doc-card-icon"><Document /></el-icon>
              <el-dropdown trigger="click" @command="(cmd: string) => handleDocCommand(cmd, doc)" @click.stop>
                <el-button link size="small" @click.stop><el-icon><MoreFilled /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="view">查看</el-dropdown-item>
                    <el-dropdown-item command="versions">版本历史</el-dropdown-item>
                    <el-dropdown-item command="permissions">协作管理</el-dropdown-item>
                    <el-dropdown-item command="archive" v-if="doc.status !== 'archived'">归档</el-dropdown-item>
                    <el-dropdown-item command="delete" divided style="color: #f56c6c">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="doc-card-title">{{ doc.title }}</div>
            <div class="doc-card-meta">
              <el-tag :type="statusTagType(doc.status)" size="small">{{ statusLabel(doc.status) }}</el-tag>
            </div>
            <div class="doc-card-footer">
              <span class="doc-card-time">{{ formatTime(doc.updated_at) }}</span>
              <span class="doc-card-collabs">
                <el-icon><UserFilled /></el-icon>
                {{ doc.collaborator_count || 0 }}
              </span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无文档" :image-size="120" />
      </template>
    </div>

    <!-- Pagination -->
    <div class="pagination-wrapper" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadDocuments"
        @current-change="loadDocuments"
      />
    </div>

    <!-- Permission Modal -->
    <DocPermModal
      v-if="permModalDocId"
      v-model="showPermModal"
      :doc-id="permModalDocId"
      @close="showPermModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { documentApi } from '@/api/document'
import DocPermModal from '@/components/DocPermModal.vue'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const documents = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const activeTab = ref('mine')
const searchQuery = ref('')
const statusFilter = ref('')
const sortBy = ref('updated_at')
const viewMode = ref('list')
const showPermModal = ref(false)
const permModalDocId = ref<number | null>(null)

let searchTimer: any = null

function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadDocuments, 300)
}

function handleTabChange() {
  currentPage.value = 1
  loadDocuments()
}

async function loadDocuments() {
  loading.value = true
  try {
    const scopeMap: Record<string, string> = {
      mine: 'mine',
      shared: 'shared',
      public: 'public'
    }
    const res = await documentApi.getDocuments({
      page: currentPage.value,
      limit: pageSize.value,
      scope: scopeMap[activeTab.value] as any,
      status: statusFilter.value || undefined,
      sort: sortBy.value,
      search: searchQuery.value || undefined
    }) as any
    documents.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handleRowClick(row: any) {
  router.push(`/documents/${row.id}/edit`)
}

async function handleDocCommand(command: string, doc: any) {
  switch (command) {
    case 'view':
      router.push(`/documents/${doc.id}/view`)
      break
    case 'versions':
      router.push(`/documents/${doc.id}/versions`)
      break
    case 'permissions':
      permModalDocId.value = doc.id
      showPermModal.value = true
      break
    case 'publish':
      try {
        await documentApi.publishDocument(doc.id)
        ElMessage.success('文档已发布')
        loadDocuments()
      } catch (e) {}
      break
    case 'archive':
      try {
        await ElMessageBox.confirm('确定要归档此文档吗？', '提示', { type: 'warning' })
        await documentApi.archiveDocument(doc.id)
        ElMessage.success('文档已归档')
        loadDocuments()
      } catch (e: any) {
        if (e !== 'cancel') ElMessage.error('操作失败')
      }
      break
    case 'delete':
      try {
        await ElMessageBox.confirm('确定要删除此文档吗？此操作不可撤销。', '确认删除', {
          type: 'error',
          confirmButtonText: '删除',
          confirmButtonClass: 'el-button--danger'
        })
        await documentApi.deleteDocument(doc.id)
        ElMessage.success('文档已删除')
        loadDocuments()
      } catch (e: any) {
        if (e !== 'cancel') ElMessage.error('删除失败')
      }
      break
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
  const date = new Date(time)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

watch(() => route.query.search, (val) => {
  if (val) {
    searchQuery.value = val as string
    loadDocuments()
  }
})

onMounted(() => {
  if (route.query.search) {
    searchQuery.value = route.query.search as string
  }
  loadDocuments()
})
</script>

<style scoped>
.doc-tabs {
  margin-bottom: 16px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 140px;
}

.doc-content {
  min-height: 300px;
}

.doc-title-cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.doc-file-icon {
  font-size: 20px;
  color: #409eff;
  margin-top: 2px;
  flex-shrink: 0;
}

.doc-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  cursor: pointer;
}

.doc-name:hover {
  color: #409eff;
}

.doc-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.owner-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.collab-count {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 13px;
}

.time-text {
  font-size: 13px;
  color: #909399;
}

:deep(.doc-table-row) {
  cursor: pointer;
}

/* Grid View */
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.doc-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #e4e7ed;
  cursor: pointer;
  transition: all 0.2s;
}

.doc-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.doc-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.doc-card-icon {
  font-size: 28px;
  color: #409eff;
}

.doc-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-card-meta {
  margin-bottom: 12px;
}

.doc-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.doc-card-collabs {
  display: flex;
  align-items: center;
  gap: 3px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
