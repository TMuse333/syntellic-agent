import Link from "next/link";
import { Shell } from "@/components/layout/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowUpRight } from "lucide-react";
import { listStrategyAccounts } from "@/lib/account/strategyAccount";

// Account list comes from strategy-app (source of truth) on every load.
export const dynamic = "force-dynamic";

export default async function AccountsIndexPage() {
  const accounts = await listStrategyAccounts();

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="mt-1 text-muted-foreground">
            {accounts.length} client{accounts.length === 1 ? "" : "s"} · sourced from strategy-app
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Link key={a.slug} href={`/accounts/${a.slug}`}>
              <Card className="group h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{a.slug}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  {a.isDemo && <Badge variant="secondary">Demo</Badge>}
                  {a.agent ? (
                    <Badge variant="secondary">Chatbot configured</Badge>
                  ) : (
                    <Badge variant="outline">No agent config</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
