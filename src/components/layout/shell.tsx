import { Sidebar, AccountSidebar } from "./sidebar";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-y-auto transition-all duration-300">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

interface AccountShellProps {
  accountId: string;
  children: React.ReactNode;
}

export function AccountShell({ accountId, children }: AccountShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AccountSidebar accountId={accountId} />
      <main className="ml-56 flex-1 overflow-y-auto transition-all duration-300">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
