# Central file storage

Uploaded bytes are stored by the configured provider. PostgreSQL stores only
the `StoredFile` metadata and audit trail. Business modules must call the
storage service and must never use filesystem APIs directly.

## Production setup

Create storage directories outside the repository and deployment directories:

```text
/var/lib/cablix/storage
/var/lib/cablix/storage-temp
```

Set `STORAGE_DRIVER=local`, `STORAGE_LOCAL_ROOT`, `STORAGE_TEMP_ROOT`, and the
upload limits in the service environment. Make both directories owned by the
dedicated application service user/group with restrictive permissions (for
example `0750` directories). Do not use `0777` and do not expose either root
through Nginx.

Production recovery requires coordinated backups of both PostgreSQL and
`STORAGE_LOCAL_ROOT`. A database backup by itself cannot restore documents.

Pre-existing files under `backend/.local/uploads` were not moved or deleted.
If present, migrate them with a reviewed one-time script that uploads each file
through `StorageService`, verifies its checksum and metadata, and only then
archives the legacy copy.
