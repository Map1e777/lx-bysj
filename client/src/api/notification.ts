import request from '@/utils/request'

export const notificationApi = {
  // Get notifications
  getNotifications: (params?: { page?: number; limit?: number; unread_only?: boolean }) =>
    request.get('/notifications', { params }),

  // Mark notification as read
  markRead: (id: number) =>
    request.put(`/notifications/${id}/read`),

  // Mark all as read
  markAllRead: () =>
    request.put('/notifications/read-all'),

  // Delete notification
  deleteNotification: (id: number) =>
    request.delete(`/notifications/${id}`),

}
