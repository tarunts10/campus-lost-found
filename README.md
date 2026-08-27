# Campus Lost & Found

A private lost-and-found platform for a college campus. Only authenticated
college members can report items, browse listings, and claim property.

> **Status: Milestone 1 — project structure only.**
> No application code has been written yet. See [Roadmap](#roadmap).

---

## Why this exists

Campus lost-and-found today is a noticeboard and a group chat. Both leak: items
go unclaimed because nobody sees the post, and worse, anyone can walk up and
claim anything. This project adds two things a noticeboard cannot:

1. **Identity** — only verified college members can participate.
2. **A verification step** — an item is not handed over on a claim alone. The
   finder's contact details stay hidden until a claim reaches the verification
   stage, and an admin can arbitrate when two people claim the same item.

---

## Architecture

Two independent applications in one repository.

```
Browser                    Server                    Database
┌──────────────┐  HTTPS   ┌──────────────┐         ┌──────────────┐
│   frontend   │  JSON    │   backend    │         │   MongoDB    │
│  React/Vite  │ ───────► │ Node/Express │ ──────► │    Atlas     │
│              │ ◄─────── │              │ ◄────── │              │
└──────────────┘          └──────────────┘         └──────────────┘
   untrusted              all auth + rules          persistent
   (user can              enforced HERE             storage
    read all code)
```

The frontend is fully visible to the user — anything it receives, they can read.
Every authorization rule is therefore enforced on the backend. The frontend
hiding a field is a convenience, never a security control.

---

## Repository layout

```
campus-lost-found/
├── frontend/        React + Vite client        (empty — Milestone 3)
├── backend/         Node + Express JSON API    (empty — Milestone 2)
├── .gitignore       Files Git must never track
└── README.md        This file
```

`frontend/` and `backend/` each get their own `package.json` and their own
`node_modules/`. They share no code — only the HTTP API contract between them.

---

## Domain model

| Entity           | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| **User**         | A college member. Student/member or admin/moderator.           |
| **Item**         | A reported lost or found object. Belongs to one reporter.      |
| **Claim**        | A request to recover an Item. Pending, approved, or rejected.  |
| **Notification** | Tells a user something happened to their item or claim.        |
| **AuditLog**     | Immutable record of moderation and state changes.              |

### Core workflow

```
Register → Login → Report Item → Browse/Search → View Item
        → Submit Claim → Verify Ownership → Resolve Item → Close Case
```

### Business rules

- Authentication is required before any part of the application is accessible.
- Registration is restricted to the college email domain.
- One user may report many items; one item may receive many claims.
- **Multiple pending claims on one item are allowed** — disputes are real and
  the system must be able to represent them rather than prevent them.
- Approving one claim rejects the other pending claims for that item.
- A user may modify only their own resources. Admins may moderate any.
- Contact information is withheld until the claim reaches verification.

---

## Planned stack

Dependencies are added only when the problem they solve actually appears.
Nothing below is installed yet.

**Frontend** — React, Vite, Tailwind CSS, React Router, Axios, Framer Motion,
React Three Fiber (selective use only)

**Backend** — Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Zod, Multer,
Cloudinary, Helmet, CORS, express-rate-limit

**Deployment** — Frontend on Vercel · Backend on Render · Database on MongoDB Atlas

---

## Requirements

| Tool    | Required        | Notes                                        |
| ------- | --------------- | -------------------------------------------- |
| Node.js | **18 LTS or newer** | 20 LTS recommended. Node 16 is end-of-life and will not run Vite or current Express. |
| npm     | 9 or newer      | Ships with Node.                             |
| Git     | Any recent      | Version control.                             |

Check yours:

```bash
node -v && npm -v && git --version
```

---

## Getting started

```bash
git clone <repository-url>
cd campus-lost-found
```

Per-application install and run instructions are added in the milestone that
creates each application.

---

## Roadmap

- [x] **1 — Project structure.** Repository, folder layout, `.gitignore`, README.
- [ ] **2 — Express server.** A backend that starts and answers one request.
- [ ] **3 — Frontend scaffold.** Vite + React, talking to the backend.
- [ ] **4 — Database.** MongoDB Atlas connection, Mongoose models.
- [ ] **5 — Authentication.** Registration, login, JWT, password hashing.
- [ ] **6 — Items.** Report, browse, search, view.
- [ ] **7 — Claims.** Submit, verify, approve/reject, resolve.
- [ ] **8 — Media.** Image upload via Multer and Cloudinary.
- [ ] **9 — Admin.** Moderation, disputes, audit log.
- [ ] **10 — Hardening.** Helmet, CORS, rate limiting, validation review.
- [ ] **11 — Visual layer.** Motion and 3D, applied with purpose.
- [ ] **12 — Deployment.** Vercel, Render, Atlas, CI.

Exact scope is agreed before each milestone begins.
