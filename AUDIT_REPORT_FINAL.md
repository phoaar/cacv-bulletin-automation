# Comprehensive Audit Report: CACV Bulletin Automation

**Date:** March 6, 2026
**Status:** Complete

## 1. Security Audit

### 1.1 Credential Protection
- **Finding:** `credentials/service-account.json` and `.env` contain sensitive keys.
- **Verification:** `.gitignore` correctly excludes these files:
  ```gitignore
  .env
  credentials/
  ```
- **Risk:** Although ignored by git, these files exist locally. **CRITICAL:** The sub-agent identified that a `service-account.json` might have been committed in the past.
- **Recommendation:** Revoke existing keys if they were ever pushed. Use environment variables for secrets in CI/CD environments.

### 1.2 PII Logging
- **Finding:** `src/translate.js` logs truncated announcement titles:
  ```javascript
  console.log(`Translating announcement ${i + 1}: ${ann.title.slice(0, 30)}…`);
  ```
- **Risk:** Announcement titles often contain names or prayer requests (PII/SPI).
- **Recommendation:** Change logging to use generic identifiers (e.g., `Translating announcement 1...`).

### 1.3 WordPress Authentication
- **Finding:** `src/wordpress.js` uses Application Passwords and environment variables.
- **Risk:** Low, provided the `.env` file remains secure.
- **Recommendation:** Ensure HTTPS is enforced for all API calls.

---

## 2. Code Audit

### 2.1 `src/template.js` (HTML Generation)
- **Finding:** Manual HTML string building using template literals is extremely complex (~600 lines of CSS/HTML mixed with JS).
- **Risk:** High fragility. Hard to maintain, prone to syntax errors in HTML/CSS that JS linters won't catch.
- **Recommendation:** 
  - Migrate to a template engine like **Handlebars** or **EJS**.
  - Separate CSS into a standalone file or use a CSS-in-JS approach if keeping it within the build process.
  - Ensure all dynamic content is consistently escaped (current usage of `esc()` is good but manual application is prone to omission).

### 2.2 `src/pdf.js` (PDF Generation & Merging)
- **Finding:** Robust implementation using `puppeteer-core` and `pdf-lib`.
- **Complexity:** `mergePdfs` handles page scaling and rotation well.
- **Error Handling:** Good use of `try/catch` and graceful skipping if `CHROME_PATH` is missing.
- **Recommendation:** Consider adding a retry mechanism for downloads if the network is unstable.

---

## 3. UX Audit

### 3.1 Visual & Aesthetic
- **Finding:** The design is modern and high-quality, utilizing "Instrument Serif" and "Instrument Sans" for a sophisticated look.
- **Grain Overlay:** Implemented as a fixed `::before` element with `pointer-events: none` and low opacity (0.032). This adds texture without affecting usability.
- **Hero Section:** Uses animated blobs and gradients. `prefers-reduced-motion` is correctly respected.

### 3.2 Accessibility (A11y)
- **Semantic Tags:** Basic usage (`<nav>`, `<footer>`, `<h1>`).
- **Contrast:** Generally high contrast (Ink on Paper). Some secondary text (`rgba(255,255,255,0.7)`) on dark backgrounds should be verified for WCAG AA (4.5:1).
- **Interactivity:** Navigation buttons are large and accessible. `min-height: 44px` is used for mobile-friendly tap targets.
- **Recommendation:**
  - Replace generic `<div class="card">` with `<section>`.
  - Add `lang` attribute to nested content if it switches between English and Chinese (though the main tag is `<html lang="en">`).

### 3.3 Responsive Design
- **Finding:** Mobile-first considerations are evident with media queries at 620px and 520px. 
- **Recommendation:** Ensure the attendance grid doesn't become too cramped on very small screens (320px).

---

## Final Conclusion
The project is technically sound but suffers from high maintenance overhead due to the manual HTML template. Security risks are primarily centered around PII in logs and the history of credential management.

**Top Priority:** Fix PII logging in `src/translate.js` and verify git history for leaked credentials.
