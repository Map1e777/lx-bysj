<template>
  <div class="register-page">
    <div class="login-bg">
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
    </div>

    <div class="register-container">
      <div class="login-header">
        <div class="login-logo">
          <el-icon class="logo-icon"><DocumentCopy /></el-icon>
        </div>
        <h1 class="login-title">文档协作系统</h1>
        <p class="login-subtitle">创建您的账号，开始协作之旅</p>
      </div>

      <el-card class="register-card" shadow="always">
        <h2 class="card-title">注册账号</h2>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名（2-20个字符）"
              prefix-icon="User"
              autocomplete="username"
            />
          </el-form-item>

          <el-form-item label="邮箱地址" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入邮箱地址"
              prefix-icon="Message"
              autocomplete="email"
            />
          </el-form-item>

          <el-form-item label="登录密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请设置密码（至少6位）"
              prefix-icon="Lock"
              show-password
            />
          </el-form-item>

          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              prefix-icon="Lock"
              show-password
              @keyup.enter="handleRegister"
            />
          </el-form-item>

          <el-button
            type="primary"
            class="register-btn"
            :loading="loading"
            @click="handleRegister"
          >
            {{ loading ? '注册中...' : '立即注册' }}
          </el-button>
        </el-form>

        <div class="register-footer">
          <span>已有账号？</span>
          <router-link to="/login" class="login-link">立即登录</router-link>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { authApi } from '@/api/auth'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const validateConfirmPassword = (_rule: any, value: string, callback: Function) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请设置密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    loading.value = true
    await authApi.register({
      username: form.username,
      email: form.email,
      password: form.password
    })
    ElMessage.success('注册成功！请登录')
    router.push('/login')
  } catch (e: any) {
    // Error handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
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
}

.circle-1 {
  width: 500px;
  height: 500px;
  top: -150px;
  right: -150px;
  background: linear-gradient(135deg, #409eff, #00d2ff);
}

.circle-2 {
  width: 350px;
  height: 350px;
  bottom: -100px;
  left: -100px;
  background: linear-gradient(135deg, #7b2ff7, #409eff);
}

.register-container {
  width: 100%;
  max-width: 440px;
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

.register-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.register-card :deep(.el-card__body) {
  padding: 32px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 24px;
  text-align: center;
}

.register-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  margin-top: 8px;
  background: linear-gradient(135deg, #409eff, #00d2ff);
  border: none;
}

.register-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #909399;
}

.login-link {
  color: #409eff;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.login-link:hover {
  color: #66b1ff;
}
</style>
