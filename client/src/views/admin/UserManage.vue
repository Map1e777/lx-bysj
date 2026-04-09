<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" @click="openCreateUser">
        <el-icon><Plus /></el-icon>
        新建用户
      </el-button>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <el-input v-model="search" placeholder="搜索用户名/邮箱..." prefix-icon="Search" clearable class="search-input" @input="handleSearch" />
      <el-select v-model="roleFilter" placeholder="系统角色" clearable style="width: 150px" @change="loadUsers">
        <el-option label="系统管理员" value="system_admin" />
        <el-option label="普通用户" value="user" />
      </el-select>
      <el-select v-model="orgFilter" placeholder="所属组织" clearable style="width: 150px" @change="loadUsers">
        <el-option v-for="org in orgs" :key="org.id" :label="org.name" :value="org.id" />
      </el-select>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="users" v-loading="loading">
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="36" :src="row.avatar_url || undefined">
                {{ row.username?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <div>
                <div class="user-name">{{ row.username }}</div>
                <div class="user-email">{{ row.email }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="系统角色" width="130">
          <template #default="{ row }">
            <el-tag :type="row.system_role === 'system_admin' ? 'danger' : 'info'" size="small">
              {{ row.system_role === 'system_admin' ? '系统管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属组织" width="150">
          <template #default="{ row }">
            <span>{{ row.org_name || '无' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.is_active !== false ? 'success' : 'danger'" size="small">
              {{ row.is_active !== false ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="140">
          <template #default="{ row }">
            <span class="time-text">{{ formatDate(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditUser(row)">编辑</el-button>
            <el-button
              link
              :type="row.is_active !== false ? 'warning' : 'success'"
              size="small"
              @click="toggleActive(row)"
            >
              {{ row.is_active !== false ? '禁用' : '启用' }}
            </el-button>
            <el-button link type="danger" size="small" @click="deleteUser(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :total="total"
          :page-size="pageSize"
          layout="total, prev, pager, next"
          @current-change="loadUsers"
        />
      </div>
    </el-card>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showUserDialog" :title="editingUser ? '编辑用户' : '新建用户'" width="500px">
      <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email" v-if="!editingUser">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!editingUser">
          <el-input v-model="userForm.password" type="password" placeholder="请输入初始密码" show-password />
        </el-form-item>
        <el-form-item label="系统角色">
          <el-select v-model="userForm.system_role" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="系统管理员" value="system_admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属组织">
          <el-select v-model="userForm.org_id" placeholder="无（独立用户）" clearable style="width: 100%">
            <el-option v-for="org in orgs" :key="org.id" :label="org.name" :value="org.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { adminApi } from '@/api/admin'

const loading = ref(false)
const saving = ref(false)
const users = ref<any[]>([])
const orgs = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const search = ref('')
const roleFilter = ref('')
const orgFilter = ref<number | null>(null)
const showUserDialog = ref(false)
const editingUser = ref<any>(null)
const userFormRef = ref<FormInstance>()

const userForm = reactive({
  username: '',
  email: '',
  password: '',
  system_role: 'user',
  org_id: null as number | null,
})

const userRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码不少于6位', trigger: 'blur' }
  ]
}

let searchTimer: any = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadUsers, 300)
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await adminApi.getUsers({
      page: currentPage.value,
      limit: pageSize.value,
      search: search.value || undefined,
      system_role: roleFilter.value || undefined,
      org_id: orgFilter.value || undefined,
    }) as any
    users.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {} finally {
    loading.value = false
  }
}

async function loadOrgs() {
  try {
    const res = await adminApi.getOrgs({ limit: 1000 }) as any
    orgs.value = res.data?.list || []
  } catch (e) {}
}

function openCreateUser() {
  editingUser.value = null
  Object.assign(userForm, { username: '', email: '', password: '', system_role: 'user', org_id: null })
  showUserDialog.value = true
}

function openEditUser(user: any) {
  editingUser.value = user
  Object.assign(userForm, {
    username: user.username,
    email: user.email,
    password: '',
    system_role: user.system_role,
    org_id: user.org_id,
  })
  showUserDialog.value = true
}

async function saveUser() {
  const valid = await userFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editingUser.value) {
      await adminApi.updateUser(editingUser.value.id, {
        username: userForm.username,
        system_role: userForm.system_role,
        org_id: userForm.org_id || undefined,
      })
      ElMessage.success('用户已更新')
    } else {
      await adminApi.createUser(userForm)
      ElMessage.success('用户已创建')
    }
    showUserDialog.value = false
    loadUsers()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    saving.value = false
  }
}

async function toggleActive(user: any) {
  try {
    const newStatus = user.is_active === false ? true : false
    await adminApi.updateUser(user.id, { is_active: newStatus })
    user.is_active = newStatus
    ElMessage.success(newStatus ? '用户已启用' : '用户已禁用')
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

async function deleteUser(user: any) {
  try {
    await ElMessageBox.confirm(`确定要删除用户 ${user.username} 吗？此操作不可撤销。`, '确认删除', {
      type: 'error', confirmButtonText: '删除'
    })
    await adminApi.deleteUser(user.id)
    ElMessage.success('用户已删除')
    loadUsers()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

function formatDate(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadUsers()
  loadOrgs()
})
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { width: 280px; }
.table-card { border-radius: 12px; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-name { font-size: 14px; font-weight: 500; color: #303133; }
.user-email { font-size: 12px; color: #909399; }
.time-text { font-size: 13px; color: #909399; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
