<template>
  <div class="editor-page">
    <!-- Top Toolbar -->
    <div class="editor-topbar">
      <div class="topbar-left">
        <el-button link @click="handleBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-divider direction="vertical" />
        <input
          v-model="docTitle"
          class="title-input"
          placeholder="无标题文档"
          @blur="autoSave"
        />
      </div>
      <div class="topbar-center">
        <el-tag :type="statusTagType(docStatus)" size="default">{{ statusLabel(docStatus) }}</el-tag>
        <span class="save-status" :class="saveStatusClass">{{ saveStatusText }}</span>
      </div>
      <div class="topbar-right">
        <el-button size="small" @click="showVersionModal = true">
          <el-icon><Clock /></el-icon>
          保存版本
        </el-button>
        <el-button size="small" @click="router.push(`/documents/${docId}/versions`)">
          版本历史
        </el-button>
        <el-button size="small" @click="showPermModal = true">
          <el-icon><Share /></el-icon>
          协作
        </el-button>
        <el-dropdown trigger="click" @command="handleMenuCommand">
          <el-button size="small">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="publish" v-if="docStatus === 'draft'">发布文档</el-dropdown-item>
              <el-dropdown-item command="archive">归档文档</el-dropdown-item>
              <el-dropdown-item command="export">导出文档</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="editor-body">
      <!-- Main Editor Area -->
      <div class="editor-main">
        <!-- Tiptap Toolbar -->
        <div class="tiptap-toolbar" v-if="editor">
          <!-- History -->
          <el-button-group class="toolbar-group">
            <el-tooltip content="撤销 (Ctrl+Z)">
              <el-button size="small" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">
                <el-icon><RefreshLeft /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="重做 (Ctrl+Y)">
              <el-button size="small" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <!-- Headings -->
          <el-button-group class="toolbar-group">
            <el-tooltip content="正文">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('paragraph') }"
                @click="editor.chain().focus().setParagraph().run()"
              >P</el-button>
            </el-tooltip>
            <el-tooltip content="标题1">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
                @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
              ><b>H1</b></el-button>
            </el-tooltip>
            <el-tooltip content="标题2">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
                @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
              ><b>H2</b></el-button>
            </el-tooltip>
            <el-tooltip content="标题3">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
                @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
              ><b>H3</b></el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <!-- Text Formatting -->
          <el-button-group class="toolbar-group">
            <el-tooltip content="粗体 (Ctrl+B)">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('bold') }"
                @click="editor.chain().focus().toggleBold().run()"
              ><b>B</b></el-button>
            </el-tooltip>
            <el-tooltip content="斜体 (Ctrl+I)">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('italic') }"
                @click="editor.chain().focus().toggleItalic().run()"
              ><i>I</i></el-button>
            </el-tooltip>
            <el-tooltip content="下划线 (Ctrl+U)">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('underline') }"
                @click="editor.chain().focus().toggleUnderline().run()"
              ><u>U</u></el-button>
            </el-tooltip>
            <el-tooltip content="删除线">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('strike') }"
                @click="editor.chain().focus().toggleStrike().run()"
              ><s>S</s></el-button>
            </el-tooltip>
            <el-tooltip content="高亮">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('highlight') }"
                @click="editor.chain().focus().toggleHighlight().run()"
              >
                <el-icon><MagicStick /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="行内代码">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('code') }"
                @click="editor.chain().focus().toggleCode().run()"
              >
                <el-icon><Platform /></el-icon>
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <!-- Alignment -->
          <el-button-group class="toolbar-group">
            <el-tooltip content="左对齐">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
                @click="editor.chain().focus().setTextAlign('left').run()"
              >
                <el-icon><AlignLeft /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="居中对齐">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
                @click="editor.chain().focus().setTextAlign('center').run()"
              >
                <el-icon><AlignCenter /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="右对齐">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
                @click="editor.chain().focus().setTextAlign('right').run()"
              >
                <el-icon><AlignRight /></el-icon>
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <!-- Lists -->
          <el-button-group class="toolbar-group">
            <el-tooltip content="无序列表">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('bulletList') }"
                @click="editor.chain().focus().toggleBulletList().run()"
              >
                <el-icon><List /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="有序列表">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('orderedList') }"
                @click="editor.chain().focus().toggleOrderedList().run()"
              >
                <el-icon><Menu /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="任务列表">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('taskList') }"
                @click="editor.chain().focus().toggleTaskList().run()"
              >
                <el-icon><Finished /></el-icon>
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <!-- Insert -->
          <el-button-group class="toolbar-group">
            <el-tooltip content="引用">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('blockquote') }"
                @click="editor.chain().focus().toggleBlockquote().run()"
              >
                <el-icon><ChatSquare /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="代码块">
              <el-button
                size="small"
                :class="{ 'is-active': editor.isActive('codeBlock') }"
                @click="editor.chain().focus().toggleCodeBlock().run()"
              >
                <el-icon><Monitor /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="插入链接">
              <el-button size="small" @click="insertLink">
                <el-icon><Link /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="插入图片">
              <el-button size="small" @click="triggerImageUpload">
                <el-icon><Picture /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="插入表格">
              <el-button size="small" @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">
                <el-icon><Grid /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="分隔线">
              <el-button size="small" @click="editor.chain().focus().setHorizontalRule().run()">—</el-button>
            </el-tooltip>
          </el-button-group>
        </div>

        <!-- Tiptap Editor Content -->
        <div class="tiptap-editor">
          <editor-content :editor="editor" class="editor-content" />
        </div>

        <!-- Hidden image upload input -->
        <input
          ref="imageInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleImageUpload"
        />
      </div>

      <!-- Right Panel -->
      <div class="editor-right-panel" v-if="showRightPanel">
        <div class="right-panel-header">
          <el-tabs v-model="rightPanelTab" size="small">
            <el-tab-pane label="协作者" name="collaborators" />
            <el-tab-pane label="评论" name="comments" />
          </el-tabs>
          <el-button link size="small" @click="showRightPanel = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <!-- Collaborators -->
        <div v-if="rightPanelTab === 'collaborators'" class="panel-content">
          <div v-for="collab in collaborators" :key="collab.id" class="collab-item">
            <el-avatar :size="32" :src="collab.avatar_url || undefined">
              {{ collab.username?.charAt(0) }}
            </el-avatar>
            <div class="collab-info">
              <div class="collab-name">{{ collab.username }}</div>
              <el-tag size="small" :type="roleTagType(collab.role)">{{ roleLabel(collab.role) }}</el-tag>
            </div>
          </div>
          <el-empty v-if="collaborators.length === 0" description="暂无协作者" :image-size="60" />
        </div>

        <!-- Comments -->
        <div v-if="rightPanelTab === 'comments'" class="panel-content">
          <div class="comment-input">
            <el-input
              v-model="newComment"
              type="textarea"
              :rows="3"
              placeholder="添加评论..."
              size="small"
            />
            <el-button type="primary" size="small" style="margin-top: 8px" @click="submitComment">
              提交评论
            </el-button>
          </div>
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <el-avatar :size="28">{{ comment.user?.username?.charAt(0) }}</el-avatar>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-author">{{ comment.user?.username }}</span>
                <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
              </div>
              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
          <el-empty v-if="comments.length === 0" description="暂无评论" :image-size="60" />
        </div>
      </div>

      <!-- Toggle Panel Button -->
      <div class="panel-toggle" @click="showRightPanel = !showRightPanel">
        <el-icon><component :is="showRightPanel ? 'ArrowRight' : 'ArrowLeft'" /></el-icon>
      </div>
    </div>

    <!-- Version Save Modal -->
    <VersionSaveModal
      v-if="docId"
      v-model="showVersionModal"
      :doc-id="docId"
      @saved="handleVersionSaved"
    />

    <!-- Permission Modal -->
    <DocPermModal
      v-if="docId"
      v-model="showPermModal"
      :doc-id="docId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { documentApi } from '@/api/document'
import { collaborationApi } from '@/api/collaboration'
import { commentApi } from '@/api/comment'
import DocPermModal from '@/components/DocPermModal.vue'
import VersionSaveModal from '@/components/VersionSaveModal.vue'

const router = useRouter()
const route = useRoute()

const docId = ref<number | null>(route.params.id ? Number(route.params.id) : null)
const docTitle = ref('无标题文档')
const docStatus = ref('draft')
const showRightPanel = ref(true)
const rightPanelTab = ref('collaborators')
const showVersionModal = ref(false)
const showPermModal = ref(false)
const collaborators = ref<any[]>([])
const comments = ref<any[]>([])
const newComment = ref('')
const imageInputRef = ref<HTMLInputElement | null>(null)

// Save status
const saveStatus = ref<'saved' | 'saving' | 'idle'>('idle')
const saveStatusText = computed(() => {
  if (saveStatus.value === 'saving') return '保存中...'
  if (saveStatus.value === 'saved') return '已保存'
  return ''
})
const saveStatusClass = computed(() => ({
  'save-saving': saveStatus.value === 'saving',
  'save-saved': saveStatus.value === 'saved',
}))

let saveTimer: any = null

// Init Tiptap Editor
const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Link.configure({ openOnClick: false }),
    Image,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
  ],
  content: '',
  editorProps: {
    attributes: {
      class: 'editor-prosemirror',
    },
  },
  onUpdate: ({ editor: e }) => {
    scheduleAutoSave()
  },
})

function scheduleAutoSave() {
  clearTimeout(saveTimer)
  saveStatus.value = 'saving'
  saveTimer = setTimeout(() => {
    autoSave()
  }, 2000)
}

async function autoSave() {
  if (!docId.value) {
    // Create new document
    await createDocument()
  } else {
    await saveContent()
  }
}

async function createDocument() {
  try {
    const res = await documentApi.createDocument({
      title: docTitle.value || '无标题文档',
      content: editor.value?.getHTML() || '',
      status: 'draft'
    }) as any
    docId.value = res.data.id
    router.replace(`/documents/${docId.value}/edit`)
    saveStatus.value = 'saved'
  } catch (e) {
    saveStatus.value = 'idle'
  }
}

async function saveContent() {
  if (!docId.value) return
  try {
    await documentApi.updateContent(docId.value, {
      content: editor.value?.getHTML() || ''
    })
    // Also update title if changed
    await documentApi.updateDocument(docId.value, { title: docTitle.value })
    saveStatus.value = 'saved'
    setTimeout(() => { saveStatus.value = 'idle' }, 3000)
  } catch (e) {
    saveStatus.value = 'idle'
  }
}

async function loadDocument() {
  if (!docId.value) return
  try {
    const res = await documentApi.getDocument(docId.value) as any
    const doc = res.data
    docTitle.value = doc.title
    docStatus.value = doc.status
    editor.value?.commands.setContent(doc.content || '')
  } catch (e) {
    ElMessage.error('加载文档失败')
    router.push('/documents')
  }
}

async function loadCollaborators() {
  if (!docId.value) return
  try {
    const res = await collaborationApi.getCollaborators(docId.value) as any
    collaborators.value = res.data || []
  } catch (e) {}
}

async function loadComments() {
  if (!docId.value) return
  try {
    const res = await commentApi.getComments(docId.value) as any
    comments.value = res.data?.list || []
  } catch (e) {}
}

async function submitComment() {
  if (!newComment.value.trim() || !docId.value) return
  try {
    await commentApi.createComment(docId.value, { content: newComment.value })
    newComment.value = ''
    loadComments()
  } catch (e) {
    ElMessage.error('评论失败')
  }
}

function insertLink() {
  const url = prompt('请输入链接地址')
  if (url) {
    editor.value?.chain().focus().setLink({ href: url }).run()
  }
}

function triggerImageUpload() {
  imageInputRef.value?.click()
}

async function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !docId.value) return

  const formData = new FormData()
  formData.append('image', file)
  try {
    const res = await documentApi.uploadImage(docId.value, formData) as any
    const url = res.data.url
    editor.value?.chain().focus().setImage({ src: url }).run()
  } catch (err) {
    ElMessage.error('图片上传失败')
  }
  if (imageInputRef.value) imageInputRef.value.value = ''
}

async function handleMenuCommand(command: string) {
  if (!docId.value) return
  if (command === 'publish') {
    try {
      await documentApi.publishDocument(docId.value)
      docStatus.value = 'published'
      ElMessage.success('文档已发布')
    } catch (e) {}
  } else if (command === 'archive') {
    try {
      await ElMessageBox.confirm('确定要归档此文档吗？', '提示', { type: 'warning' })
      await documentApi.archiveDocument(docId.value)
      docStatus.value = 'archived'
      ElMessage.success('文档已归档')
    } catch (e: any) {}
  } else if (command === 'export') {
    try {
      const blob = await documentApi.exportDocument(docId.value, 'html') as any
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${docTitle.value}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      ElMessage.error('导出失败')
    }
  }
}

function handleBack() {
  if (docId.value) {
    autoSave().then(() => router.push('/documents'))
  } else {
    router.push('/documents')
  }
}

function handleVersionSaved() {
  ElMessage.success('版本节点已保存')
}

function statusTagType(status: string) {
  const map: Record<string, string> = { draft: 'info', published: 'success', archived: 'warning' }
  return map[status] || 'info'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' }
  return map[status] || status
}

function roleTagType(role: string) {
  const map: Record<string, string> = { owner: 'warning', editor: 'success', commenter: 'primary', viewer: 'info' }
  return map[role] || 'info'
}

function roleLabel(role: string) {
  const map: Record<string, string> = { owner: '所有者', editor: '编辑者', commenter: '评论者', viewer: '查看者' }
  return map[role] || role
}

function formatTime(time: string) {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  if (docId.value) {
    loadDocument()
    loadCollaborators()
    loadComments()
  }
})

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  editor.value?.destroy()
})
</script>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
  overflow: hidden;
}

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  flex-shrink: 0;
  gap: 16px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.title-input {
  border: none;
  outline: none;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.title-input:hover, .title-input:focus {
  background: #f5f7fa;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.save-status {
  font-size: 12px;
}

.save-saving { color: #909399; }
.save-saved { color: #67c23a; }

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tiptap-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 4px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-group {
  display: flex;
  gap: 2px;
}

.tiptap-editor {
  flex: 1;
  overflow-y: auto;
}

:deep(.editor-content) {
  height: 100%;
}

:deep(.editor-prosemirror) {
  padding: 24px 60px;
  min-height: 100%;
  outline: none;
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
  max-width: 900px;
  margin: 0 auto;
}

:deep(.editor-prosemirror p) { margin: 0 0 10px 0; }
:deep(.editor-prosemirror h1) { font-size: 28px; font-weight: 700; margin: 20px 0 12px; }
:deep(.editor-prosemirror h2) { font-size: 22px; font-weight: 600; margin: 18px 0 10px; }
:deep(.editor-prosemirror h3) { font-size: 18px; font-weight: 600; margin: 14px 0 8px; }
:deep(.editor-prosemirror ul), :deep(.editor-prosemirror ol) { padding-left: 24px; margin: 0 0 10px; }
:deep(.editor-prosemirror blockquote) { border-left: 4px solid #409eff; padding-left: 16px; margin: 0 0 10px; color: #606266; font-style: italic; }
:deep(.editor-prosemirror pre) { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; margin: 0 0 10px; font-family: monospace; }
:deep(.editor-prosemirror code) { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 13px; }
:deep(.editor-prosemirror table) { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
:deep(.editor-prosemirror th), :deep(.editor-prosemirror td) { border: 1px solid #dcdfe6; padding: 8px 12px; }
:deep(.editor-prosemirror th) { background: #f5f7fa; font-weight: 600; }
:deep(.editor-prosemirror mark) { background: #ffeb3b; padding: 0 2px; }
:deep(.editor-prosemirror a) { color: #409eff; text-decoration: underline; }
:deep(.editor-prosemirror img) { max-width: 100%; border-radius: 4px; }
:deep(.editor-prosemirror ul[data-type="taskList"]) { list-style: none; padding-left: 0; }
:deep(.editor-prosemirror ul[data-type="taskList"] li) { display: flex; align-items: flex-start; gap: 8px; }
:deep(.editor-prosemirror hr) { border: none; border-top: 2px solid #e4e7ed; margin: 16px 0; }

/* Toolbar button active state */
:deep(.el-button.is-active) {
  background-color: #ecf5ff;
  color: #409eff;
  border-color: #b3d8ff;
}

.editor-right-panel {
  width: 300px;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.right-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #e4e7ed;
}

.right-panel-header :deep(.el-tabs__header) {
  margin: 0;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.collab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f7fa;
}

.collab-item:last-child {
  border-bottom: none;
}

.collab-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.collab-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.comment-input {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f5f7fa;
}

.comment-item {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f7fa;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-body {
  flex: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.comment-time {
  font-size: 11px;
  color: #c0c4cc;
}

.comment-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.panel-toggle {
  position: absolute;
  right: 300px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 48px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-right: none;
  border-radius: 4px 0 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  z-index: 10;
  transition: color 0.2s;
}

.panel-toggle:hover {
  color: #409eff;
}
</style>
