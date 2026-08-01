# 🌍 Geotano

A real-time multiplayer geography quiz game. Test your knowledge of flags, capitals, continents, and countries — challenge friends, climb the rankings, and learn along the way.

---

## Features

- **🗺️ Geography Quizzes** — Flags, capitals, continents, and countries. Randomized questions with scoring and streaks across five modes: Standard, Express, Unlimited, and Hardcore (with lives).
- **⚔️ Multiplayer Duels** — Challenge friends to turn-based geography duels. Pick a game mode and duration (1/2/3 minutes), accept or decline invites in real time via WebSockets, and get sound feedback (correct/wrong/win/lose) just like in single-player.
- **🕒 Match History** — Track your duels in "Multiplayer Games", with automatic cleanup of stale or abandoned matches after 24 hours.
- **👥 Friends & Chat** — Add friends, see who's online, chat in real time via WebSockets, and invite friends with join codes.
- **🏆 Rankings** — Compete on the global leaderboard and track your progress.
- **🏅 Achievements** — Unlock 20+ achievements for games played, streaks, perfect games, high scores, and more.
- **🔔 Notifications** — In-app notifications for duel invites and other events, delivered in real time.
- **🌐 i18n** — Full English and Spanish (Rioplatense) localization.
- **📱 Responsive Design** — Works on mobile and desktop with a clean, modern UI.
- **🔐 Authentication** — Email/password registration with JWT sessions, password recovery, and Google sign-in.

---

## Tech Stack

| Layer        | Technology                                                              |
| ------------ | ----------------------------------------------------------------------- |
| **Frontend** | React 19, React Router 7, Zustand, Tailwind CSS 4, i18next, Socket.io   |
| **Backend**  | Fastify, Drizzle ORM, PostgreSQL (Neon), Socket.io, JWT, Nodemailer     |
| **Shared**   | TypeScript shared types package (`@geotano/shared`)                     |
| **Tooling**  | Turborepo, pnpm workspaces, Vitest, TypeScript                          |

---

## Project Structure

```
geotano/
├── apps/
│   ├── backend/          # Fastify API server + Socket.io
│   │   ├── src/
│   │   │   ├── routes/   # API route handlers
│   │   │   ├── services/ # Business logic
│   │   │   ├── db/       # Drizzle schema & migrations
│   │   │   └── lib/      # Utilities (email, socket, auth)
│   │   └── __tests__/    # Vitest test suite (389 tests)
│   └── frontend/         # React SPA with Vite
│       └── src/
│           ├── features/ # Feature modules (quiz, multiplayer, friends, etc.)
│           ├── components/# Shared UI components
│           ├── store/    # Zustand stores
│           ├── lib/      # API client, socket, i18n
│           └── __tests__/# Vitest test suite (531 tests)
├── packages/
│   └── shared/           # Shared TypeScript types
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **PostgreSQL** database (or [Neon](https://neon.tech) serverless)
- A `.env` file in `apps/backend/` with your database connection string and secrets

### Install & Run

```bash
# Install dependencies
pnpm install

# Generate database schema and push
pnpm --filter @geotano/backend db:generate
pnpm --filter @geotano/backend db:push

# Seed countries (requires DB connection)
pnpm --filter @geotano/backend seed

# Start development (backend + frontend)
pnpm dev
```

### Tests

```bash
# Run all tests
pnpm test

# Backend only
pnpm test:backend

# Frontend only
pnpm test:frontend

# With coverage
pnpm --filter @geotano/backend test -- --coverage
```

---

## Scripts

| Command                             | Description                    |
| ----------------------------------- | ------------------------------ |
| `pnpm dev`                          | Start backend + frontend in dev |
| `pnpm build`                        | Build all packages              |
| `pnpm test`                         | Run all tests                   |
| `pnpm lint`                         | Type-check all packages         |
| `pnpm format`                       | Format code with Prettier       |
| `pnpm --filter @geotano/backend seed` | Seed country data               |

---

## Database

Geotano uses **PostgreSQL** with **Drizzle ORM**. The schema includes tables for users, friends, chat messages, quiz sessions, game results, rankings, daily rankings, achievements, notifications, match challenges, match games, and match answers.

Run `pnpm --filter @geotano/backend db:studio` to open Drizzle Studio and inspect data.

---

## Coverage

**Backend** — 389 tests across 22 test files with Vitest (82%+ statement coverage).
**Frontend** — 531 tests across 33 test files with Vitest.

---

## Author

**Franco Polesel**

---

## License

This project is private and not currently licensed for public use.

---

---

# 🌍 Geotano — Español

Un juego de geografía multijugador en tiempo real. Poné a prueba tu conocimiento de banderas, capitales, continentes y países — desafiá a tus amigos, trepá en el ranking y aprendé en el camino.

---

## Funcionalidades

- **🗺️ Cuestionarios de geografía** — Banderas, capitales, continentes y países. Preguntas aleatorias con puntuación y rachas en cinco modos: Standard, Express, Unlimited y Hardcore (con vidas).
- **⚔️ Duelos multijugador** — Desafiá a tus amigos a duelos de geografía por turnos. Elegí el modo y la duración (1/2/3 minutos), aceptá o rechazá invitaciones en tiempo real via WebSockets, y escuchá los mismos sonidos (acierto/error/ganar/perder) que en el modo individual.
- **🕒 Historial de partidas** — Seguí tus duelos en "Juegos multijugador", con limpieza automática de partidas abandonadas o vencidas después de 24 horas.
- **👥 Amigos y chat** — Agregá amigos, mirá quién está conectado, chateá en tiempo real via WebSockets e invitá amigos con códigos de invitación.
- **🏆 Rankings** — Competí en la tabla global y seguí tu progreso.
- **🏅 Logros** — Desbloqueá más de 20 logros por partidas jugadas, rachas, juegos perfectos, puntajes altos y más.
- **🔔 Notificaciones** — Notificaciones in-app para invitaciones a duelos y otros eventos, en tiempo real.
- **🌐 i18n** — Localización completa en inglés y español (rioplatense).
- **📱 Diseño responsive** — Funciona en mobile y desktop con una UI limpia y moderna.
- **🔐 Autenticación** — Registro con email/contraseña, sesiones JWT, recuperación de contraseña e inicio de sesión con Google.

---

## Stack Tecnológico

| Capa          | Tecnología                                                              |
| ------------- | ----------------------------------------------------------------------- |
| **Frontend**  | React 19, React Router 7, Zustand, Tailwind CSS 4, i18next, Socket.io   |
| **Backend**   | Fastify, Drizzle ORM, PostgreSQL (Neon), Socket.io, JWT, Nodemailer     |
| **Compartido**| Paquete de tipos compartidos en TypeScript (`@geotano/shared`)          |
| **Herramientas**| Turborepo, pnpm workspaces, Vitest, TypeScript                        |

---

## Estructura del Proyecto

```
geotano/
├── apps/
│   ├── backend/          # Servidor Fastify + Socket.io
│   │   ├── src/
│   │   │   ├── routes/   # Handlers de rutas API
│   │   │   ├── services/ # Lógica de negocio
│   │   │   ├── db/       # Schema Drizzle y migraciones
│   │   │   └── lib/      # Utilidades (email, socket, auth)
│   │   └── __tests__/    # Suite de tests Vitest (389 tests)
│   └── frontend/         # SPA React con Vite
│       └── src/
│           ├── features/ # Módulos funcionales (quiz, multiplayer, friends, etc.)
│           ├── components/# Componentes compartidos de UI
│           ├── store/    # Stores de Zustand
│           ├── lib/      # Cliente API, socket, i18n
│           └── __tests__/# Suite de tests Vitest (531 tests)
├── packages/
│   └── shared/           # Tipos compartidos TypeScript
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Primeros Pasos

### Requisitos

- **Node.js** >= 20
- **pnpm** >= 9
- Base de datos **PostgreSQL** (o [Neon](https://neon.tech) serverless)
- Un archivo `.env` en `apps/backend/` con la conexión a la base de datos y secrets

### Instalación y ejecución

```bash
# Instalar dependencias
pnpm install

# Generar schema de BD y pushear
pnpm --filter @geotano/backend db:generate
pnpm --filter @geotano/backend db:push

# Sembrar países (requiere conexión a BD)
pnpm --filter @geotano/backend seed

# Iniciar desarrollo (backend + frontend)
pnpm dev
```

### Tests

```bash
# Ejecutar todos los tests
pnpm test

# Solo backend
pnpm test:backend

# Solo frontend
pnpm test:frontend

# Con cobertura
pnpm --filter @geotano/backend test -- --coverage
```

---

## Scripts

| Comando                            | Descripción                      |
| ----------------------------------- | -------------------------------- |
| `pnpm dev`                          | Iniciar backend + frontend en dev |
| `pnpm build`                        | Compilar todos los paquetes       |
| `pnpm test`                         | Ejecutar todos los tests          |
| `pnpm lint`                         | Type-check de todos los paquetes  |
| `pnpm format`                       | Formatear código con Prettier     |
| `pnpm --filter @geotano/backend seed` | Sembrar datos de países          |

---

## Base de Datos

Geotano usa **PostgreSQL** con **Drizzle ORM**. El schema incluye tablas para usuarios, amigos, mensajes de chat, sesiones de quiz, resultados de partidas, rankings, rankings diarios, logros, notificaciones, desafíos de partida, partidas y respuestas de partidas.

Ejecutá `pnpm --filter @geotano/backend db:studio` para abrir Drizzle Studio e inspeccionar los datos.

---

## Cobertura

**Backend** — 389 tests en más de 22 archivos de test con Vitest (82%+ de cobertura de sentencias).
**Frontend** — 531 tests en más de 33 archivos de test con Vitest.

---

## Autor

**Franco Polesel**

---

## Licencia

Este proyecto es privado y no está licenciado para uso público actualmente.
