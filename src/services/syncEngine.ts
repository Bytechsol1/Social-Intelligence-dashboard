import { google } from "googleapis";
import { format, subDays } from "date-fns";
import { db } from "../db/database.js";
import { decrypt } from "../utils/encryption.js";
import { ManyChatService, ManyChatAuthError } from "./manychatService.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// The APP_URL redirect URI will be dynamically passed where needed, but we init a base client here
const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    process.env.APP_URL?.replace(/\/$/, "") + "/api/auth/youtube/callback"
);

export async function performSync(userId: string) {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) throw new Error("User not found");

    const results = { youtube: "skipped", manychat: "skipped" };

    // 1. YouTube Sync
    if (user.yt_refresh_token) {
        try {
            const refreshToken = decrypt(user.yt_refresh_token);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const ytAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth2Client });
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });

            // 1a. Fetch Real-time Stats (Subscribers) from Data API
            const channelRes = await youtube.channels.list({
                mine: true,
                part: ["statistics", "snippet"]
            });

            let channelId = "MINE";
            if (channelRes.data.items && channelRes.data.items.length > 0) {
                const channel = channelRes.data.items[0];
                channelId = channel.id || "MINE";
                const stats = channel.statistics;
                const date = format(new Date(), "yyyy-MM-dd");

                const id = `${userId}_${date}_youtube_total_subscribers`;
                db.prepare(`
          INSERT INTO metrics (id, user_id, date, source, metric_name, value)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value = excluded.value
        `).run(id, userId, date, "youtube", "total_subscribers", Number(stats?.subscriberCount || 0));

                db.prepare(`
          INSERT INTO metrics (id, user_id, date, source, metric_name, value)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value = excluded.value
        `).run(`${userId}_${date}_youtube_total_views`, userId, date, "youtube", "total_views", Number(stats?.viewCount || 0));

                db.prepare(`
          INSERT INTO metrics (id, user_id, date, source, metric_name, value)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value = excluded.value
        `).run(`${userId}_${date}_youtube_total_videos`, userId, date, "youtube", "total_videos", Number(stats?.videoCount || 0));
            }

            // 1b. Fetch Historical Analytics
            try {
                const endDate = format(subDays(new Date(), 2), "yyyy-MM-dd"); // 2 day delay for revenue
                const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");

                const response = await ytAnalytics.reports.query({
                    ids: channelId === "MINE" ? "channel==MINE" : `channel==${channelId}`,
                    startDate,
                    endDate,
                    metrics: "views,estimatedRevenue,subscribersGained,estimatedMinutesWatched,likes,comments,shares",
                    dimensions: "day",
                    sort: "day"
                });

                if (response.data.rows) {
                    const stmt = db.prepare(`
            INSERT INTO metrics (id, user_id, date, source, metric_name, value)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET value = excluded.value
          `);

                    for (const row of response.data.rows) {
                        const [date, views, revenue, subs, watchTime, likes, comments, shares] = row;
                        const metricsToStore = [
                            { name: 'views', val: views },
                            { name: 'estimatedRevenue', val: revenue },
                            { name: 'subscribersGained', val: subs },
                            { name: 'watchTime', val: watchTime },
                            { name: 'likes', val: likes },
                            { name: 'comments', val: comments },
                            { name: 'shares', val: shares }
                        ];

                        metricsToStore.forEach(m => {
                            const id = `${userId}_${date}_youtube_${m.name}`;
                            stmt.run(id, userId, date, "youtube", m.name, m.val);
                        });
                    }
                }
            } catch (analyticsErr: any) {
                if (analyticsErr.message?.includes("Insufficient permission")) {
                    console.log("YouTube Analytics: Historical data not yet available (expected for new channels).");
                } else {
                    console.warn("YouTube Analytics Report failed:", analyticsErr.message);
                }
            }

            results.youtube = "success";
            db.prepare("INSERT INTO sync_logs (user_id, status, message) VALUES (?, ?, ?)")
                .run(userId, "COMPLETED", "YouTube sync successful. Real-time stats updated. Historical data pending (48h delay).");
        } catch (err: any) {
            console.error("YT Sync Error:", err);
            results.youtube = `failed: ${err.message}`;
        }
    }

    // 2. ManyChat Sync
    const mcKey = user?.manychat_key ? decrypt(user.manychat_key) : process.env.MANYCHAT_API_KEY;
    if (mcKey) {
        try {
            const mcService = new ManyChatService(mcKey);
            const mcData = await mcService.fetchAllData();
            const date = format(new Date(), "yyyy-MM-dd");

            const mcMetrics = [
                { name: 'subscribers', value: mcData.total_contacts },
                { name: 'active_widgets', value: mcData.active_widgets },
                { name: 'conversion_rate', value: mcData.lead_conversion_rate },
                { name: 'total_tags', value: mcData.total_tags },
                { name: 'total_custom_fields', value: mcData.total_custom_fields },
                { name: 'total_bot_fields', value: mcData.total_bot_fields },
                { name: 'total_growth_tools', value: mcData.total_growth_tools },
                { name: 'active_growth_tools', value: mcData.active_growth_tools },
                { name: 'total_flows', value: mcData.total_flows }
            ];

            for (const m of mcMetrics) {
                const id = `${userId}_${date}_manychat_${m.name}`;
                db.prepare(`
          INSERT INTO metrics (id, user_id, date, source, metric_name, value)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value = excluded.value
        `).run(id, userId, date, "manychat", m.name, m.value);
            }

            // Save Automations
            for (const auto of mcData.automations) {
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

            db.prepare("INSERT INTO sync_logs (user_id, status, message) VALUES (?, ?, ?)")
                .run(userId, "COMPLETED", `ManyChat sync successful for ${mcData.account_name}`);
            results.manychat = "success";
        } catch (error: any) {
            const msg = error instanceof ManyChatAuthError ? error.message : `ManyChat sync failed: ${error.message}`;
            console.error("ManyChat Sync Error Details:", error);
            db.prepare("INSERT INTO sync_logs (user_id, status, message) VALUES (?, ?, ?)")
                .run(userId, "FAILED", msg);
            results.manychat = `failed: ${msg}`;
        }
    }

    db.prepare("INSERT INTO sync_logs (user_id, status, message) VALUES (?, ?, ?)")
        .run(userId, "COMPLETED", JSON.stringify(results));
}
