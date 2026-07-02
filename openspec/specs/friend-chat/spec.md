# Friend Chat Specification

## Purpose

Real-time WebSocket (Socket.io) messaging between accepted friends.

## Requirements

### Requirement: Connection
MUST authenticate Socket.io connections via JWT.
- **Auth**: GIVEN valid JWT, WHEN client connects, THEN authenticated + online status broadcast to friends.

### Requirement: Messaging
MUST deliver messages between accepted friends in real time.
- **Online**: GIVEN A and B connected as friends, WHEN A sends message, THEN B receives immediately.
- **Offline**: GIVEN B offline, WHEN A sends message, THEN persisted + delivered on B's reconnect.

### Requirement: History
MUST persist messages and expose GET /api/chat/:friendId.
- **Load**: GIVEN previous messages, WHEN GET call, THEN last 50 messages with cursor pagination returned.
