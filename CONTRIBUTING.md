# Contributing to aegisQS

Welcome to aegisQS development and engineering team!
Welcome to the aegisQS engineering team. This guide defines how we use Git and GitHub to build, review, and ship aegisQS, the platform Quantity Surveyors rely on for cost estimation, Bills of Quantities (BOQ), workbook, and measurement.

## Table of Contents

1. [Branching Strategy](#1-branching-strategy)
2. [Commit Message Rules](#2-commit-message-rules)
3. [Pull Requests & Code Review](#3-pull-requests--code-review)
4. [Tagging & Release Rules](#4-tagging--release-rules)

---

## 1. Branching Strategy

aegisQS uses a **simplified Git Flow** model. We keep a stable `main` for production and an integration branch `develop` for the next release, with short-lived supporting branches for all work.

### 1.1 Long-Lived Branches

| Branch    | Purpose                                                    | Deploys to | Direct pushes |
| --------- | ---------------------------------------------------------- | ---------- | ------------- |
| `main`    | Production-ready code. Every commit is a released version. | Production | Never         |
| `develop` | Integration branch for the next release.                   | Staging    | Never         |

### 1.2 Short-Lived Branches

| Prefix     | Branches from | Merges into              | Use for                                                       |
| ---------- | ------------- | ------------------------ | ------------------------------------------------------------- |
| `feature/` | `develop`     | `develop`                | New functionality or enhancements                             |
| `bugfix/`  | `develop`     | `develop`                | Non-urgent defects found before release                       |
| `release/` | `develop`     | `main` **and** `develop` | Stabilising a release (version bump, final fixes only)        |
| `hotfix/`  | `main`        | `main` **and** `develop` | Urgent production defects                                     |
| `chore/`   | `develop`     | `develop`                | Tooling, dependencies, CI, refactors with no behaviour change |
| `docs/`    | `develop`     | `develop`                | Documentation-only changes                                    |


### 1.3 Branch Naming Convention

```
<type>/<short-kebab-case-description>
```

**Rules:**

- Start with one of the approved types: `feature/`, `bugfix/`, `release/`, `hotfix/`, `chore/`, `docs/`.
- Use lowercase and hyphens only. No spaces, underscores, or camelCase.
- Keep the description under or around 50 characters, and make it specific enough that a teammate understands the change from the branch name alone.
- `release/` branches use the version number instead of a description (e.g. `release/v1.4.0`).

**Examples:**

```bash
feature/boq-revision-comparison
feature/nrm2-measurement-templates
bugfix/rate-buildup-rounding-error
bugfix/excel-export-merged-cells
chore/upgrade-pdf-renderer
docs/api-auth-guide
release/v1.4.0
hotfix/workbook-sum-incorrect-vat
```

**Bad examples:**

```bash
my-branch                     # no type
feature/fixStuff              # camelCase, vague
Feature/BOQ_Compare           # uppercase prefix, underscores
feature/fix                   # too vague to be useful
```

## 2. Commit Message Rules

We follow the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) specification. This lets us generate changelogs automatically and determine version bumps from history.

### 2.1 Format

```text
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Subject line rules:**

- Use the imperative mood: "add", "fix", "remove" (not "added", "fixes").
- Lowercase first letter, no trailing full stop.
- Maximum 72 characters.
- Describe _what_ changed from the user's or system's perspective.
  **Body rules:**

- Wrap at 72 characters.
- Explain _why_ the change was needed and any trade-offs.
- For calculation changes, state the old and new behaviour explicitly.
  **Footer rules:**

- Reference tickets: `Refs: AQS-214` or `Closes: AQS-214`.
- Declare breaking changes: `BREAKING CHANGE: <description>`.

### 2.2 Allowed Types

| Type       | When to use                                        | SemVer impact |
| ---------- | -------------------------------------------------- | ------------- |
| `feat`     | A new feature visible to users or API consumers    | MINOR         |
| `fix`      | A bug fix                                          | PATCH         |
| `perf`     | A performance improvement with no behaviour change | PATCH         |
| `refactor` | Code restructuring with no behaviour change        | None          |
| `test`     | Adding or correcting tests                         | None          |
| `docs`     | Documentation only                                 | None          |
| `build`    | Build system or dependency changes                 | None          |
| `ci`       | CI/CD pipeline changes                             | None          |
| `chore`    | Maintenance tasks that don't fit elsewhere         | None          |
| `revert`   | Reverting a previous commit                        | Depends       |

Append `!` after the type/scope (e.g. `feat(api)!:`) or add a `BREAKING CHANGE:` footer for breaking changes. This triggers a MAJOR bump.

### 2.4 Examples for aegisQS

**Features:**

```text
feat(boq): add side-by-side comparison of BOQ revisions

Allows QSs to select two BOQ revisions and view added, removed and
changed items with quantity and rate deltas highlighted.
```

```text
feat(measure): support NRM2 work section templates for take-off
```

```text
feat(workbook): rank workbook returns by adjusted total with arithmetic checks

Checks files where extended totals do not equal quantity x rate,
so adjudication catches contractor arithmetic errors automatically.
```

```text
feat(export): export cost plan to PDF with elemental summary page
```

**Fixes:**

```text
fix(rates): round rate build-up totals using banker's rounding

Previously each resource line was rounded half-up to 2 d.p. before
summing, causing cumulative drift of up to 0.05 per item on large
build-ups. Lines are now summed at full precision and the final
rate is rounded once using the project's configured rounding mode.

Old: 12.345 + 7.655 -> 12.35 + 7.66 = 20.01
New: 12.345 + 7.655 = 20.000 -> 20.00
```

```text
fix(export): preserve merged header cells in Excel BOQ export
```

```text
fix(currency): apply VAT to workbook sum after discounts, not before
```

```text
fix(measure): convert m² to ft² using exact factor 10.7639104
```

**Breaking change:**

```text
feat(api)!: return monetary values as decimal strings instead of floats

Floating-point amounts in API responses caused precision loss in
client integrations for values above 1e9.

BREAKING CHANGE: all monetary fields in /api/v2/estimates and
/api/v2/boq now return strings (e.g. "1250000.00"). Clients must
parse them as decimals. v1 endpoints are unchanged until deprecation.
```

**Other types:**

```text
perf(boq): lazy-load BOQ sections over 5,000 items
refactor(estimate): extract elemental cost summary into service
test(rates): add regression fixtures for composite rate build-ups
build(deps): upgrade exceljs to 4.4.0
ci: add calculation regression suite to PR checks
docs(standards): document NRM1 element code mapping
revert: feat(workbook): rank workbook returns by adjusted total
```

**Bad examples:**

```text
fixed bug                          # no type, no scope, vague
feat: Updated the BOQ stuff.       # past tense, capitalised, vague, full stop
fix(boq): fix                      # meaningless subject
WIP                                # never push WIP commits to shared branches
```
## 3. Pull Requests & Code Review

### 3.1 Before Opening a PR

- [ ] Your branch is rebased on the latest target branch.
- [ ] All tests pass locally, including the calculation regression suite.
- [ ] You have added or updated tests for your change.
- [ ] You have self-reviewed the diff on GitHub.
- [ ] No secrets, client data, or real project files are committed.

### 3.2 PR Title

The PR title **must** follow the commit format, because it becomes the squash-commit message:

```text
feat(boq): add side-by-side comparison of BOQ revisions
```

Open a **Draft PR** early if you want feedback before the work is complete.

### 3.3 Merge Strategy

| Source → Target                 | Strategy           | Reason                                           |
| ------------------------------- | ------------------ | ------------------------------------------------ |
| `feature/*` → `develop`         | **Squash & merge** | One clean conventional commit per change         |
| `bugfix/*` → `develop`          | **Squash & merge** | Same as above                                    |
| `chore/*`, `docs/*` → `develop` | **Squash & merge** | Same as above                                    |
| `release/*` → `main`            | **Merge commit**   | Preserves the release history as a unit          |
| `hotfix/*` → `main`             | **Merge commit**   | Preserves traceability of the emergency fix      |
| `main` → `develop` (back-merge) | **Merge commit**   | Keeps branches in sync without rewriting history |

Delete the source branch after merging (enable **Automatically delete head branches** in repo settings).

## 4. Tagging & Release Rules

### 4.1 Semantic Versioning

aegisQS follows [Semantic Versioning 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Part      | Increment when…                                                                                                                                                                  | Example             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **MAJOR** | Breaking changes: API contract changes, incompatible data/file formats, removed features, or **changes to calculation output for existing data** that users must be warned about | `v1.9.3` → `v2.0.0` |
| **MINOR** | New backwards-compatible functionality                                                                                                                                           | `v1.4.2` → `v1.5.0` |
| **PATCH** | Backwards-compatible bug fixes and performance improvements                                                                                                                      | `v1.5.0` → `v1.5.1` |

**Rules:**

- Always prefix with lowercase `v`.
- Use **annotated, signed** tags only. Lightweight tags are not allowed.
- Production tags (`vX.Y.Z` with no suffix) are created **only on `main`**.
- Pre-release tags are created on `release/*` branches.
- Tags are immutable. Never delete or move a published tag; release a new version instead.

If you have any questions or suggestions, please contact the repository maintainer. This process belongs to the whole team and should evolve as we do.

Thanks! Happy Coding!!!
