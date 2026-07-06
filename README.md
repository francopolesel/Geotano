# 🌍 Geotano

A real-time multiplayer geography quiz game. Test your knowledge of flags, capitals, continents, and countries — challenge friends, climb the rankings, and learn along the way.

---

## Features

- **🗺️ Geography Quizzes** — Flags, capitals, continents, and countries. Randomized questions with scoring and streaks.
- **👥 Friends & Chat** — Add friends, see who's online, and chat in real time via WebSockets.
- **🏆 Rankings** — Compete on the global leaderboard and track your progress.
- **📱 Responsive Design** — Works on mobile and desktop with a clean, modern UI.
- **🔐 Authentication** — Email/password registration with JWT sessions and password recovery.

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
│   │   └── __tests__/    # Vitest test suite (244+ tests)
│   └── frontend/         # React SPA with Vite
│       └── src/
│           ├── features/ # Feature modules (quiz, friends, profile, etc.)
│           ├── components/# Shared UI components
│           ├── store/    # Zustand stores
│           └── lib/      # API client, socket, i18n
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

Geotano uses **PostgreSQL** with **Drizzle ORM**. The schema includes tables for users, friends, chat messages, quiz sessions, game results, rankings, and daily rankings.

Run `pnpm --filter @geotano/backend db:studio` to open Drizzle Studio and inspect data.

---

## Coverage

**Backend** — 82%+ statement coverage across 20+ test files with Vitest.

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

- **🗺️ Cuestionarios de geografía** — Banderas, capitales, continentes y países. Preguntas aleatorias con puntuación y rachas.
- **👥 Amigos y chat** — Agregá amigos, mirá quién está conectado y chateá en tiempo real via WebSockets.
- **🏆 Rankings** — Competí en la tabla global y seguí tu progreso.
- **📱 Diseño responsive** — Funciona en mobile y desktop con una UI limpia y moderna.
- **🔐 Autenticación** — Registro con email/contraseña, sesiones JWT y recuperación de contraseña.

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
│   │   └── __tests__/    # Suite de tests Vitest (244+ tests)
│   └── frontend/         # SPA React con Vite
│       └── src/
│           ├── features/ # Módulos funcionales (quiz, friends, profile, etc.)
│           ├── components/# Componentes compartidos de UI
│           ├── store/    # Stores de Zustand
│           └── lib/      # Cliente API, socket, i18n
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

Geotano usa **PostgreSQL** con **Drizzle ORM**. El schema incluye tablas para usuarios, amigos, mensajes de chat, sesiones de quiz, resultados de partidas, rankings y rankings diarios.

Ejecutá `pnpm --filter @geotano/backend db:studio` para abrir Drizzle Studio e inspeccionar los datos.

---

## Cobertura

**Backend** — 82%+ de cobertura de sentencias en más de 20 archivos de test con Vitest.

---

## Autor

**Franco Polesel**

---

## Licencia

Este proyecto es privado y no está licenciado para uso público actualmente.
