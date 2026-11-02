import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  Folder,
  FolderPlus,
  MoreVertical,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { PageContainer } from '../ui/PageContainer'
import { PageHeader, PageHeaderActionLabel } from '../ui/PageHeader'
import { EmptyState } from '../ui/EmptyState'
import { useConfirm } from '../ui/useConfirm'
import { cn } from '@/lib/utils'
import { formatDate } from '../lib/format'
import { fileTypeMeta } from './fileTypeMeta'
import type { DocumentItem } from './documentsApi'
import {
  useCreateFolder,
  useDeleteDocument,
  useDeleteFolder,
  useDocumentFolders,
  useDocuments,
} from './useDocuments'
import { DocumentUploadDialog } from './DocumentUploadDialog'
import { DocumentEditDialog } from './DocumentEditDialog'
import { DocumentPreviewSheet } from './DocumentPreviewSheet'
import { PaperlessPanel } from './PaperlessPanel'
import { apiFetch } from '../lib/apiClient'

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}


export function DocumentsPage() {
  const { t } = useTranslation('nav')
  const [params, setParams] = useSearchParams()
  const [paperlessUploadOpen, setPaperlessUploadOpen] = useState(false)
  const [paperlessConfigured, setPaperlessConfigured] = useState(false)

  useEffect(() => {
    void apiFetch<{ configured: boolean }>('/paperless/connection')
      .then((status) => setPaperlessConfigured(status.configured))
      .catch(() => setPaperlessConfigured(false))
  }, [])

  async function copyToPaperless(doc: DocumentItem) {
    try {
      const result = await apiFetch<{ content_pending?: boolean }>(`/paperless/copy-from-local/${encodeURIComponent(doc.id)}`, { method: 'POST' })
      toast.success(result.content_pending
        ? 'Document submitted; saved text will transfer after processing'
        : 'Document submitted to Paperless for OCR processing')
      if (result.content_pending) {
        // Processing may take several minutes. Retrying is safe: the backend
        // clears the pending marker only after a successful content update.
        for (let attempt = 0; attempt < 90; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, 5000))
          try {
            const status = await apiFetch<{ status: string }>(`/paperless/finalize-content/${encodeURIComponent(doc.id)}`, { method: 'POST' })
            if (status.status === 'completed') {
              toast.success('Recognized text copied to Paperless')
              break
            }
            if (status.status === 'failed' || status.status === 'not_pending') {
              toast.error('Paperless text transfer did not complete')
              break
            }
          } catch {
            // Leave the pending marker intact for a later retry.
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Copy to Paperless failed')
    }
  }

  function openUpload(destination: 'local' | 'paperless') {
    setProvider(destination)
    if (destination === 'paperless') setPaperlessUploadOpen(true)
    else setUploadOpen(true)
  }
  const [provider, setProvider] = useState<'local' | 'paperless'>('local')
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderDraft, setFolderDraft] = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const requested = params.get('upload')
    if (!requested || !['1', 'local', 'paperless'].includes(requested)) return
    if (requested === 'local') {
      openUpload('local')
    } else {
      void apiFetch<{ configured: boolean }>('/paperless/connection')
        .then((status) => {
          setPaperlessConfigured(status.configured)
          openUpload(status.configured ? 'paperless' : 'local')
        })
        .catch(() => openUpload('local'))
    }
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('upload')
      return next
    }, { replace: true })
  }, [params, setParams])

  const { confirm, confirmDialog } = useConfirm()

  const { data: documents, isLoading } = useDocuments(
    selectedFolder ? { folder: selectedFolder } : {},
  )
  const { data: foldersData, isLoading: foldersLoading } = useDocumentFolders()
  const deleteDocument = useDeleteDocument()
  const createFolder = useCreateFolder()
  const deleteFolderMutation = useDeleteFolder()

  const filtered = useMemo(() => {
    if (!documents) return []
    const q = search.trim().toLowerCase()
    return documents.filter(
      (doc) =>
        (!selectedTag || (doc.paperless_metadata?.tags ?? []).includes(selectedTag)) &&
        (!q || (
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.filename.toLowerCase().includes(q) ||
        (doc.content ?? '').toLowerCase().includes(q))) ,
    )
  }, [documents, search, selectedTag])

  const availableTags = useMemo(() => [...new Set((documents ?? []).flatMap((doc) => doc.paperless_metadata?.tags ?? []))].sort((a, b) => a.localeCompare(b)), [documents])
  const folders = foldersData?.folders ?? []
  const totalCount = foldersData?.total ?? documents?.length ?? 0

  async function handleDeleteDoc(doc: DocumentItem) {
    const ok = await confirm({
      title: `Delete "${doc.title}"?`,
      description: 'This permanently removes the file. This cannot be undone.',
      confirmLabel: 'Delete document',
    })
    if (!ok) return
    try {
      await deleteDocument.mutateAsync(doc.id)
      toast.success('Document deleted')
      if (previewDoc?.id === doc.id) setPreviewDoc(null)
    } catch {
      toast.error('Failed to delete document')
    }
  }

  async function handleDeleteFolder(name: string) {
    const ok = await confirm({
      title: `Delete folder "${name}"?`,
      description: 'Documents inside move to "All documents" — nothing is deleted.',
      confirmLabel: 'Delete folder',
    })
    if (!ok) return
    try {
      await deleteFolderMutation.mutateAsync(name)
      toast.success('Folder deleted')
      if (selectedFolder === name) setSelectedFolder('')
    } catch {
      toast.error('Failed to delete folder')
    }
  }

  function submitFolderDraft() {
    const name = folderDraft.trim()
    setAddingFolder(false)
    setFolderDraft('')
    if (!name) return
    createFolder.mutate(name, {
      onSuccess: () => toast.success('Folder created'),
      onError: () => toast.error('Could not create folder — it may already exist'),
    })
  }

  const isEmpty = !isLoading && filtered.length === 0

  return (
    <PageContainer wide>
      <PageHeader
        title={t("items.documents")}
        action={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddingFolder(true)
                requestAnimationFrame(() => folderInputRef.current?.focus())
              }}
            >
              <FolderPlus data-icon="inline-start" />
              <PageHeaderActionLabel>New folder</PageHeaderActionLabel>
            </Button>
            {paperlessConfigured ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm"><FileText data-icon="inline-start" /><PageHeaderActionLabel>Upload</PageHeaderActionLabel></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openUpload('local')}>Upload to Local documents</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openUpload('paperless')}>Upload to Paperless-ngx</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={() => openUpload('local')}>
                <FileText data-icon="inline-start" /><PageHeaderActionLabel>Upload</PageHeaderActionLabel>
              </Button>
            )}
          </>
        }
      />

      <div className="flex gap-2 pb-4">
        <Button variant={provider === 'local' ? 'default' : 'outline'} onClick={() => setProvider('local')}>Local documents</Button>
        <Button variant={provider === 'paperless' ? 'default' : 'outline'} onClick={() => setProvider('paperless')}>Paperless-ngx</Button>
      </div>
      {provider === 'paperless' ? <PaperlessPanel openUpload={paperlessUploadOpen} onUploadOpenChange={setPaperlessUploadOpen} /> : (
      <div className="glass-panel flex flex-col overflow-hidden rounded-xl border lg:flex-row">
        {/* Folder rail — horizontal chips on mobile, sidebar on desktop */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b p-3 lg:w-56 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-e lg:p-3">
          <FolderRailItem
            label="All documents"
            count={totalCount}
            active={selectedFolder === ''}
            onClick={() => setSelectedFolder('')}
          />
          {foldersLoading &&
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full shrink-0 rounded-lg lg:w-full" />)}
          {folders.map((folder) => (
            <FolderRailItem
              key={folder.name}
              label={folder.name}
              count={folder.count}
              active={selectedFolder === folder.name}
              onClick={() => setSelectedFolder(folder.name)}
              onDelete={() => handleDeleteFolder(folder.name)}
            />
          ))}
          {addingFolder && (
            <div className="flex shrink-0 items-center gap-1 lg:w-full">
              <input
                ref={folderInputRef}
                value={folderDraft}
                onChange={(e) => setFolderDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitFolderDraft()
                  if (e.key === 'Escape') {
                    setAddingFolder(false)
                    setFolderDraft('')
                  }
                }}
                onBlur={submitFolderDraft}
                placeholder="Folder name…"
                className="h-8 w-36 min-w-0 rounded-lg border border-primary bg-muted px-2.5 text-sm outline-none lg:w-full"
              />
            </div>
          )}
        </div>

        {/* Documents area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <InputGroup className="h-8 max-w-xs flex-1">
              <InputGroupAddon>
                <Search size={15} />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton onClick={() => setSearch('')} aria-label="Clear search">
                    <X size={13} />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <select aria-label="Filter by tag" className="h-8 max-w-48 rounded border bg-background px-2 text-sm" value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
              <option value="">All tags</option>
              {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>

            <div className="ms-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isLoading ? '' : `${filtered.length} document${filtered.length === 1 ? '' : 's'}`}
              </span>

            </div>
          </div>

          <div className="flex-1 p-4">
            {isLoading && <div className="flex flex-col gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>}

            {isEmpty && (
              <EmptyState
                icon={FileText}
                title={search ? 'No documents match your search' : 'No documents yet'}
                description={
                  search
                    ? 'Try a different search term or clear the filter.'
                    : 'Upload PDFs, images, or spreadsheets to keep them with your finances.'
                }
                action={
                  !search && (
                    <Button size="sm" onClick={() => setUploadOpen(true)}>
                      <FileText data-icon="inline-start" />
                      Upload your first document
                    </Button>
                  )
                }
              />
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {filtered.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onOpen={() => setPreviewDoc(doc)}
                    onEdit={() => setEditingDoc(doc)}
                    onDelete={() => handleDeleteDoc(doc)}
                    onCopy={paperlessConfigured ? () => void copyToPaperless(doc) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      )}
      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} defaultFolder={selectedFolder} />
      <DocumentEditDialog document={editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)} />
      <DocumentPreviewSheet
        document={previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        onEdit={(doc) => {
          setPreviewDoc(null)
          setEditingDoc(doc)
        }}
        onDelete={handleDeleteDoc}
      />
      {confirmDialog}
    </PageContainer>
  )
}

function FolderRailItem({
  label,
  count,
  active,
  onClick,
  onDelete,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={cn(
        'group/folder flex shrink-0 items-center gap-1 rounded-lg lg:w-full',
        active ? 'bg-primary/12' : 'hover:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors',
          active ? 'font-medium text-primary' : 'text-foreground',
        )}
      >
        <Folder size={15} className="shrink-0" />
        <span className="truncate">{label}</span>
        <Badge
          variant="outline"
          className={cn('ms-auto shrink-0', active && 'border-primary/30 bg-primary/10 text-primary')}
        >
          {count}
        </Badge>
      </button>
      {onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="me-1 shrink-0 opacity-0 group-hover/folder:opacity-100 focus-visible:opacity-100"
              aria-label={`Folder options for ${label}`}
            >
              <MoreVertical size={13} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function DocumentActionsMenu({ onEdit, onDelete, onCopy }: { onEdit: () => void; onDelete: () => void; onCopy?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon-xs"
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Document options"
        >
          <MoreVertical size={13} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>Edit details</DropdownMenuItem>
        {onCopy && <DropdownMenuItem onClick={onCopy}>Copy to Paperless-ngx</DropdownMenuItem>}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DocumentRow({
  doc,
  onOpen,
  onEdit,
  onDelete,
  onCopy,
}: {
  doc: DocumentItem
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onCopy?: () => void
}) {
  const meta = fileTypeMeta(doc.mime_type, doc.filename)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group/row flex cursor-pointer items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-xs transition-colors hover:bg-muted/50"
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', meta.className)}>
        <meta.icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
        {doc.folder && <p className="truncate text-xs text-muted-foreground">{doc.folder}</p>}
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatDate(doc.uploaded_at)}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(doc.size)}</span>
      <DocumentActionsMenu onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} />
    </div>
  )
}
