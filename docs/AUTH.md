# Authentication

## Overview

Seasonal Harvest uses Supabase Auth for account registration, email/password login, password recovery, access-token verification, current-user lookup, and logout. The authentication router is mounted at `/api/v1/auth`.

## Implemented features

| Feature | Endpoint | Access |
|---|---|---|
| Sign up | `POST /api/v1/auth/sign-up` | Public |
| Sign in | `POST /api/v1/auth/sign-in` | Public |
| Forgot password | `POST /api/v1/auth/forgot-password` | Public |
| Reset password | `POST /api/v1/auth/reset-password` | Supabase bearer token |
| Current user | `GET /api/v1/auth/me` | Supabase bearer token |
| Sign out | `POST /api/v1/auth/sign-out` | Supabase bearer token |

Arcjet also protects these routes through the global shield, bot-detection, and token-bucket rules.

## Source files

| File | Responsibility |
|---|---|
| `routes/auth.routes.js` | Declares authentication endpoints |
| `controller/auth.controller.js` | Validates HTTP input and shapes responses |
| `services/auth.service.js` | Calls the Supabase Auth API |
| `middleware/auth.middleware.js` | Verifies Supabase bearer tokens and sets `req.user` |
| `config/supabase.js` | Configures the shared Supabase client |
| `config/env.js` | Loads Supabase and frontend configuration |

## Sign up

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "fullName": "Maria Santos",
  "email": "maria@example.com",
  "password": "secure-password"
}
```

`name` is also accepted as an alias for `fullName`. The full name must contain 2–100 characters, the email must be valid, and the password must contain at least 8 characters.

```json
{
  "success": true,
  "message": "Account created. Check your email to verify your account.",
  "data": {
    "user": {},
    "session": null
  }
}
```

When email confirmation is disabled in Supabase, `session` can contain an active session immediately after registration.

## Sign in

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "maria@example.com",
  "password": "secure-password"
}
```

```json
{
  "success": true,
  "message": "Signed in successfully.",
  "data": {
    "user": {},
    "session": {
      "access_token": "<access-token>",
      "refresh_token": "<refresh-token>",
      "expires_at": 0
    }
  }
}
```

The frontend should use `data.session.access_token` for protected API calls. Invalid credentials return `401` with a generic message.

## Protected requests

```http
Authorization: Bearer <access-token>
```

The middleware asks Supabase to validate the token and attaches the returned Supabase user to `req.user`. Missing, invalid, or expired tokens return `401`.

Get the authenticated user:

```http
GET /api/v1/auth/me
Authorization: Bearer <access-token>
```

## Forgot password

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

```json
{
  "email": "maria@example.com"
}
```

The backend asks Supabase to email a recovery link. It always returns a neutral response so callers cannot use the endpoint to discover registered accounts:

```json
{
  "success": true,
  "message": "If an account exists for that email, a password reset link has been sent."
}
```

When `FRONTEND_URL` is configured, the recovery link redirects to:

```text
<FRONTEND_URL>/reset-password
```

Add that URL to the allowed redirect URLs in the Supabase Auth dashboard.

## Reset password

After the frontend processes the Supabase recovery link, it must send the recovery session access token with the new password:

```http
POST /api/v1/auth/reset-password
Authorization: Bearer <recovery-access-token>
Content-Type: application/json
```

```json
{
  "password": "new-secure-password"
}
```

The new password must contain at least 8 characters.

```json
{
  "success": true,
  "message": "Password updated successfully.",
  "data": {
    "user": {}
  }
}
```

## Sign out

```http
POST /api/v1/auth/sign-out
Authorization: Bearer <access-token>
```

The backend requests a global Supabase sign-out, which revokes the user's refresh tokens. The frontend must also remove its stored access and refresh tokens.

## Frontend example

```js
const response = await fetch("http://localhost:<PORT>/api/v1/auth/sign-in", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

const result = await response.json();

if (!response.ok) {
  throw new Error(result.error || "Unable to sign in");
}

const accessToken = result.data.session.access_token;
```

Protected request:

```js
await fetch("http://localhost:<PORT>/api/v1/auth/me", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Public Supabase client key |
| `FRONTEND_URL` | Recommended | Frontend origin used for the reset-password redirect |

Never place a Supabase service-role key or another private secret in frontend code.

## Supabase configuration checklist

- Enable email/password authentication.
- Configure the site URL and `<FRONTEND_URL>/reset-password` redirect URL.
- Configure the email-confirmation policy.
- Customize confirmation and recovery email templates if needed.
- Confirm that the `handle_new_user` migration creates a `profiles` row.
- Review password strength and rate-limit settings in Supabase.
- Test recovery links in the deployed frontend environment.

## Response convention

Successful responses use:

```json
{
  "success": true,
  "message": "Operation completed.",
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "error": "Error message"
}
```
