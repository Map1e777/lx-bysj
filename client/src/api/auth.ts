import request from '@/utils/request'

export const authApi = {
  login: (data: { email: string; password: string }) =>
    request.post('/auth/login', data),

  register: (data: { username: string; email: string; password: string }) =>
    request.post('/auth/register', data),

  getMe: () =>
    request.get('/auth/me'),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    request.put('/auth/password', data),

  updateProfile: (data: { username?: string; avatar_url?: string }) =>
    request.put('/users/me', data)
}
