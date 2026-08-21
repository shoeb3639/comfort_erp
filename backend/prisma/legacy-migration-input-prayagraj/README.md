# Comfort Cars Prayagraj legacy migration input

Place the approved MySQL CSV exports in this directory. CSV files are ignored
by Git because they contain tenant data.

The vendor importer expects `vendor.csv` with this exact header:

```csv
id,vendor_id,name,mobile_no,city,address,joined_on,total_vehicles,priority
```

Run the vendor dry run from `backend`:

```sh
npm run vendors:migrate:old -- --tenant-id 1bf92e04-a9a5-445d-bad5-e889604feb05
```

The command performs a read-only database preflight and writes review reports
to `prisma/vendor-migration-output-prayagraj/`. It does not import records
unless the separate `--apply`, tenant confirmation, and source hash confirmation
arguments are supplied.
