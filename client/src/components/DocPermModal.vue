<template>
  <el-dialog
    v-model="visible"
    title="协作者管理"
    width="560px"
    @close="emit('close')"
  >
    <!-- Invite Section -->
    <div class="invite-section">
      <h4 class="section-title">邀请协作者</h4>
      <div class="invite-form">
        <el-input
          v-model="inviteEmail"
          placeholder="输入邮箱地址"
          class="invite-email-input"
          clearable
        />
        <el-select v-model="inviteRole" placeholder="角色" style="width: 120px">
          <el-option label="查看者" value="viewer" />
          <el-option label="评论者" value="commenter" />
          <el-option label="编辑者" value="editor" />
        </el-select>
        <el-button type="primary" :loading="inviting" @click="handleInvite">邀请</el-button>
      </div>
    </div>

    <!-- Collaborators List -->
    <div class="collabs-section">
      <h4 class="section-title">当前协作者</h4>
      <div v-loading="loading">
        <template v-if="collaborators.length > 0">
          <div
            v-for="collab in collaborators"
            :key="collab.id"
            class="collab-item"
          >
            <div class="collab-info">
              <el-avatar :size="36" :src="collab.avatar_url || undefined">
                {{ collab.username?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <div class="collab-detail">
                <div class="collab-name">{{ collab.username }}</div>
                <div class="collab-email">{{ collab.email }}</div>
              </div>
            </div>
            <div class="collab-actions">
              <el-tag v-if="collab.is_owner" type="warning" size="small">所有者</el-tag>
              <template v-else>
                <el-select
                  v-model="collab.role"
                  size="small"
                  style="width: 100px"
                  @change="handleRoleChange(collab)"
                >
                  <el-option label="查看者" value="viewer" />
                  <el-option label="评论者" value="commenter" />
                  <el-option label="编辑者" value="editor" />
                </el-select>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="handleRemove(collab)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无协作者" :image-size="60" />
      </div>
    </div>

    <!-- Share Link Section -->
    <div class="share-link-section">
      <h4 class="section-title">分享链接</h4>
      <div class="share-link-form">
        <el-select v-model="shareLinkExpiry" placeholder="链接有效期" style="width: 150px">
          <el-option label="1天" :value="1" />
          <el-option label="7天" :value="7" />
          <el-option label="30天" :value="30" />
          <el-option label="永久" :value="0" />
        </el-select>
        <el-select v-model="shareLinkPerm" placeholder="权限" style="width: 120px">
          <el-option label="只读" value="view" />
          <el-option label="可评论" value="comment" />
        </el-select>
        <el-button type="primary" :loading="generatingLink" @click="handleGenerateLink">
          生成链接
        </el-button>
      </div>
      <div v-if="shareLink" class="share-link-display">
        <el-input v-model="shareLink" readonly>
          <template #append>
            <el-button @click="copyLink">复制</el-button>
          </template>
        </el-input>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { collaborationApi } from '@/api/collaboration'
import { documentApi } from '@/api/document'

interface Collaborator {
  id: number
  user_id: number
  username: string
  email: string
  role: string
  avatar_url: string | null
  is_owner?: boolean
}

const props = defineProps<{
  modelValue: boolean
  docId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const visible = ref(props.modelValue)
const collaborators = ref<Collaborator[]>([])
const loading = ref(false)
const inviteEmail = ref('')
const inviteRole = ref('viewer')
const inviting = ref(false)
const shareLink = ref('')
const shareLinkExpiry = ref(7)
const shareLinkPerm = ref('view')
const generatingLink = ref(false)

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) loadCollaborators()
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

async function loadCollaborators() {
  try {
    loading.value = true
    const res = await collaborationApi.getCollaborators(props.docId) as any
    collaborators.value = res.data || []
  } catch (e) {
    ElMessage.error('加载协作者失败')
  } finally {
    loading.value = false
  }
}

async function handleInvite() {
  if (!inviteEmail.value.trim()) {
    ElMessage.warning('请输入邮箱地址')
    return
  }
  try {
    inviting.value = true
    await collaborationApi.inviteCollaborator(props.docId, {
      email: inviteEmail.value,
      role: inviteRole.value
    })
    ElMessage.success('邀请已发送')
    inviteEmail.value = ''
    loadCollaborators()
  } catch (e) {
    ElMessage.error('邀请失败')
  } finally {
    inviting.value = false
  }
}

async function handleRoleChange(collab: Collaborator) {
  try {
    await collaborationApi.updateCollaboratorRole(props.docId, collab.user_id, { role: collab.role })
    ElMessage.success('角色已更新')
  } catch (e) {
    ElMessage.error('更新失败')
    loadCollaborators()
  }
}

async function handleRemove(collab: Collaborator) {
  try {
    await ElMessageBox.confirm(`确定要移除协作者 ${collab.username} 吗？`, '提示', {
      type: 'warning'
    })
    await collaborationApi.removeCollaborator(props.docId, collab.user_id)
    ElMessage.success('已移除协作者')
    loadCollaborators()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('移除失败')
  }
}

async function handleGenerateLink() {
  try {
    generatingLink.value = true
    const res = await documentApi.createShareLink(props.docId, {
      expires_in_days: shareLinkExpiry.value || undefined
    }) as any
    const token = res.data.share_token
    shareLink.value = `${window.location.origin}/share/${token}`
    ElMessage.success('分享链接已生成')
  } catch (e) {
    ElMessage.error('生成链接失败')
  } finally {
    generatingLink.value = false
  }
}

function copyLink() {
  navigator.clipboard.writeText(shareLink.value).then(() => {
    ElMessage.success('链接已复制')
  })
}
</script>

<style scoped>
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
}

.invite-section,
.collabs-section,
.share-link-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
}

.share-link-section {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.invite-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.invite-email-input {
  flex: 1;
}

.collab-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f7fa;
}

.collab-item:last-child {
  border-bottom: none;
}

.collab-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.collab-detail {
  display: flex;
  flex-direction: column;
}

.collab-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.collab-email {
  font-size: 12px;
  color: #909399;
}

.collab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-link-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.share-link-display {
  margin-top: 12px;
}
</style>
