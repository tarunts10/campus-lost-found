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

## Architecture

```
Browser
    |
    | HTTPS / JSON
    v
Frontend (React + Vite)          <- untrusted: all code is visible to the user
    |
    | REST API + Authorization: Bearer <JWT>
    v
Backend (Node.js + Express)      <- authoritative: enforces every rule
    |
    +-----------> MongoDB        <- users, institutions, items, claims
    |
    +-----------> ImageKit       <- image files (URLs and IDs stored in MongoDB)
```

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
│   │   ├── components/      Navbar, ItemCard, ImageUploader, ThemeToggle,
│   │   │                    Loader, StateBlock, Badge, Pagination,
│   │   │                    ProtectedRoute, CustomCursor, ...
│   │   ├── pages/           Home, Login, Register, Items, ItemDetail,
│   │   │                    ReportItem, MyItems, MyClaims, NotFound
│   │   ├── context/         AuthContext.jsx, ThemeContext.jsx
│   │   ├── services/        apiClient, auth, item, claim, institution, upload
│   │   ├── hooks/           useReveal, useParallax, useTilt, useDocumentTitle
│   │   ├── layouts/         MainLayout.jsx
│   │   ├── styles/          tokens.css, base.css, components.css, app.css
│   │   ├── utils/           constants.js, format.js
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

**Not yet deployed.** The application currently runs locally only.

Planned targets:

| Component | Target |
| --- | --- |
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |
| Images | ImageKit |

Production deployment is the next step. It will require: provisioning an Atlas
cluster, setting environment variables in each platform's dashboard, updating
`CORS_ORIGIN` and `VITE_API_URL` to the deployed URLs, configuring `trust proxy` on
Express so rate limiting sees real client IPs, and setting `NODE_ENV=production`.

---

## Project Status

**Working MVP — local development complete; production deployment pending.**

### Completed

- [x] Express + MongoDB backend with a layered structure
- [x] JWT authentication and bcrypt password hashing
- [x] Institution model with email-domain verification
- [x] Server-enforced institution isolation across items and claims
- [x] Item reporting, browsing, search, filtering, pagination
- [x] Ownership and role-based authorization
- [x] Claims workflow including approval, rejection, and competing-claim handling
- [x] Image uploads via ImageKit with multi-layer file validation
- [x] React + Vite frontend covering every backend feature
- [x] Light / dark / system theming with persistence
- [x] UI polish, responsive layout, loading / empty / error states
- [x] Accessibility pass with measured contrast
- [x] Manual integration testing of all of the above
- [x] Clean production build

### Remaining

- [ ] Production deployment (Vercel, Render, MongoDB Atlas)
- [ ] Production environment configuration and secret rotation
- [ ] Final verification against the deployed environment
- [ ] Automated test suite (none exists yet)

### Known limitations

- No automated tests — all verification has been manual
- Live ImageKit uploads require credentials; every validation layer before the
  ImageKit call is tested, the upload round-trip itself is not
- A user's institution cannot be changed after registration, and there is no
  admin path to move one
- There is no cross-institution super-administrator
- JWTs cannot be revoked before expiry; the token lifetime is the blast radius
- Abandoning the report form after uploading leaves orphaned files in ImageKit
- No notifications, audit log, password reset, or email verification
