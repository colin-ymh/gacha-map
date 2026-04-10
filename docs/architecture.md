# Architecture

This document describes the current structure of the `gacha-map` codebase.
Implementation rules and workflow rules should follow `CLAUDE.md` and related rule documents.

## Overview

`gacha-map` is a Next.js-based web application for discovering gacha shops and related shop information.

The application uses:
- Supabase for database access and authentication
- Naver Maps for map rendering
- Server Components for initial data fetching
- Client Components for browser APIs and interactive UI

This document should describe the current codebase only.
Planned or future changes should be documented separately.

## Tech Stack

| Area | Technology                         |
|------|------------------------------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Styled-Component         |
| Backend | Supabase (PostgreSQL + Auth)       |
| Map | Naver Maps JavaScript API v3       |
| Language | TypeScript 5                       |

## Project Structure

```text
src/
├── app/          # route entry points
├── components/   # shared and page-level UI
├── lib/          # shared logic and integrations
├── types/        # shared types

supabase/
└── schema.sql    # schema and RLS definition
```

## Directory Notes

- `src/app/` contains route-level files and page entry points.
- `src/components/` contains reusable UI components.
- `src/lib/supabase/` contains Supabase clients for browser and server environments.
- `src/proxy.ts` handles session refresh and admin route protection.
- `supabase/schema.sql` defines tables, indexes, and RLS policies.

## Rendering Strategy

The project uses Server Components by default for initial data fetching.
Client Components are used only when browser APIs, SDKs, or interactive state are required.

### General Rules

- Prefer Server Components for initial data fetching.
- Use Client Components only when browser APIs, local interaction state, or third-party browser SDKs are required.
- Keep browser-only logic out of Server Components.

## Data Flow

### Read Flow

1. A request enters the application.
2. `proxy.ts` refreshes the session and protects admin routes.
3. A Server Component queries Supabase using the cookie-based session.
4. RLS returns only approved shop data for public views.
5. The server passes fetched data to Client Components through props.
6. Client Components render the map and list UI.

### Write Flow

1. A user interacts with a form or action button.
2. A Client Component uses the browser Supabase client.
3. The request is sent directly to Supabase.
4. Authentication and RLS policies control access.

## Authentication

- Supabase Auth is used for authentication.
- Sessions are stored in cookies via `@supabase/ssr`.
- `proxy.ts` refreshes the session on every request.
- `/admin/*` routes redirect unauthenticated users to `/login`.
- General user access is primarily controlled through RLS policies.

## Notes

- This document should stay aligned with the actual codebase.
- If the folder structure, rendering strategy, or authentication flow changes, this document should be updated.
- Planned features such as future admin pages should be documented separately until implemented.
