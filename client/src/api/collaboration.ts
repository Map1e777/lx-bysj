import request from '@/utils/request'

export const collaborationApi = {
  // Get collaborators for a document
  getCollaborators: (docId: number) =>
    request.get(`/documents/${docId}/collaborators`),

  // Invite collaborator
  inviteCollaborator: (docId: number, data: { email: string; role: string; expires_in_days?: number }) =>
    request.post(`/documents/${docId}/collaborators/invite`, data),

  // Update collaborator role
  updateCollaboratorRole: (docId: number, userId: number, data: { role: string }) =>
    request.put(`/documents/${docId}/collaborators/${userId}`, data),

  // Remove collaborator
  removeCollaborator: (docId: number, userId: number) =>
    request.delete(`/documents/${docId}/collaborators/${userId}`),

  // Get pending invitations (for current user)
  getMyInvitations: (params?: { status?: string }) =>
    request.get('/invitations', { params }),

  // Accept invitation by token
  acceptInvitation: (token: string) =>
    request.post(`/invitations/${token}/accept`),

  // Decline invitation by token
  declineInvitation: (token: string) =>
    request.post(`/invitations/${token}/decline`),

  // Get documents shared with me
  getSharedDocuments: (params?: { page?: number; limit?: number; search?: string; role?: string }) =>
    request.get('/documents', { params: { ...params, scope: 'shared' } }),
}
