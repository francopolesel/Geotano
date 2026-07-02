# User Authentication Specification

## Purpose

Register/login with unique usernames and stateless JWT sessions.

## Requirements

### Requirement: Registration
MUST register with unique username and password (8+ chars).
- **Success**: GIVEN new username and valid password, WHEN POST /auth/register, THEN JWT + profile returned.
- **Duplicate**: GIVEN existing username, WHEN POST /auth/register, THEN 409.

### Requirement: Login
MUST authenticate by username+password, issue stateless JWT.
- **Success**: GIVEN correct credentials, WHEN POST /auth/login, THEN signed JWT with user id + role.
- **Invalid**: GIVEN wrong password, WHEN POST /auth/login, THEN 401.

### Requirement: Token guard
MUST validate JWT on protected routes without server-side state.
- **Valid**: GIVEN valid non-expired JWT, WHEN protected endpoint, THEN request authenticated.
- **Expired**: GIVEN expired token, WHEN protected endpoint, THEN 401.
