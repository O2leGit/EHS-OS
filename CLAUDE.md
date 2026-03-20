# EHS Operating System - Prototype

## What This Is
AI-native EHS Operating System for life sciences companies. Prototype stage. Must demo AI document ingestion, incident reporting, CAPA workflow, and KPI dashboard. Must be operable by a non-technical EHS consultant (Jen Parzacone, Parzy Consulting) without developer support.

## Architecture
- **Frontend:** React (Next.js) + Tailwind CSS, deployed on Netlify
- **Backend:** Python FastAPI, deployed on Railway
- **Database:** PostgreSQL on Railway, schema-per-tenant (multi-tenant with row-level security)
- **AI:** Claude API (Sonnet for document ingestion/gap analysis, Haiku for classification)
- **File Storage:** S3-compatible (Cloudflare R2 or Railway volume)
- **Auth:** JWT with refresh tokens

## Key Design Rules
- No business logic in the frontend. Frontend talks to backend via API only.
- No tenant assumptions in the API. Every request scoped to tenant ID from JWT.
- No hardcoded prompts. Prompt templates stored in database, versioned, per-tenant configurable.
- No direct database access from frontend. Everything through API endpoints.
- Every layer talks through defined interfaces. This is what makes it portable across delivery models.

## The AI Document Ingestion Pipeline (Core Feature)
1. User uploads PDF, DOCX, or image
2. Backend extracts text (PyMuPDF for PDFs, python-docx for DOCX, Tesseract for scanned/images)
3. Text chunked at 2,000-3,000 tokens with 200-token overlap
4. Each chunk sent to Claude API with the Pfizer 4-tier framework classification prompt
5. Claude returns structured JSON: document type, framework categories covered, gaps, risk severity
6. Results stored in DB linked to source document, tenant, and framework categories
7. Gap analysis endpoint aggregates across all documents for a tenant

## The Pfizer 4-Tier Framework (What Documents Map Against)
- **Tier 1 - Policy:** Corporate EHS Policy (top-level commitment)
- **Tier 2 - Systems Manual:** Governance structure, PDCA methodology, roles and responsibilities
- **Tier 3 - Standards:** Organized in four series:
  - 100 series: Management Systems (leadership, planning, performance evaluation, improvement)
  - 200 series: Risk Topics (chemical safety, biosafety, radiation, ergonomics, fire/life safety)
  - 300 series: Program Standards (incident management, training, emergency preparedness, auditing)
  - 400 series: Business Resilience (business continuity, crisis management, security)
- **Tier 4 - Implementation Documents:** SOPs, checklists, forms, recommended practices

## Multi-Tenant Architecture
- PostgreSQL schema-per-tenant for data isolation
- Tenant ID embedded in JWT, enforced at API layer
- To go single-tenant for a specific client: spin up separate Railway Postgres instance, point their config at it. Same API code.
- File storage uses tenant-prefixed paths (bucket/tenant_id/...)

## API Structure
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me

POST /api/documents/upload
GET  /api/documents/
GET  /api/documents/{id}

GET  /api/reports/gap-analysis
GET  /api/reports/gap-analysis/{category}

POST /api/incidents/
GET  /api/incidents/
GET  /api/incidents/{id}
POST /api/incidents/report (public - no auth, for QR code submissions)

GET  /api/capa/
GET  /api/capa/{id}
PATCH /api/capa/{id}

GET  /api/dashboard/summary
GET  /api/dashboard/incidents-over-time
GET  /api/dashboard/capa-status
GET  /api/dashboard/framework-coverage

POST /api/admin/tenants
GET  /api/admin/tenants
POST /api/admin/users
GET  /api/admin/qr-codes/{site_id}

POST /api/chat/message          (AI EHS Expert - send message, get response with context)
GET  /api/chat/history           (chat history for current user)
GET  /api/chat/suggested-prompts (context-aware prompt suggestions based on current page)
```

## Build Priority Order
1. FastAPI backend skeleton + auth + tenant model + Railway deploy
2. Document upload + Claude API ingestion pipeline + structured storage
3. Gap analysis report endpoint + framework coverage visualization
4. React frontend: login, upload, gap results with heatmap (THE WOW PAGE)
5. AI EHS Expert Chat panel (right-side, Claude API with tenant context injection) - THIS IS THE DIFFERENTIATOR
6. Incident reporting form (mobile-responsive, works without auth for QR submissions)
7. CAPA workflow (auto-generated from incidents, kanban status tracking)
8. KPI Dashboard (incidents MTD/YTD, open/overdue CAPAs, framework coverage %)
9. QR code generator per site/location
10. Admin panel (tenant management, user management)
11. Demo mode with Helix BioWorks sample data

## What NOT to Build Yet
- Voice input for incident reporting (Phase 2 - browser voice-to-text API is free and easy but polish it later)
- Automated SOP drafting from AI chat (Phase 2 - the chat can advise, but auto-generating full SOPs is a feature, not MVP)
- Regulatory data integration / Dakota API (Phase 3)
- Audit scheduling and templates (build when client asks)
- Email/SMS notifications via Twilio (Phase 2)
- Training tracker (Phase 2)
- Stripe billing / self-service signup (only needed for SaaS model)
- Offline mode / PWA (Phase 2 - important but not for demo)
- CopilotKit integration (evaluate for Phase 2 - open-source framework for in-app AI copilots with React, 28K+ GitHub stars, could replace custom chat panel with richer agentic capabilities like AI taking actions in the UI)

## Environment Variables Expected
```
DATABASE_URL=postgresql://...
CLAUDE_API_KEY=sk-ant-...
JWT_SECRET=...
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=ehs-os-documents
FRONTEND_URL=https://... (for CORS)
```

## Code Style
- Python: Black formatter, type hints on all functions
- React: Functional components with hooks, Tailwind for all styling
- No ORMs - use raw SQL with asyncpg for performance and clarity (or SQLAlchemy Core, not ORM)
- All API responses return structured JSON with consistent error format
- All Claude API calls go through a service layer (app/services/ai.py) with prompt templates loaded from DB

## UX Design Specification (Competitive Differentiation)

### Design Philosophy
SafetyCulture owns "mobile-first simplicity." Cority owns "enterprise AI governance." We own "AI-native intelligence that makes you smarter, not just compliant." The interface must feel like a modern productivity tool (Linear, Notion, Vercel dashboard) not like traditional EHS software (clunky forms, nested menus, 2010-era dashboards).

### Visual Identity
- Color palette: Dark navy (#1B2A4A) primary, green (#2ECC71) for positive/safe, amber (#F59E0B) for warnings, red (#EF4444) for critical, cool gray (#F1F5F9) backgrounds
- Typography: Inter or similar clean sans-serif. Large type for key metrics. Generous whitespace.
- Cards over tables: Use card-based layouts for incidents, CAPAs, documents. Tables only for dense data views.
- Minimal chrome: No heavy sidebars. Use a slim left nav with icons. Content area takes 85%+ of screen width.
- Dark mode support from day one (Tailwind dark: prefix). EHS managers often work early morning/late night shifts.

### Layout Structure (3 zones)
1. **Left rail (56px collapsed, 240px expanded):** Icon-based navigation. Dashboard, Documents, Incidents, CAPAs, Audits, Settings. Tenant/site selector at top.
2. **Main content (fluid):** The work area. Cards, lists, dashboards, forms.
3. **Right panel (AI Chat - 380px, collapsible):** The EHS Expert Assistant. Always accessible. Slides in from right edge. Toggle button visible on every page.

### Key Pages

**Dashboard (landing page):**
- Top row: 4 metric cards (Incidents MTD, Open CAPAs, Overdue CAPAs, Framework Coverage %)
- Each card is clickable, drills into detail
- Below cards: 2-column layout
  - Left: Incidents over time (area chart, recharts), CAPA aging (horizontal bar)
  - Right: Framework coverage heatmap (4-tier, color-coded cells), Recent activity feed
- Design reference: Linear's dashboard + Vercel's analytics. Clean, data-dense, zero clutter.

**Document Ingestion (the "wow" page):**
- Drag-and-drop upload zone (large, centered, dashed border, animated on hover)
- Upload progress with real-time status: "Extracting text...", "Analyzing against framework...", "Mapping coverage..."
- Results render as the analysis completes (progressive disclosure, not a loading spinner)
- Output: Framework coverage visualization
  - A grid/heatmap showing all 4 tiers and their sub-categories
  - Each cell: green (covered), yellow (partial), red (gap), gray (not assessed)
  - Click any cell to see the source text that maps to it and the AI's reasoning
- Below the heatmap: "Top 5 Gaps" list with severity, recommended actions, and a button to auto-generate a CAPA for each gap
- THIS PAGE IS THE DEMO CLOSER. It must feel magical. The transition from "upload a PDF" to "see your entire framework coverage" should take under 60 seconds and feel like the system understood the document deeply.

**Incident Reporting (public-facing, no auth required via QR link):**
- Single-page form, mobile-optimized
- Big friendly buttons for type: Injury, Near-Miss, Hazard, Environmental, Observation
- Photo upload with camera integration
- Location auto-detect or dropdown
- Description field with voice-to-text browser API (navigator.mediaDevices)
- Anonymous toggle (default on for QR submissions)
- Submit confirmation with incident ID and "thank you" message
- Design reference: Apple Health emergency screen. Large touch targets. Zero friction. Someone in a hard hat with gloves can use this.

**CAPA Board:**
- Kanban view (default): Open, In Progress, Overdue, Closed columns
- Each card shows: incident ID, description snippet, assigned to, due date, days remaining/overdue
- Drag to change status
- Click to expand: full details, linked incident, timeline, comments, attachments
- List/table view toggle for power users
- Filter by: site, severity, assigned to, overdue only
- Design reference: Linear's issue board. Not Trello (too playful). Not Jira (too complex).

### The AI EHS Expert Chat (Right Panel) - PRIMARY DIFFERENTIATOR

**What it is:** A persistent, context-aware AI assistant powered by Claude API that acts as an expert EHS advisor. It understands the client's documents, framework coverage, incidents, and regulatory context. It is not a generic chatbot. It is an EHS specialist that knows this client's specific situation.

**System prompt (stored in DB, per-tenant configurable):**
```
You are an expert Environmental Health and Safety (EHS) advisor for a life sciences company. You have deep knowledge of:
- OSHA regulations (29 CFR 1910, 1926)
- EPA RCRA hazardous waste management
- Biosafety levels (BSL-1 through BSL-4)
- Chemical hygiene (OSHA Lab Standard 29 CFR 1910.1450)
- GMP/cleanroom compliance
- ISO 14001 and ISO 45001 management systems
- The Pfizer 4-tier EHS Management System framework (100-400 series standards)

You have access to this company's:
- Uploaded documents and their framework coverage analysis
- Incident history and CAPA status
- Current gaps in their EHS management system

When asked questions, you:
1. Draw from the company's actual data first
2. Reference specific regulatory requirements with citation
3. Provide actionable recommendations, not generic advice
4. Flag when something requires a qualified professional (e.g., CIH for IH assessments)
5. Speak in plain language, not regulatory jargon, unless the user asks for technical detail

You are not a lawyer. You do not provide legal advice. You provide EHS operational guidance based on regulatory standards and best practices.
```

**UX for the chat panel:**
- Slide-in from right edge, 380px wide
- Header: "EHS Expert" with green dot (active), collapse button
- Suggested prompts on first open (3-4 clickable chips):
  - "What are my biggest gaps right now?"
  - "Help me write an SOP for [topic]"
  - "Explain the requirements for chemical waste disposal"
  - "What should I do about this incident?"
- Chat history persisted per-user per-tenant
- Context injection: When user is on a specific page (e.g., viewing an incident), the chat automatically has that context. "I see you're looking at incident #INC-2024-037. How can I help?"
- Actions from chat: The AI can suggest creating a CAPA, and a button appears inline to do it. "Based on this incident, I recommend creating a corrective action for [specific issue]. [Create CAPA]"
- Document-aware: "Based on your uploaded Chemical Hygiene Plan, you're missing the required annual review documentation. Would you like me to draft a review checklist?"

**Why this wins:**
- Cority's Cortex AI has 9 agent types that do specific tasks. We have ONE expert that understands everything and talks to you like a colleague.
- VelocityEHS has dashboards. We have an advisor.
- SafetyCulture has template generation. We have an expert that reads your documents, knows your gaps, and tells you what to do next.
- No competitor has a persistent, context-aware EHS advisor that understands the client's specific data.

### What Makes This Better Than Everything Out There

| Competitor | Their AI | Our AI |
|-----------|---------|--------|
| Cority Cortex AI | 9 separate agents for specific tasks (scribe, photo analysis, checklist autofill). $72-290K/yr. Launched Dec 2025. Google Gemini integration. Enterprise-only. | One unified EHS expert that understands everything. Conversational. Context-aware. Accessible to mid-market at 1/10th the cost. |
| VelocityEHS | "VelocityAI" bolt-on. Incident data analysis. Ergonomic video capture. Dashboard analytics. | AI that reads your documents, maps your gaps, and tells you what to do. Not analytics on existing data. Intelligence on what you're missing. |
| SafetyCulture | AI generates inspection template questions from text descriptions. That's it. | AI ingests entire document libraries, produces framework coverage analysis, acts as ongoing EHS advisor. Different category. |
| EHS Momentum | No AI whatsoever. Manual processes. | AI-native from the ground up. |

### Mobile Responsiveness
- All pages must work on mobile viewport (375px+)
- Incident reporting form is mobile-first (designed for phone, scales up to desktop)
- Dashboard cards stack vertically on mobile
- AI chat panel goes full-screen on mobile (bottom sheet pattern)
- CAPA board switches to list view on mobile (kanban doesn't work on small screens)
