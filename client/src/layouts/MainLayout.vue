<template>
  <el-container class="layout-container">
    <!-- Sidebar -->
    <el-aside :width="isCollapsed ? '64px' : '240px'" class="layout-aside">
      <!-- Logo -->
      <div class="sidebar-logo" @click="router.push('/dashboard')">
        <el-icon class="logo-icon"><DocumentCopy /></el-icon>
        <span v-if="!isCollapsed" class="logo-text">文档协作系统</span>
      </div>

      <!-- Navigation Menu -->
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#ffffff"
        router
        class="sidebar-menu"
      >
        <!-- Common Menu Items -->
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>

        <el-menu-item index="/documents">
          <el-icon><Document /></el-icon>
          <template #title>我的文档</template>
        </el-menu-item>

        <el-menu-item index="/shared">
          <el-icon><Share /></el-icon>
          <template #title>共享文档</template>
        </el-menu-item>

        <el-menu-item index="/invitations">
          <el-icon><Bell /></el-icon>
          <template #title>
            待处理邀请
            <el-badge v-if="pendingCount > 0" :value="pendingCount" class="menu-badge" />
          </template>
        </el-menu-item>

        <el-menu-item index="/profile">
          <el-icon><User /></el-icon>
          <template #title>个人中心</template>
        </el-menu-item>

        <!-- Org Admin Section -->
        <template v-if="authStore.isOrgAdmin">
          <el-divider v-if="!isCollapsed" class="menu-divider">
            <span class="divider-text">组织管理</span>
          </el-divider>
          <el-divider v-else class="menu-divider-collapsed" />

          <el-menu-item index="/org/dashboard">
            <el-icon><OfficeBuilding /></el-icon>
            <template #title>组织概览</template>
          </el-menu-item>

          <el-menu-item index="/org/members">
            <el-icon><UserFilled /></el-icon>
            <template #title>成员管理</template>
          </el-menu-item>

          <el-menu-item index="/org/departments">
            <el-icon><Grid /></el-icon>
            <template #title>部门管理</template>
          </el-menu-item>

          <el-menu-item index="/org/documents">
            <el-icon><Files /></el-icon>
            <template #title>组织文档</template>
          </el-menu-item>

          <el-menu-item index="/org/audit">
            <el-icon><Tickets /></el-icon>
            <template #title>版本审计</template>
          </el-menu-item>
        </template>

        <!-- System Admin Section -->
        <template v-if="authStore.isSystemAdmin">
          <el-divider v-if="!isCollapsed" class="menu-divider">
            <span class="divider-text">系统管理</span>
          </el-divider>
          <el-divider v-else class="menu-divider-collapsed" />

          <el-menu-item index="/admin/dashboard">
            <el-icon><Monitor /></el-icon>
            <template #title>系统概览</template>
          </el-menu-item>

          <el-menu-item index="/admin/users">
            <el-icon><Avatar /></el-icon>
            <template #title>用户管理</template>
          </el-menu-item>

          <el-menu-item index="/admin/orgs">
            <el-icon><Connection /></el-icon>
            <template #title>组织管理</template>
          </el-menu-item>

          <el-menu-item index="/admin/permission-templates">
            <el-icon><Lock /></el-icon>
            <template #title>权限模板</template>
          </el-menu-item>

          <el-menu-item index="/admin/version-rules">
            <el-icon><SetUp /></el-icon>
            <template #title>版本规则</template>
          </el-menu-item>

          <el-menu-item index="/admin/audit-logs">
            <el-icon><List /></el-icon>
            <template #title>审计日志</template>
          </el-menu-item>

          <el-menu-item index="/admin/config">
            <el-icon><Setting /></el-icon>
            <template #title>系统配置</template>
          </el-menu-item>
        </template>
      </el-menu>

      <!-- Collapse Toggle -->
      <div class="sidebar-toggle" @click="isCollapsed = !isCollapsed">
        <el-icon>
          <ArrowLeft v-if="!isCollapsed" />
          <ArrowRight v-else />
        </el-icon>
      </div>
    </el-aside>

    <!-- Main Content -->
    <el-container class="layout-main-container">
      <!-- Header -->
      <el-header class="layout-header">
        <!-- Search Bar -->
        <div class="header-search">
          <el-input
            v-model="searchQuery"
            placeholder="搜索文档..."
            prefix-icon="Search"
            clearable
            class="search-input"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Right Actions -->
        <div class="header-actions">
          <!-- Create Document Button -->
          <el-button type="primary" size="small" @click="router.push('/documents/new')">
            <el-icon><Plus /></el-icon>
            新建文档
          </el-button>

          <!-- Notification Bell -->
          <NotifBell />

          <!-- User Avatar Dropdown -->
          <el-dropdown trigger="click" @command="handleUserCommand">
            <div class="user-avatar-wrapper">
              <el-avatar
                :size="36"
                :src="authStore.user?.avatar_url || undefined"
                class="user-avatar"
              >
                {{ authStore.user?.username?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <span class="username-text">{{ authStore.user?.username }}</span>
              <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- Main Area -->
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/useAuthStore'
import { useNotifStore } from '@/stores/useNotifStore'
import { getSocket } from '@/utils/socket'
import NotifBell from '@/components/NotifBell.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const notifStore = useNotifStore()

const isCollapsed = ref(false)
const searchQuery = ref('')
const pendingCount = ref(0)

const activeMenu = computed(() => {
  const path = route.path
  return path
})

function handleSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/documents', query: { search: searchQuery.value } })
  }
}

function handleUserCommand(command: string) {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      authStore.logout()
      router.push('/login')
    }).catch(() => {})
  }
}

// Setup socket listeners for real-time notifications
function setupSocketListeners() {
  const socket = getSocket()
  if (!socket) return

  socket.on('notification', (data: any) => {
    notifStore.addNotification(data)
  })
}

onMounted(() => {
  notifStore.fetchUnreadCount()
  setupSocketListeners()
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
  overflow: hidden;
}

.layout-aside {
  background-color: #001529;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.logo-icon {
  font-size: 24px;
  color: #409eff;
  flex-shrink: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 240px;
}

.menu-divider {
  margin: 8px 16px;
  border-color: rgba(255, 255, 255, 0.1);
}

.menu-divider-collapsed {
  margin: 8px 8px;
  border-color: rgba(255, 255, 255, 0.1);
}

.divider-text {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  white-space: nowrap;
}

.menu-badge {
  margin-left: 8px;
}

.sidebar-toggle {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transition: color 0.2s;
}

.sidebar-toggle:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.layout-main-container {
  flex: 1;
  overflow: hidden;
  flex-direction: column;
}

.layout-header {
  height: 60px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.header-search {
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-avatar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.user-avatar-wrapper:hover {
  background: #f5f7fa;
}

.user-avatar {
  background-color: #409eff;
  color: #fff;
  font-weight: 600;
}

.username-text {
  font-size: 14px;
  color: #303133;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-arrow {
  color: #909399;
  font-size: 12px;
}

.layout-main {
  flex: 1;
  overflow-y: auto;
  background-color: #f5f7fa;
  padding: 0;
}

/* Override Element Plus menu styles */
:deep(.el-menu-item) {
  height: 48px;
  line-height: 48px;
  margin: 2px 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

:deep(.el-menu-item.is-active) {
  background-color: #409eff !important;
  color: #ffffff !important;
}

:deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.08) !important;
}

:deep(.el-menu--collapse .el-menu-item) {
  margin: 2px 6px;
}

:deep(.el-divider) {
  margin: 12px 0;
}

:deep(.el-divider__text) {
  background-color: #001529;
}
</style>
