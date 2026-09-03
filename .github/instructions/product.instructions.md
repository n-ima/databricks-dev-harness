---
applyTo: "apps/**,src/**,resources/**"
---

Read the relevant accepted requirement/design under docs/product and its active session. Follow docs/product/standards. Use AppKit UI before adding UI libraries; Lakebase for transactional CRUD and Delta for analytical writes. Do not connect live data before the UI mock gate. Bundle changes require strict validation with an explicit profile. Never hardcode secrets or workspace/resource identifiers.
