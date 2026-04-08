<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <div class="error-icon">
        <el-icon><QuestionFilled /></el-icon>
      </div>
      <h2 class="error-title">页面未找到</h2>
      <p class="error-desc">您访问的页面不存在或已被移除</p>
      <div class="error-actions">
        <el-button type="primary" size="large" @click="router.push('/dashboard')">
          <el-icon><HomeFilled /></el-icon>
          返回首页
        </el-button>
        <el-button size="large" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回上页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf4 100%);
}

.not-found-content {
  text-align: center;
  padding: 40px;
}

.error-code {
  font-size: 120px;
  font-weight: 900;
  color: #dce0e8;
  line-height: 1;
  margin-bottom: 16px;
  letter-spacing: -4px;
}

.error-icon {
  font-size: 64px;
  color: #c0c4cc;
  margin-bottom: 24px;
}

.error-title {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px;
}

.error-desc {
  font-size: 16px;
  color: #909399;
  margin: 0 0 36px;
}

.error-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
</style>
