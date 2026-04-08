<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">待处理邀请</h2>
    </div>

    <div v-loading="loading" class="invitations-content">
      <template v-if="invitations.length > 0">
        <div
          v-for="inv in invitations"
          :key="inv.id"
          class="invitation-card"
        >
          <div class="inv-icon">
            <el-icon><Document /></el-icon>
          </div>

          <div class="inv-info">
            <div class="inv-doc-title">{{ inv.document_title }}</div>
            <div class="inv-meta">
              <span class="inv-inviter">
                <el-avatar :size="20">{{ inv.inviter_name?.charAt(0) }}</el-avatar>
                {{ inv.inviter_name }} 邀请您协作
              </span>
              <el-tag :type="roleTagType(inv.role)" size="small">{{ roleLabel(inv.role) }}</el-tag>
              <span class="inv-expiry" v-if="inv.expires_at">
                <el-icon><Clock /></el-icon>
                有效期至 {{ formatDate(inv.expires_at) }}
              </span>
              <el-tag v-if="isExpired(inv.expires_at)" type="danger" size="small">已过期</el-tag>
            </div>
            <div class="inv-time">
              收到于 {{ formatTime(inv.created_at) }}
            </div>
          </div>

          <div class="inv-actions">
            <el-button
              type="success"
              size="small"
              :loading="processingId === inv.id && processingAction === 'accept'"
              :disabled="isExpired(inv.expires_at)"
              @click="handleAccept(inv)"
            >
              <el-icon><Check /></el-icon>
              接受
            </el-button>
            <el-button
              type="danger"
              plain
              size="small"
              :loading="processingId === inv.id && processingAction === 'decline'"
              @click="handleDecline(inv)"
            >
              <el-icon><Close /></el-icon>
              拒绝
            </el-button>
          </div>
        </div>
      </template>

      <div v-else class="empty-state">
        <el-empty
          description="暂无待处理邀请"
          :image-size="120"
        >
          <template #extra>
            <el-button type="primary" @click="router.push('/shared')">
              查看共享文档
            </el-button>
          </template>
        </el-empty>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination-wrapper" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        :total="total"
        :page-size="pageSize"
        layout="prev, pager, next"
        @current-change="loadInvitations"
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
const invitations = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const processingId = ref<number | null>(null)
const processingAction = ref('')

async function loadInvitations() {
  loading.value = true
  try {
    const res = await collaborationApi.getMyInvitations({ status: 'pending' }) as any
    invitations.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error('加载邀请失败')
  } finally {
    loading.value = false
  }
}

async function handleAccept(inv: any) {
  processingId.value = inv.id
  processingAction.value = 'accept'
  try {
    await collaborationApi.acceptInvitation(inv.id)
    ElMessage.success('已接受邀请，现在可以访问该文档')
    loadInvitations()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    processingId.value = null
    processingAction.value = ''
  }
}

async function handleDecline(inv: any) {
  processingId.value = inv.id
  processingAction.value = 'decline'
  try {
    await collaborationApi.declineInvitation(inv.id)
    ElMessage.success('已拒绝邀请')
    loadInvitations()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    processingId.value = null
    processingAction.value = ''
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

function formatDate(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isExpired(expiresAt: string) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

onMounted(() => {
  loadInvitations()
})
</script>

<style scoped>
.invitations-content {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  min-height: 300px;
}

.invitation-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  margin-bottom: 12px;
  transition: all 0.2s;
}

.invitation-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64,158,255,0.1);
}

.inv-icon {
  width: 48px;
  height: 48px;
  background: #ecf5ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #409eff;
  flex-shrink: 0;
}

.inv-info {
  flex: 1;
  min-width: 0;
}

.inv-doc-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.inv-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.inv-inviter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #606266;
}

.inv-expiry {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}

.inv-time {
  font-size: 12px;
  color: #c0c4cc;
}

.inv-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.empty-state {
  padding: 40px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
