# HonTech AutoCenter Operations System - Documentation Hub

Welcome to the documentation master hub for the **HonTech AutoCenter Operations System** Capstone Project. This directory contains the complete blueprint, data models, workflows, security audits, and developer roadmaps organized for solo development.

---

## 🎯 Project Goals & Objectives

1. **Streamline Workshop Operations:** Transition the auto-shop workflow from manual paper claim stubs to a real-time digital queue management dashboard.
2. **Role-Based Workflows:** Enforce strict system roles (Owner, Front Desk Assistant, Service Advisor) to compartmentalize workshop duties and increase accountability.
3. **Live Status Broadcasting:** Display active vehicle repair phases (lifts 1-4, General Repairs, carry-overs) on a live rotating TV monitor in the customer waiting lounge.
4. **Data Security & Integrity:** Protect customer records, prevent unauthorized modifications, and implement professional backend authorization rules.

---

## 🗂️ Documentation Guide

### 🧠 Learning & Educational Documentation (Guides, diagrams, and audits)
* 📊 [**Data Flow Diagrams**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Learning/hontech_data_flow_diagrams.md) - Visual Mermaid diagrams tracking user requests, job creations, and database states.
* 🚨 [**Security Vulnerabilities Explainer**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Learning/SecurityVulnerabilities.md) - Active vulnerability audit log (OTP leaks, mass assignments) with clear remediation steps.
* 🌐 [**Local Network Sharing Guide**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Learning/NetworkingLocalSharingGuide.md) - A student-friendly tutorial on `localhost` loopbacks, network IP routing, socket bindings, and bypassing firewall blocks.

### 🛠️ Technical Specifications & Roadmaps (Project setup, plans, and roadmap blueprints)
* ⚙️ [**Startup Operation Manual**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/StartupOperation) - Terminal commands to run the frontend and backend in local development.
* 📐 [**Architecture Blueprint (Plan 1 - Archived)**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/Archived_Plans/implementation_plan_1) - Solid design patterns, MVC file layouts, and Mongoose database model schemas.
* 🗄️ [**Database Schema & ERD**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/database_schema_and_erd.md) - Model structures, fields, constraints, validation behaviors, and Mermaid ERD.
* 📈 [**Owner Analytics Implementation Plan (Archived)**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/Archived_Plans/implementation_plan%20for%20Owner%20Anylitics) - The blueprint used to implement completed job persistence and metrics.
* 💳 [**Account Setup Implementation Plan (Archived)**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/Archived_Plans/implementation_plan%20for%20AccountS) - Blueprint for staff account creation, permissions, and roles.
* 🗺️ [**Solo Developer Launch Roadmap**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/SoloDeveloperRoadmap.md) - Cloud hosting (Render/Atlas), domain configuration, and developer pathways.
* 📜 [**Client Presentation Script**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/SystemPresentationScript.md) - A structured script and presentation booklet to explain roles, permissions, and value to clients.
* ⏱️ [**Launch Timeline & Emergency Manual**](file:///c:/Users/justi/Downloads/School%20Files/MainProjectCollection/ComprogStudies/ProjectsWebDev/Capstone%20Things/DeveloperVersion/Hontech%20Documentation/Technical/LaunchTimelineAndEmergencyManual.md) - Monthly milestone plans, budget/expense estimations, dry run procedures, and emergency crash steps.

---

## 📝 Master Development TODO List

As a solo developer, here is your organized checklist to complete the system:

### Phase 1: Prototype Logic & UI Completion (Completed & Stable)
- [x] Implement the complete TV monitor slide rotation logic on the frontend.
- [x] Connect the front-desk booking confirmation toggle.
- [x] Integrate Booking Custom Category ("Others" text-field) saving custom service inputs.
- [x] Deprecate standalone Technician role and consolidate queue actions, lifts, and evaluations under the Service Advisor.
- [x] Implement Service Advisor Table Segregation ("My Active Jobs" vs "Unassigned / Other Advisor Jobs") with claim capabilities.
- [x] Build parts tracking status for "WCA" (Waiting Customer Approval).
- [x] Implement automatic PMS success/failure determination based on the 2-hour completion threshold.
- [x] Overhaul Owner Dashboard to display PMS Goal Success Rate, Success/Failure counters, and record log filters (search keyword + start/end dates).
- [x] Integrate role-update controls for active users directly from the Owner's staff roster.
- [ ] Split the 1,800+ line frontend monolithic `index.html` file into separate JavaScript modules under `/frontend/js/`.
- [ ] Integrate HTTP logging middleware (`morgan`) in the Node.js server.

### Phase 2: Security Hardening (Pre-Launch)
- [ ] **Fix OTP Exposure:** Modify `forgotPassword` to stop returning the token in the API response payload.
- [ ] **Email Setup:** Integrate `nodemailer` using a free provider (like Resend) to send OTP codes via email.
- [ ] **API Whitelisting:** Implement whitelisting in `updateJobField` to prevent arbitrary properties from being updated.
- [ ] **Strict Inputs:** Add validation and sanitization using `express-validator` middleware.
- [ ] **Configure CSP:** Restrict Helmet Content Security Policy to whitelist only approved CDNs (Tailwind, Lucide, jsPDF).

### Phase 3: Infrastructure Setup & Deployment (Launch)
- [ ] Set up a free MongoDB Atlas cluster and acquire a public database connection string.
- [ ] Upload the codebase to a private/public GitHub repository.
- [ ] Create a Render or Railway account and link the GitHub repository for automatic deployment.
- [ ] Set up secure Environment Variables in the hosting dashboard.
- [ ] Purchase a custom domain and connect it to the hosting platform.
- [ ] Turn on automated daily database backups inside MongoDB Atlas.

### Phase 4: Next Year / OJT Contract (Version 2.0)
- [ ] **SQL Database Migration:** Transition from MongoDB to PostgreSQL to support ACID compliance for financial ledgers.
- [ ] **Finance Module:** Build complex SQL `JOIN` queries for Tax, Labor Costs, and Automated Invoicing.
- [ ] **Inventory Module:** Map out relational tables for Parts, Suppliers, and automated inventory deduction algorithms.
