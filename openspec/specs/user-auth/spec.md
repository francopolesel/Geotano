# User Authentication Specification

## Purpose

Register/login with unique usernames and stateless JWT sessions.

## Requirements

### Requirement: Registration
MUST register with unique username and password (8+ chars). MUST NOT create a user whose effective display name (explicit displayName, defaulting to username) trims and lowercases to the reserved creator name `geocreator`, unless the registering user's username is `francopolesel99`.
- **Success**: GIVEN a new username and a valid password, WHEN POST /auth/register, THEN JWT and profile are returned.
- **Duplicate**: GIVEN an existing username, WHEN POST /auth/register, THEN 409 is returned.
- **Reserved username**: GIVEN a non-creator registers with username `geocreator` (display name defaults to username), WHEN POST /auth/register, THEN 409 RESERVED_DISPLAY_NAME is returned and no user is created.
- **Reserved display name variant**: GIVEN a non-creator registers with a display name that trims and lowercases to `geocreator` (e.g. ` Geocreator `), WHEN POST /auth/register, THEN 409 RESERVED_DISPLAY_NAME is returned.
- **Google OAuth new user**: GIVEN a Google OAuth new-user flow whose provider name trims and lowercases to `geocreator`, WHEN OAuth registration completes, THEN 409 RESERVED_DISPLAY_NAME is returned and no user is created.
- **Creator exception**: GIVEN a user with JWT username `francopolesel99`, WHEN the creator registers or retains the display name `geocreator`, THEN the flow succeeds (no 409) and the display name is preserved.
- **Register error feedback**: GIVEN the register flow receives 409 RESERVED_DISPLAY_NAME, WHEN the auth store maps the error code, THEN the mapped i18n message is shown to the user.

### Requirement: Reserved display name on profile update
The system MUST return HTTP 409 RESERVED_DISPLAY_NAME when PATCH /api/auth/profile assigns an effective display name that trims and lowercases to `geocreator`, unless the authenticated user's username is `francopolesel99`.
- **Non-creator patch rejected**: GIVEN an authenticated non-creator user, WHEN PATCH /api/auth/profile with displayName `geocreator` or any case/spacing variant (e.g. `GEOCREATOR`), THEN 409 RESERVED_DISPLAY_NAME is returned and the display name is unchanged.
- **Creator patch allowed**: GIVEN the authenticated creator with username `francopolesel99`, WHEN PATCH /api/auth/profile with displayName `geocreator`, THEN 200 is returned and the display name is kept.

### Requirement: Login
MUST authenticate by username+password, issue stateless JWT.
- **Success**: GIVEN correct credentials, WHEN POST /auth/login, THEN signed JWT with user id + role.
- **Invalid**: GIVEN wrong password, WHEN POST /auth/login, THEN 401.

### Requirement: Token guard
MUST validate JWT on protected routes without server-side state.
- **Valid**: GIVEN valid non-expired JWT, WHEN protected endpoint, THEN request authenticated.
- **Expired**: GIVEN expired token, WHEN protected endpoint, THEN 401.
