import request from '@/utils/request'

export const commentApi = {
  // Get comments for a document
  getComments: (docId: number, params?: { page?: number; limit?: number }) =>
    request.get(`/documents/${docId}/comments`, { params }),

  // Create comment
  createComment: (docId: number, data: { content: string; parent_id?: number; selection?: string }) =>
    request.post(`/documents/${docId}/comments`, data),

  // Update comment
  updateComment: (docId: number, commentId: number, data: { content: string }) =>
    request.put(`/documents/${docId}/comments/${commentId}`, data),

  // Delete comment
  deleteComment: (docId: number, commentId: number) =>
    request.delete(`/documents/${docId}/comments/${commentId}`),

  // Resolve comment
  resolveComment: (docId: number, commentId: number) =>
    request.put(`/documents/${docId}/comments/${commentId}/resolve`),
}
