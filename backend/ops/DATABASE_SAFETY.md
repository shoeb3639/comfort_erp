# Cablix database safety

## Active protections

- The application uses the restricted `cablix_app` PostgreSQL role.
- The API runtime `.env` contains only the restricted `DATABASE_URL`; database
  administration credentials are not loaded into the API process.
- Database operations load owner-only credentials from
  `.local/secrets/database-operations.env` (or `DATABASE_OPERATIONS_ENV`).
- Prisma CLI migrations use `MIGRATION_DATABASE_URL` from that operations file.
- Jest always replaces `DATABASE_URL` with `TEST_DATABASE_URL` and refuses any
  database name other than `cablix_erp_test`.
- Runtime configuration refuses `cablix_erp_test` outside test mode and refuses
  any non-test database while running in test mode.
- `com.cablix.erp.database-backup` runs at 02:00 daily and on agent load.
- Each backup is a PostgreSQL custom archive, validated by listing its contents
  with `pg_restore --list`, accompanied by SHA-256 metadata, and restricted to
  the file owner.
- The latest 30 backups are retained in both locations:
  - `backend/.local/backups`
  - `/Users/syedshoeb/CablixDatabaseBackups`

## Manual operations

Create and validate a backup:

```sh
npm run db:backup
```

On a new installation, copy `ops/database-operations.env.example` to
`.local/secrets/database-operations.env`, replace every placeholder, and set
the directory to `0700` and file to `0600`. Existing installations can migrate
legacy operational URLs out of `.env` with:

```sh
npm run db:separate-credentials
```

Perform a full restore drill in a temporary database (the temporary database is
removed after verification):

```sh
npm run db:backup:verify -- /absolute/path/to/backup.dump
```

Check the scheduled service:

```sh
launchctl print gui/501/com.cablix.erp.database-backup
```

Backup logs are stored at:

- `backend/.local/logs/database-backup.log`
- `backend/.local/logs/database-backup-error.log`

## Recovery rule

Never restore directly over `cablix_erp`. Restore into a temporary database,
verify tenant and record counts, then perform a controlled switchover after a
fresh backup of the live database.

## Remaining infrastructure recommendation

Both configured backup locations are on this Mac. They protect against
accidental database or workspace deletion, but not total disk loss. Configure
an encrypted external disk or approved cloud destination as a third copy for
machine-level disaster recovery.
