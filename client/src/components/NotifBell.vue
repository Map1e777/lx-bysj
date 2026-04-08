<template>
  <el-popover
    placement="bottom-end"
    :width="380"
    trigger="click"
    popper-class="notif-popover"
    @show="handleShow"
  >
    <template #reference>
      <el-badge :value="notifStore.unreadCount" :max="99" :hidden="notifStore.unreadCount === 0">
        <el-button circle size="default" class="notif-btn">
          <el-icon><Bell /></el-icon>
        </el-button>
      </el-badge>
    </template>

    <div class="notif-panel">
      <!-- Header -->
      <div class="notif-header">
        <span class="notif-title">通知消息</span>
        <div class="notif-actions">
          <el-button
            v-if="notifStore.unreadCount > 0"
            link
            type="primary"
            size="small"
            @click="notifStore.markAllRead()"
          >
            全部已读
          </el-button>
          <el-button link type="primary" size="small" @click="router.push('/dashboard')">
            查看全部
          </el-button>
        </div>
      </div>

      <!-- Notification List -->
      <div class="notif-list" v-loading="notifStore.loading">
        <template v-if="notifStore.notifications.length > 0">
          <div
            v-for="notif in notifStore.notifications.slice(0, 10)"
            :key="notif.id"
            class="notif-item"
            :class="{ 'is-unread': !notif.is_read }"
            @click="handleNotifClick(notif)"
          >
            <div class="notif-icon" :class="getNotifIconClass(notif.type)">
              <el-icon>
                <component :is="getNotifIcon(notif.type)" />
              </el-icon>
            </div>
            <div class="notif-content">
              <div class="notif-item-title">{{ notif.title }}</div>
              <div class="notif-item-content">{{ notif.content }}</div>
              <div class="notif-time">{{ formatTime(notif.created_at) }}</div>
            </div>
            <div v-if="!notif.is_read" class="unread-dot" />
          </div>
        </template>
        <div v-else class="notif-empty">
          <el-icon><BellFilled /></el-icon>
          <p>暂无通知</p>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotifStore } from '@/stores/useNotifStore'
import { getSocket } from '@/utils/socket'
import type { Notification } from '@/stores/useNotifStore'

const router = useRouter()
const notifStore = useNotifStore()

let socketListenerAdded = false

function handleShow() {
  notifStore.fetchNotifications({ limit: 10 })
}

function handleNotifClick(notif: Notification) {
  notifStore.markRead(notif.id)
  if (notif.related_type === 'invitation') {
    router.push('/invitations')
  } else if (notif.related_type === 'document' && notif.related_id) {
    router.push(`/documents/${notif.related_id}/view`)
  } else if (notif.related_type === 'comment' && notif.related_id) {
    router.push(`/documents/${notif.related_id}/view`)
  }
}

function getNotifIcon(type: string) {
  const map: Record<string, string> = {
    invitation: 'Message',
    comment: 'ChatDotRound',
    version: 'DocumentCopy',
    system: 'InfoFilled',
    share: 'Share',
  }
  return map[type] || 'Bell'
}

function getNotifIconClass(type: string) {
  const map: Record<string, string> = {
    invitation: 'icon-primary',
    comment: 'icon-success',
    version: 'icon-warning',
    system: 'icon-info',
    share: 'icon-primary',
  }
  return map[type] || 'icon-info'
}

function formatTime(time: string) {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

function setupSocket() {
  if (socketListenerAdded) return
  const socket = getSocket()
  if (!socket) return

  socket.on('notification', (data: Notification) => {
    notifStore.addNotification(data)
  })
  socketListenerAdded = true
}

onMounted(() => {
  notifStore.fetchUnreadCount()
  setupSocket()

  // Poll for unread count every 30 seconds
  const interval = setInterval(() => {
    notifStore.fetchUnreadCount()
  }, 30000)

  onUnmounted(() => clearInterval(interval))
})
</script>

<style scoped>
.notif-btn {
  border: none;
  background: transparent;
  color: #606266;
  font-size: 18px;
}

.notif-btn:hover {
  background: #f5f7fa;
  color: #409eff;
}

.notif-panel {
  max-height: 480px;
  display: flex;
  flex-direction: column;
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.notif-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.notif-actions {
  display: flex;
  gap: 8px;
}

.notif-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f5f7fa;
  position: relative;
}

.notif-item:hover {
  background: #f5f7fa;
}

.notif-item.is-unread {
  background: #f0f7ff;
}

.notif-item.is-unread:hover {
  background: #e6f0ff;
}

.notif-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.icon-primary {
  background: #ecf5ff;
  color: #409eff;
}

.icon-success {
  background: #f0f9eb;
  color: #67c23a;
}

.icon-warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.icon-info {
  background: #f4f4f5;
  color: #909399;
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-item-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-item-content {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  background: #409eff;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #c0c4cc;
}

.notif-empty .el-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.notif-empty p {
  margin: 0;
  font-size: 13px;
}
</style>
