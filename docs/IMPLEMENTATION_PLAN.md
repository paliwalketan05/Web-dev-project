# QuizArena Implementation Plan & Progress Checklist

## Tooling & Environment Verification
- **Node.js**: `v24.19.0` (Node >= 20 requirement satisfied)
- **npm**: `11.17.0`
- **Git**: `git version 2.46.0.windows.1`
- **GitHub CLI (gh)**: Not installed in PATH (Using direct git remote: `https://github.com/paliwalketan05/Web-dev-project.git`)
- **Docker**: `Docker version 29.7.2, build a7dcaa6` (Daemon status: stopped)
- **OS**: Windows

---

## Phase Checklist

- [x] **Phase 0: Plan and tooling check**
  - [x] Record tool versions and verify Node >= 20 and Git availability
  - [x] Create root project skeleton (`client/`, `server/`, `docs/`) and root `package.json`
  - [x] Create implementation plan document

- [x] **Phase 1: Git repository**
  - [x] Initialize git repository (`main` branch)
  - [x] Add `.gitignore`, `.editorconfig`, `LICENSE` (MIT), `README.md`
  - [x] Initial commit with Phase 0 and Phase 1 files
  - [x] Configure GitHub remote (`https://github.com/paliwalketan05/Web-dev-project.git`) and push `main`

- [ ] **Phase 2: Backend foundation and database**
  - [ ] Initialize `server/` with TypeScript (strict), Express, tsx, ESLint, Prettier
  - [ ] Implement `src/config/env.ts` with Zod validation
  - [ ] Configure Prisma schema with models (`User`, `Quiz`, `Question`, `Option`, `Attempt`, `Answer`)
  - [ ] Add `docker-compose.yml` for PostgreSQL 16
  - [ ] Setup `server/.env.example` and run migrations
  - [ ] Add security and utility middleware (helmet, cors, rate limiter, request logger, error handler, 404 handler)
  - [ ] Implement `GET /api/health` with database check
  - [ ] Verify `npm run dev` and `npm run build`

- [ ] **Phase 3: Authentication and authorization**
  - [ ] Implement bcrypt hashing (cost 12) & JWT utilities
  - [ ] Implement `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
  - [ ] Implement `requireAuth` and `requireRole` guards
  - [ ] Apply stricter rate limiting on `/api/auth/*`
  - [ ] Verify auth flows and error handling (401, 403, 409)

- [ ] **Phase 4: Teacher: quiz and question management**
  - [ ] Implement 6-character access code generator (no 0, O, 1, I) with collision retry
  - [ ] Implement quiz CRUD endpoints with ownership checks
  - [ ] Implement question management endpoints (create, transaction update, delete, reorder)
  - [ ] Implement publish validation (rule 7.2) and attempt locking (rule 7.3)
  - [ ] Implement code regeneration and result release endpoints

- [ ] **Phase 5: Student: join, attempt, autosave, submit, scoring**
  - [ ] Implement `POST /api/quizzes/join` (case-insensitive access code)
  - [ ] Implement attempt start/resume with window and max-attempt validation
  - [ ] Implement deterministic seeded shuffling for questions and options
  - [ ] Ensure correct answers are stripped from question delivery
  - [ ] Implement pure scoring service in `services/scoring.ts`
  - [ ] Implement autosave (`PUT /api/attempts/:id/answers`) with expiry handling
  - [ ] Implement attempt submission (`POST /api/attempts/:id/submit`) and result retrieval
  - [ ] Implement background attempt expiry job (`jobs/expireAttempts.ts`)
  - [ ] Implement tab-switch tracking, student quizzes, and attempt history

- [ ] **Phase 6: Results, analytics and export**
  - [ ] Implement teacher attempts view with pagination, search, and status filter
  - [ ] Implement individual attempt review for teachers
  - [ ] Implement quiz analytics (averages, pass rate, 10-bucket score distribution, question accuracy)
  - [ ] Implement CSV export (RFC 4180 escaped, UTF-8) and teacher stats endpoint

- [ ] **Phase 7: Backend tests**
  - [ ] Set up Vitest with Supertest
  - [ ] Comprehensive scoring unit tests (all question types, negative marks, edge cases)
  - [ ] API integration tests (auth, RBAC, ownership, quiz lifecycle, attempt lifecycle, expiry, results)
  - [ ] Verify at least 30 passing backend tests

- [ ] **Phase 8: Frontend foundation**
  - [ ] Initialize `client/` with Vite, React, TypeScript (strict), Tailwind CSS
  - [ ] Install React Router, TanStack Query, React Hook Form, Zod, Axios, Lucide icons, Toast library
  - [ ] Build reusable UI kit (Button, Input, Select, Card, Modal, Badge, Table, Toast, Spinner, Skeleton)
  - [ ] Build layout components (`Navbar`, `Sidebar`, `PageShell`)
  - [ ] Implement typed API client with token interceptor and waking-up indicator
  - [ ] Implement `AuthContext`, login/register pages, protected route components, 404 page

- [ ] **Phase 9: Teacher interface**
  - [ ] Build Teacher Dashboard with stat cards and quiz list
  - [ ] Build Quiz Editor (settings form + questions editor with drag/reorder, options, answers)
  - [ ] Display real-time validation errors on publish attempt; locked quiz warning
  - [ ] Build Quiz Results view (table, search, filter, pagination, CSV download, attempt review modal)
  - [ ] Build Quiz Analytics view with Recharts (summary cards, distribution chart, accuracy list)

- [ ] **Phase 10: Student interface**
  - [ ] Build Student Dashboard (join box, in-progress resume list, completed attempts history)
  - [ ] Build Quiz Info & Rules page before attempt start
  - [ ] Build Attempt Screen (timer countdown, question card, navigator grid, autosave indicator, offline banner)
  - [ ] Build Tab-switch detection & warning banner
  - [ ] Build Submission confirmation modal & auto-submit on countdown zero
  - [ ] Build Result page with score breakdown, pass/fail status, and per-question review

- [ ] **Phase 11: Polish and quality**
  - [ ] Responsive design verification (375px, 768px, 1280px)
  - [ ] Accessibility pass (labels, focus management, aria-live timer updates)
  - [ ] Frontend unit & component tests with Vitest + React Testing Library
  - [ ] End-to-end flow verification and console error cleanup

- [ ] **Phase 12: Containers and CI**
  - [ ] Multi-stage `server/Dockerfile` with Prisma migration and production runner
  - [ ] Multi-stage `client/Dockerfile` with Nginx and SPA fallback
  - [ ] Root `docker-compose.yml` orchestrating database, server, and client
  - [ ] `.github/workflows/ci.yml` running lint, typecheck, tests, and build

- [ ] **Phase 13: Seed data and documentation**
  - [ ] Create idempotent `prisma/seed.ts` with teacher, student, 10-question demo quiz, and student attempts
  - [ ] Enable auto-seeding on server start when `SEED_DEMO=true`
  - [ ] Comprehensive documentation: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `DEPLOYMENT.md`

- [ ] **Phase 14: Deployment**
  - [ ] Prepare Render blueprint (`render.yaml`) and Vercel configuration (`vercel.json`)
  - [ ] Complete cloud deployment setup (Neon PostgreSQL, Render API, Vercel Frontend)
  - [ ] Perform live smoke tests and update URLs

- [ ] **Phase 15: Final verification and handover**
  - [ ] Verify all items in Final Acceptance Checklist (Section 13)
  - [ ] Git tagging (`v1.0.0`) and merge to `main`
  - [ ] Final handover report with demo credentials, links, and test results
