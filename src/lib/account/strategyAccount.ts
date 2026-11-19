/**
 * Account source of truth (Spec section 4, rewritten 2026-10-24): strategy-app's
 * Mongo `strategy.accounts`. We never connect to that db directly — strategy-app
 * already exposes GET /api/accounts/[id], which strips every credential-looking
 * field (toPublicAccount) before it leaves the server, so this is a safe
 * token-free read. We only pick the fields this app is allowed to use; anything
 * under `platforms` (including Instagram tokens) is never touched.
 *
 * Offline fallback (no STRATEGY_APP_URL, or the request fails): the local demo
 * fixture, so tests and `npm run demo:e2e` stay hermetic.
 */

import type { Account } from "../db/schemas";
import { loadDemo } from "../demo/fixtures";

const STRATEGY_APP_URL = process.env.STRATEGY_APP_URL;

interface StrategyAccountResponse {
  success: boolean;
  account?: {
    id: string;
    name: string;
    isDemo?: boolean;
    driveFolderId?: string;
    notion?: { postsDataSourceId: string; topicsDataSourceId: string };
    agent?: Account["agent"];
  };
}

function pick(raw: NonNullable<StrategyAccountResponse["account"]>): Account {
  return {
    slug: raw.id,
    name: raw.name,
    isDemo: raw.isDemo,
    notion: raw.notion,
    driveFolderId: raw.driveFolderId,
    agent: raw.agent,
  };
}

export async function getStrategyAccount(accountId: string): Promise<Account | null> {
  if (STRATEGY_APP_URL) {
    try {
      const res = await fetch(`${STRATEGY_APP_URL}/api/accounts/${accountId}`, { cache: "no-store" });
      if (res.ok) {
        const data: StrategyAccountResponse = await res.json();
        if (data.success && data.account) return pick(data.account);
      }
    } catch {
      // Strategy app unreachable: fall through to the offline fixture below.
    }
  }
  if (accountId === "demo") return loadDemo().account;
  return null;
}

/** All accounts from strategy-app (source of truth). Falls back to just the demo account offline. */
export async function listStrategyAccounts(): Promise<Account[]> {
  if (STRATEGY_APP_URL) {
    try {
      const res = await fetch(`${STRATEGY_APP_URL}/api/accounts`, { cache: "no-store" });
      if (res.ok) {
        const data: { success: boolean; accounts?: NonNullable<StrategyAccountResponse["account"]>[] } = await res.json();
        if (data.success && data.accounts) return data.accounts.map(pick);
      }
    } catch {
      // fall through to the offline fixture
    }
  }
  return [loadDemo().account];
}
