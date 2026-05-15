# Shield Monitor Platform V2

V2 is a structured rebuild of the shield tunnel monitoring demo.

Core idea:

```text
Unstandardized Excel/docx/PDF sources
  -> raw import layer
  -> field mapping and validation layer
  -> standard PostgreSQL/PostGIS domain layer
  -> stable FastAPI v2 contracts
  -> readable React monitoring console
```

This version intentionally separates backend API, service, repository, schema, and utility layers.

Default runtime ports:

- Backend: 8100
- Frontend: 5180

Default database:

- postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor
