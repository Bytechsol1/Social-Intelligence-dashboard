import axios from 'axios';

export class ManyChatAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManyChatAuthError';
  }
}

export interface ManyChatAutomation {
  id: string;
  name: string;
  status: string;
  runs: number;
  ctr: number;
}

export interface ManyChatData {
  account_name: string;
  total_contacts: number;
  active_widgets: number;
  lead_conversion_rate: number;
  total_tags: number;
  total_custom_fields: number;
  total_bot_fields: number;
  total_growth_tools: number;
  active_growth_tools: number;
  total_flows: number;
  automations: ManyChatAutomation[];
}

export class ManyChatService {
  private apiKey: string;
  private baseUrl = 'https://api.manychat.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json'
    };
  }

  async fetchAllData(): Promise<ManyChatData> {
    // 1. Get Page Info (Critical - will throw on auth failure)
    let pageInfo: any = {};
    try {
      const infoRes = await axios.get(`${this.baseUrl}/fb/page/getInfo`, { headers: this.headers });
      if (infoRes.data.status !== 'success') {
        throw new ManyChatAuthError('Invalid ManyChat API Key or unauthorized access');
      }
      pageInfo = infoRes.data.data || {};
    } catch (error: any) {
      if (error instanceof ManyChatAuthError) throw error;
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new ManyChatAuthError('ManyChat authentication failed. Please check your API key.');
      }
      throw new Error(`Critical ManyChat error: ${error.message}`);
    }

    // 2. Safe fetcher for non-critical endpoints
    const safeFetch = async (url: string) => {
      try {
        const res = await axios.get(url, { headers: this.headers });
        return res.data; // Return the full response object so we can handle different shapes
      } catch (err: any) {
        console.warn(`ManyChat fetch failed for ${url}:`, err.response?.status, err.message);
        return null;
      }
    };

    // 3. Fetch all data in parallel
    const [tagsRes, widgetsRes, cfRes, bfRes, gtRes, flowsRes] = await Promise.all([
      safeFetch(`${this.baseUrl}/fb/page/getTags`),
      safeFetch(`${this.baseUrl}/fb/page/getWidgets`),
      safeFetch(`${this.baseUrl}/fb/page/getCustomFields`),
      safeFetch(`${this.baseUrl}/fb/page/getBotFields`),
      safeFetch(`${this.baseUrl}/fb/page/getGrowthTools`),
      safeFetch(`${this.baseUrl}/fb/page/getFlows`),
    ]);

    // 4. Extract arrays robustly – each endpoint may return data as an array OR an object with a nested key
    const extractArray = (res: any, nestedKey?: string): any[] => {
      if (!res || res.status !== 'success') return [];
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (d && nestedKey && Array.isArray(d[nestedKey])) return d[nestedKey];
      if (d && typeof d === 'object') {
        // Try to find the first array property
        const firstArr = Object.values(d).find(v => Array.isArray(v));
        if (firstArr) return firstArr as any[];
      }
      return [];
    };

    const tags = extractArray(tagsRes);
    const widgets = extractArray(widgetsRes);
    const customFields = extractArray(cfRes);
    const botFields = extractArray(bfRes);
    const growthTools = extractArray(gtRes);
    const flows = extractArray(flowsRes, 'flows'); // getFlows returns { flows: [...] }

    // 5. Compute derived metrics
    const leadTags = tags.filter((t: any) =>
      t?.name && (t.name.toLowerCase().includes('lead') || t.name.toLowerCase().includes('conversion'))
    );

    // Active widgets: widgets with a truthy `active` field
    const activeWidgets = widgets.filter((w: any) => !!w?.active).length;

    // Growth tools: the API returns { id, name, type } only – no status field
    // Treat all as active since there's no status field available
    const activeGrowthTools = growthTools.length;

    // Flows → automations table
    const automations: ManyChatAutomation[] = flows.map((f: any) => ({
      id: f.ns || f.id || Math.random().toString(36).slice(2, 9),
      name: f.name || 'Unnamed Flow',
      status: 'LIVE',
      runs: 0,  // ManyChat Public API does not expose run counts
      ctr: 0,   // ManyChat Public API does not expose CTR
    }));

    // 6. Subscriber count: `getInfo` no longer includes `subscribers_count` for all account types.
    // Use what's available; if missing report 0 (not an API limitation we can fix without a Pro subscription scope).
    const totalContacts = pageInfo.subscribers_count ?? 0;
    const conversionRate = totalContacts > 0
      ? parseFloat(((leadTags.length / Math.max(tags.length, 1)) * 100).toFixed(2))
      : 0;

    return {
      account_name: pageInfo.name || 'ManyChat Account',
      total_contacts: totalContacts,
      active_widgets: activeWidgets,
      lead_conversion_rate: conversionRate,
      total_tags: tags.length,
      total_custom_fields: customFields.length,
      total_bot_fields: botFields.length,
      total_growth_tools: growthTools.length,
      active_growth_tools: activeGrowthTools,
      total_flows: flows.length,
      automations,
    };
  }
}
