<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="router.push(`/documents/${docId}/versions`)">
          <el-icon><ArrowLeft /></el-icon>
          返回版本历史
        </el-button>
        <el-divider direction="vertical" />
        <h2 class="page-title" style="margin: 0">版本对比</h2>
      </div>
    </div>

    <div v-loading="loading" class="compare-container">
      <template v-if="compareResult">
        <!-- Compare Header -->
        <div class="compare-header-bar">
          <div class="compare-side">
            <div class="compare-version-info">
              <el-tag type="info" size="large">v{{ v1Info?.version_number }}</el-tag>
              <span class="compare-label" v-if="v1Info?.label">{{ v1Info.label }}</span>
              <span class="compare-time">{{ formatTime(v1Info?.created_at) }}</span>
            </div>
          </div>
          <div class="compare-divider">
            <el-icon><Sort /></el-icon>
            <span>对比中</span>
          </div>
          <div class="compare-side">
            <div class="compare-version-info">
              <el-tag type="success" size="large">v{{ v2Info?.version_number }}</el-tag>
              <span class="compare-label" v-if="v2Info?.label">{{ v2Info.label }}</span>
              <span class="compare-time">{{ formatTime(v2Info?.created_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="compare-stats">
          <el-tag type="success">
            <el-icon><Plus /></el-icon>
            新增 {{ compareResult.additions }} 处
          </el-tag>
          <el-tag type="danger">
            <el-icon><Minus /></el-icon>
            删除 {{ compareResult.deletions }} 处
          </el-tag>
          <el-tag type="warning">
            <el-icon><Edit /></el-icon>
            修改 {{ compareResult.changes }} 处
          </el-tag>
        </div>

        <!-- Diff View -->
        <div class="diff-view">
          <div class="diff-side diff-old">
            <div class="diff-side-title">
              <el-icon><Document /></el-icon>
              旧版本 (v{{ v1Info?.version_number }})
            </div>
            <div class="diff-content" v-html="compareResult.old_html" />
          </div>
          <div class="diff-side diff-new">
            <div class="diff-side-title">
              <el-icon><Document /></el-icon>
              新版本 (v{{ v2Info?.version_number }})
            </div>
            <div class="diff-content" v-html="compareResult.new_html" />
          </div>
        </div>
      </template>

      <el-empty v-else-if="!loading" description="无法加载对比结果" :image-size="120">
        <template #extra>
          <el-button @click="loadCompare">重新加载</el-button>
        </template>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { versionApi } from '@/api/version'

const router = useRouter()
const route = useRoute()
const docId = Number(route.params.id)
const v1Id = Number(route.query.v1)
const v2Id = Number(route.query.v2)

const loading = ref(false)
const compareResult = ref<any>(null)
const v1Info = ref<any>(null)
const v2Info = ref<any>(null)

async function loadCompare() {
  if (!v1Id || !v2Id) {
    ElMessage.error('缺少版本参数')
    return
  }
  loading.value = true
  try {
    const [compareRes, v1Res, v2Res] = await Promise.all([
      versionApi.compareVersions(docId, v1Id, v2Id),
      versionApi.getVersion(docId, v1Id),
      versionApi.getVersion(docId, v2Id),
    ]) as any[]
    compareResult.value = compareRes.data
    v1Info.value = v1Res.data
    v2Info.value = v2Res.data
  } catch (e) {
    ElMessage.error('加载对比失败')
  } finally {
    loading.value = false
  }
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(() => {
  loadCompare()
})
</script>

<style scoped>
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.compare-container {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.compare-header-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.compare-side {
  flex: 1;
  display: flex;
  justify-content: center;
}

.compare-version-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.compare-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.compare-time {
  font-size: 12px;
  color: #c0c4cc;
}

.compare-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 12px;
}

.compare-divider .el-icon {
  font-size: 20px;
}

.compare-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.diff-view {
  display: flex;
  gap: 16px;
  min-height: 400px;
}

.diff-side {
  flex: 1;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.diff-side-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
}

.diff-old .diff-side-title {
  background: #ffeef0;
  color: #cb2431;
}

.diff-new .diff-side-title {
  background: #e6ffed;
  color: #22863a;
}

.diff-content {
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  overflow-y: auto;
  max-height: calc(100vh - 320px);
}

:deep(.diff-content h1) { font-size: 24px; font-weight: 700; margin: 16px 0 10px; }
:deep(.diff-content h2) { font-size: 20px; font-weight: 600; margin: 14px 0 8px; }
:deep(.diff-content h3) { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
:deep(.diff-content p) { margin: 0 0 8px; }

:deep(.diff-added) {
  background-color: #e6ffed;
  color: #22863a;
  padding: 0 2px;
}

:deep(.diff-removed) {
  background-color: #ffeef0;
  color: #cb2431;
  text-decoration: line-through;
  padding: 0 2px;
}
</style>
