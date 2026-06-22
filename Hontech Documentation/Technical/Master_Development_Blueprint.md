# Master Development Blueprint & Roadmap

This document consolidates all previous roadmaps and outlines the strategic path to take the HonTech AutoCenter Operations System from its current prototype state to a fully structured, production-ready enterprise application.

---

## 🎯 Phase 1: Prototype Validation (Completed & Stable)
*Strategy: Keep everything in the simple HTML/JS stack for now to allow rapid iteration. Do not migrate to frameworks until testers finalize all requirements.*

**Completed Developments:**
- [x] **Developer Mailbox Simulator:** Built a local UI modal to intercept and view system emails (like OTPs) without needing a real Gmail account connected.
- [x] **Role & UI Polish:** Deprecated the standalone Technician role, merging all status updates, lift assignments, evaluations, and goal status triggers into the Service Advisor workflow. Added segregated SA tables (My Active Jobs vs Unassigned / Other Advisor Jobs) with dynamic claiming.
- [x] **Owner Dashboard Enhancements:** Added PMS Goal Success calculations, Success/Failure counters, and record log filter controls.
- [x] **Strict Formats & Role Restrictions:** Enforced 24-hour time formatting universally. Restricted Periodic Record Logs to Owner/Admin roles. Formatted contact numbers dynamically (09XX-XXX-XXXX). Revamped Assistant workflow for online bookings (Action remarks handling).
- [x] **Group QA Testing:** Verified core layouts and workflows locally.

**Remaining Immediate To-Dos:**
- [ ] **Frontend Modularization (Pre-React cleanup):** Split the massive `index.html` file into dedicated JS modules (`api.js`, `tv.js`, `dashboard.js`) and separate the CSS to make the codebase manageable.


---

## 🔒 Phase 2: Security & Backend Hardening
*Strategy: Before going public, we must secure the robust backend we have built.*

**Tasks to Complete:**
- [ ] **Input Validation:** Install `express-validator` to sanitize inputs and prevent NoSQL injection.
- [ ] **Centralized Error Handling:** Write a global Express error handler middleware to clean up repetitive `try/catch` blocks in controllers.
- [ ] **Automated Testing:** Install `Jest` and `Supertest` to mathematically prove the authentication and role limitations work.
- [ ] **Content Security Policy (CSP):** Configure Helmet to whitelist approved CDNs.
- [ ] **Fix OTP Leaks:** Remove OTP tokens from JSON responses (they must only be sent via email simulator).

---

## ⚛️ Phase 3: The Framework Migration
*Strategy: Once the prototype requirements are locked in, replace the frontend monolith with a modern framework to support future scaling (Multi-Branch).*

- [ ] **Initialize Framework:** Keep the backend untouched. Create a new React application (via Vite or Next.js) to replace `frontend/index.html`.
- [ ] **Component Architecture:** Break the UI into SOLID React components (e.g., `<TVMonitor />`, `<WalkInForm />`, `<DailyIntakes />`).
- [ ] **Global State Management:** Implement Context API or Redux for handling the `allJobs` state cleanly.

---

## ☁️ Phase 4: Infrastructure & Deployment
*Strategy: Move from `localhost` to the internet using modern Cloud PaaS.*

- [ ] **Cloud Database:** Migrate local MongoDB to MongoDB Atlas (Free Tier).
- [ ] **Backend Hosting:** Deploy the Node.js server to Render.com or Railway.app.
- [ ] **Environment Secrets:** Configure `.env` variables securely in the cloud dashboard.
- [ ] **Real Email Integration:** Connect Resend, Brevo, or SendGrid for official OTP delivery.
- [ ] **Domain & SSL:** Purchase `hontech-autocenter.com` and ensure HTTPS is active.

---

## 🏢 Phase 5: Version 2.0 (OJT Phase - Finance & Multi-Branch)
*Strategy: Post-launch enterprise expansion.*

- [ ] **SQL Migration:** Plan a transition from MongoDB to PostgreSQL for complex financial ledger transactions and inventory.
- [ ] **Multi-Branch Dashboard:** Add global owner visibility across multiple shop locations.
