# Project Audit Report

**Project:** CACV Bulletin Automation | **Date:** 2026-03-06 | **Scope:** Full audit

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Agents run | 8 (Architecture, Security, Code Quality, Completeness, DevOps, Performance, Documentation, UX) |
| Agents skipped | 2 (API Design — no API server, Data & State — no database) |
| Health score | **C** |

### Findings by Severity

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 1 | 7 | 25 | 18 | 2 |

### Top 3 Priorities

1. **Fix command injection in `protectPdf()`** — shell string interpolation of password/path allows arbitrary command execution (Critical, quick fix)
2. **Parallelize PDF downloads & QR generation** — sequential awaits in loops add 200–500ms per item unnecessarily (High, quick fix)
3. **Add fetch timeouts to all external API calls** — Google Sheets, Drive, and WordPress calls can hang indefinitely (High, moderate effort)

---

## Critical & High Priority Findings

### CRITICAL: Command Injection in PDF Password Protection
- **File:** `src/pdf.js:211-225`
- **Agent:** Security
- **Description:** `protectPdf()` interpolates `password` and `pdfPath` directly into a shell command string via template literals. A crafted password (e.g., containing `"; rm -rf /; "`) from the Google Sheet "PDF Password" setting or `PDF_PASSWORD` env var can execute arbitrary commands.
- **Recommendation:** Use `execFileSync('qpdf', ['--encrypt', password, password, '256', '--', pdfPath, tmpPath])` instead of `execSync()` with a shell string. This avoids shell interpretation entirely.

---

### HIGH: Sequential PDF Attachment Downloads
- **File:** `src/index.js:126-136`
- **Agent:** Performance
- **Description:** PDF attachments are downloaded one-at-a-time in a `for` loop with `await`. With 3+ attachments, each download blocks the next.
- **Recommendation:** Use `Promise.all()` to download all attachments concurrently.

### HIGH: Sequential QR Code Generation
- **File:** `src/index.js:98-103`
- **Agent:** Performance
- **Description:** QR codes for up to 12 announcements are generated sequentially in a `for` loop.
- **Recommendation:** Batch with `Promise.all()` for parallel generation.

### HIGH: Synchronous File I/O in cleanOldOutputs()
- **File:** `src/index.js:24-33`
- **Agent:** Performance
- **Description:** `readdirSync()`, `statSync()`, and `unlinkSync()` block the event loop on every run.
- **Recommendation:** Convert to `fs.promises` async equivalents.

### HIGH: Duplicate/Lazy require() Patterns
- **File:** `src/index.js:125`, `src/notify.js:109`
- **Agents:** Architecture, Code Quality
- **Description:** `downloadFromDrive` is re-required from `./pdf` inside a conditional block (already imported at line 11). `fs` is required inside `notifySuccess()` instead of at module top. Both hide dependencies and break consistency.
- **Recommendation:** Move all `require()` calls to module top-level.

### HIGH: No Tests or Linting in CI Pipeline
- **File:** `.github/workflows/generate-bulletin.yml`, `package.json`
- **Agents:** DevOps, Completeness
- **Description:** CI pipeline has no automated testing, linting, or code quality checks. Only one test file exists (`test-translate.js`) with no test runner configured. No `test` or `lint` npm scripts.
- **Recommendation:** Add ESLint + a test framework (Jest/Mocha). Add `npm test` and `npm run lint` steps to CI before deployment.

### HIGH: Incomplete Developer Setup Documentation
- **File:** `README.md`
- **Agent:** Documentation
- **Description:** README lacks step-by-step setup instructions. A new developer cannot clone and run the project from docs alone — prerequisites (Node version, Chrome path), credential setup, and local run steps are scattered or missing.
- **Recommendation:** Add a "Getting Started" section with: prerequisites, clone, install, .env setup, and `npm start`.

### HIGH: Missing Deployment Runbook
- **File:** `docs/MAINTENANCE.md`
- **Agent:** Documentation
- **Description:** No documentation for full environment setup: GitHub Secrets provisioning, Google Cloud service account setup, WordPress bot user creation, or credential rotation procedures.
- **Recommendation:** Add a "Deployment" section covering all credential sources and setup steps.

---

## Architecture

### HIGH: Duplicate/Lazy require() Patterns
*(See Critical & High section above)*

### MEDIUM: Singleton Module State Without Documentation
- **File:** `src/translate.js:5-9`, `src/notify.js:5-17`
- **Description:** Both modules maintain module-level singleton state (`client`, `transporter`) that persists across calls. Acceptable for single-run scripts but undocumented.
- **Recommendation:** Add comments documenting the caching intent.

### MEDIUM: Configuration Scattered Across Files
- **File:** `src/index.js:19`, `src/template.js:8`, `src/print-template.js:5`
- **Description:** `LIVE_URL`, `BUILD_VERSION`, and other env-based constants are defined with identical fallback patterns in multiple files.
- **Recommendation:** Create a centralized `src/config.js` module exporting all env-based constants.

### LOW: Magic Configuration Values
- **File:** `src/google-auth.js:34`
- **Description:** JWT expiry hardcoded to 3600 seconds without explanation.
- **Recommendation:** Extract to named constant: `const JWT_EXPIRY_SECONDS = 3600;`

---

## Security

### CRITICAL: Command Injection in protectPdf()
*(See Critical & High section above)*

### MEDIUM: Path Traversal in PDF Download
- **File:** `src/pdf.js:182-184`
- **Description:** `downloadFromDrive()` accepts a `destPath` without validating it's within the output directory. A malicious "PDF Attachment URL" in the sheet could write files outside `output/`.
- **Recommendation:** Validate `path.resolve(destPath).startsWith(path.resolve(outputDir))`.

### MEDIUM: Missing HTTPS Enforcement on Direct Downloads
- **File:** `src/pdf.js:164-169`
- **Description:** `downloadFile()` uses `fetch()` without verifying HTTPS protocol, unlike `downloadFromDrive()` which does check.
- **Recommendation:** Add `if (new URL(url).protocol !== 'https:') throw new Error('Downloads must use HTTPS')`.

### MEDIUM: ReDoS Risk in URL Regex
- **File:** `src/validate.js:76`, `src/utils.js:96`
- **Description:** URL regex patterns could be vulnerable to catastrophic backtracking with crafted input strings.
- **Recommendation:** Use simpler non-backtracking patterns or limit input string length.

### MEDIUM: Unvalidated Email Recipients
- **File:** `src/sheets.js:240`
- **Description:** Email addresses from "Notification Emails" sheet setting are split and trimmed but not validated for format before passing to nodemailer.
- **Recommendation:** Filter with a basic email regex before use.

### MEDIUM: Unvalidated Google Drive File IDs
- **File:** `src/pdf.js:174-177`
- **Description:** `getDriveId()` regex `/[-\w]{25,}/` is overly broad and accepts any 25+ char alphanumeric string.
- **Recommendation:** Use stricter regex matching actual Drive ID format.

### LOW: Information Disclosure in Error Messages
- **File:** `src/sheets.js:28`
- **Description:** API error messages may contain service account metadata and are forwarded in notification emails.
- **Recommendation:** Sanitize error messages before external exposure.

### INFO: Hardcoded Church Contact Details
- **File:** `src/template.js:1040-1051`, `src/print-template.js:29-35`
- **Description:** Pastor contact info and church details are hardcoded with defaults. Public information but could be data-driven.

---

## Code Quality

### HIGH: Duplicate PDF Generation Error Handling
- **File:** `src/index.js:128-160`
- **Description:** Two near-identical 20-line try-catch blocks for print vs booklet PDF generation.
- **Recommendation:** Extract `async function generateAndProtectPdf(name, htmlBuilder, opts)` helper.

### HIGH: Duplicate Date Parsing Logic
- **File:** `src/sheets.js:75-87`, `src/utils.js:240-261`, `src/validate.js:57-61`
- **Description:** `parseServiceDate` exists in both sheets.js and utils.js. `sheetsSerialToDate` and `dateToKey` contain overlapping date conversion logic.
- **Recommendation:** Consolidate all date parsing into utils.js.

### MEDIUM: Magic Numbers Without Named Constants
- **File:** `src/sheets.js:145-175`
- **Description:** `.slice(4)` appears 4+ times (header row skip) and `.slice(0, 12)` (announcement limit) with no explanation.
- **Recommendation:** Define `const SHEET_HEADER_ROWS = 4` and `const MAX_ANNOUNCEMENTS = 12`.

### MEDIUM: Global Regex State Bug Risk
- **File:** `src/utils.js:95-127`
- **Description:** `autoLink()` uses a global regex (`/g`) with `.exec()` in a while-loop. The `/g` flag maintains stateful iteration that could cause skipped matches in edge cases.
- **Recommendation:** Use `String.matchAll()` instead.

### MEDIUM: Long main() Function
- **File:** `src/index.js:36-246`
- **Description:** 210-line function handling 8+ responsibilities.
- **Recommendation:** Extract phases into named functions: `fetchAndTranslate()`, `generateOutputs()`, `publishResults()`.

### MEDIUM: Missing Null Checks in Template Rendering
- **File:** `src/template.js:45`
- **Description:** `buildRoster()` assumes roster items have all expected properties without defensive checks.
- **Recommendation:** Add null guards or validate roster shape in sheets.js.

### LOW: Redundant isPrint Check
- **File:** `src/utils.js:170-178`
- **Description:** Inside an `if (isPrint)` block, `isPrint && a.qrSvg` checks `isPrint` redundantly.
- **Recommendation:** Simplify to `a.qrSvg ? ...`.

### LOW: No JSDoc on Public API Functions
- **File:** Multiple files
- **Description:** Exported functions (`fetchBulletinData`, `generatePdf`, `translateData`, `buildBulletin`) lack JSDoc type annotations.
- **Recommendation:** Add `@param`, `@returns`, `@throws` to all exports.

### LOW: Duplicate URL Regex Patterns
- **File:** `src/validate.js:76`, `src/utils.js:82`
- **Description:** Two nearly identical URL regex patterns in separate files.
- **Recommendation:** Extract to a shared constant in utils.js.

---

## Completeness

### MEDIUM: No Timeout on File Downloads
- **File:** `src/pdf.js:164-169, 182-200`
- **Description:** `downloadFile()` and `downloadFromDrive()` use `fetch()` without timeout or AbortController. Large files or slow networks hang indefinitely. No Content-Length bounds checking either.
- **Recommendation:** Add `AbortSignal.timeout(30000)` to all fetch calls. Reject files >100MB.

### MEDIUM: Silent QR Code Failures
- **File:** `src/index.js:101`
- **Description:** Per-announcement QR codes use `.catch(() => null)` which silently suppresses all errors. No distinction between "no URL found" and "QR generation failed."
- **Recommendation:** Log QR failures separately for debugging.

### MEDIUM: PDF Password Not Validated
- **File:** `src/index.js:149, 176`
- **Description:** Empty or whitespace-only passwords are accepted and create PDFs with useless password protection.
- **Recommendation:** Validate password is non-empty after trimming before calling `protectPdf()`.

### LOW: Minimal Test Coverage
- **File:** `src/test-translate.js` (only test file)
- **Description:** Only translation is tested. No tests for sheet parsing, PDF generation, email formatting, URL validation, or date handling edge cases.
- **Recommendation:** Create `tests/` directory with unit tests for each module using Jest.

### LOW: Missing Troubleshooting Guide
- **File:** No dedicated file
- **Description:** When the pipeline fails, users must check "Last Run Errors" in the sheet with no guide for common failures.
- **Recommendation:** Create `docs/TROUBLESHOOTING.md` with common errors and resolutions.

---

## DevOps & Configuration

### MEDIUM: No Node Version Specification
- **File:** `package.json`
- **Description:** No `engines` field. CI uses Node 20 but local developers may use any version.
- **Recommendation:** Add `"engines": { "node": ">=20.0.0" }` and create `.nvmrc`.

### MEDIUM: No Dependency Security Scanning
- **File:** `package.json`, CI workflows
- **Description:** No `npm audit` in CI, no Dependabot config. Dependencies use caret (^) ranges without update strategy.
- **Recommendation:** Add `npm audit` to CI and configure `.github/dependabot.yml`.

### MEDIUM: Apps Script Workflow Missing npm Cache
- **File:** `.github/workflows/deploy-apps-script.yml:19-21`
- **Description:** setup-node action doesn't configure npm cache, wasting CI resources.
- **Recommendation:** Add `cache: 'npm'` to setup-node config.

### LOW: .gitignore Could Be More Comprehensive
- **File:** `.gitignore`
- **Description:** Missing common IDE files (`.vscode/`, `.idea/`), OS files (`Thumbs.db`), and log files.
- **Recommendation:** Extend with standard Node.gitignore entries.

### LOW: Credentials Path Uses Relative Path
- **File:** `.env.example`, `src/sheets.js`
- **Description:** `CREDENTIALS_PATH` defaults to `./credentials/service-account.json` — fragile if working directory changes.
- **Recommendation:** Use `path.resolve(__dirname, ...)` in code.

---

## Performance

### MEDIUM: No Timeouts on Google Sheets/Auth API Calls
- **File:** `src/sheets.js:23, 40, 289`
- **Description:** All `fetch()` calls to Google APIs lack timeouts. If Google's API hangs, the entire pipeline blocks indefinitely.
- **Recommendation:** Add `signal: AbortSignal.timeout(15000)` to all fetch calls.

### MEDIUM: Regex Recompilation in Hot Loops
- **File:** `src/utils.js:247-248`
- **Description:** `parseServiceDate()` rebuilds the months lookup object and regex patterns on every call. Called for every roster entry and event.
- **Recommendation:** Hoist `MONTHS`, `ORDINAL_RE`, and `DATE_SPLIT_RE` to module-level constants.

### MEDIUM: Template File Size (39KB Inline CSS)
- **File:** `src/template.js`
- **Description:** 1,156 lines with all CSS inline. No minification or external stylesheet extraction.
- **Recommendation:** Consider extracting CSS to cacheable external stylesheet for GitHub Pages deployment.

### LOW: Unbounded Token Cache
- **File:** `src/google-auth.js:8`
- **Description:** `tokenCache` Map never clears old entries. Not a practical issue for single-run scripts but poor hygiene.
- **Recommendation:** Add size limit or TTL cleanup.

---

## Documentation

### MEDIUM: Environment Variables Insufficiently Documented
- **File:** `.env.example`
- **Description:** Lists variables but doesn't explain where to obtain each secret, whether required or optional, or expected format.
- **Recommendation:** Add inline comments explaining each variable's source and format.

### MEDIUM: Missing Workflow Execution Flow Diagram
- **File:** `docs/TECHNICAL_SPEC.md`
- **Description:** Architecture is described but the end-to-end flow (Apps Script button → GitHub Actions → Node.js pipeline → outputs) is not documented step-by-step.
- **Recommendation:** Add a "Process Flow" section with numbered steps and typical execution times.

### MEDIUM: Missing Credential Lifecycle Documentation
- **File:** `docs/MAINTENANCE.md`
- **Description:** Credential rotation is mentioned but expiration policies, monitoring, and failure symptoms are not documented.
- **Recommendation:** Add a credential lifecycle table.

### MEDIUM: No CHANGELOG
- **File:** (does not exist)
- **Description:** No record of changes between versions despite `BUILD_VERSION` in templates.
- **Recommendation:** Create `CHANGELOG.md` with semantic versioning.

### LOW: Admin Guide Missing Troubleshooting
- **File:** `docs/ADMIN_GUIDE.md`
- **Description:** Covers normal operation but not common admin errors (wrong date format, missing fields, etc.).
- **Recommendation:** Add a troubleshooting section with common errors and fixes.

### LOW: Theme Customization Undocumented for Admins
- **File:** `docs/ADMIN_GUIDE.md`
- **Description:** Theme cells (HOPE acronym) can be customized in the sheet but this isn't documented.
- **Recommendation:** Document theme cell format and location.

---

## UX

### MEDIUM: Sticky Nav Scroll Offset Hardcoded
- **File:** `src/template.js:1144-1145`
- **Description:** Smooth scroll applies a fixed 56px offset for nav height. Actual nav height varies by device.
- **Recommendation:** Calculate dynamically: `document.querySelector('.sticky-nav')?.offsetHeight ?? 56`.

### MEDIUM: Only Two Responsive Breakpoints
- **File:** `src/template.js:764-779`
- **Description:** Media queries at 620px and 520px only. No tablet breakpoint (768px–1024px) — layout stretches awkwardly on iPads.
- **Recommendation:** Add intermediate breakpoint at 768px.

### MEDIUM: IntersectionObserver Margin Too Aggressive
- **File:** `src/template.js:1131`
- **Description:** `rootMargin: '-20% 0px -60% 0px'` means only a 20% viewport zone triggers section highlighting. Nav highlighting lags behind actual scroll position.
- **Recommendation:** Adjust to `-10% 0px -50% 0px` for more responsive highlighting.

### LOW: Missing Keyboard Focus Indicators
- **File:** `src/template.js:812-846`
- **Description:** Navigation buttons, announcement cards, and table rows lack `:focus-visible` CSS styles.
- **Recommendation:** Add `.nav-btn:focus-visible { outline: 2px solid var(--slate); outline-offset: 2px; }`.

### LOW: Insufficient Color Contrast in Footer
- **File:** `src/template.js:644, 680, 727-759`
- **Description:** Footer text uses `rgba(255,255,255,0.25-0.45)` on dark backgrounds — fails WCAG AA (needs 4.5:1, some are as low as 1.5:1).
- **Recommendation:** Increase opacity to 0.7+ for all footer text.

### LOW: Small Touch Targets on Mobile Nav
- **File:** `src/template.js:812-829`
- **Description:** Nav buttons render ~28×22px on mobile, below the 44×44px WCAG guideline.
- **Recommendation:** Add mobile media query increasing padding to meet 44px minimum.

### LOW: QR Codes Lack Alt Text
- **File:** `src/utils.js:174`, `src/print-template.js`
- **Description:** QR code SVGs have no `<title>`, `aria-label`, or figcaption for screen readers.
- **Recommendation:** Wrap with `<figure>` + `<figcaption>` or add `aria-label`.

### LOW: Platform-Specific Print Instructions
- **File:** `src/print-template.js:349`
- **Description:** Print hint says "Cmd+P" which is Mac-only. Windows/Linux users see incorrect instructions.
- **Recommendation:** Use OS-agnostic wording: "Print double-sided on A4, fold in half."

### LOW: No prefers-reduced-motion Support
- **File:** `src/template.js:124-132, 505-507`
- **Description:** Grain overlay animation and card hover transitions play regardless of user motion preferences.
- **Recommendation:** Add `@media (prefers-reduced-motion: reduce)` to disable animations.

---

## Cross-Cutting Concerns

### Shell Safety + Input Validation
The command injection in `protectPdf()` (Security) is amplified by the lack of input validation on the PDF password field (Completeness) and the absence of tests covering this path (Completeness/DevOps). These three findings together represent a single exploitable chain from sheet input → shell execution.

### Missing Timeouts Across All External Calls
Multiple agents flagged missing timeouts independently: Google Sheets API (Performance), Google Drive downloads (Completeness), and WordPress publish (Security). A single `fetchWithTimeout()` wrapper in utils.js would address all three.

### Scattered Configuration + Missing Documentation
Configuration constants are duplicated across files (Architecture) and insufficiently documented (Documentation). Centralizing config would also make the developer setup guide easier to write.

---

## Action Items

### Quick Fixes (< 1 hour)
- [ ] **Fix command injection:** Replace `execSync()` with `execFileSync()` in `protectPdf()` (`src/pdf.js:215`)
- [ ] **Parallelize downloads:** Replace sequential for-loop with `Promise.all()` (`src/index.js:126-136`)
- [ ] **Parallelize QR generation:** Replace sequential for-loop with `Promise.all()` (`src/index.js:98-103`)
- [ ] **Move lazy requires to top:** `downloadFromDrive` in index.js, `fs` in notify.js
- [ ] **Add named constants:** `SHEET_HEADER_ROWS = 4`, `MAX_ANNOUNCEMENTS = 12` in sheets.js
- [ ] **Validate PDF password:** Skip `protectPdf()` if password is empty after trim
- [ ] **Fix redundant isPrint check:** Simplify in utils.js:170-178
- [ ] **Add path traversal check:** Validate destPath in `downloadFromDrive()`
- [ ] **Add HTTPS check:** Enforce https:// in `downloadFile()`
- [ ] **Dynamic nav offset:** Replace hardcoded 56px with `offsetHeight` query

### Moderate Effort (hours)
- [ ] **Add fetch timeouts:** Create `fetchWithTimeout()` wrapper, apply to all external calls
- [ ] **Extract PDF generation helper:** Deduplicate print/booklet try-catch blocks in index.js
- [ ] **Consolidate date parsing:** Move all date functions to utils.js
- [ ] **Create src/config.js:** Centralize all env-based constants
- [ ] **Convert sync I/O to async:** `cleanOldOutputs()` in index.js
- [ ] **Add .nvmrc + engines field:** Pin Node.js version
- [ ] **Add npm audit to CI:** Security scanning in generate-bulletin.yml
- [ ] **Fix footer contrast:** Increase opacity to 0.7+ on all footer text
- [ ] **Add focus-visible styles:** All interactive elements in template.js
- [ ] **Add tablet breakpoint:** 768px media query in template.js
- [ ] **Enhance .env.example:** Add inline docs for each variable

### Significant Effort (days+)
- [ ] **Add test suite:** Jest + unit tests for sheets, validate, pdf, translate, utils modules
- [ ] **Add ESLint + CI linting:** Configure linter, add to CI pipeline
- [ ] **Developer setup guide:** Complete Getting Started docs with all prerequisites
- [ ] **Deployment runbook:** Full credential provisioning and rotation guide
- [ ] **Create CHANGELOG.md:** Retroactive version history
- [ ] **Accessibility pass:** WCAG AA compliance for web bulletin (contrast, focus, ARIA, touch targets)
