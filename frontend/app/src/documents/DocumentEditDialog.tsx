import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Dialog } from '../ui/Dialog'
import { FolderPicker } from './FolderPicker'
import { LocalMetadataFields, type LocalMetadata } from './LocalMetadataFields'
import { useDocumentFolders, useUpdateDocument } from './useDocuments'
import type { DocumentItem } from './documentsApi'

interface DocumentEditDialogProps {
  document: DocumentItem | null
  onOpenChange: (open: boolean) => void
}

export function DocumentEditDialog(props: DocumentEditDialogProps) {
  return props.document ? <DocumentEditDialogContent key={props.document.id} {...props} /> : null
}

function DocumentEditDialogContent({ document, onOpenChange }: DocumentEditDialogProps) {
  const { data: foldersData } = useDocumentFolders()
  const updateDocument = useUpdateDocument()

  const [title, setTitle] = useState(document?.title ?? '')
  const [description, setDescription] = useState('')
  const [metadata, setMetadata] = useState<LocalMetadata>(document?.paperless_metadata ?? {})
  const [folder, setFolder] = useState('')
  const [content, setContent] = useState('')
  const [tab, setTab] = useState<'details' | 'content'>('details')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!document || !title.trim()) return
    try {
      await updateDocument.mutateAsync({
        id: document.id,
        input: { title: title.trim(), description: description.trim(), folder, paperless_metadata: metadata, content },
      })
      toast.success('Document updated')
      onOpenChange(false)
    } catch {
      toast.error('Failed to update document')
    }
  }

  const formId = 'document-edit-form'

  return (
    <Dialog
      open={!!document}
      title="Edit document"
      icon={PencilEdit02Icon}
      onOpenChange={onOpenChange}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!title.trim() || updateDocument.isPending}>
            {updateDocument.isPending && <Spinner data-icon="inline-start" />}
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        <div className="mb-3 flex gap-2" role="tablist" aria-label="Document editor tabs">
          <Button type="button" variant={tab === 'details' ? 'default' : 'outline'} onClick={() => setTab('details')}>Properties</Button>
          <Button type="button" variant={tab === 'content' ? 'default' : 'outline'} onClick={() => setTab('content')}>Content (OCR)</Button>
        </div>
        {tab === 'details' ? <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-doc-title">Title</FieldLabel>
            <Input id="edit-doc-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-doc-description">Description</FieldLabel>
            <Textarea
              id="edit-doc-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-doc-folder">Folder</FieldLabel>
            <FolderPicker value={folder} onChange={setFolder} folders={foldersData?.folders ?? []} />
          </Field>
          <LocalMetadataFields value={metadata} onChange={setMetadata} />
        </FieldGroup> : <label className="block text-sm">Recognized text
          <Textarea className="mt-2 min-h-72 font-mono text-sm" value={content} onChange={(event) => setContent(event.target.value)} placeholder="No recognized text yet" />
        </label>}
      </form>
    </Dialog>
  )
}
