<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">组织管理</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建组织
      </el-button>
    </div>

    <div class="filter-bar">
      <el-input v-model="search" placeholder="搜索组织名称..." prefix-icon="Search" clearable class="search-input" @input="handleSearch" />
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="orgs" v-loading="loading">
        <el-table-column label="组织名称" min-width="200">
          <template #default="{ row }">
            <div class="org-cell">
              <div class="org-icon">
                <el-icon><OfficeBuilding /></el-icon>
              </div>
              <div>
                <div class="org-name">{{ row.name }}</div>
                <div class="org-desc" v-if="row.description">{{ row.description }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="150">
          <template #default="{ row }">
            <div class="owner-cell">
              <el-avatar :size="24">{{ row.owner_username?.charAt(0) }}</el-avatar>
              <span>{{ row.owner_username || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="成员数" width="90">
          <template #default="{ row }">
            <span>{{ row.member_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="文档数" width="90">
          <template #default="{ row }">
            <span>{{ row.doc_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="130">
          <template #default="{ row }">
            <span class="time-text">{{ formatDate(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewOrg(row)">详情</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="deleteOrg(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination v-model:current-page="currentPage" :total="total" :page-size="pageSize"
          layout="total, prev, pager, next" @current-change="loadOrgs" />
      </div>
    </el-card>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDialog" :title="editingOrg ? '编辑组织' : '新建组织'" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="组织名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入组织名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="组织描述（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveOrg">保存</el-button>
      </template>
    </el-dialog>

    <!-- Org Detail Dialog -->
    <el-dialog v-model="showDetailDialog" title="组织详情" width="600px">
      <div v-if="orgDetail" v-loading="detailLoading">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="组织名称">{{ orgDetail.name }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ orgDetail.owner_username || '-' }}</el-descriptions-item>
          <el-descriptions-item label="成员数">{{ orgDetail.member_count }}</el-descriptions-item>
          <el-descriptions-item label="文档数">{{ orgDetail.doc_count }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(orgDetail.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ orgDetail.description || '无' }}</el-descriptions-item>
        </el-descriptions>
      </div>
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
const detailLoading = ref(false)
const orgs = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const search = ref('')
const showDialog = ref(false)
const showDetailDialog = ref(false)
const editingOrg = ref<any>(null)
const orgDetail = ref<any>(null)
const formRef = ref<FormInstance>()

const form = reactive({ name: '', description: '' })
const rules = { name: [{ required: true, message: '请输入组织名称', trigger: 'blur' }] }

let searchTimer: any = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadOrgs, 300)
}

async function loadOrgs() {
  loading.value = true
  try {
    const res = await adminApi.getOrgs({ page: currentPage.value, limit: pageSize.value, search: search.value || undefined }) as any
    orgs.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {} finally {
    loading.value = false
  }
}

function openCreate() {
  editingOrg.value = null
  Object.assign(form, { name: '', description: '' })
  showDialog.value = true
}

function openEdit(org: any) {
  editingOrg.value = org
  Object.assign(form, { name: org.name, description: org.description || '' })
  showDialog.value = true
}

async function viewOrg(org: any) {
  showDetailDialog.value = true
  detailLoading.value = true
  try {
    const res = await adminApi.getOrgDetail(org.id) as any
    orgDetail.value = res.data
  } catch (e) {} finally {
    detailLoading.value = false
  }
}

async function saveOrg() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editingOrg.value) {
      await adminApi.updateOrg(editingOrg.value.id, form)
      ElMessage.success('组织已更新')
    } else {
      await adminApi.createOrg(form)
      ElMessage.success('组织已创建')
    }
    showDialog.value = false
    loadOrgs()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteOrg(org: any) {
  try {
    await ElMessageBox.confirm(`确定要删除组织 "${org.name}" 吗？此操作将影响组织内所有成员。`, '确认删除', { type: 'error' })
    await adminApi.deleteOrg(org.id)
    ElMessage.success('组织已删除')
    loadOrgs()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

function formatDate(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}

onMounted(() => loadOrgs())
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.search-input { width: 280px; }
.table-card { border-radius: 12px; }
.org-cell { display: flex; align-items: center; gap: 12px; }
.org-icon { width: 36px; height: 36px; background: #ecf5ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #409eff; flex-shrink: 0; }
.org-name { font-size: 14px; font-weight: 500; color: #303133; }
.org-desc { font-size: 12px; color: #909399; }
.owner-cell { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.time-text { font-size: 13px; color: #909399; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
