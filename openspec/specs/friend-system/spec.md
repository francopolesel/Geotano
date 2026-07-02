# Friend System Specification

## Purpose

Bidirectional friend requests, username search, and invite links.

## Requirements

### Requirement: Requests
MUST send, accept, and reject bidirectional friend requests.
- **Send**: GIVEN A authenticated + B exists, WHEN A sends request, THEN B gets pending notification.
- **Accept**: GIVEN B has pending request from A, WHEN B accepts, THEN A and B become friends.

### Requirement: Search
MUST search users by username prefix.
- **Search**: GIVEN matching usernames exist, WHEN GET /api/users/search?q=pref, THEN matches returned (excluding self + friends).

### Requirement: Invite links
MUST generate shareable links that auto-add sender as friend.
- **Redeem**: GIVEN A generates link, WHEN B opens + accepts, THEN A and B become mutual friends.
