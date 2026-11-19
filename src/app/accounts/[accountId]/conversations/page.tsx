import { ConversationsClient } from "./client";

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function ConversationsPage({ params }: PageProps) {
  const { accountId } = await params;
  return <ConversationsClient accountId={accountId} />;
}
