import request from '@/utils/request'

export const searchApi = {
  // Full text search
  search: (params: { q: string; type?: 'document' | 'version' | 'all'; page?: number; limit?: number }) =>
    request.get('/search', { params }),

  // Search documents
  searchDocuments: (params: { q: string; page?: number; limit?: number }) =>
    request.get('/search/documents', { params }),
}
