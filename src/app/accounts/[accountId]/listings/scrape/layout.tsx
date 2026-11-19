import { AccountShell } from "@/components/layout/shell";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ accountId: string }>;
}

export default async function ScrapeLayout({ children, params }: LayoutProps) {
  const { accountId } = await params;

  return (
    <AccountShell accountId={accountId}>
      {children}
    </AccountShell>
  );
}
