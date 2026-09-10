# Initialization reproducibility (HARD-08)

Status: candidate — independent verification and human adoption pending.

## Scope

HIMP-08 isolates offline setup tests from product state and checks AppKit output
roots before validation or fixture-only quarantine. This is not a template
release, migration, live CLI compatibility claim, or authorization to deploy.
`setup` continues to refuse product renaming and preserve existing settings.

## Acceptance contract

| ID | Observable requirement |
| --- | --- |
| INIT-01 | A versioned allowlist builds an uninitialized offline fixture from the harness code under test. Product config, root Bundle, product requirements, applications, local state and work history are not copied. Source bytes are unchanged. |
| INIT-02 | An independently initialized fixture passes same-name setup without changing product config, customized Bundle or installed baseline. Different-name setup fails without changing them. |
| INIT-03 | Fixture construction refuses existing destinations and source/destination symlinks or junctions; it never cleans, resets or renames an existing product. |
| ROOT-01 | AppKit apply refuses an existing or linked expected output before authentication/init. The expected root remains `apps/<name>` from the sealed plan. |
| ROOT-02 | After init, before quarantine or validate, require an actual directory and a regular, bounded, valid UTF-8 JSON-object package.json at the expected root. Reject links/special files in generated output. Record the inspected root. |
| ROOT-03 | Missing/nested-only/ambiguous/uninspectable output fails at output-inspection with an expected-root diagnosis. Preserve generated files; never move unknown directories, synthesize a missing root, or validate a guessed path. |
| ROOT-04 | Inspection is bounded and fails closed on limits. Bind the same root identity, package and configuration/fixture-only controls before and after validation; ordinary cache generation in the same root is permitted. Validation failure, init failure, mock quarantine and output locking retain their existing distinct behavior. |

Nested-only discovery is diagnostic, not automatic relocation or adoption.
Only inspect the expected subtree, not arbitrary repository or filesystem paths.
An expected root containing a package plus legitimate nested packages is allowed;
the sealed expected root remains authoritative. Limits must be documented and
tested. package.json establishes structure, not application quality or safety.

## Verification and tradeoffs

Use injected CLI fakes only, with no authentication, network, paid model or DB.
Prove the old copy/nested-output failure first; run setup, scaffold, distribution
and full regression tests; obtain a separate review. Both provider adapters use
the same deterministic entrypoint. Actual Claude Code/Copilot sessions and pinned
Databricks CLI output compatibility remain untested in this slice.

Keep test fixture inputs explicit rather than cloning and deleting product files.
This adds fixture maintenance when setup gains new mandatory inputs, but exposes
missing dependencies deterministically. Output inspection costs local filesystem
reads and can reject unusually large starters; it does not grant more authority.
Local path checks are not an OS sandbox against a concurrent hostile process.

## Fixed inputs and limits

`harness/fixtures/initialization/manifest.json` v1 selects harness code, canonical
skills, vendored skills/legal inputs, provider settings and product standards.
It supplies synthetic root/product READMEs and package files. It excludes the
source baseline and all non-allowlisted product/local paths. Missing required
inputs fail before destination creation. Source/destination overlap is refused.
The caller owns an existing temporary parent; no cleanup or product reset occurs
inside the builder. Input inventory is bounded to depth 20, 20,000 entries and
100 MiB. This is an offline setup fixture, not a distributable application template.

Generated output inspection is bounded to depth 12 below the component root,
20,000 entries, 1 MiB per package.json or root Bundle/fixture control file, and
128 MiB total file sizes. Directory iteration and content reads are bounded.
Only packages and the three named root control files are read; content is hashed,
not stored in the plan. Hard links are refused as well as symlinks/junctions.
Reserved mock marker/quarantine collisions stop before either is overwritten.
The recorded root uses exact bigint device/inode strings, not a pathname alone.
Root/package/control replacement requires re-planning; build caches and other
regular generated files may change within the same inspected root and limits.
Package/control filenames require their exact canonical case on every OS; case
aliases are rejected, never renamed. Fixture local-state/baseline exclusions are
case-insensitive so Windows aliases cannot reintroduce excluded inputs.
The three root control names, when present, must be regular files, never
directories. Initial mock marker/quarantine collisions retain the historical
`fixture-quarantine` diagnosis even when inspection rejects their directory type
before writes. A control directory added by validate fails at `output-reinspection`.

Recovery: inspect the failed plan's `failureStage`, `outputInspection.expectedRoot`
and `candidateRoots`; these are observations, not adoption decisions. Preserve the
generated directory for diagnosis. For nested/unknown output, investigate the
pinned generator version and create a newly reviewed plan with an unused name.
Do not delete product.config.json, rerun setup with a new product name, move
unknown directories recursively, or bypass validation. Fresh fixture tests run
with `node --test tests/initialization.test.mjs tests/harness.test.mjs`; no CLI
profile or authentication is supplied to the offline setup.

Related: [retrospective validation](../../../work/reviews/2026-09-10-sales-retrospective-validation.md),
[hardening plan](../../../work/plans/2026-09-10-retrospective-hardening.md).
