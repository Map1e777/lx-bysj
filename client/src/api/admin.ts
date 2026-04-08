import request from '@/utils/request'

export const adminApi = {
  // Dashboard stats
  getStats: () =>
    request.get('/admin/stats'),

  // User management
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; org_id?: number }) =>
    request.get('/admin/users', { params }),

  createUser: (data: { username: string; email: string; password: string; system_role?: string; org_id?: number }) =>
    request.post('/admin/users', data),

  updateUser: (userId: number, data: { username?: string; system_role?: string; org_id?: number; is_active?: boolean }) =>
    request.put(`/admin/users/${userId}`, data),

  deleteUser: (userId: number) =>
    request.delete(`/admin/users/${userId}`),

  // Organization management
  getOrgs: (params?: { page?: number; limit?: number; search?: string }) =>
    request.get('/admin/orgs', { params }),

  createOrg: (data: { name: string; owner_id?: number; description?: string }) =>
    request.post('/admin/orgs', data),

  updateOrg: (orgId: number, data: { name?: string; owner_id?: number; description?: string }) =>
    request.put(`/admin/orgs/${orgId}`, data),

  deleteOrg: (orgId: number) =>
    request.delete(`/admin/orgs/${orgId}`),

  getOrgDetail: (orgId: number) =>
    request.get(`/admin/orgs/${orgId}`),

  // Permission templates
  getPermTemplates: () =>
    request.get('/admin/permission-templates'),

  createPermTemplate: (data: { name: string; description?: string; permissions: object }) =>
    request.post('/admin/permission-templates', data),

  updatePermTemplate: (id: number, data: { name?: string; description?: string; permissions?: object }) =>
    request.put(`/admin/permission-templates/${id}`, data),

  deletePermTemplate: (id: number) =>
    request.delete(`/admin/permission-templates/${id}`),

  // Version rules
  getVersionRules: () =>
    request.get('/admin/version-rules'),

  updateVersionRules: (data: {
    auto_save_interval?: number
    max_versions_per_doc?: number
    auto_version_on_save?: boolean
    version_retention_days?: number
  }) => request.put('/admin/version-rules', data),

  // Audit logs
  getAuditLogs: (params?: {
    page?: number
    limit?: number
    action?: string
    actor_id?: number
    start_date?: string
    end_date?: string
    resource_type?: string
  }) => request.get('/admin/audit-logs', { params }),

  // System config
  getConfig: () =>
    request.get('/admin/config'),

  updateConfig: (data: {
    registration_open?: boolean
    max_upload_size?: number
    platform_name?: string
    maintenance_mode?: boolean
  }) => request.put('/admin/config', data),
}
