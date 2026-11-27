# Secret Detection Test Fixtures

This directory contains positive and negative test fixtures for validating the
secret-detection patterns in `tests/validate.js`.

- `positive.env` — Intentionally contains secret-like patterns (GH_TOKEN, API_KEY,
  AWS keys, passwords, secrets, x-access-token). The validator's secret-detection
  logic should flag these patterns when scanning this file directly.
- `negative.env` — Contains no secret-like patterns. The validator should not flag
  any patterns when scanning this file directly.

These fixtures are used to verify that the secret-detection regex patterns work
correctly. They are excluded from the repository-wide secret scan in `validate.js`
because the positive fixture intentionally contains patterns that would otherwise
cause the main scan to fail.