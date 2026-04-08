<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">部门管理</h2>
      <el-button type="primary" @click="openCreateDept(null)">
        <el-icon><Plus /></el-icon>
        新建部门
      </el-button>
    </div>

    <el-row :gutter="20">
      <!-- Department Tree -->
      <el-col :span="10">
        <el-card shadow="never" class="dept-card">
          <template #header>部门架构</template>
          <div v-loading="loading">
            <el-tree
              v-if="deptTree.length > 0"
              :data="deptTree"
              :props="{ label: 'name', children: 'children' }"
              node-key="id"
              default-expand-all
              @node-click="handleDeptClick"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <span class="tree-label">{{ data.name }}</span>
                  <span class="tree-count">{{ data.member_count || 0 }} 人</span>
                  <div class="tree-actions" @click.stop>
                    <el-button link size="small" @click="openCreateDept(data.id)">
                      <el-icon><Plus /></el-icon>
                    </el-button>
                    <el-button link size="small" @click="openEditDept(data)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button link size="small" type="danger" @click="deleteDept(data)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </template>
            </el-tree>
            <el-empty v-else description="暂无部门，点击新建" :image-size="80" />
          </div>
        </el-card>
      </el-col>

      <!-- Department Members -->
      <el-col :span="14">
        <el-card shadow="never" class="dept-card">
          <template #header>
            {{ selectedDept ? `${selectedDept.name} 的成员` : '选择部门查看成员' }}
          </template>
          <div v-if="selectedDept" v-loading="membersLoading">
            <el-table :data="deptMembers" size="small">
              <el-table-column label="成员" min-width="160">
                <template #default="{ row }">
                  <div class="member-cell">
                    <el-avatar :size="28">{{ row.username?.charAt(0) }}</el-avatar>
                    <div>
                      <div class="member-name">{{ row.username }}</div>
                      <div class="member-email">{{ row.email }}</div>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="角色" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.org_role === 'org_admin' ? 'warning' : 'info'" size="small">
                    {{ row.org_role === 'org_admin' ? '管理员' : '成员' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="deptMembers.length === 0 && !membersLoading" description="该部门暂无成员" :image-size="60" />
          </div>
          <el-empty v-else description="请从左侧选择部门" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDeptDialog" :title="editingDept ? '编辑部门' : '新建部门'" width="440px">
      <el-form ref="deptFormRef" :model="deptForm" :rules="deptRules" label-width="80px">
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="deptForm.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="deptForm.parent_id" placeholder="无上级部门（顶级）" clearable style="width: 100%">
            <el-option v-for="dept in flatDepts" :key="dept.id" :label="dept.name" :value="dept.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deptForm.description" type="textarea" :rows="3" placeholder="部门描述（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeptDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDept">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { orgApi } from '@/api/org'

const loading = ref(false)
const membersLoading = ref(false)
const saving = ref(false)
const departments = ref<any[]>([])
const deptMembers = ref<any[]>([])
const selectedDept = ref<any>(null)
const showDeptDialog = ref(false)
const editingDept = ref<any>(null)
const deptFormRef = ref<FormInstance>()

const deptForm = reactive({ name: '', parent_id: null as number | null, description: '' })
const deptRules = { name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }] }

const deptTree = computed(() => buildTree(departments.value))
const flatDepts = computed(() => departments.value)

function buildTree(depts: any[], parentId: number | null = null): any[] {
  return depts
    .filter(d => d.parent_id === parentId)
    .map(d => ({
      ...d,
      children: buildTree(depts, d.id)
    }))
}

async function loadDepts() {
  loading.value = true
  try {
    const res = await orgApi.getDepartments() as any
    departments.value = res.data || []
  } catch (e) {} finally {
    loading.value = false
  }
}

async function handleDeptClick(data: any) {
  selectedDept.value = data
  membersLoading.value = true
  try {
    const res = await orgApi.getMembers({ dept_id: data.id, limit: 100 }) as any
    deptMembers.value = res.data?.list || []
  } catch (e) {} finally {
    membersLoading.value = false
  }
}

function openCreateDept(parentId: number | null) {
  editingDept.value = null
  Object.assign(deptForm, { name: '', parent_id: parentId, description: '' })
  showDeptDialog.value = true
}

function openEditDept(dept: any) {
  editingDept.value = dept
  Object.assign(deptForm, { name: dept.name, parent_id: dept.parent_id, description: dept.description || '' })
  showDeptDialog.value = true
}

async function saveDept() {
  const valid = await deptFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editingDept.value) {
      await orgApi.updateDepartment(editingDept.value.id, deptForm)
      ElMessage.success('部门已更新')
    } else {
      await orgApi.createDepartment(deptForm)
      ElMessage.success('部门已创建')
    }
    showDeptDialog.value = false
    loadDepts()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteDept(dept: any) {
  try {
    await ElMessageBox.confirm(`确定要删除部门 "${dept.name}" 吗？部门内的成员将移至无部门状态。`, '提示', { type: 'warning' })
    await orgApi.deleteDepartment(dept.id)
    ElMessage.success('部门已删除')
    if (selectedDept.value?.id === dept.id) selectedDept.value = null
    loadDepts()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

onMounted(() => loadDepts())
</script>

<style scoped>
.dept-card { border-radius: 12px; }

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 2px 0;
}

.tree-label { flex: 1; font-size: 14px; color: #303133; }
.tree-count { font-size: 12px; color: #909399; }

.tree-actions {
  display: none;
  gap: 4px;
}

.tree-node:hover .tree-actions {
  display: flex;
}

.member-cell { display: flex; align-items: center; gap: 8px; }
.member-name { font-size: 13px; font-weight: 500; color: #303133; }
.member-email { font-size: 12px; color: #909399; }
</style>
