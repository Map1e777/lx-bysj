<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="router.push(`/documents/${docId}/edit`)">
          <el-icon><ArrowLeft /></el-icon>
          返回文档
        </el-button>
        <el-divider direction="vertical" />
        <h2 class="page-title" style="margin: 0">版本历史</h2>
        <el-tag type="info" size="small" v-if="docTitle">{{ docTitle }}</el-tag>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          :disabled="selectedVersions.length !== 2"
          @click="compareVersions"
        >
          <el-icon><View /></el-icon>
          对比选中版本 ({{ selectedVersions.length }}/2)
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="version-list">
      <div
        v-for="version in versions"
        :key="version.id"
        class="version-item"
        :class="{ 'is-checkpoint': version.is_checkpoint, 'is-current': version.is_current }"
      >
        <!-- Selection checkbox -->
        <el-checkbox
          :model-value="selectedVersions.includes(version.id)"
          @change="(val: boolean) => toggleSelect(version.id, val)"
          :disabled="!selectedVersions.includes(version.id) && selectedVersions.length >= 2"
        />

        <!-- Version Timeline Line -->
        <div class="version-timeline">
          <div class="timeline-dot" :class="{ 'is-checkpoint': version.is_checkpoint }">
            <el-icon v-if="version.is_checkpoint"><Flag /></el-icon>
            <el-icon v-else><Clock /></el-icon>
          </div>
          <div class="timeline-line" v-if="!version.is_last" />
        </div>

        <!-- Version Content -->
        <div class="version-content">
          <div class="version-header">
            <div class="version-title-area">
              <span class="version-number">v{{ version.version_number }}</span>
              <el-tag v-if="version.label" type="warning" size="small">{{ version.label }}</el-tag>
              <el-tag v-if="version.is_current" type="success" size="small">当前版本</el-tag>
              <el-tag v-if="version.is_checkpoint" type="danger" size="small">手动节点</el-tag>
            </div>
            <div class="version-meta">
              <el-avatar :size="24">{{ version.created_by?.username?.charAt(0) }}</el-avatar>
              <span>{{ version.created_by?.username }}</span>
              <span class="version-time">{{ formatTime(version.created_at) }}</span>
              <span class="word-count">{{ version.word_count || 0 }} 字</span>
            </div>
          </div>

          <div v-if="version.change_summary" class="version-summary">
            {{ version.change_summary }}
          </div>

          <div class="version-actions">
            <el-button link type="primary" size="small" @click="viewVersion(version)">
              查看内容
            </el-button>
            <el-button
              link
              type="warning"
              size="small"
              @click="restoreVersion(version)"
              v-if="!version.is_current"
            >
              恢复此版本
            </el-button>
            <el-button
              link
              type="danger"
              size="small"
              @click="deleteVersion(version)"
              v-if="!version.is_current && !version.is_checkpoint"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>

      <el-empty v-if="versions.length === 0 && !loading" description="暂无版本记录" :image-size="120" />
    </div>

    <!-- Pagination -->
    <div class="pagination-wrapper" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        :total="total"
        :page-size="pageSize"
        layout="prev, pager, next"
        @current-change="loadVersions"
      />
    </div>

    <!-- Version Preview Dialog -->
    <el-dialog v-model="showPreview" title="版本内容预览" width="800px" top="5vh">
      <div v-if="previewVersion">
        <div class="preview-meta">
          <el-tag type="warning" v-if="previewVersion.label">{{ previewVersion.label }}</el-tag>
          <span>v{{ previewVersion.version_number }}</span>
          <span>{{ formatTime(previewVersion.created_at) }}</span>
          <span>{{ previewVersion.word_count }} 字</span>
        </div>
        <div class="preview-content" v-html="previewVersion.content" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { versionApi } from '@/api/version'
import { documentApi } from '@/api/document'

const router = useRouter()
const route = useRoute()
const docId = Number(route.params.id)

const loading = ref(false)
const versions = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const docTitle = ref('')
const selectedVersions = ref<number[]>([])
const showPreview = ref(false)
const previewVersion = ref<any>(null)

async function loadVersions() {
  loading.value = true
  try {
    const res = await versionApi.getVersions(docId, { page: currentPage.value, limit: pageSize.value }) as any
    versions.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error('加载版本历史失败')
  } finally {
    loading.value = false
  }
}

async function loadDocInfo() {
  try {
    const res = await documentApi.getDocument(docId) as any
    docTitle.value = res.data.title
  } catch (e) {}
}

function toggleSelect(id: number, val: boolean) {
  if (val) {
    if (selectedVersions.value.length < 2) {
      selectedVersions.value.push(id)
    }
  } else {
    selectedVersions.value = selectedVersions.value.filter(v => v !== id)
  }
}

async function viewVersion(version: any) {
  try {
    const res = await versionApi.getVersion(docId, version.id) as any
    previewVersion.value = res.data
    showPreview.value = true
  } catch (e) {
    ElMessage.error('加载版本内容失败')
  }
}

async function restoreVersion(version: any) {
  try {
    await ElMessageBox.confirm(
      `确定要恢复到版本 v${version.version_number} 吗？当前内容将被替换。`,
      '恢复版本',
      { type: 'warning', confirmButtonText: '确认恢复' }
    )
    await versionApi.restoreVersion(docId, version.id)
    ElMessage.success('版本已恢复')
    loadVersions()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('恢复失败')
  }
}

async function deleteVersion(version: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除版本 v${version.version_number} 吗？此操作不可撤销。`,
      '删除版本',
      { type: 'error', confirmButtonText: '删除' }
    )
    await versionApi.deleteVersion(docId, version.id)
    ElMessage.success('版本已删除')
    loadVersions()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

function compareVersions() {
  if (selectedVersions.value.length !== 2) return
  router.push({
    path: `/documents/${docId}/versions/compare`,
    query: { v1: selectedVersions.value[0], v2: selectedVersions.value[1] }
  })
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(() => {
  loadDocInfo()
  loadVersions()
})
</script>

<style scoped>
.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.version-list {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.version-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #f5f7fa;
}

.version-item:last-child {
  border-bottom: none;
}

.version-item.is-checkpoint {
  background: #fffbf0;
  margin: -16px -24px;
  padding: 16px 24px;
}

.version-item.is-current {
  background: #f0f9f0;
  margin: -16px -24px;
  padding: 16px 24px;
}

.version-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.timeline-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
  flex-shrink: 0;
  z-index: 1;
}

.timeline-dot.is-checkpoint {
  background: #fdf6ec;
  color: #e6a23c;
  border: 2px solid #e6a23c;
}

.timeline-line {
  width: 2px;
  height: 100%;
  background: #e4e7ed;
  margin-top: 4px;
  flex: 1;
}

.version-content {
  flex: 1;
  min-width: 0;
}

.version-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.version-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.version-number {
  font-size: 15px;
  font-weight: 700;
  color: #303133;
}

.version-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
  flex-wrap: wrap;
}

.version-time, .word-count {
  font-size: 12px;
  color: #c0c4cc;
}

.version-summary {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.version-actions {
  display: flex;
  gap: 8px;
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  color: #909399;
}

.preview-content {
  max-height: calc(90vh - 200px);
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
}

:deep(.preview-content h1) { font-size: 24px; font-weight: 700; margin: 16px 0 10px; }
:deep(.preview-content h2) { font-size: 20px; font-weight: 600; margin: 14px 0 8px; }
:deep(.preview-content h3) { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
:deep(.preview-content p) { margin: 0 0 8px; }
:deep(.preview-content ul), :deep(.preview-content ol) { padding-left: 24px; margin: 0 0 8px; }
:deep(.preview-content pre) { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; }
:deep(.preview-content code) { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-family: monospace; }
:deep(.preview-content blockquote) { border-left: 4px solid #409eff; padding-left: 12px; color: #606266; font-style: italic; }

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
