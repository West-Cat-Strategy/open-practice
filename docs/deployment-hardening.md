# Deployment Hardening

- Require TLS for all browser, API, portal, and object-storage traffic.
- Configure OIDC with MFA for firm users and strong invitation flows for portal users.
- Keep S3 buckets private; serve files only through expiring signed URLs after server-side authorization.
- Run malware scanning before a document can be shared through the portal.
- Back up PostgreSQL and object storage together, and test restores.
- Store secrets outside git and outside container images.
- Keep audit exports in immutable or write-once storage where available.
- Separate production trust/funds operations from test data and demo data.
- Enable dependency, container, and license scanning in CI before deployment.
