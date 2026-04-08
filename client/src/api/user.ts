import request from '@/utils/request'

export const userApi = {
  // Get current user profile
  getProfile: () =>
    request.get('/users/me'),

  // Update profile
  updateProfile: (data: { username?: string; avatar_url?: string }) =>
    request.put('/users/me', data),

  // Search users by email (for invitation)
  searchByEmail: (email: string) =>
    request.get('/users', { params: { search: email } }),

  // Get user by ID
  getUser: (id: number) =>
    request.get(`/users/${id}`),
}
