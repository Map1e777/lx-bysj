import request from '@/utils/request'

export const orgApi = {
  // Get current org info
  getMyOrg: () =>
    request.get('/org'),

  // Get org dashboard stats
  getOrgStats: () =>
    request.get('/org/stats'),

  // Get org members
  getMembers: (params?: { page?: number; limit?: number; search?: string; dept_id?: number }) =>
    request.get('/org/members', { params }),

  // Add member to org
  addMember: (data: { email: string; role?: string; dept_id?: number }) =>
    request.post('/org/members/invite', data),

  // Update member
  updateMember: (userId: number, data: { role?: string; dept_id?: number }) =>
    request.put(`/org/members/${userId}/role`, data),

  // Remove member
  removeMember: (userId: number) =>
    request.delete(`/org/members/${userId}`),

  // Get departments
  getDepartments: () =>
    request.get('/org/departments'),

  // Create department
  createDepartment: (data: { name: string; parent_id?: number; description?: string }) =>
    request.post('/org/departments', data),

  // Update department
  updateDepartment: (deptId: number, data: { name?: string; description?: string; parent_id?: number }) =>
    request.put(`/org/departments/${deptId}`, data),

  // Delete department
  deleteDepartment: (deptId: number) =>
    request.delete(`/org/departments/${deptId}`),

  // Get org documents
  getOrgDocuments: (params?: { page?: number; limit?: number; status?: string; dept_id?: number; creator_id?: number }) =>
    request.get('/org/documents', { params }),

  // Force archive document
  forceArchiveDocument: (docId: number) =>
    request.put(`/org/documents/${docId}/archive`),

  // Get version audit trail
  getVersionAudit: (params?: { page?: number; limit?: number; doc_id?: number; user_id?: number; start_date?: string; end_date?: string }) =>
    request.get('/org/audit', { params }),

  // Export audit report
  exportAuditReport: (params?: { start_date?: string; end_date?: string }) =>
    request.get('/org/audit/export', { params, responseType: 'blob' }),
}
