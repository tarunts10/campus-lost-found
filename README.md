# Campus Lost & Found

A private lost-and-found platform for schools and colleges. Verified members of an
institution can report items they have lost or found, browse and search everything
reported at their own institution, claim items that belong to them, and resolve those
claims — with ownership and institution boundaries enforced on the server.

Built as a full-stack application: React + Vite on the front end, Node.js + Express +
MongoDB on the back end, with JWT authentication and multi-tenant isolation between
institutions.

---

## Features

Everything listed here is implemented and working.

**Authentication and accounts**
- Registration and login with JSON Web Tokens (JWT)
- Passwords hashed with bcrypt (cost factor 12, unique salt per password)
- Password hashes excluded from every API response
- Institution selected at sign-up and verified against the account's email domain
- `GET /api/auth/me` restores a session on page refresh
- Expired, tampered, forged and malformed tokens all rejected with `401`
- Role changes and account deletion take effect immediately (the role is read from
  the database on each request, never from the token)

**Institution isolation (multi-tenancy)**
- Every user and every item belongs to exactly one institution
- Users only ever receive items and claims from their own institution
- `institutionId` is derived server-side from the authenticated user and is never
  read from the request body or query string
- Cross-institution access returns `404`, not `403`, so resource existence is not
  disclosed
- Admins are scoped to their own institution — an admin of one college has no
  authority over another

**Items**
- Report lost or found items with title, description, category, type, location, date
- Browse with keyword search across title and description
- Filter by type (LOST/FOUND), category, and status (ACTIVE/CLAIMED/RESOLVED)
- Pagination with full metadata (`page`, `limit`, `total`, `totalPages`)
- "My Items" view via a server-side `mine=true` filter
- Owners can edit and delete their own items; admins can moderate items within
  their institution

**Claims**
- Submit a claim with a written ownership-evidence message
- You cannot claim your own item
- One active claim per user per item, enforced by a partial unique index
- Item owners and admins approve or reject claims
- Approving a claim sets the item to `CLAIMED` and automatically rejects the other
  pending claims on that item
- Claim visibility is restricted to claims you filed plus claims on items you reported

**Images**
- Up to 5 images per item, stored in ImageKit (metadata only in MongoDB)
- JPEG, PNG and WEBP only, 5 MB per image
- Validated three ways: declared MIME type, file extension, and the file's actual
  magic bytes — so an executable renamed `.jpg` is rejected
- SVG deliberately rejected (it is XML and can carry scripts)
- Uploads are tagged with the uploader, and re-verified against ImageKit before
  being attached to an item, so a file ID belonging to someone else cannot be used
- Images are removed from ImageKit when an item is deleted or an image is removed

**Interface**
- Light / dark / system theme with a header toggle, persisted in `localStorage`,
  applied before first paint so there is no flash of the wrong theme
- Responsive from 375 px upward with no horizontal overflow
- Explicit loading, empty, and error states on every data-driven page
- Skeleton loaders, button loading states, and a route-change progress bar
- Keyboard-accessible with visible focus rings, labelled inputs, and a skip link
- WCAG AA colour contrast verified in both themes
- Six visual effects (hover, parallax, custom cursor, loaders, 3D tilt, entrance
  reveals), all respecting `prefers-reduced-motion`

**Security middleware**
- Helmet security headers, CORS restricted to a configured origin
- Rate limiting on authentication routes
- Zod request validation at the HTTP boundary, plus Mongoose schema validation
- Regex escaping on search input to prevent ReDoS

---

## Why This Project Exists

Most campus lost-and-found systems are one of two things: a physical desk that is
open four hours a day, or a group chat where "found a black wallet near the library"
scrolls out of sight in an hour. Both share the same failure — **there is no way to
check that the person collecting an item is the person who lost it.** Whoever
answers first, wins.

This project exists to fix that specific problem, and it shapes every decision in the
codebase:

- **Ownership is proved, not asserted.** A claimant has to describe something about
  the item that a stranger could not know. The person who filed the report reads
  that description and decides. Approving one claim automatically rejects the
  competing ones, so an item cannot be promised to two people.
- **The boundary is the institution.** A lost student ID is only meaningful inside
  one college, and publishing one to the open internet is a privacy problem rather
  than a feature. Every account belongs to exactly one institution and the server
  filters every query by it.
- **Contact details stay private.** A report never publishes an email address or a
  phone number. That conversation only opens once a claim is approved.

It is also a deliberate teaching codebase. The comments explain *why* a decision was
made and what the alternative would have cost — the trade-offs, the failure modes,
and in several places the bug that motivated the current shape of the code.

---

## Architecture

```
                        ┌─────────────────┐
                        │     Browser     │
                        └────────┬────────┘
                                 │  HTTPS
                                 v
                  ┌──────────────────────────────┐
                  │   Vercel  —  React + Vite    │   UNTRUSTED
                  │   static build (SPA)         │   every line is public
                  └──────────────┬───────────────┘
                                 │
                                 │  REST + `Authorization: Bearer <JWT>`
                                 v
                  ┌──────────────────────────────┐
                  │   Render  —  Node + Express  │   AUTHORITATIVE
                  │   authn · authz · isolation  │   the only enforcement point
                  └───────┬──────────────┬───────┘
                          │              │
             users,       │              │   image bytes
             institutions,│              │   (multipart, proxied)
             items, claims│              │
                          v              v
              ┌────────────────┐   ┌──────────────────┐
              │ MongoDB Atlas  │   │    ImageKit      │
              └────────────────┘   └──────────────────┘
                                     stores the FILES;
                                     Mongo stores only
                                     url + fileId + name
```

The browser never talks to MongoDB or ImageKit directly. Uploads are proxied through
the backend specifically so `IMAGEKIT_PRIVATE_KEY` never leaves the server — see
[Image Upload Architecture](#image-upload-architecture).

**The frontend is untrusted.** Every line of it is downloaded by the user and can be
read or modified. It hides buttons the user cannot use, but hiding a button is a
convenience, not a security control.

**The backend is authoritative.** Authentication, authorization, and institution
isolation are all enforced server-side:

- *Authentication* — a JWT is verified on every protected request, and the user is
  loaded fresh from the database
- *Authorization* — ownership is compared against the stored `reportedBy`, never
  against anything the client sends
- *Institution isolation* — every query is scoped by the authenticated user's
  `institutionId`

**MongoDB** stores application data. **ImageKit** stores image files; MongoDB holds
only the URL, file ID, and original filename.

---

---

## Tech Stack

Every dependency here was added when a specific problem required it, and each one
earns its place. There is no UI framework, no CSS framework, no state-management
library, and no animation library.

### Backend

| Package | Version | Why it is here |
| --- | --- | --- |
| `express` | ^5.2.1 | HTTP routing and middleware |
| `mongoose` | ^9.9.4 | Schemas, validation, and query building for MongoDB |
| `jsonwebtoken` | ^9.0.3 | Signs and verifies the session token |
| `bcrypt` | ^6.0.0 | Password hashing (cost factor 12) |
| `zod` | ^4.4.3 | Validates and strips request bodies at the HTTP boundary |
| `helmet` | ^8.3.0 | Security response headers |
| `cors` | ^2.8.6 | Restricts which origin may call the API |
| `express-rate-limit` | ^8.6.2 | Throttles authentication routes |
| `multer` | ^2.2.0 | Parses `multipart/form-data` uploads into memory |
| `imagekit` | ^6.0.0 | Uploads, tags, and deletes image files |

No `dotenv`: Node's built-in `--env-file` covers it.
No test framework yet — see [Current Limitations](#current-limitations).

### Frontend

Four runtime dependencies, total.

| Package | Version | Why it is here |
| --- | --- | --- |
| `react` / `react-dom` | ^19.2.8 | UI rendering |
| `react-router-dom` | ^7.18.2 | Client-side routing |
| `axios` | ^1.20.0 | HTTP client, interceptors, upload progress events |

Build tooling is Vite 8 with `@vitejs/plugin-react`, and `oxlint` for linting.

**Styling** is plain CSS with custom properties, in four layers:
`tokens.css` (the design system) → `base.css` (reset, layout, motion) →
`components.css` (reusable vocabulary) → `app.css` (page layout).

**Motion** is CSS transitions, `IntersectionObserver`, and `requestAnimationFrame` —
no animation library. The 3D on the home page is CSS `perspective` and per-layer
`translateZ`, not WebGL. That is a deliberate trade: `three` + `@react-three/fiber`
would add roughly 150 KB gzipped and require a fallback path for blocked or
software-rendered WebGL, to produce depth that CSS composites on the GPU for free.

## Repository Structure

```
campus-lost-found/
├── backend/
│   ├── src/
│   │   ├── config/          db.js, imagekit.js
│   │   ├── controllers/     auth, institution, item, claim, upload
│   │   ├── middleware/      authMiddleware, validate, upload,
│   │   │                    rateLimiter, errorHandler
│   │   ├── models/          User.js, Institution.js, Item.js, Claim.js
│   │   ├── routes/          auth, institution, item, claim, upload
│   │   ├── validators/      authValidators, itemValidators, claimValidators
│   │   ├── utils/           jwt.js
│   │   ├── app.js           middleware order + route mounting
│   │   └── server.js        env check -> DB connect -> listen
│   ├── scripts/
│   │   ├── seed-institutions.js
│   │   └── migrate-users-to-institution.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      Navbar, Footer, ItemCard, Badge, Pagination,
│   │   │                    ImageUploader, SmartImage, Lightbox,
│   │   │                    ConfirmDialog, Toaster, ThemeToggle, Loader,
│   │   │                    StateBlock, ProtectedRoute, CustomCursor,
│   │   │                    RouteProgress, ScrollToTop
│   │   ├── pages/           Home, Login, Register, Items, ItemDetail,
│   │   │                    ReportItem, MyItems, MyClaims, NotFound
│   │   ├── context/         AuthContext, ThemeContext, ToastContext
│   │   ├── services/        apiClient, auth, item, claim, institution, upload
│   │   ├── hooks/           useReveal, useParallax, useTilt, useMagnetic,
│   │   │                    useScene3D, useDocumentTitle
│   │   ├── layouts/         MainLayout.jsx
│   │   ├── styles/          tokens.css, base.css, components.css, app.css
│   │   ├── utils/           constants.js, format.js, media.js
│   │   ├── App.jsx          route table
│   │   └── main.jsx         entry point + providers
│   ├── index.html           includes the pre-paint theme bootstrap
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## Data Model

Four collections, related by reference (no duplicated documents).

```
Institution
  name, slug (unique), emailDomain (unique), isActive, timestamps

User
  name, email (unique), password (bcrypt hash, never returned),
  role (STUDENT | ADMIN), timestamps
  └── institutionId  ->  Institution

Item
  title, description, category, type (LOST | FOUND),
  location, date, status (ACTIVE | CLAIMED | RESOLVED),
  images[] { url, fileId, name }   (max 5), timestamps
  ├── institutionId  ->  Institution
  └── reportedBy     ->  User

Claim
  message, status (PENDING | APPROVED | REJECTED), timestamps
  ├── item      ->  Item
  └── claimant  ->  User
```

**Relationships**

- One institution has many users and many items
- One user reports many items; one item has exactly one reporter
- One item can receive many claims, from many different users — disputes are
  something the system represents rather than prevents
- A user may hold only one *active* (PENDING or APPROVED) claim per item

**Why `institutionId` is stored on `Item`.** It could be derived by following
`reportedBy` to its user, but it is used in the filter of *every* item query.
Denormalising it avoids a second lookup per request for a value that never changes
after creation.

**Images are metadata only.** The image bytes live in ImageKit. Storing binaries in
MongoDB would bloat every document and eventually hit the 16 MB document limit.

---

---

## Item Workflow

An item is a **report**, not an object in a warehouse. It records that someone lost
or found something, and it moves through three states.

```
   report filed
        │
        v
    ┌────────┐   a claim is approved    ┌──────────┐
    │ ACTIVE │ ──────────────────────>  │ CLAIMED  │
    └────────┘                          └──────────┘
        │                                     │
        │  reporter edits or deletes          │  handed over
        │                                     v
        │                               ┌──────────┐
        └─────────────────────────────> │ RESOLVED │
                                        └──────────┘
```

| Step | Who | What the server enforces |
| --- | --- | --- |
| Create | any member | `reportedBy` and `institutionId` are taken from the JWT, never the body. `status` defaults to `ACTIVE` and cannot be set by the client. |
| Browse | any member | The query **starts** scoped to the caller's institution. Unknown query parameters are rejected with `400` rather than ignored. |
| Edit | reporter or admin | Only six fields are updatable: `title`, `description`, `category`, `type`, `location`, `date`, plus `images`. `reportedBy`, `status` and `institutionId` are not in the list, so an item can never change owner or institution. |
| Delete | reporter or admin | The item is removed, then its ImageKit files are deleted best-effort. Failing to reach ImageKit does not fail the delete — an undeletable item would be worse than an orphaned file. |

Cross-institution access returns **`404`, not `403`**, so the API never confirms that
an item exists in another college.

---

## Claims Workflow

This is the part that makes the product work, and the part with the real concurrency
problem.

```
  member submits evidence          reporter decides
          │                               │
          v                               v
     ┌─────────┐   approve   ┌──────────┐
     │ PENDING │ ──────────> │ APPROVED │   item -> CLAIMED
     └─────────┘             └──────────┘   all other PENDING claims -> REJECTED
          │
          │ reject
          v
     ┌──────────┐
     │ REJECTED │   item stays ACTIVE, others may still claim
     └──────────┘
```

Rules, all enforced server-side:

- You cannot claim an item you reported yourself (`400`).
- You cannot file a second claim on the same item (`409`), enforced by a **partial
  unique index**, not by an application-level check that a race could slip past.
- Only the reporter or an admin may decide a claim (`403`).
- A claim can only be decided while it is `PENDING` and the item is `ACTIVE` (`409`).
- A claimant sees only their own claim; a reporter sees every claim on their items.
  The same endpoint serves both — the backend decides visibility.

**Why approval locks the item first.** MongoDB running as a standalone server has no
transactions, so "mark the claim approved" and "mark the item claimed" cannot be one
atomic unit. The order is therefore deliberate: an atomic
`findOneAndUpdate({ _id, status: 'ACTIVE' }, { status: 'CLAIMED' })` runs **first**,
as a compare-and-set. Two simultaneous approvals mean exactly one wins the item lock
and the other gets `409`. A crash between the two writes leaves an item marked
claimed with a still-pending claim — visibly odd, and fixable. The reverse order
could produce two approved claims on one item, which is the failure that actually
matters.

Verified under load: five simultaneous duplicate claims returned
`[201, 409, 409, 409, 409]`; two simultaneous approvals returned `[200, 409]`.

---

## Image Upload Architecture

```
  browser                backend                     ImageKit
     │                      │                            │
     │ 1. multipart POST    │                            │
     │    /api/uploads/image│                            │
     │─────────────────────>│                            │
     │                      │ protect      (401 if anonymous)
     │                      │ multer       (type, extension, 5 MB cap)
     │                      │ magic bytes  (the real check)
     │                      │                            │
     │                      │ 2. upload, tagged uploader_<id>
     │                      │───────────────────────────>│
     │                      │<───────────────────────────│
     │ 3. { url, fileId, name }                          │
     │<─────────────────────│                            │
     │                      │                            │
     │ 4. POST /api/items with those references          │
     │─────────────────────>│ 5. re-ask ImageKit for each
     │                      │    file's tags and confirm
     │                      │    THIS user uploaded it ─>│
     │                      │ 6. store url + fileId + name in MongoDB
```

**Why uploads are proxied rather than sent straight to ImageKit.** Direct browser
upload needs either the private key in the client — which would let anyone upload to
and delete from the account — or a signed-token endpoint, which is most of this code
anyway. Proxying means `IMAGEKIT_PRIVATE_KEY` never leaves the server, the uploader
is authenticated before a single byte is accepted, and validation is ours rather than
the client's. The cost is that image bytes pass through the backend; with a 5 MB cap
that is a fine trade.

**Three layers of file validation**, because the first two are advisory:

1. `Content-Type` — supplied by the client, so it stops honest mistakes only.
2. File extension — also client-supplied.
3. **Magic bytes** — the first bytes of the actual content (`FF D8 FF` for JPEG,
   `89 50 4E 47 0D 0A 1A 0A` for PNG, `RIFF`/`WEBP` for WebP). Renaming
   `payload.exe` to `photo.jpg` and declaring `image/jpeg` defeats layers 1 and 2 and
   fails here.

SVG is rejected deliberately: it is XML that can contain `<script>`, so serving
user-uploaded SVG is a stored-XSS vector.

**Ownership is verified against ImageKit, not trusted from the client.** Every upload
is tagged `uploader_<userId>`. When an item is submitted carrying image `fileId`s, the
backend asks ImageKit for each file's real tags and confirms this user uploaded it —
so a guessed or copied `fileId` cannot be attached to someone else's report. The
stored `url` is taken from ImageKit's response, never from the client, so a valid
`fileId` cannot be paired with a URL pointing somewhere else.

Limits: **5 images per item, 5 MB per image**, JPEG / PNG / WebP only. Removing an
image during an edit, or deleting the item, removes the file from ImageKit
best-effort.

If the `IMAGEKIT_*` variables are absent the rest of the application runs normally and
the upload endpoint returns `503` with a clear message — image upload is an optional
capability, not a startup requirement.

## Authentication Flow

### Register

```
Client
  -> POST /api/auth/register  { institutionId, name, email, password }
  -> Zod validation           (shape, email format; email trimmed + lowercased)
  -> Institution checks       exists? active? does the email domain match?
  -> Duplicate email check    -> 409 if taken
  -> User.create()            pre-save hook hashes the password with bcrypt
  -> MongoDB                  only the hash is ever written
  <- 201 { user }             no password field in the response
```

The email-domain check is what makes the institution meaningful. Anyone can *claim*
to attend a college; only someone with an address at that college's domain can
register for it.

### Login

```
Client
  -> POST /api/auth/login  { email, password }
  -> rate limiter          throttles repeated attempts per IP
  -> Zod validation
  -> User.findOne(...).select('+password')
                           the hash is excluded by default and opted into here
  -> bcrypt.compare()      re-hashes the attempt with the stored salt;
                           a hash cannot be reversed
  -> signToken(user._id)   HS256, payload is { sub, iat, exp }
  <- 200 { token, user }
```

Both failure modes — wrong password and no such account — return an identical `401`,
so registered email addresses cannot be enumerated.

### Authenticated request

```
Client
  -> GET /api/auth/me
     Authorization: Bearer <token>
  -> protect middleware
       parse the header            missing/malformed -> 401
       jwt.verify(token, SECRET)   bad signature or expired -> 401
       User.findById(payload.sub)  deleted account -> 401
       req.user = user             the only trusted identity in the app
  -> controller
  -> MongoDB
  <- 200 { user }
```

A JWT's payload is **encoded, not encrypted** — anyone holding a token can read it.
What the signature provides is integrity: change one byte and verification fails.
The token carries only the user ID, so the role and institution are always read fresh
from the database.

> **`req.body` is a claim. `req.user` is a fact.**

---

## Institution Isolation

This is the most important security property of the application.

Each user belongs to one institution. Each item belongs to one institution. A user
must never see, modify, or claim anything from another institution.

**How it is enforced.** `institutionId` comes from `req.user`, which was loaded from
the database using a cryptographically verified token. It is never read from the
request body or the query string.

```js
// Reading items — the filter STARTS scoped, and nothing can widen it
const filter = { institutionId: institutionIdOf(req.user) };

// Reading one item — scoped in the query, so another institution's
// document is never even loaded into memory
const item = await Item.findOne({
  _id: id,
  institutionId: institutionIdOf(req.user),
});

// Creating an item — copied from the authenticated user, never the body
const item = await Item.create({
  ...allowedFields,
  reportedBy: req.user._id,
  institutionId: institutionIdOf(req.user),
});
```

**Example.** Alice is at Example College. Bob is at VIT Vellore.

| Bob tries to… | Result |
| --- | --- |
| `GET /api/items` | Only VIT Vellore items — Alice's are absent |
| `GET /api/items/<Alice's item id>` | `404 Item not found` |
| `PATCH` or `DELETE` Alice's item | `404 Item not found` |
| `POST /api/items/<Alice's item>/claims` | `404 Item not found` |
| `GET /api/items?institutionId=<Example College>` | `400 Unknown query parameter` |
| `POST /api/items` with `institutionId` in the body | Ignored; stored as VIT Vellore |
| `PATCH /api/claims/<Alice's claim id>` | `404 Claim not found` |

Cross-institution access returns `404` rather than `403` on purpose. A `403` would
confirm the resource exists, letting someone probe another institution's data.

---

## API Endpoints

Base URL: `http://localhost:5000/api`

### Health

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/api/health` | Liveness plus database connection state | None |

### Institutions

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/api/institutions` | Active institutions, for the sign-up form | None |

Read-only by design. Institutions are created by an administrator running a
server-side script — a public create endpoint would let anyone invent a college and
register inside another institution's tenancy.

### Authentication

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Create an account (rate limited) | None |
| POST | `/api/auth/login` | Exchange credentials for a JWT (rate limited) | None |
| GET | `/api/auth/me` | Current user + institution | Bearer |

### Items

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/api/items` | Report a lost or found item | Bearer |
| GET | `/api/items` | List, search, filter, paginate | Bearer |
| GET | `/api/items/:id` | One item | Bearer |
| PATCH | `/api/items/:id` | Update — owner or institution admin | Bearer |
| DELETE | `/api/items/:id` | Delete — owner or institution admin | Bearer |

Query parameters on `GET /api/items`: `search`, `type`, `category`, `status`,
`mine`, `page`, `limit`. Unknown parameters are rejected with `400`.

### Claims

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/api/items/:id/claims` | File a claim against an item | Bearer |
| GET | `/api/claims` | Claims you filed + claims on your items | Bearer |
| PATCH | `/api/claims/:id` | Approve or reject — item owner or admin | Bearer |

Query parameters on `GET /api/claims`: `status`, `item`, `page`, `limit`.

### Uploads

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/api/uploads/image` | Upload one image (multipart/form-data, field `image`) | Bearer |

### Response format

Every endpoint uses the same envelope.

```jsonc
// Success
{ "success": true, "data": ... }

// List endpoints add pagination
{ "success": true, "count": 9, "pagination": { "page": 1, "limit": 9,
  "total": 24, "totalPages": 3, "hasNextPage": true, "hasPrevPage": false },
  "data": [ ... ] }

// Error — always exactly these two fields, never a stack trace
{ "success": false, "message": "Item not found" }
```

Status codes: `400` validation, `401` not authenticated, `403` not permitted,
`404` not found, `409` conflict, `429` rate limited, `503` uploads not configured,
`500` unexpected.

---

## Environment Variables

Real values live in `.env` files, which are git-ignored. Templates with placeholders
are committed as `.env.example`.

### Backend — `backend/.env`

| Variable | Purpose | Secret |
| --- | --- | --- |
| `PORT` | HTTP port (default 5000) | No |
| `NODE_ENV` | `development` or `production` | No |
| `MONGODB_URI` | MongoDB connection string | **Yes** |
| `JWT_SECRET` | Key used to sign and verify tokens | **Yes** |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` | No |
| `AUTH_RATE_LIMIT_MAX` | Auth requests per IP per 15 minutes | No |
| `CORS_ORIGIN` | Browser origin allowed to call the API | No |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key | No |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key | **Yes** |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit delivery URL | No |

The three secrets above are **server-only** and must never appear in frontend code,
in a `VITE_`-prefixed variable, or in the repository.

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Image uploads are optional: with the ImageKit variables blank, the application runs
normally and `POST /api/uploads/image` returns `503` with a clear message.

### Frontend — `frontend/.env`

| Variable | Purpose | Secret |
| --- | --- | --- |
| `VITE_API_URL` | Base URL of the backend API, e.g. `http://localhost:5000/api` | No |

Vite replaces `import.meta.env.VITE_*` with literal values **at build time**, so
anything with that prefix ends up in the JavaScript bundle every visitor downloads.
Only public configuration belongs here. This is exactly why image uploads are proxied
through the backend rather than sent to ImageKit from the browser — the private key
never reaches the client.

---

## Local Development

### Prerequisites

- Node.js 18 or newer (developed on 22)
- MongoDB running locally on `27017`, or a MongoDB Atlas connection string
- An ImageKit account (optional — only needed for image uploads)

### 1. Clone

```bash
git clone <repository-url>
cd campus-lost-found
```

### 2. Backend

```bash
cd backend
npm install
copy .env.example .env
```

*(macOS/Linux: `cp .env.example .env`)*

Edit `backend/.env` and set at minimum `MONGODB_URI` and `JWT_SECRET`.

### 3. Create at least one institution

Nobody can register until an institution exists, because sign-up requires choosing
one and matching its email domain.

```bash
node --env-file=.env scripts/seed-institutions.js --dev
```

That creates two example institutions. To add a real one:

```bash
node --env-file=.env scripts/seed-institutions.js --name "VIT Vellore" --slug vit-vellore --domain vitstudent.ac.in
```

Other options: `--list`, and `--slug <slug> --deactivate`.

### 4. Start the backend

```bash
npm run dev
```

Runs on `http://localhost:5000` with automatic restart on file changes
(`node --watch`). Use `npm start` for a non-watching run.

### 5. Frontend

In a second terminal:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Runs on `http://localhost:5173`. That port matters — it is the default `CORS_ORIGIN`
on the backend. If Vite starts on a different port, update `CORS_ORIGIN` to match.

### 6. Open the application

Go to `http://localhost:5173`, register with an email matching your institution's
domain (for the dev seed: `you@example.edu` or `you@vitstudent.ac.in`), and sign in.

### Available scripts

| Location | Command | Purpose |
| --- | --- | --- |
| backend | `npm run dev` | Start with file watching |
| backend | `npm start` | Start without watching |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | Production build to `dist/` |
| frontend | `npm run preview` | Serve the production build locally |
| frontend | `npm run lint` | Run oxlint |

---

## Testing

**All testing to date is manual and integration-level. There is no automated test
suite in the repository.** Test scripts were written and run against the live
application during development, then removed; they are not committed and there is no
`npm test` command.

Verified by driving the running application and the live API:

**Authentication**
- Registration succeeds with a matching institution email domain
- Registration is rejected for a wrong domain, and for lookalike domains such as
  `evilexample.edu`
- Duplicate registration returns `409`
- Registration with a non-existent, malformed, or missing `institutionId` is rejected
- Login succeeds with correct credentials and returns a token plus institution
- Wrong password and unknown account return an identical `401`
- Timing of both failure paths measured within ~44 ms of each other, so accounts
  cannot be enumerated by response time
- `/api/auth/me` works with a valid token; missing, garbage, tampered, wrongly signed,
  and expired tokens are all rejected with `401`
- A user promoted to ADMIN in the database gains admin rights immediately using their
  existing token; demotion and account deletion take effect just as quickly

**Institution isolation**
- A user of one institution cannot list, read, modify, delete, or claim another
  institution's items
- `?institutionId=` is rejected; `mine=false` and `search=` cannot cross the boundary
- A forged `institutionId` or `reportedBy` in a request body is ignored in favour of
  the authenticated user
- An admin of one institution cannot manage another institution's items or claims,
  but can moderate within their own

**Ownership and claims**
- A student can edit and delete only their own items (`403` otherwise)
- `PATCH` cannot transfer ownership or force a status change
- A user cannot claim their own item, and cannot file two active claims on one item
- Only the item owner or an admin can decide a claim; the claimant cannot approve
  their own
- Approving a claim sets the item to `CLAIMED` and rejects competing pending claims
- Concurrency: five simultaneous duplicate claims produced exactly one claim; two
  simultaneous approvals produced exactly one approval

**Images**
- Uploads require authentication
- Unsupported types, oversized files (>5 MB), SVG, and missing files are rejected
- An executable renamed `.jpg` with a forged `image/jpeg` header is rejected by the
  magic-byte check
- More than five images per item is rejected
- Valid JPEG/PNG/WEBP pass every validation layer

**Frontend**
- Register, login, logout, session restore on refresh, browse, search, filters,
  item details, report, edit, delete, my items, claims
- Light, dark and system themes; preference persists across refresh
- Colour contrast measured in both themes — all sampled pairs pass WCAG AA
- No horizontal overflow at 375 px, 768 px, or desktop widths
- All entrance-reveal elements become visible on scroll; none stay hidden
- Every form input has an associated label; no button lacks an accessible name

**Build**
- `npm run build` completes with no errors or warnings

---

## Security

Implemented and verified:

| Measure | Detail |
| --- | --- |
| Password hashing | bcrypt, cost factor 12, unique salt per password |
| Token authentication | JWT (HS256); payload carries only the user ID |
| Fresh authorization data | Role and institution read from the database per request |
| Password exclusion | `select: false` on the schema, a `toJSON` transform, and explicit response shaping |
| Server-side authorization | Ownership compared against stored values, never client input |
| Institution isolation | Every query scoped by the authenticated user's institution |
| Mass-assignment defence | Zod strips unknown keys; controllers pick allowed fields explicitly |
| Input validation | Zod at the HTTP boundary, Mongoose at the database boundary |
| Rate limiting | `express-rate-limit` on authentication routes |
| Security headers | Helmet (CSP, HSTS, nosniff, frame options); `X-Powered-By` removed |
| CORS | Restricted to a configured origin, never `*` |
| Account enumeration | Identical error and comparable timing for both login failures |
| Upload validation | MIME type, extension, and magic bytes; SVG rejected |
| Upload ownership | Files tagged with the uploader and re-verified against ImageKit |
| ReDoS protection | Regex metacharacters escaped in search input |
| Error handling | One response shape; no stack traces; internal 500 details never returned |
| Secret management | All secrets in git-ignored `.env`; only `VITE_API_URL` reaches the browser |

---

## Deployment

**Not yet deployed.** The application runs locally only. This section describes the
intended topology and what has to be true before it goes live.

### Target architecture

| Component | Platform | Notes |
| --- | --- | --- |
| Frontend | Vercel | Static build of `frontend/`; `npm run build` → `dist/` |
| Backend | Render | Web service running `npm start` from `backend/` |
| Database | MongoDB Atlas | Replica set, so transactions become available |
| Images | ImageKit | Already integrated; only needs credentials |

### Deployment steps

1. **Provision MongoDB Atlas.** Create a cluster and a database user, restrict
   network access to Render's egress addresses rather than `0.0.0.0/0`, and take the
   connection string.
2. **Generate fresh production secrets.** Do not reuse the development `JWT_SECRET`:

   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

3. **Deploy the backend to Render** with root directory `backend`, build
   `npm install`, start `npm start`, and these environment variables set in the
   dashboard (never in the repository):

   `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
   `CORS_ORIGIN` (the Vercel URL), `AUTH_RATE_LIMIT_MAX`, and the three
   `IMAGEKIT_*` values.

4. **Configure `trust proxy` on Express.** Render terminates TLS at a proxy, so
   without this the rate limiter sees the proxy's IP and applies one shared limit to
   every user on the planet. Set it to the specific number of proxy hops — `true`
   is unsafe, because it makes Express believe any `X-Forwarded-For` header a client
   sends, which lets an attacker spoof their IP and bypass rate limiting entirely.
5. **Deploy the frontend to Vercel** with root directory `frontend`, and set
   `VITE_API_URL` to `https://<your-backend>.onrender.com/api`. Note that Vite
   inlines `VITE_*` values at *build* time, so changing it requires a rebuild.
6. **Add an SPA rewrite** so deep links work: any path that is not a static file must
   serve `index.html`, otherwise reloading `/items/abc123` returns a 404 from the CDN.
7. **Seed at least one institution** against the production database:

   ```
   node --env-file=.env scripts/seed-institutions.js --name "VIT Vellore" --slug vit-vellore --domain vitstudent.ac.in
   ```

8. **Verify against the deployed environment**: registration, login, browse, report,
   upload, claim, approve, and a cross-institution isolation check.

### Before going live

- [ ] Fresh `JWT_SECRET`, not the development value
- [ ] `CORS_ORIGIN` set to the exact Vercel origin, never `*`
- [ ] `trust proxy` set to a hop count, not `true`
- [ ] Atlas network access restricted
- [ ] `IMAGEKIT_*` configured
- [ ] The five legacy accounts without an institution resolved or removed
- [ ] `NODE_ENV=production`

---

## Current Limitations

Known and accepted, stated plainly rather than discovered later.

- **No automated test suite.** Every behaviour described in this README was verified
  by hand. This is the single biggest gap in the project.
- **The ImageKit round-trip is untested without credentials.** Every validation layer
  before the ImageKit call is verified, including the magic-byte check; a valid JPEG
  reaches the upload call and fails only on the missing keys.
- **A user's institution is fixed at registration.** There is no admin path to move
  an account between institutions, by design — but it means a mistake needs a script.
- **No cross-institution super-administrator.** An admin's authority stops at their
  own college.
- **JWTs cannot be revoked before they expire.** Deleting an account takes effect
  immediately because the user is re-read on every request, but a stolen token stays
  valid until it expires. The token lifetime is the blast radius.
- **Abandoning the report form after uploading leaves orphaned files in ImageKit.**
  Images upload before the item is submitted, so failures surface while the form can
  still be fixed; the cost is unreferenced files.
- **Marketing photography is loaded from an external CDN.** If `images.unsplash.com`
  is blocked, those panels fall back to a themed gradient. No item photo depends on
  it — those come only from user uploads.
- **No notifications, audit log, password reset, or email verification.**
- **Search is a case-insensitive regex** over title and description. Correct and
  ReDoS-safe, but it will not scale to a large collection without a text index.

---

## Future Improvements

Roughly in the order they would be worth doing:

1. **An automated test suite** — integration tests against the API for the
   authorization and isolation rules, which are the parts where a regression would be
   both silent and serious.
2. **Deploy to production** — Vercel, Render, and MongoDB Atlas, with fresh secrets
   and `trust proxy` configured correctly.
3. **Email verification at registration**, so an institution's email domain proves
   the address rather than just matching a pattern.
4. **Password reset**, which needs transactional email.
5. **Notifications** when a claim is filed or decided — currently the only way to
   find out is to check the page.
6. **A MongoDB text index** with weighting, replacing the regex search.
7. **Refresh tokens with revocation**, so a compromised session can be ended.
8. **A scheduled sweep for orphaned ImageKit files.**
9. **An admin view** for managing institutions without running a script.
10. **Image thumbnails** via ImageKit transformations, so grids fetch small
    derivatives instead of full uploads.

---

## License

ISC. See `backend/package.json`.
