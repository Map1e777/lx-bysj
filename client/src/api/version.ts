import request from '@/utils/request'

export const versionApi = {
  // Get version list for a document
  getVersions: (docId: number, params?: { page?: number; limit?: number }) =>
    request.get(`/documents/${docId}/versions`, { params }),

  // Get single version
  getVersion: (docId: number, versionId: number) =>
    request.get(`/documents/${docId}/versions/${versionId}`),

  // Create manual version checkpoint
  createVersion: (docId: number, data: { label?: string; change_summary?: string }) =>
    request.post(`/documents/${docId}/versions`, data),

  // Restore a version
  restoreVersion: (docId: number, versionId: number) =>
    request.post(`/documents/${docId}/versions/${versionId}/restore`),

  // Compare two versions
  compareVersions: (docId: number, from: number, to: number) =>
    request.get(`/documents/${docId}/versions/diff`, { params: { from, to } }),

  // Delete a version
  deleteVersion: (docId: number, versionId: number) =>
    request.delete(`/documents/${docId}/versions/${versionId}`),
}
