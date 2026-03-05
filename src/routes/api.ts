import express from "express";
import { google } from "googleapis";
import { format } from "date-fns";
import { db } from "../db/database.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { performSync } from "../services/syncEngine.js";
import { ManyChatService, ManyChatAuthError } from "../services/manychatService.js";

export const apiRouter = express.Router();

// Simple Auth Middleware (Mocking a single user for this demo, or using a cookie)
const getUserId = (req: express.Request) => req.cookies?.user_id || process.env.VITE_DEMO_USER_ID || "default_user";

// Connection Status
apiRouter.get("/status", (req, res) => {
    const userId = getUserId(req);
    const user = db.prepare("SELECT yt_refresh_token, manychat_key FROM users WHERE id = ?").get(userId) as any;
    res.json({
        youtube: !!user?.yt_refresh_token,
        manychat: !!user?.manychat_key,
    });
});

// YouTube Auth URL
apiRouter.get("/auth/youtube/url", (req, res) => {
    const currentAppUrl = process.env.APP_URL?.replace(/\/$/, "");
    const dynamicRedirectUri = `${currentAppUrl}/api/auth/youtube/callback`;

    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        dynamicRedirectUri
    );

    const url = client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/yt-analytics.readonly",
            "https://www.googleapis.com/auth/youtube.readonly"
        ],
        prompt: "consent"
    });
    res.json({ url });
});

// YouTube Auth Callback
apiRouter.get("/auth/youtube/callback", async (req, res) => {
    const { code } = req.query;
    try {
        const currentAppUrl = process.env.APP_URL?.replace(/\/$/, "");
        const dynamicRedirectUri = `${currentAppUrl}/api/auth/youtube/callback`;

        const client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            dynamicRedirectUri
        );

        const { tokens } = await client.getToken(code as string);
        const userId = getUserId(req);

        const encryptedToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

        db.prepare(`
      INSERT INTO users (id, yt_refresh_token) 
      VALUES (?, ?) 
      ON CONFLICT(id) DO UPDATE SET yt_refresh_token = excluded.yt_refresh_token
    `).run(userId, encryptedToken);

        res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'OAUTH_SUCCESS' }, '*');
            window.close();
          </script>
          <p>Connection successful! You can close this window.</p>
        </body>
      </html>
    `);
    } catch (error) {
        console.error("YT Auth Error:", error);
        res.status(500).send("Authentication failed");
    }
});

// ManyChat Key Update
apiRouter.post("/auth/manychat", (req, res) => {
    const { key } = req.body;
    const userId = getUserId(req);
    const encryptedKey = encrypt(key);

    db.prepare(`
    INSERT INTO users (id, manychat_key) 
    VALUES (?, ?) 
    ON CONFLICT(id) DO UPDATE SET manychat_key = excluded.manychat_key
  `).run(userId, encryptedKey);

    res.json({ success: true });
});

// ManyChat Sync Endpoint
apiRouter.get("/sync/manychat", async (req, res) => {
    const userId = getUserId(req);
    const user = db.prepare("SELECT manychat_key FROM users WHERE id = ?").get(userId) as any;
    const apiKey = user?.manychat_key ? decrypt(user.manychat_key) : process.env.MANYCHAT_API_KEY;

    if (!apiKey) {
        return res.status(400).json({ error: "ManyChat API key not configured" });
    }

    try {
        const mcService = new ManyChatService(apiKey);
        const data = await mcService.fetchAllData();

        const date = format(new Date(), "yyyy-MM-dd");

        // Save metrics
        const metrics = [
            { name: 'subscribers', value: data.total_contacts },
            { name: 'active_widgets', value: data.active_widgets },
            { name: 'conversion_rate', value: data.lead_conversion_rate },
            { name: 'total_tags', value: data.total_tags },
            { name: 'total_custom_fields', value: data.total_custom_fields },
            { name: 'total_bot_fields', value: data.total_bot_fields },
            { name: 'total_growth_tools', value: data.total_growth_tools },
            { name: 'active_growth_tools', value: data.active_growth_tools },
            { name: 'total_flows', value: data.total_flows }
        ];

        for (const m of metrics) {
            const id = `${userId}_${date}_manychat_${m.name}`;
            db.prepare(`
        INSERT INTO metrics (id, user_id, date, source, metric_name, value)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value
      `).run(id, userId, date, "manychat", m.name, m.value);
        }

        // Save Automations
        for (const auto of data.automations) {
            db.prepare(`
        INSERT INTO manychat_automations (id, user_id, name, status, runs, ctr)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          name = excluded.name,
          status = excluded.status,
          runs = excluded.runs,
          ctr = excluded.ctr,
          updated_at = CURRENT_TIMESTAMP
      `).run(auto.id, userId, auto.name, auto.status, auto.runs, auto.ctr);
        }

        res.json(data);
    } catch (error) {
        if (error instanceof ManyChatAuthError) {
            res.status(401).json({ error: error.message, code: 'RECONNECTION_REQUIRED' });
        } else {
            res.status(500).json({ error: "Failed to sync ManyChat data" });
        }
    }
});

// Dashboard Data
apiRouter.get("/dashboard", (req, res) => {
    const userId = getUserId(req);
    const metrics = db.prepare("SELECT * FROM metrics WHERE user_id = ? ORDER BY date ASC").all(userId) as any[];

    // Group by source for charts
    const chartData = metrics.reduce((acc: any, curr) => {
        const date = curr.date;
        if (!acc[date]) acc[date] = { date };
        acc[date][`${curr.source}_${curr.metric_name}`] = curr.value;
        return acc;
    }, {});

    // Summary Stats
    const summary = {
        recent_views: metrics.filter(m => m.metric_name === 'views').reduce((a, b) => a + b.value, 0),
        total_views: metrics.filter(m => m.metric_name === 'total_views').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        total_videos: metrics.filter(m => m.metric_name === 'total_videos').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        recent_likes: metrics.filter(m => m.metric_name === 'likes').reduce((a, b) => a + b.value, 0),
        recent_comments: metrics.filter(m => m.metric_name === 'comments').reduce((a, b) => a + b.value, 0),
        recent_shares: metrics.filter(m => m.metric_name === 'shares').reduce((a, b) => a + b.value, 0),
        revenue: metrics.filter(m => m.metric_name === 'estimatedRevenue').reduce((a, b) => a + b.value, 0),
        subscribers: metrics
            .filter(m => m.metric_name === 'total_subscribers')
            .sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        manychat_subs: metrics
            .filter(m => m.metric_name === 'subscribers')
            .sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        active_widgets: metrics.filter(m => m.metric_name === 'active_widgets').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        conversion_rate: metrics.filter(m => m.metric_name === 'conversion_rate').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        total_tags: metrics.filter(m => m.metric_name === 'total_tags').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        total_custom_fields: metrics.filter(m => m.metric_name === 'total_custom_fields').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        total_bot_fields: metrics.filter(m => m.metric_name === 'total_bot_fields').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        total_growth_tools: metrics.filter(m => m.metric_name === 'total_growth_tools').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        active_growth_tools: metrics.filter(m => m.metric_name === 'active_growth_tools').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
        total_flows: metrics.filter(m => m.metric_name === 'total_flows').sort((a, b) => b.date.localeCompare(a.date))[0]?.value || 0,
    };

    res.json({
        summary,
        chartData: Object.values(chartData),
        logs: db.prepare("SELECT * FROM sync_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5").all(userId),
        automations: db.prepare("SELECT * FROM manychat_automations WHERE user_id = ? ORDER BY name ASC").all(userId)
    });
});

// Manual Sync Trigger
apiRouter.post("/sync", async (req, res) => {
    const userId = getUserId(req);
    try {
        await performSync(userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
