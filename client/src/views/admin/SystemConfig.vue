<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统配置</h2>
    </div>

    <el-card shadow="never" class="config-card" v-loading="loading">
      <template #header>基本配置</template>

      <el-form ref="formRef" :model="form" label-width="200px" size="large">
        <el-form-item label="平台名称">
          <el-input v-model="form.platform_name" placeholder="请输入平台名称" style="width: 300px" />
          <div class="field-desc">显示在页面标题和邮件通知中</div>
        </el-form-item>

        <el-divider />

        <el-form-item label="开放注册">
          <el-switch
            v-model="form.registration_open"
            active-text="开放"
            inactive-text="关闭"
          />
          <div class="field-desc">关闭后新用户无法自行注册，只能由管理员创建账号</div>
        </el-form-item>

        <el-form-item label="最大上传文件大小">
          <el-input-number
            v-model="form.max_upload_size"
            :min="1"
            :max="1024"
            :step="1"
            style="width: 160px"
          />
          <span class="unit-text">MB</span>
          <div class="field-desc">限制单个文件上传的最大大小（1-1024 MB）</div>
        </el-form-item>

        <el-divider />

        <el-form-item label="维护模式">
          <el-switch
            v-model="form.maintenance_mode"
            active-text="启用"
            inactive-text="关闭"
            active-color="#f56c6c"
          />
          <el-alert
            v-if="form.maintenance_mode"
            type="error"
            :closable="false"
            show-icon
            style="margin-top: 8px; max-width: 400px"
          >
            <template #title>警告：维护模式已启用</template>
            启用维护模式后，除系统管理员外的所有用户将无法访问系统
          </el-alert>
          <div v-else class="field-desc">启用后非管理员用户将看到维护提示页面</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" :loading="saving" @click="saveConfig">
            保存配置
          </el-button>
          <el-button size="large" @click="loadConfig">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Config Summary -->
    <el-card shadow="never" style="margin-top: 20px; border-radius: 12px">
      <template #header>当前配置概览</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="平台名称">{{ form.platform_name || '文档协作系统' }}</el-descriptions-item>
        <el-descriptions-item label="注册状态">
          <el-tag :type="form.registration_open ? 'success' : 'danger'">
            {{ form.registration_open ? '开放注册' : '注册已关闭' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="最大上传">{{ form.max_upload_size }} MB</el-descriptions-item>
        <el-descriptions-item label="系统状态">
          <el-tag :type="form.maintenance_mode ? 'danger' : 'success'">
            {{ form.maintenance_mode ? '维护中' : '正常运行' }}
          </el-tag>
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
  platform_name: '文档协作系统',
  registration_open: true,
  max_upload_size: 10,
  maintenance_mode: false,
})

async function loadConfig() {
  loading.value = true
  try {
    const res = await adminApi.getConfig() as any
    const config = res.data || {}
    Object.assign(form, {
      platform_name: config.platform_name || '文档协作系统',
      registration_open: config.registration_open ?? config.allow_registration ?? true,
      max_upload_size: Number(config.max_upload_size ?? 10),
      maintenance_mode: Boolean(config.maintenance_mode ?? false),
    })
  } catch (e) {} finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    await adminApi.updateConfig(form)
    ElMessage.success('系统配置已保存')
    // Update page title if platform name changed
    if (form.platform_name) {
      document.title = form.platform_name
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => loadConfig())
</script>

<style scoped>
.config-card { border-radius: 12px; }
.unit-text { margin-left: 10px; font-size: 14px; color: #909399; }
.field-desc { font-size: 12px; color: #c0c4cc; margin-top: 4px; line-height: 1.5; }
</style>
