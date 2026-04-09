import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'selected_org_id'

export const useOrgContextStore = defineStore('orgContext', () => {
  const selectedOrgId = ref<number | null>(null)

  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY)
    selectedOrgId.value = raw ? Number(raw) : null
  }

  function setSelectedOrgId(orgId: number | null) {
    selectedOrgId.value = orgId
    if (orgId) {
      localStorage.setItem(STORAGE_KEY, String(orgId))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const hasOrgContext = computed(() => !!selectedOrgId.value)

  return {
    selectedOrgId,
    hasOrgContext,
    loadFromStorage,
    setSelectedOrgId
  }
})
