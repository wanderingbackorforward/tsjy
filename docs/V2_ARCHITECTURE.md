# V2 Architecture

V1 proved that the frontend, FastAPI backend, PostgreSQL database, field mapping, and ring linkage could run.

V2 upgrades the project into a platform-oriented structure.

## Backend layers

- api: HTTP route definitions only.
- schemas: Pydantic input/output contracts.
- services: business orchestration.
- repositories: SQL queries and database access.
- utils: mileage parsing, unit conversion, field normalization.
- core: config, database, CORS.

## Domain axis

The key domain axis is `ring_mileage_map`:

```text
section_id + ring_no -> mileage -> risk source -> monitoring point -> monitoring reading -> event
```

The frontend must not depend on original Excel/docx field names.
