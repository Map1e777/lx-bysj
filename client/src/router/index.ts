import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

const routes = [
  {
    path: '/login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    component: () => import('@/views/Register.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/share/:token',
    component: () => import('@/views/doc/DocShare.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('@/views/Dashboard.vue') },
      { path: 'profile', component: () => import('@/views/Profile.vue') },

      // Document routes
      { path: 'documents', component: () => import('@/views/doc/DocList.vue') },
      { path: 'documents/new', component: () => import('@/views/doc/DocEditor.vue') },
      { path: 'documents/:id/edit', component: () => import('@/views/doc/DocEditor.vue') },
      { path: 'documents/:id/view', component: () => import('@/views/doc/DocView.vue') },
      { path: 'documents/:id/versions', component: () => import('@/views/version/VersionHistory.vue') },
      { path: 'documents/:id/versions/compare', component: () => import('@/views/version/VersionCompare.vue') },

      // Collaboration routes
      { path: 'invitations', component: () => import('@/views/collab/Invitations.vue') },
      { path: 'shared', component: () => import('@/views/collab/SharedDocs.vue') },

      // Org admin routes
      {
        path: 'org',
        meta: { requiresOrgAdmin: true },
        children: [
          { path: '', redirect: '/org/dashboard' },
          { path: 'dashboard', component: () => import('@/views/org/OrgDashboard.vue') },
          { path: 'members', component: () => import('@/views/org/MemberManage.vue') },
          { path: 'departments', component: () => import('@/views/org/DeptManage.vue') },
          { path: 'documents', component: () => import('@/views/org/OrgDocManage.vue') },
          { path: 'audit', component: () => import('@/views/org/VersionAudit.vue') },
        ]
      },

      // System admin routes
      {
        path: 'admin',
        meta: { requiresSystemAdmin: true },
        children: [
          { path: '', redirect: '/admin/dashboard' },
          { path: 'dashboard', component: () => import('@/views/admin/AdminDashboard.vue') },
          { path: 'users', component: () => import('@/views/admin/UserManage.vue') },
          { path: 'orgs', component: () => import('@/views/admin/OrgManage.vue') },
          { path: 'permission-templates', component: () => import('@/views/admin/PermTemplates.vue') },
          { path: 'version-rules', component: () => import('@/views/admin/VersionRules.vue') },
          { path: 'audit-logs', component: () => import('@/views/admin/AuditLogs.vue') },
          { path: 'config', component: () => import('@/views/admin/SystemConfig.vue') },
        ]
      },
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  authStore.loadFromStorage()

  if (to.meta.requiresAuth !== false && !authStore.isLoggedIn) {
    return next('/login')
  }
  if (to.meta.requiresSystemAdmin && !authStore.isSystemAdmin) {
    return next('/dashboard')
  }
  if (to.meta.requiresOrgAdmin && !authStore.isOrgAdmin && !authStore.isSystemAdmin) {
    return next('/dashboard')
  }
  next()
})

export default router
