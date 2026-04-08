import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  (response) => {
    const data = response.data
    // 只有明确的业务错误码（4xx/5xx 且不是成功状态）才拦截
    if (data.code && data.code >= 400) {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
    } else if (error.response?.status === 403) {
      ElMessage.error(error.response?.data?.message || '权限不足')
    } else if (error.response?.status === 404) {
      ElMessage.error(error.response?.data?.message || '请求的资源不存在')
    } else if (error.response?.status === 429) {
      ElMessage.error('请求过于频繁，请稍后再试')
    } else if (error.code === 'ECONNREFUSED' || !error.response) {
      ElMessage.error('无法连接到服务器，请确认后端服务已启动')
    } else {
      ElMessage.error(error.response?.data?.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
