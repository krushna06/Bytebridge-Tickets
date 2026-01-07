import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { TicketManager } from '../structures/TicketManager';
import { registerSettingsRoutes } from './routes/settings';
import { registerOverviewRoutes } from './routes/overview';
import { registerTicketRoutes } from './routes/tickets';
import { registerTranscriptRoutes, registerTranscriptFileRoute } from './routes/transcripts';
import { registerPanelRoutes } from './routes/panels';
import { registerCategoryRoutes } from './routes/categories';
import { registerChannelRoutes } from './routes/channels';
import { registerFeedbackRoutes } from './routes/feedback';
import { registerLogRoutes } from './routes/logs';
import { registerInternalRoutes } from './routes/internal';
import { registerMemberRoutes } from './routes/members';
import { registerProfileRoutes } from './routes/profile';

dotenv.config();

const BOT_API_KEY = process.env.BOT_API_KEY || process.env.DASHBOARD_API_KEY || '';

export let client: any;

export function setClient(discordClient: any) {
  client = discordClient;
}

export async function startBotApi(ticketManager: TicketManager) {
  const app = express();
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  app.use(cors({ origin: dashboardUrl }));
  app.use(bodyParser.json());

  const requireKey = (req: any, res: any, next: any) => {
    const key = req.header('X-BOT-KEY') || req.header('X-API-KEY') || req.query.apiKey;
    if (!key || key !== BOT_API_KEY) return res.status(401).json({ error: 'unauthorized' });
    next();
  };

  registerInternalRoutes(app, requireKey, ticketManager);
  registerSettingsRoutes(app, requireKey);
  registerOverviewRoutes(app, requireKey);
  registerTicketRoutes(app, requireKey, ticketManager);
  registerTranscriptRoutes(app, requireKey, ticketManager);
  registerCategoryRoutes(app, requireKey);
  registerChannelRoutes(app, requireKey, ticketManager);
  registerPanelRoutes(app, requireKey, ticketManager);
  registerFeedbackRoutes(app, requireKey);
  registerLogRoutes(app, requireKey);
  registerMemberRoutes(app, requireKey);
  registerProfileRoutes(app, requireKey);
  registerTranscriptFileRoute(app);

  const port = Number(process.env.BOT_API_PORT || 3001);
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Bot internal API listening on ${port}`);
      resolve();
    });
  });
}

export default startBotApi;
