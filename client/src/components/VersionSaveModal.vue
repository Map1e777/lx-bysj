<template>
  <el-dialog
    v-model="visible"
    title="保存版本节点"
    width="460px"
    @close="emit('close')"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="版本标签" prop="label">
        <el-input
          v-model="form.label"
          placeholder="例如：v1.0 初稿、修订版本等"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="变更说明" prop="change_summary">
        <el-input
          v-model="form.change_summary"
          type="textarea"
          placeholder="描述此版本的主要变更内容..."
          :rows="4"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存版本</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { versionApi } from '@/api/version'

const props = defineProps<{
  modelValue: boolean
  docId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
  'saved': [version: any]
}>()

const visible = ref(props.modelValue)
const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive({
  label: '',
  change_summary: ''
})

const rules = {
  label: [
    { required: true, message: '请输入版本标签', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    form.label = ''
    form.change_summary = ''
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    saving.value = true
    const res = await versionApi.createVersion(props.docId, {
      label: form.label,
      change_summary: form.change_summary
    }) as any
    ElMessage.success('版本节点已保存')
    emit('saved', res.data)
    visible.value = false
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}
</script>
