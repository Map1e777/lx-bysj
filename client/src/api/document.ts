import request from '@/utils/request'

export interface DocumentQuery {
  page?: number
  limit?: number
  status?: string
  tag?: string
  sort?: string
  search?: string
  scope?: 'mine' | 'shared' | 'public'
}

export const documentApi = {
  // List documents
  getDocuments: (params?: DocumentQuery) =>
    request.get('/documents', { params }),

  // Get single document
  getDocument: (id: number) =>
    request.get(`/documents/${id}`),

  // Create document
  createDocument: (data: { title: string; content?: string; status?: string; tags?: string[] }) =>
    request.post('/documents', data),

  // Update document metadata
  updateDocument: (id: number, data: { title?: string; status?: string; tags?: string[] }) =>
    request.put(`/documents/${id}`, data),

  // Update document content
  updateContent: (id: number, data: { content: string; save_version?: boolean }) =>
    request.put(`/documents/${id}/content`, data),

  // Delete document
  deleteDocument: (id: number) =>
    request.delete(`/documents/${id}`),

  // Archive document
  archiveDocument: (id: number) =>
    request.post(`/documents/${id}/archive`),

  // Publish document
  publishDocument: (id: number) =>
    request.post(`/documents/${id}/publish`),

  // Generate share link
  createShareLink: (id: number, data: { expires_in_days?: number }) =>
    request.post(`/documents/${id}/share`, data),

  // Revoke share link
  revokeShareLink: (id: number) =>
    request.delete(`/documents/${id}/share`),

  // Get document by share token (no auth needed)
  getSharedDocument: (token: string) =>
    request.get(`/documents/share/${token}`),

  // Export document
  exportDocument: (id: number, format: string) =>
    request.get(`/documents/${id}/export`, { params: { format }, responseType: 'blob' }),
}
