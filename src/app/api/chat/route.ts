/**
 * POST /api/chat — the chatbot endpoint any client site embeds.
 *
 * Body: { accountId, sessionId, conversationId?, message?, entryPostId?, utm? }
 *  - no conversationId → starts a conversation (greeting, optionally from a post)
 *  - with conversationId + message → next turn
 */
import { NextRequest, NextResponse } from "next/server";
import { chat, ChatError } from "@/lib/chat/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cors = {
  "Access-Control-Allow-Origin": process.env.CHAT_ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, sessionId } = body ?? {};
    if (typeof accountId !== "string" || typeof sessionId !== "string") {
      return NextResponse.json({ error: "accountId and sessionId are required" }, { status: 400, headers: cors });
    }
    const res = await chat({
      accountId,
      sessionId,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
      entryPostId: typeof body.entryPostId === "string" ? body.entryPostId : undefined,
      utm: body.utm && typeof body.utm === "object" ? body.utm : undefined,
      inspect: body.inspect === true,
    });
    return NextResponse.json(res, { headers: cors });
  } catch (e) {
    const status = e instanceof ChatError ? e.status : 500;
    if (status === 500) console.error("chat error", e);
    return NextResponse.json({ error: e instanceof ChatError ? e.message : "Something went wrong" }, { status, headers: cors });
  }
}
