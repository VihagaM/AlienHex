# AlienHex

AlienHex is a full-stack WhatsApp bot built with Baileys and a real-time React dashboard. It supports WhatsApp command processing, group administration, music and utility tools, live connection status, QR pairing, usage statistics, and backend logs.

## Features

- WhatsApp Web/linked-device connection using Baileys
- QR-code pairing and automatic session persistence
- Real-time dashboard with Socket.IO
- Start, restart, and logout controls
- Live connection state, uptime, message counts, command usage, and errors
- Owner-only command handling
- Group-only, group-admin-only, and bot-admin-required commands
- General, music, group, and utility command categories
- Optional dashboard token protection
- Spam safety checks for suspicious messages
- Optional production mode that serves the React build from Express

## Tech Stack

### Backend

- Node.js
- Express
- Socket.IO
- `@whiskeysockets/baileys`
- Pino
- `yt-search`

### Frontend

- React
- Vite
- Tailwind CSS
- Socket.IO Client
- Lucide React
- `qrcode.react`

## Project Structure

```text
AlienHex/
├── backend/
│   ├── src/
│   │   ├── commands/       # Bot command modules
│   │   ├── utils/          # Shared helpers and utilities
│   │   ├── assets/         # Menu image
│   │   ├── commandHandler.js
│   │   ├── config.js
│   │   ├── index.js
│   │   ├── logger.js
│   │   └── whatsapp.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── hooks/
│   ├── .env.example
│   └── package.json
└── LICENSE
```

## Prerequisites

- Node.js 20 or newer
- npm
- A WhatsApp account to link

## Installation

Clone the repository and install both applications:

```powershell
git clone https://github.com/VihagaM/AlienHex.git
cd AlienHex

cd backend
npm install

cd ..\frontend
npm install
```

## Backend Configuration

Copy the example environment file and update it as needed:

```powershell
cd backend
Copy-Item .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Express and Socket.IO server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated dashboard origin allowlist |
| `DASHBOARD_TOKEN` | Empty | Shared token used to protect dashboard API and Socket.IO access |
| `BOT_NAME` | `AlienHex` | Name displayed by bot commands |
| `PREFIX` | `.` | Command prefix |
| `OWNER_NUMBER` | `765516398` | Owner number in country-code-plus-number digits only |
| `OWNER_NAME` | `Vihaga Manodya` | Owner name |
| `AUTO_START` | `true` | Start WhatsApp automatically when the backend boots |
| `MAX_MESSAGE_AGE_SECONDS` | `60` | Maximum age accepted for an incoming command |
| `AUTH_DIR` | `auth_session` | Folder used to persist the WhatsApp login session |
| `BAILEYS_LOG_LEVEL` | `silent` | Baileys log level |

Set `DASHBOARD_TOKEN` to a strong, private value for a publicly accessible dashboard. If it is empty, dashboard authentication is disabled.

`OWNER_NUMBER` should contain the country code and number without `+`, spaces, or punctuation. For example: `94771234567`.

## Frontend Configuration

For separate development servers, copy the example environment file:

```powershell
cd frontend
Copy-Item .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3001` in development | Backend URL |

Leave `VITE_API_URL` empty when Express is serving the already-built frontend.

## Running Locally

Start the backend:

```powershell
cd backend
npm run dev
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`.

If `AUTO_START=true`, the backend attempts to connect immediately. Otherwise, use **Connect** in the dashboard. Scan the QR code with WhatsApp:

1. Open WhatsApp on your phone.
2. Open **Settings > Linked devices**.
3. Select **Link a device**.
4. Scan the dashboard QR code.

If `DASHBOARD_TOKEN` is configured, enter the same token in the dashboard login screen.

## Commands

Type commands using the configured prefix. The default prefix is `.`.

Commands are triggered with the configured prefix. Commands marked as owner-only would be restricted to the configured owner or linked account, while admin and group restrictions are enforced automatically.

### General

| Command | Description |
| --- | --- |
| `.menu` / `.help` / `.commands` | Show the command menu |
| `.ping` | Check response latency |
| `.info` | Show group information |
| `.owner` | Show bot owner details |
| `.alive` | Check whether the bot is running |
| `.id` | Get the current chat ID |
| `.runtime` / `.uptime` | Show bot uptime |
| `.dp` / `.pp` / `.profilepic` | Get a mentioned, replied, or sender profile picture |
| `.showstatus` / `.getstatus` | Retrieve a replied WhatsApp status |

### Music

| Command | Description |
| --- | --- |
| `.song <query>` / `.play <query>` | Search for a song and return details |
| `.lyrics <song name>` | Search for matching lyrics |

### Group Administration

These commands require a group chat. Admin commands require the sender and the bot to have the necessary group permissions.

| Command | Description |
| --- | --- |
| `.kick <@user>` / `.remove <@user>` | Remove a member |
| `.add <number>` | Add a member |
| `.promote <@user>` | Promote a member |
| `.demote <@user>` | Demote an admin |
| `.mute` | Allow only admins to send messages |
| `.unmute` | Allow everyone to send messages |
| `.tagall [message]` / `.everyone [message]` | Mention every group member |

### Utility

| Command | Description |
| --- | --- |
| `.weather <city>` | Show current weather |
| `.calc <expression>` / `.calculate <expression>` | Evaluate a math expression |
| `.joke` | Send a random joke |
| `.quote` | Send an inspiring quote |
| `.reveal` / `.vv` | Download and reveal replied view-once media |
| `.systemclean` / `.sysclean` | Run a simulated cleanup animation |

> `.systemclean` is a cosmetic demonstration and does not delete files or access system directories.

## API

The backend provides these REST endpoints:

| Method | Endpoint | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Backend health and uptime |
| `GET` | `/api/auth-required` | No | Whether dashboard authentication is enabled |
| `GET` | `/api/status` | Yes | Current bot state and statistics |
| `POST` | `/api/start` | Yes | Start or connect the WhatsApp service |
| `POST` | `/api/restart` | Yes | Restart the WhatsApp service |
| `POST` | `/api/logout` | Yes | Log out and clear the saved session |

Authenticate dashboard requests with:

```text
Authorization: Bearer YOUR_DASHBOARD_TOKEN
```

Socket.IO connections must provide the same token through the handshake auth payload.

## Production Build

Build the dashboard:

```powershell
cd frontend
npm run build
```

Start the backend:

```powershell
cd ..\backend
npm start
```

Express automatically serves `frontend/dist` when it exists. Open `http://localhost:3001`, or use the configured `PORT`.

Set `CLIENT_ORIGIN` to an exact frontend origin or a comma-separated list when the dashboard and backend run on separate origins. Include the protocol and port, for example:

```text
CLIENT_ORIGIN=http://localhost:5173,https://dashboard.example.com
```

## Session and Security Notes

- WhatsApp session credentials are stored in `backend/auth_session` by default.
- Keep `AUTH_DIR` and `.env` private and exclude them from source control.
- Back up or delete the auth directory if you need to reset or move the linked session.
- Set `DASHBOARD_TOKEN` before exposing the server beyond localhost.
- Use HTTPS and a reverse proxy if the dashboard is publicly hosted.
- Status and profile retrieval are limited by WhatsApp privacy settings and whether the bot received the relevant media.

## Troubleshooting

### QR code does not appear

Check that the backend is running and `AUTO_START=true`, or press **Connect** in the dashboard. Restart the backend if the session has stale connection state.

### Dashboard cannot connect

Confirm the backend port and `VITE_API_URL`, and make sure `CLIENT_ORIGIN` includes the dashboard origin.

### Dashboard login fails

Confirm that `DASHBOARD_TOKEN` in `backend/.env` is identical to the token entered in the dashboard.

### Commands do not run

Verify that `OWNER_NUMBER` is correct for commands marked owner-only. Commands in private or group chats must also use the configured prefix.

### Bot disconnects or reconnect loops

Try **Restart** from the dashboard. If WhatsApp reports a session replacement or logout, use **Logout**, then relink the account by scanning a new QR code.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
