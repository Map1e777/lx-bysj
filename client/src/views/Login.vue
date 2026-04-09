<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
      <div class="bg-circle circle-3"></div>
    </div>

    <div class="login-container">
      <!-- Logo & Title -->
      <div class="login-header">
        <div class="login-logo">
          <el-icon class="logo-icon"><DocumentCopy /></el-icon>
        </div>
        <h1 class="login-title">文档协作系统</h1>
        <p class="login-subtitle">高效协作，版本管理，知识沉淀</p>
      </div>

      <!-- Login Form -->
      <el-card class="login-card" shadow="always">
        <h2 class="card-title">欢迎登录</h2>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          @submit.prevent="handleLogin"
        >
          <el-form-item label="邮箱地址" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入邮箱"
              prefix-icon="Message"
              autocomplete="email"
            />
          </el-form-item>

          <el-form-item label="登录密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              prefix-icon="Lock"
              show-password
              autocomplete="current-password"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-button
            type="primary"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form>

        <div class="login-footer">
          <span>还没有账号？</span>
          <router-link to="/register" class="register-link">立即注册</router-link>
        </div>
      </el-card>

      <!-- Demo Accounts Hint -->
      <el-alert
        class="demo-hint"
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>
          <span class="demo-title">测试账号</span>
        </template>
        <div class="demo-accounts">
          <div class="demo-account-item">
            <span class="demo-role">系统管理员：</span>
            <span class="demo-cred">admin@example.com / admin123</span>
          </div>
          <div class="demo-account-item">
            <span class="demo-role">组织管理员：</span>
            <span class="demo-cred">orgadmin@example.com / admin123</span>
          </div>
          <div class="demo-account-item">
            <span class="demo-role">文档创作者：</span>
            <span class="demo-cred">creator@example.com / admin123</span>
          </div>
          <div class="demo-account-item">
            <span class="demo-role">文档协作者：</span>
            <span class="demo-cred">collab@example.com / admin123</span>
          </div>
        </div>
      </el-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useAuthStore } from '@/stores/useAuthStore'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  email: '',
  password: ''
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    loading.value = true
    await authStore.login(form.email, form.password)
    ElMessage.success('登录成功，欢迎回来！')
    router.push('/dashboard')
  } catch (e: any) {
    // Error handled by request interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
  background: linear-gradient(135deg, #409eff, #00d2ff);
}

.circle-1 {
  width: 600px;
  height: 600px;
  top: -200px;
  left: -200px;
}

.circle-2 {
  width: 400px;
  height: 400px;
  bottom: -100px;
  right: -100px;
  background: linear-gradient(135deg, #00d2ff, #7b2ff7);
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #409eff, #00d2ff);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.4);
}

.logo-icon {
  font-size: 36px;
  color: #ffffff;
}

.login-title {
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px;
}

.login-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.login-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.login-card :deep(.el-card__body) {
  padding: 32px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 24px;
  text-align: center;
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  margin-top: 8px;
  background: linear-gradient(135deg, #409eff, #00d2ff);
  border: none;
}

.login-btn:hover {
  background: linear-gradient(135deg, #66b1ff, #40e0ff);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.4);
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #909399;
}

.register-link {
  color: #409eff;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.register-link:hover {
  color: #66b1ff;
}

.demo-hint {
  margin-top: 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.demo-hint :deep(.el-alert__title) {
  color: rgba(255, 255, 255, 0.9);
}

.demo-hint :deep(.el-alert__icon) {
  color: rgba(255, 255, 255, 0.7);
}

.demo-title {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.demo-accounts {
  margin-top: 4px;
}

.demo-account-item {
  font-size: 12px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.7);
}

.demo-role {
  font-weight: 500;
}

.demo-cred {
  font-family: monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}
</style>
