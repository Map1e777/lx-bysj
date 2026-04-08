<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">个人中心</h2>
    </div>

    <el-row :gutter="24">
      <!-- Profile Card -->
      <el-col :span="8">
        <el-card class="profile-card" shadow="never">
          <div class="avatar-section">
            <div class="avatar-wrapper">
              <el-avatar
                :size="100"
                :src="authStore.user?.avatar_url || undefined"
                class="profile-avatar"
              >
                {{ authStore.user?.username?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <el-upload
                class="avatar-upload"
                :show-file-list="false"
                :before-upload="beforeAvatarUpload"
                :http-request="handleAvatarUpload"
                accept="image/*"
              >
                <div class="avatar-upload-btn">
                  <el-icon><Camera /></el-icon>
                </div>
              </el-upload>
            </div>
            <h3 class="profile-username">{{ authStore.user?.username }}</h3>
            <p class="profile-email">{{ authStore.user?.email }}</p>
            <div class="role-badges">
              <el-tag :type="systemRoleType" size="default">{{ systemRoleLabel }}</el-tag>
              <el-tag v-if="authStore.user?.org_role" type="warning" size="default">
                {{ orgRoleLabel }}
              </el-tag>
            </div>
          </div>

          <!-- Org Info -->
          <div v-if="authStore.user?.org_id" class="org-info-section">
            <el-divider />
            <div class="info-item">
              <span class="info-label">所属组织</span>
              <span class="info-value">{{ orgName || '加载中...' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">组织角色</span>
              <span class="info-value">{{ orgRoleLabel }}</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- Edit Profile & Change Password -->
      <el-col :span="16">
        <!-- Edit Profile -->
        <el-card shadow="never" class="edit-card">
          <template #header>
            <span class="card-header-title">基本信息</span>
          </template>

          <el-form
            ref="profileFormRef"
            :model="profileForm"
            :rules="profileRules"
            label-width="80px"
            size="large"
          >
            <el-form-item label="用户名" prop="username">
              <el-input v-model="profileForm.username" placeholder="请输入用户名" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input :value="authStore.user?.email" disabled>
                <template #suffix>
                  <el-tag size="small" type="success">已验证</el-tag>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="profileSaving" @click="saveProfile">
                保存修改
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Change Password -->
        <el-card shadow="never" class="edit-card" style="margin-top: 16px">
          <template #header>
            <span class="card-header-title">修改密码</span>
          </template>

          <el-form
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            label-width="100px"
            size="large"
          >
            <el-form-item label="当前密码" prop="oldPassword">
              <el-input
                v-model="pwdForm.oldPassword"
                type="password"
                placeholder="请输入当前密码"
                show-password
              />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="pwdForm.newPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                show-password
              />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirmPassword">
              <el-input
                v-model="pwdForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="pwdSaving" @click="changePassword">
                修改密码
              </el-button>
              <el-button @click="resetPwdForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useAuthStore } from '@/stores/useAuthStore'
import { authApi } from '@/api/auth'
import { userApi } from '@/api/user'

const authStore = useAuthStore()

const profileFormRef = ref<FormInstance>()
const pwdFormRef = ref<FormInstance>()
const profileSaving = ref(false)
const pwdSaving = ref(false)
const orgName = ref('')

const profileForm = reactive({
  username: authStore.user?.username || ''
})

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const systemRoleType = computed(() => {
  if (authStore.user?.system_role === 'system_admin') return 'danger'
  return 'info'
})

const systemRoleLabel = computed(() => {
  if (authStore.user?.system_role === 'system_admin') return '系统管理员'
  return '普通用户'
})

const orgRoleLabel = computed(() => {
  if (authStore.user?.org_role === 'org_admin') return '组织管理员'
  return '组织成员'
})

const profileRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度在 2 到 20 个字符', trigger: 'blur' }
  ]
}

const validateNewPassword = (_rule: any, value: string, callback: Function) => {
  if (value !== pwdForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const pwdRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateNewPassword, trigger: 'blur' }
  ]
}

async function saveProfile() {
  const valid = await profileFormRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    profileSaving.value = true
    await authApi.updateProfile({ username: profileForm.username })
    authStore.updateUser({ username: profileForm.username })
    ElMessage.success('个人信息已更新')
  } catch (e) {
    ElMessage.error('更新失败')
  } finally {
    profileSaving.value = false
  }
}

async function changePassword() {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    pwdSaving.value = true
    await authApi.changePassword({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    })
    ElMessage.success('密码已修改，请重新登录')
    resetPwdForm()
  } catch (e) {
    // error handled by interceptor
  } finally {
    pwdSaving.value = false
  }
}

function resetPwdForm() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdFormRef.value?.clearValidate()
}

function beforeAvatarUpload(file: File) {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isImage) {
    ElMessage.error('只能上传图片文件')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB')
    return false
  }
  return true
}

async function handleAvatarUpload(options: any) {
  // Convert to base64 data URL for avatar preview and storage
  const reader = new FileReader()
  reader.onload = async (e) => {
    const avatarUrl = e.target?.result as string
    try {
      await userApi.updateProfile({ avatar_url: avatarUrl })
      authStore.updateUser({ avatar_url: avatarUrl })
      ElMessage.success('头像已更新')
    } catch (err) {
      ElMessage.error('头像更新失败')
    }
  }
  reader.readAsDataURL(options.file)
}

onMounted(() => {
  profileForm.username = authStore.user?.username || ''
})
</script>

<style scoped>
.profile-card {
  border-radius: 12px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.profile-avatar {
  background-color: #409eff;
  font-size: 40px;
  font-weight: 600;
  color: #fff;
}

.avatar-upload {
  position: absolute;
  bottom: 0;
  right: 0;
}

.avatar-upload-btn {
  width: 32px;
  height: 32px;
  background: #409eff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  border: 2px solid #fff;
  font-size: 14px;
  transition: background 0.2s;
}

.avatar-upload-btn:hover {
  background: #66b1ff;
}

.profile-username {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px;
}

.profile-email {
  font-size: 14px;
  color: #909399;
  margin: 0 0 12px;
}

.role-badges {
  display: flex;
  gap: 8px;
}

.org-info-section {
  padding: 0 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.info-label {
  font-size: 13px;
  color: #909399;
}

.info-value {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.edit-card {
  border-radius: 12px;
}

.card-header-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
</style>
