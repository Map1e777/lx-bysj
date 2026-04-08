<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">版本规则配置</h2>
    </div>

    <el-card shadow="never" class="rules-card" v-loading="loading">
      <template #header>全局版本控制规则</template>

      <el-form ref="formRef" :model="form" label-width="200px" size="large">
        <el-form-item label="自动保存间隔">
          <el-input-number
            v-model="form.auto_save_interval"
            :min="10"
            :max="3600"
            :step="10"
            style="width: 160px"
          />
          <span class="unit-text">秒（10-3600秒）</span>
          <div class="field-desc">编辑文档时自动保存内容的时间间隔</div>
        </el-form-item>

        <el-form-item label="每文档最大版本数">
          <el-input-number
            v-model="form.max_versions_per_doc"
            :min="10"
            :max="1000"
            :step="10"
            style="width: 160px"
          />
          <span class="unit-text">个</span>
          <div class="field-desc">超过此数量后，最旧的自动版本将被删除（手动节点不受影响）</div>
        </el-form-item>

        <el-form-item label="保存时自动创建版本">
          <el-switch
            v-model="form.auto_version_on_save"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="field-desc">每次手动保存时自动创建版本快照</div>
        </el-form-item>

        <el-form-item label="版本保留天数">
          <el-input-number
            v-model="form.version_retention_days"
            :min="0"
            :max="3650"
            :step="30"
            style="width: 160px"
          />
          <span class="unit-text">天（0 表示永久保留）</span>
          <div class="field-desc">超过此天数的自动版本将被自动清理</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" :loading="saving" @click="saveRules">
            保存配置
          </el-button>
          <el-button size="large" @click="loadRules">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Rules Preview -->
    <el-card shadow="never" class="rules-preview-card" style="margin-top: 20px">
      <template #header>规则说明</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="当前自动保存间隔">
          每 {{ form.auto_save_interval }} 秒自动保存一次
        </el-descriptions-item>
        <el-descriptions-item label="版本上限">
          每个文档最多保留 {{ form.max_versions_per_doc }} 个版本
        </el-descriptions-item>
        <el-descriptions-item label="自动版本">
          {{ form.auto_version_on_save ? '每次保存时创建版本' : '仅手动触发时创建版本' }}
        </el-descriptions-item>
        <el-descriptions-item label="版本清理">
          {{ form.version_retention_days === 0 ? '永久保留所有版本' : `${form.version_retention_days} 天后自动清理旧版本` }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'

const loading = ref(false)
const saving = ref(false)

const form = reactive({
  auto_save_interval: 30,
  max_versions_per_doc: 100,
  auto_version_on_save: true,
  version_retention_days: 0,
})

async function loadRules() {
  loading.value = true
  try {
    const res = await adminApi.getVersionRules() as any
    const rules = res.data || {}
    Object.assign(form, {
      auto_save_interval: rules.auto_save_interval ?? 30,
      max_versions_per_doc: rules.max_versions_per_doc ?? 100,
      auto_version_on_save: rules.auto_version_on_save ?? true,
      version_retention_days: rules.version_retention_days ?? 0,
    })
  } catch (e) {} finally {
    loading.value = false
  }
}

async function saveRules() {
  saving.value = true
  try {
    await adminApi.updateVersionRules(form)
    ElMessage.success('版本规则已更新')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => loadRules())
</script>

<style scoped>
.rules-card, .rules-preview-card { border-radius: 12px; }

.unit-text {
  margin-left: 10px;
  font-size: 14px;
  color: #909399;
}

.field-desc {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
