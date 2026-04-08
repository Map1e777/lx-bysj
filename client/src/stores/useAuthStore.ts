import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { initSocket, disconnectSocket } from '@/utils/socket'

interface User {
  id: number
  username: string
  email: string
  system_role: string
  org_id: number | null
  org_role: string | null
  avatar_url: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isSystemAdmin = computed(() => user.value?.system_role === 'system_admin')
  const isOrgAdmin = computed(() => user.value?.org_role === 'org_admin' || user.value?.system_role === 'system_admin')

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password }) as any
    token.value = res.data.token
    user.value = res.data.user
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    initSocket(res.data.token)
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    disconnectSocket()
  }

  function loadFromStorage() {
    if (user.value) return
    const stored = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    if (stored && storedToken) {
      try {
        user.value = JSON.parse(stored)
        token.value = storedToken
        initSocket(storedToken)
      } catch (e) {
        logout()
      }
    }
  }

  function updateUser(data: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...data }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  async function refreshUser() {
    try {
      const res = await authApi.getMe() as any
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    } catch (e) {
      logout()
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    isSystemAdmin,
    isOrgAdmin,
    login,
    logout,
    loadFromStorage,
    updateUser,
    refreshUser,
  }
})
