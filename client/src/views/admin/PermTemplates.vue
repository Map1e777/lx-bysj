<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">权限模板管理</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建模板
      </el-button>
    </div>

    <div v-loading="loading" class="templates-grid">
      <div
        v-for="tmpl in templates"
        :key="tmpl.id"
        class="template-card"
      >
        <div class="tmpl-header">
          <div class="tmpl-icon">
            <el-icon><Lock /></el-icon>
          </div>
          <div class="tmpl-actions">
            <el-button link size="small" @click="openEdit(tmpl)"><el-icon><Edit /></el-icon></el-button>
            <el-button link size="small" type="danger" @click="deleteTemplate(tmpl)"><el-icon><Delete /></el-icon></el-button>
          </div>
        </div>
        <div class="tmpl-name">{{ tmpl.name }}</div>
        <div class="tmpl-desc">{{ tmpl.description || '无描述' }}</div>
        <div class="tmpl-perms">
          <el-tag
            v-for="(val, key) in tmpl.permissions"
            :key="key"
            :type="val ? 'success' : 'danger'"
            size="small"
          >
            {{ permLabel(key as string) }}: {{ val ? '允许' : '禁止' }}
          </el-tag>
        </div>
      </div>
      <el-empty v-if="templates.length === 0 && !loading" description="暂无权限模板" :image-size="100" style="grid-column: 1/-1" />
    </div>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showDialog" :title="editingTmpl ? '编辑权限模板' : '新建权限模板'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="描述此权限模板的用途" />
        </el-form-item>
        <el-form-item label="权限设置">
          <div class="perm-builder">
            <div v-for="perm in permDefinitions" :key="perm.key" class="perm-row">
              <span class="perm-label">{{ perm.label }}</span>
              <el-switch
                v-model="(form.permissions as any)[perm.key]"
                active-text="允许"
                inactive-text="禁止"
              />
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTemplate">保存</el-button>
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
const templates = ref<any[]>([])
const showDialog = ref(false)
const editingTmpl = ref<any>(null)
const formRef = ref<FormInstance>()

const permDefinitions = [
  { key: 'can_read', label: '查看文档' },
  { key: 'can_comment', label: '添加评论' },
  { key: 'can_edit', label: '编辑内容' },
  { key: 'can_manage_versions', label: '管理版本' },
  { key: 'can_invite', label: '邀请协作者' },
  { key: 'can_share', label: '生成分享链接' },
]

const form = reactive({
  name: '',
  description: '',
  permissions: {
    can_read: true,
    can_comment: false,
    can_edit: false,
    can_manage_versions: false,
    can_invite: false,
    can_share: false,
  } as Record<string, boolean>
})

const rules = { name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }] }

async function loadTemplates() {
  loading.value = true
  try {
    const res = await adminApi.getPermTemplates() as any
    templates.value = (res.data?.list || []).map((tmpl: any) => ({
      ...tmpl,
      permissions: typeof tmpl.rules === 'object' && !Array.isArray(tmpl.rules) ? tmpl.rules : {}
    }))
  } catch (e) {} finally {
    loading.value = false
  }
}

function openCreate() {
  editingTmpl.value = null
  Object.assign(form, {
    name: '', description: '',
    permissions: { can_read: true, can_comment: false, can_edit: false, can_manage_versions: false, can_invite: false, can_share: false }
  })
  showDialog.value = true
}

function openEdit(tmpl: any) {
  editingTmpl.value = tmpl
  Object.assign(form, {
    name: tmpl.name,
    description: tmpl.description || '',
    permissions: { ...{ can_read: true, can_comment: false, can_edit: false, can_manage_versions: false, can_invite: false, can_share: false }, ...tmpl.permissions }
  })
  showDialog.value = true
}

async function saveTemplate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (editingTmpl.value) {
      await adminApi.updatePermTemplate(editingTmpl.value.id, form)
      ElMessage.success('模板已更新')
    } else {
      await adminApi.createPermTemplate(form)
      ElMessage.success('模板已创建')
    }
    showDialog.value = false
    loadTemplates()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteTemplate(tmpl: any) {
  try {
    await ElMessageBox.confirm(`确定要删除权限模板 "${tmpl.name}" 吗？`, '提示', { type: 'warning' })
    await adminApi.deletePermTemplate(tmpl.id)
    ElMessage.success('模板已删除')
    loadTemplates()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

function permLabel(key: string) {
  const map: Record<string, string> = {
    can_read: '查看', can_comment: '评论', can_edit: '编辑',
    can_manage_versions: '版本管理', can_invite: '邀请', can_share: '分享'
  }
  return map[key] || key
}

onMounted(() => loadTemplates())
</script>

<style scoped>
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.template-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: all 0.2s;
}

.template-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64,158,255,0.12);
}

.tmpl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.tmpl-icon {
  width: 40px;
  height: 40px;
  background: #ecf5ff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #409eff;
}

.tmpl-name { font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 6px; }
.tmpl-desc { font-size: 13px; color: #909399; margin-bottom: 12px; }

.tmpl-perms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.perm-builder {
  width: 100%;
}

.perm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f5f7fa;
}

.perm-row:last-child { border-bottom: none; }
.perm-label { font-size: 14px; color: #303133; }
</style>
