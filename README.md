# Bytebridge Tickets

A Discord ticket bot built with TypeScript, discord.js, and Express. Manage support tickets directly in Discord with an integrated dashboard API for transcript serving and ticket management.

## Features

- **Discord Ticket System** - Create, manage, and close support tickets within Discord
- **Transcript Generation** - Automatically generate HTML transcripts of ticket conversations
- **REST API** - Express-based API for ticket management and transcript serving
- **SQLite Database** - Persistent ticket storage with better-sqlite3
- **CORS Support** - Cross-origin requests enabled for dashboard integration
- **TypeScript** - Full type safety across the project

## Prerequisites

- Node.js 18+ 
- npm
- Discord Bot Token
- Discord Application ID and Guild ID

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Fill in the `.env` file with:
   - `DISCORD_TOKEN` - Your Discord bot token
   - `CLIENT_ID` - Your Discord application ID
   - `GUILD_ID` - Your Discord server ID
   - `DASHBOARD_API_KEY` & `BOT_API_KEY` - Shared API key for authentication
   - `BOT_API_URL` - Bot API endpoint (default: http://localhost:3001)
   - `DASHBOARD_URL` - Dashboard URL (default: http://localhost:3000)
   - `DB_PATH` - Database file location (default: ./data/tickets.sqlite)
   - `TRANSCRIPTS_PATH` - Transcripts directory (default: ./transcripts)

3. **Initialize the database:**
   ```bash
   npm run build
   ts-node scripts/createDatabase.ts
   ```

4. **Deploy Discord commands:**
   ```bash
   npm run deploy-commands
   ```

## Development

Run the bot in development mode with hot reload:
```bash
npm run dev:bot
```

Run the dashboard in development mode:
```bash
npm run dev:dashboard
```

Run both concurrently:
```bash
npm run dev
```

## Production

Build the project:
```bash
npm run build
```

Start the bot:
```bash
npm start:bot
```

Start the dashboard:
```bash
npm start:dashboard
```

## Scripts

- `npm run lint` - Run ESLint on TypeScript files
- `npm run deploy-commands` - Deploy Discord slash commands
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev:bot` - Start bot with hot reload
- `npm run dev:dashboard` - Start dashboard dev server
- `npm run start:bot` - Start compiled bot
- `npm run start:dashboard` - Start dashboard production build

## Database

The bot uses SQLite for persistent storage. Database scripts are available:
- `scripts/createDatabase.ts` - Initialize database schema
- `scripts/clearDatabase.ts` - Clear all data (use with caution)
- `scripts/testCreateTicket.ts` - Test ticket creation

## API

The bot exposes a REST API on port 3001 for:
- Ticket management
- Transcript serving
- Dashboard integration

All API requests require the `BOT_API_KEY` header for authentication.

## License

MIT
