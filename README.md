# IoT Alert Backend

Real-time backend for an IoT alert system built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO**. Designed to receive sensor data from ESP32 devices, process emergency alerts, and notify contacts via Telegram.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Authentication](#authentication)
- [Roles & Permissions](#roles--permissions)
- [Security Notes](#security-notes)

---

## Overview

This backend serves as the central hub between ESP32 IoT devices and a web dashboard. It handles:

- **Device registration** and ownership mapping
- **Real-time sensor streaming** (GPS, accelerometer, gyroscope) via WebSocket
- **Automatic alert creation** when anomalies are detected
- **Telegram notifications** sent to registered emergency contacts
- **Admin dashboard** with KPIs, per-user filtering, and Excel exports

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.IO |
| Auth | JWT (jsonwebtoken) |
| Password hashing | bcrypt |
| Notifications | Telegram Bot API |
| Excel export | ExcelJS |

---

## Project Structure

```
├── config/
│   └── db.js                  # MongoDB connection
├── middleware/
│   ├── auth.js                # JWT verification middleware
│   └── adminOnly.js           # Admin role guard
├── models/
│   ├── User.js                # User schema (email, password, role)
│   ├── Device.js              # ESP32 device schema
│   ├── Alert.js               # Alert event schema
│   └── EmergencyContact.js    # Emergency contact schema
├── realtime/
│   └── deviceMap.js           # In-memory device → owner map
├── routes/
│   ├── auth.routes.js         # Register, login, password update
│   ├── device.routes.js       # Device registration and listing
│   ├── emergency.routes.js    # Emergency contact management
│   └── admin.routes.js        # Admin-only dashboard and management
├── utils/
│   └── telegram.js            # Telegram bot setup and message sender
├── server.js                  # App entry point, Socket.IO logic
├── .env.example               # Environment variable template
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A MongoDB Atlas cluster (or local MongoDB instance)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd <project-folder>

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# 4. Start the server
node server.js
```

The server will start on `http://localhost:3000` (or the port defined in `.env`).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. **Never commit `.env` to version control.**

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string (Atlas or local) |
| `PORT` | Server port (default: `3000`) |
| `JWT_SECRET` | Secret key for signing JWT tokens — use a long random string |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather for the Telegram notification bot |

Generate a secure `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## API Reference

All protected routes require the header:

```
Authorization: Bearer <token>
```

### Auth — `/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create a new user (`user` or `admin` role) |
| `POST` | `/auth/login` | None | Login and receive a JWT token |
| `PUT` | `/auth/me/password` | User | Update own password |

#### POST `/auth/register`
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "role": "user"
}
```

#### POST `/auth/login`
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```
Returns: `{ "token": "<jwt>" }`

---

### Devices — `/devices`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/devices/register` | Admin | Register a new ESP32 device |
| `GET` | `/devices/me` | User | List devices owned by the authenticated user |

---

### Emergency Contacts — `/emergency`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/emergency/me` | User | List own emergency contacts |
| `PUT` | `/emergency/:id` | User | Update a contact |
| `DELETE` | `/emergency/:id` | User | Delete a contact (minimum 1 must remain) |

---

### Admin — `/admin`

All admin routes require `role: admin`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/users` | List all users |
| `PUT` | `/admin/users/:id` | Update user role or password |
| `DELETE` | `/admin/users/:id` | Delete user and all related data |
| `PUT` | `/admin/users/:id/password` | Reset any user's password |
| `GET` | `/admin/devices` | List all devices (filterable by `userId`) |
| `PUT` | `/admin/devices/:id` | Update device info |
| `DELETE` | `/admin/devices/:id` | Delete a device |
| `GET` | `/admin/alerts` | List alerts with filters (`userId`, `deviceId`, `tipo`, `from`, `to`) |
| `GET` | `/admin/dashboard/summary` | KPIs: total alerts, today, last 7 days, top users |
| `GET` | `/admin/dashboard/alerts-per-day` | Alert time series for charts |
| `POST` | `/admin/export` | Export collection data as `.xlsx` |

---

## WebSocket Events

The server uses Socket.IO. Devices (ESP32) and the frontend connect to the same server.

### Authentication

The frontend authenticates the socket connection by passing the JWT in the handshake:

```js
const socket = io("http://localhost:3000", {
  auth: { token: "<jwt>" }
});
```

Unauthenticated sockets are disconnected immediately.

### Events — Device → Server (ESP32 emits)

| Event | Payload | Description |
|---|---|---|
| `device-data` | `{ deviceId, ... }` | General device status |
| `gps-data` | `{ deviceId, lat, lng, fix }` | GPS coordinates |
| `accelerometer-data` | `{ deviceId, x, y, z }` | Accelerometer readings |
| `gyroscope-data` | `{ deviceId, pitch, roll }` | Gyroscope readings |
| `alert-data` | `{ deviceId, tipo, alerta, mensaje, ubicacion, ... }` | Emergency alert trigger |
| `request-emergency-contacts` | `{ deviceId }` | Request contacts for a device |

### Events — Server → Frontend (server emits to user room)

| Event | Description |
|---|---|
| `device-update` | Forwarded general device data |
| `gps-update` | Forwarded GPS data |
| `accelerometer-update` | Forwarded accelerometer data |
| `gyroscope-update` | Forwarded gyroscope data |
| `alert-update` | New alert created and saved to DB |
| `emergency-contacts` | List of active contacts for a device |

When an `alert-data` event is received, the server:
1. Saves the alert to MongoDB
2. Sends a Telegram message to all active contacts with a valid `telegramChatId`
3. Emits `alert-update` to the device owner's room

---

## Authentication

- Passwords are hashed with **bcrypt** (10 salt rounds) before storage
- JWTs are signed with `JWT_SECRET` and expire after **1 day**
- The JWT payload contains `{ id, role }`
- All protected routes validate the token via the `auth` middleware

---

## Roles & Permissions

| Action | `user` | `admin` |
|---|---|---|
| Login / update own password | ✅ | ✅ |
| View own devices | ✅ | ✅ |
| View own emergency contacts | ✅ | ✅ |
| Register devices | ❌ | ✅ |
| Manage all users | ❌ | ✅ |
| View all alerts | ❌ | ✅ |
| Export data | ❌ | ✅ |
| Access dashboard KPIs | ❌ | ✅ |

---

## Security Notes

- `.env` is excluded from version control — never commit secrets
- `JWT_SECRET` should be a cryptographically random string of at least 32 characters
- MongoDB credentials and the Telegram bot token must be rotated if ever exposed in git history
- The export endpoint validates allowed fields per collection to prevent data leakage
- Admin deletion cascades: removing a user also removes their devices, alerts, and contacts
