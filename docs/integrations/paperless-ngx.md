# Paperless-ngx integration

Status: integration implemented on `feature/paperless-ngx-integration`; release pending. The scope below includes planned capabilities and is not a checklist of shipped features.

## Currently available
- Optional connection to an external Paperless-ngx server through FinWorkspace settings.
- Paperless document list, search, tag and storage-path filters, preview, upload, download and metadata editing.
- Local Documents remains available separately, with its own folder and tag filters.
- Copy documents between local storage and Paperless-ngx, including OCR text handling.
- Responsive document lists and search controls for mobile screens.

The integration has been manually checked, including mobile use. Automated CI and Docker release builds still need verification before release.

## Architecture
- Optional external Paperless-ngx instance, including Home Assistant add-on; no embedded Paperless container.
- FinWorkspace backend is the sole API proxy; never expose Paperless API tokens to browsers.
- Preserve existing local Documents storage and its API. Switching providers must not delete or migrate files implicitly.
- Per-user connection credentials encrypted at rest; enforce strict tenant isolation, URL validation, SSRF protections and permissions.
- Paperless remains authoritative for its document metadata and binaries; FinWorkspace stores only links to transactions and other finance entities.

## Scope
1. Connection configuration, test and capability discovery.
2. List, search, preview, download, upload and OCR processing status.
3. Upload metadata: title, created date, correspondent, document type, tags, storage path, archive serial number and custom fields.
4. CRUD for tags, correspondents, document types, storage paths and custom fields, including create-from-upload form.
5. Edit existing document metadata, bulk operations and supported permissions/workflows.
6. Link documents to FinWorkspace transactions, accounts, recurring payments and expenses.
7. Support multiple users and servers with isolation.

## API
- `/api/documents/`, `/api/documents/post_document/`, `/api/tasks/`
- `/api/tags/`, `/api/document_types/`, `/api/correspondents/`, `/api/storage_paths/`, `/api/custom_fields/`
- Verify request and response schemas against the installed Paperless-ngx version before implementing each operation.
- Upload is asynchronous; show processing state and reconcile the resulting document ID.
- Preserve Paperless authorization; never use a shared administrator token for untrusted multi-user access.

## Delivery
- Backend API client, encrypted per-user connection settings, contract tests.
- Backend proxy routes, integration tests and error handling.
- React Documents provider selection and connection settings.
- Full document UI, metadata CRUD and localization.
- Finance links, end-to-end tests and release notes.

## Acceptance criteria
- No Paperless configured: existing Documents behavior unchanged.
- Connected: upload with metadata, create a tag/type/correspondent in FinWorkspace, search OCR text, edit attributes and view the same result in Paperless.
- Token cannot be read by frontend users; user A cannot access user B's connection or documents.
- Failed OCR, unavailable server and invalid credentials are recoverable without losing local documents.
