<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-divider direction="vertical" />
        <h2 class="page-title" style="margin: 0">{{ document?.title }}</h2>
      </div>
      <div class="header-right">
        <el-button @click="router.push(`/documents/${docId}/versions`)">
          <el-icon><Clock /></el-icon>
          版本历史
        </el-button>
        <el-button @click="toggleComments">
          <el-icon><ChatDotRound /></el-icon>
          评论 ({{ commentsCount }})
        </el-button>
        <el-button type="primary" @click="exportDoc">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
      </div>
    </div>

    <div class="view-layout" v-loading="loading">
      <!-- Document Content -->
      <div class="doc-view-main" :class="{ 'with-panel': showComments }">
        <div class="doc-meta">
          <div class="meta-item">
            <el-icon><User /></el-icon>
            <span>{{ document?.owner_username || '-' }}</span>
          </div>
          <div class="meta-item">
            <el-icon><Clock /></el-icon>
            <span>{{ formatTime(document?.updated_at) }}</span>
          </div>
          <div class="meta-item">
            <el-tag :type="statusTagType(document?.status)" size="small">
              {{ statusLabel(document?.status) }}
            </el-tag>
          </div>
          <div class="meta-item" v-if="userRole">
            <el-tag type="info" size="small">我的角色: {{ roleLabel(userRole) }}</el-tag>
          </div>
        </div>

        <div class="doc-view-content" v-html="document?.content" />
      </div>

      <!-- Comments Panel -->
      <div v-if="showComments" class="comments-panel">
        <div class="panel-header">
          <h4>评论区</h4>
          <el-button link @click="showComments = false"><el-icon><Close /></el-icon></el-button>
        </div>
        <div class="comment-input-area">
          <el-input
            v-model="newComment"
            type="textarea"
            :rows="3"
            placeholder="写下您的评论..."
          />
          <el-button type="primary" size="small" style="margin-top: 8px" @click="submitComment">
            提交
          </el-button>
        </div>
        <div class="comments-list">
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <el-avatar :size="32">{{ comment.author_username?.charAt(0) }}</el-avatar>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-author">{{ comment.author_username }}</span>
                <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
              </div>
              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
          <el-empty v-if="comments.length === 0" description="暂无评论" :image-size="60" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { documentApi } from '@/api/document'
import { commentApi } from '@/api/comment'

const router = useRouter()
const route = useRoute()
const docId = Number(route.params.id)

const loading = ref(false)
const document = ref<any>(null)
const comments = ref<any[]>([])
const showComments = ref(false)
const newComment = ref('')
const userRole = ref('')

const commentsCount = computed(() => comments.value.length)

function statusTagType(status: string) {
  const map: Record<string, string> = { draft: 'info', published: 'success', archived: 'warning' }
  return map[status] || 'info'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' }
  return map[status] || status
}

function roleLabel(role: string) {
  const map: Record<string, string> = { creator: '创建者', editor: '编辑者', commenter: '评论者', viewer: '查看者' }
  return map[role] || role
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function loadDocument() {
  loading.value = true
  try {
    const res = await documentApi.getDocument(docId) as any
    document.value = res.data
    userRole.value = res.data?.my_role || ''
  } catch (e) {
    ElMessage.error('加载文档失败')
    router.push('/documents')
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  try {
    const res = await commentApi.getComments(docId) as any
    comments.value = res.data || []
  } catch (e) {}
}

function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value) loadComments()
}

async function submitComment() {
  if (!newComment.value.trim()) return
  try {
    await commentApi.createComment(docId, { content: newComment.value })
    newComment.value = ''
    loadComments()
    ElMessage.success('评论已提交')
  } catch (e) {
    ElMessage.error('评论失败')
  }
}

async function exportDoc() {
  try {
    const blob = await documentApi.exportDocument(docId, 'html') as any
    const url = URL.createObjectURL(blob)
    const a = global.document.createElement('a')
    a.href = url
    a.download = `${document.value?.title}.html`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  loadDocument()
})
</script>

<style scoped>
.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-layout {
  display: flex;
  gap: 20px;
  height: calc(100vh - 140px);
}

.doc-view-main {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 40px 60px;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: flex 0.3s;
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
}

.doc-view-content {
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
}

:deep(.doc-view-content h1) { font-size: 28px; font-weight: 700; margin: 20px 0 12px; }
:deep(.doc-view-content h2) { font-size: 22px; font-weight: 600; margin: 18px 0 10px; }
:deep(.doc-view-content h3) { font-size: 18px; font-weight: 600; margin: 14px 0 8px; }
:deep(.doc-view-content p) { margin: 0 0 10px; }
:deep(.doc-view-content ul), :deep(.doc-view-content ol) { padding-left: 24px; margin: 0 0 10px; }
:deep(.doc-view-content blockquote) { border-left: 4px solid #409eff; padding-left: 16px; margin: 0 0 10px; color: #606266; font-style: italic; }
:deep(.doc-view-content pre) { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; margin: 0 0 10px; font-family: monospace; overflow-x: auto; }
:deep(.doc-view-content code) { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 13px; }
:deep(.doc-view-content table) { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
:deep(.doc-view-content th), :deep(.doc-view-content td) { border: 1px solid #dcdfe6; padding: 8px 12px; }
:deep(.doc-view-content th) { background: #f5f7fa; font-weight: 600; }
:deep(.doc-view-content img) { max-width: 100%; border-radius: 4px; }
:deep(.doc-view-content a) { color: #409eff; text-decoration: underline; }

.comments-panel {
  width: 320px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h4 { margin: 0; font-size: 15px; }

.comment-input-area {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.comments-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.comment-body { flex: 1; }
.comment-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
.comment-author { font-size: 12px; font-weight: 600; color: #303133; }
.comment-time { font-size: 11px; color: #c0c4cc; }
.comment-text { font-size: 13px; color: #606266; line-height: 1.5; }
</style>
