<template>
  <div class="share-page">
    <div class="share-header">
      <div class="share-logo">
        <el-icon class="logo-icon"><DocumentCopy /></el-icon>
        <span>文档协作系统</span>
      </div>
    </div>

    <div v-loading="loading" class="share-container">
      <template v-if="document">
        <div class="share-doc-meta">
          <h1 class="share-title">{{ document.title }}</h1>
          <div class="share-info">
            <span>
              <el-icon><User /></el-icon>
              {{ document.owner_username || '-' }}
            </span>
            <span>
              <el-icon><Clock /></el-icon>
              最后更新：{{ formatTime(document.updated_at) }}
            </span>
            <el-tag :type="statusTagType(document.status)" size="small">
              {{ statusLabel(document.status) }}
            </el-tag>
          </div>
        </div>

        <div class="share-content" v-html="document.content" />
      </template>

      <div v-else-if="error" class="share-error">
        <el-result icon="warning" title="链接无效或已过期" sub-title="该分享链接可能已失效或未找到对应文档">
          <template #extra>
            <el-button type="primary" @click="router.push('/login')">登录系统</el-button>
          </template>
        </el-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentApi } from '@/api/document'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string

const loading = ref(true)
const document = ref<any>(null)
const error = ref(false)

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
  return new Date(time).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  try {
    const res = await documentApi.getSharedDocument(token) as any
    document.value = res.data
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.share-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
}

.share-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.logo-icon {
  font-size: 22px;
  color: #409eff;
}

.share-container {
  max-width: 900px;
  margin: 40px auto;
  background: #fff;
  border-radius: 12px;
  padding: 48px 60px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.08);
}

.share-title {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 16px;
}

.share-info {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  color: #909399;
  flex-wrap: wrap;
}

.share-info span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.share-content {
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
}

:deep(.share-content h1) { font-size: 28px; font-weight: 700; margin: 20px 0 12px; }
:deep(.share-content h2) { font-size: 22px; font-weight: 600; margin: 18px 0 10px; }
:deep(.share-content h3) { font-size: 18px; font-weight: 600; margin: 14px 0 8px; }
:deep(.share-content p) { margin: 0 0 10px; }
:deep(.share-content ul), :deep(.share-content ol) { padding-left: 24px; margin: 0 0 10px; }
:deep(.share-content blockquote) { border-left: 4px solid #409eff; padding-left: 16px; margin: 0 0 10px; color: #606266; font-style: italic; }
:deep(.share-content pre) { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; margin: 0 0 10px; font-family: monospace; overflow-x: auto; }
:deep(.share-content code) { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 13px; }
:deep(.share-content img) { max-width: 100%; border-radius: 4px; }
:deep(.share-content table) { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
:deep(.share-content th), :deep(.share-content td) { border: 1px solid #dcdfe6; padding: 8px 12px; }
:deep(.share-content th) { background: #f5f7fa; font-weight: 600; }

.share-error {
  text-align: center;
  padding: 40px;
}
</style>
