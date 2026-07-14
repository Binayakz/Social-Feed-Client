# Social Feed Client

Frontend client for the Social Feed application, built with Next.js, TypeScript, and the provided HTML/CSS design assets.

This app implements authentication, protected feed access, post creation with optional image upload, comments and replies, like/unlike interactions, profile photo upload, and theme switching. It is designed to work with the companion backend API and is ready to deploy on AWS Amplify.

## Features

- Login and registration flows
- Secure cookie-based session handling
- Protected `/feed` route
- Public and private post visibility
- Create posts with text and optional image upload
- Feed ordered by newest first
- Like and unlike posts, comments, and replies
- Comment threads with nested replies
- Liker list modal
- Profile photo upload
- Avatar fallback using user initials
- Light and dark theme switcher
- UI adapted from the provided static design files

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Existing provided CSS assets for the final UI
- AWS Amplify for hosting

## Routes

### App routes

- `/login`
- `/register`
- `/feed`

### Frontend API routes

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/proxy/[...path]`

## Project Structure

```text
src/
  app/
    login/
    register/
    feed/
    api/
      auth/
      proxy/
  components/
    auth/
    feed/
  lib/
    backend.ts
    session.ts
    types.ts
public/
  assets/
    css/
    images/
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Running backend API

### Install dependencies

```bash
pnpm install
```

### Configure environment

Create `.env.local` with:

```bash
BACKEND_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

The frontend defaults to `http://127.0.0.1:8000/api/v1` if the variable is not set, but setting it explicitly is recommended.

### Start development server

```bash
pnpm dev
```

### Other useful scripts

```bash
pnpm lint
pnpm build
pnpm start
```

## Backend Expectations

The client assumes the backend exposes endpoints compatible with these flows:

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `POST /posts/compose`
- `GET /posts`
- `POST/DELETE /posts/{id}/like`
- `GET /posts/{id}/likes`
- `GET /posts/{id}/comments`
- `POST /posts/{id}/comments`
- `POST/DELETE /comments/{id}/like`
- `GET /comments/{id}/likes`
- `POST /users/me/profile-image`

## Authentication Flow

- Login and registration are handled through Next.js route handlers under `/api/auth/*`.
- On successful login, the frontend stores the backend access token in a secure HTTP-only cookie named `social_feed_access_token`.
- Protected data fetching is done server-side and through the authenticated proxy route.
- If the backend returns `401`, the proxy clears the cookie and the user is redirected back to `/login`.

## API Integration

The app uses a server-side proxy at `/api/proxy/[...path]` to forward authenticated requests to the backend API.

This gives a few benefits:

- the access token is not stored in `localStorage`
- the browser never talks to the backend with raw auth headers directly
- multipart requests such as post composition and profile image upload can be forwarded cleanly
- backend base URL stays configurable through environment variables

## Deployment

This project includes an `amplify.yml` configuration for AWS Amplify.

During build, Amplify writes the backend URL into `.env.production` using:

```bash
BACKEND_API_BASE_URL
```

Make sure this environment variable is configured in Amplify before deploying.

## Crucial Design Decisions

### 1. App Router with route handlers

Next.js App Router was used so page protection, server rendering, and auth helpers could stay close to the route structure.

### 2. Secure cookie-based auth

The backend token is stored in an HTTP-only cookie instead of `localStorage`. This reduces token exposure in the browser and keeps the authenticated flow centralized in server routes and proxy handlers.

### 3. Server-side proxy for backend calls

The `/api/proxy/[...path]` route forwards authenticated requests to the backend. This keeps backend URLs configurable, avoids leaking token handling across the UI, and supports JSON and multipart form submissions consistently.

### 4. Single-step post creation

Post creation uses a single multipart request to `POST /posts/compose` so text, visibility, and optional image are submitted together. This simplifies the frontend flow compared to uploading the image separately first.

### 5. Reusable avatar fallback

A shared avatar component is used throughout the app. It shows the user profile image when available and falls back to initials when not. This keeps the UI consistent across navbar, feed, comments, replies, and liker lists.

### 6. Theme switching through existing template hooks

The app uses the provided CSS dark-mode system by toggling the `._dark_wrapper` class and persisting the selected theme in `localStorage`. This preserves the original design language instead of replacing it with a new theming approach.

### 7. Static asset versioning awareness

Because template CSS is linked from `/public/assets`, cache behavior matters in production. Hosted environments may need cache busting for stylesheet updates.

## Known Limitations

- The post action dropdown is currently a UI placeholder.
- Forgot password is intentionally not implemented.
- Some UI elements from the original template remain presentational only.
- Theme preference is stored client-side and is not tied to a user profile.

## Notes

- The feed page is intentionally focused on the required functionality from the task.
- The UI follows the provided design assets rather than introducing a new design system.
