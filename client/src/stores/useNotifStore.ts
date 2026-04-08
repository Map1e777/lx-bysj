import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notificationApi } from '@/api/notification'

export interface Notification {
  id: number
  type: string
  title: string
  content: string
  is_read: boolean
  related_id?: number
  related_type?: string
  created_at: string
}

export const useNotifStore = defineStore('notif', () => {
  const notifications = ref<Notification[]>([])
  const total = ref(0)
  const unreadCount = ref(0)
  const loading = ref(false)

  const hasUnread = computed(() => unreadCount.value > 0)

  async function fetchNotifications(params?: { page?: number; limit?: number; unread_only?: boolean }) {
    try {
      loading.value = true
      const res = await notificationApi.getNotifications(params) as any
      if (params?.page && params.page > 1) {
        notifications.value = [...notifications.value, ...res.data.list]
      } else {
        notifications.value = res.data.list || []
      }
      total.value = res.data.total || 0
    } catch (e) {
      console.error('Failed to fetch notifications', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await notificationApi.getNotifications({ limit: 1 }) as any
      unreadCount.value = res.data.unread_count || 0
    } catch (e) {
      console.error('Failed to fetch unread count', e)
    }
  }

  async function markRead(id: number) {
    try {
      await notificationApi.markRead(id)
      const notif = notifications.value.find(n => n.id === id)
      if (notif && !notif.is_read) {
        notif.is_read = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch (e) {
      console.error('Failed to mark as read', e)
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead()
      notifications.value.forEach(n => n.is_read = true)
      unreadCount.value = 0
    } catch (e) {
      console.error('Failed to mark all as read', e)
    }
  }

  function addNotification(notif: Notification) {
    notifications.value.unshift(notif)
    if (!notif.is_read) {
      unreadCount.value += 1
    }
  }

  async function deleteNotification(id: number) {
    try {
      await notificationApi.deleteNotification(id)
      const index = notifications.value.findIndex(n => n.id === id)
      if (index !== -1) {
        const notif = notifications.value[index]
        if (!notif.is_read) {
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        }
        notifications.value.splice(index, 1)
      }
    } catch (e) {
      console.error('Failed to delete notification', e)
    }
  }

  return {
    notifications,
    total,
    unreadCount,
    loading,
    hasUnread,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    addNotification,
    deleteNotification,
  }
})
