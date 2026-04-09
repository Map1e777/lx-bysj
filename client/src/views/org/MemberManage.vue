<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">成员管理</h2>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        添加成员
      </el-button>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <el-input v-model="search" placeholder="搜索成员..." prefix-icon="Search" clearable class="search-input" @input="handleSearch" />
      <el-select v-model="deptFilter" placeholder="部门筛选" clearable style="width: 160px" @change="loadMembers">
        <el-option v-for="dept in departments" :key="dept.id" :label="dept.name" :value="dept.id" />
      </el-select>
      <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width: 140px" @change="loadMembers">
        <el-option label="组织管理员" value="org_admin" />
        <el-option label="普通成员" value="member" />
      </el-select>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="members" v-loading="loading">
        <el-table-column label="成员" min-width="200">
          <template #default="{ row }">
            <div class="member-cell">
              <el-avatar :size="36" :src="row.avatar_url || undefined">
                {{ row.username?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <div>
                <div class="member-name">{{ row.username }}</div>
                <div class="member-email">{{ row.email }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="部门" width="140">
          <template #default="{ row }">
            <span>{{ row.dept_name || '未分配' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="140">
          <template #default="{ row }">
            <el-select
              :model-value="row.org_role"
              size="small"
              style="width: 120px"
              @change="(val: string) => updateRole(row, val)"
            >
              <el-option label="组织管理员" value="org_admin" />
              <el-option label="普通成员" value="member" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="加入时间" width="140">
          <template #default="{ row }">
            <span class="time-text">{{ formatDate(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openMoveDept(row)">
              调整部门
            </el-button>
            <el-button link type="danger" size="small" @click="removeMember(row)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :total="total"
          :page-size="pageSize"
          layout="total, prev, pager, next"
          @current-change="loadMembers"
        />
      </div>
    </el-card>

    <!-- Add Member Dialog -->
    <el-dialog v-model="showAddDialog" title="添加成员" width="460px">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="80px">
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="addForm.email" placeholder="输入成员邮箱" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="addForm.role" style="width: 100%">
            <el-option label="普通成员" value="member" />
            <el-option label="组织管理员" value="org_admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="addForm.dept_id" placeholder="选择部门（可选）" clearable style="width: 100%">
            <el-option v-for="dept in departments" :key="dept.id" :label="dept.name" :value="dept.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAddMember">添加</el-button>
      </template>
    </el-dialog>

    <!-- Move Dept Dialog -->
    <el-dialog v-model="showMoveDeptDialog" title="调整部门" width="400px">
      <el-form label-width="80px">
        <el-form-item label="目标部门">
          <el-select v-model="moveDeptId" placeholder="选择部门" clearable style="width: 100%">
            <el-option label="无部门" :value="null" />
            <el-option v-for="dept in departments" :key="dept.id" :label="dept.name" :value="dept.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMoveDeptDialog = false">取消</el-button>
        <el-button type="primary" :loading="moving" @click="confirmMoveDept">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { orgApi } from '@/api/org'

const loading = ref(false)
const members = ref<any[]>([])
const departments = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const search = ref('')
const deptFilter = ref<number | null>(null)
const roleFilter = ref('')
const showAddDialog = ref(false)
const adding = ref(false)
const addFormRef = ref<FormInstance>()
const showMoveDeptDialog = ref(false)
const moving = ref(false)
const movingMember = ref<any>(null)
const moveDeptId = ref<number | null>(null)

const addForm = reactive({ email: '', role: 'member', dept_id: null as number | null })
const addRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效邮箱', trigger: 'blur' }
  ]
}

let searchTimer: any = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadMembers, 300)
}

async function loadMembers() {
  loading.value = true
  try {
    const res = await orgApi.getMembers({
      page: currentPage.value,
      limit: pageSize.value,
      search: search.value || undefined,
      dept_id: deptFilter.value || undefined,
      org_role: roleFilter.value || undefined,
    }) as any
    members.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {} finally {
    loading.value = false
  }
}

async function loadDepartments() {
  try {
    const res = await orgApi.getDepartments() as any
    departments.value = res.data || []
  } catch (e) {}
}

async function updateRole(member: any, role: string) {
  try {
    await orgApi.updateMember(member.id, { role })
    member.org_role = role
    ElMessage.success('角色已更新')
  } catch (e) {
    ElMessage.error('更新失败')
    loadMembers()
  }
}

async function removeMember(member: any) {
  try {
    await ElMessageBox.confirm(`确定要移除成员 ${member.username} 吗？`, '提示', { type: 'warning' })
    await orgApi.removeMember(member.id)
    ElMessage.success('成员已移除')
    loadMembers()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('操作失败')
  }
}

async function handleAddMember() {
  const valid = await addFormRef.value?.validate().catch(() => false)
  if (!valid) return
  adding.value = true
  try {
    await orgApi.addMember(addForm)
    ElMessage.success('成员已添加')
    showAddDialog.value = false
    Object.assign(addForm, { email: '', role: 'member', dept_id: null })
    loadMembers()
  } catch (e) {
    ElMessage.error('添加失败')
  } finally {
    adding.value = false
  }
}

function openMoveDept(member: any) {
  movingMember.value = member
  moveDeptId.value = member.department?.id || null
  showMoveDeptDialog.value = true
}

async function confirmMoveDept() {
  if (!movingMember.value) return
  moving.value = true
  try {
    await orgApi.updateMember(movingMember.value.id, { dept_id: moveDeptId.value })
    ElMessage.success('部门已更新')
    showMoveDeptDialog.value = false
    loadMembers()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    moving.value = false
  }
}

function formatDate(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadMembers()
  loadDepartments()
})
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { width: 260px; }
.table-card { border-radius: 12px; }
.member-cell { display: flex; align-items: center; gap: 10px; }
.member-name { font-size: 14px; font-weight: 500; color: #303133; }
.member-email { font-size: 12px; color: #909399; }
.time-text { font-size: 13px; color: #909399; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
