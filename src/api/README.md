## Directory Structure

```
src/api/
├── server.ts              # Main entry point, imports and registers all routes
└── routes/
    ├── settings.ts        # Example (Settings)
```

## Route Modules

### settings.ts
- `GET /api/guilds/:guildId/settings` - Get guild settings
- `POST /api/guilds/:guildId/settings` - Update guild settings

### overview.ts
- `GET /api/guilds/:guildId/overview` - Get overview statistics (total tickets, open tickets, avg resolution time, avg response time)

### tickets.ts
- `GET /api/guilds/:guildId/tickets` - List all tickets
- `GET /api/guilds/:guildId/tickets/:ticketId` - Get single ticket
- `POST /api/guilds/:guildId/tickets/:ticketId/close` - Close a ticket
- `POST /api/guilds/:guildId/tickets/:ticketId/reopen` - Reopen a ticket
- `DELETE /api/guilds/:guildId/tickets/:ticketId` - Delete a ticket

### transcripts.ts
- `GET /api/transcript` - Download transcript file
- `GET /api/transcript-html` - Get transcript as HTML
- `GET /api/guilds/:guildId/transcripts` - List all transcripts
- `GET /transcripts/:filename` - Serve transcript file

### panels.ts
- `GET /api/guilds/:guildId/panels` - List all panels
- `POST /api/guilds/:guildId/panels` - Create a new panel
- `PUT /api/guilds/:guildId/panels/:panelId` - Update a panel
- `POST /api/guilds/:guildId/panels/:panelId/send` - Send panel to Discord
- `DELETE /api/guilds/:guildId/panels/:panelId` - Delete a panel

### categories.ts
- `GET /api/guilds/:guildId/categories` - List all categories
- `POST /api/guilds/:guildId/categories` - Create a category
- `DELETE /api/guilds/:guildId/categories/:categoryId` - Delete a category

### channels.ts
- `GET /api/guilds/:guildId/channels` - List text channels
- `GET /api/guilds/:guildId/discord-categories` - List Discord categories

### feedback.ts
- `GET /api/guilds/:guildId/feedbacks` - List all feedback
- `DELETE /api/guilds/:guildId/feedbacks/:feedbackId` - Delete feedback

### logs.ts
- `GET /api/guilds/:guildId/logs` - Get activity logs
- `POST /api/guilds/:guildId/logs/purge` - Purge logs

### internal.ts
- `POST /internal/close-ticket` - Internal endpoint to close tickets

## Adding New Routes (For developers only)

To add new routes:

1. Create a new file in `src/api/routes/` (e.g., `src/api/routes/newfeature.ts`)
2. Export a `registerNewFeatureRoutes` function
3. Import and call it in `src/api/server.ts` in the `startBotApi` function

Example:
```typescript
// src/api/routes/newfeature.ts
export function registerNewFeatureRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/newfeature', requireKey, (req: any, res: any) => {
    // route logic here
    res.json({ ok: true });
  });
}

// In src/api/server.ts
import { registerNewFeatureRoutes } from './routes/newfeature';

// Inside startBotApi function:
registerNewFeatureRoutes(app, requireKey);
```