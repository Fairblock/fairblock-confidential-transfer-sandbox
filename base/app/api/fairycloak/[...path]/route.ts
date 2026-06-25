import { NextRequest, NextResponse } from "next/server";

const RELAY_URL = process.env.FAIRYCLOAK_URL || process.env.NEXT_PUBLIC_FAIRYCLOAK_URL || "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  if (!RELAY_URL) {
    return NextResponse.json({ error: "Relay not configured" }, { status: 503 });
  }

  const path = params.path.join("/");
  const search = req.nextUrl.search;
  const target = `${RELAY_URL.replace(/\/$/, "")}/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!["host", "connection", "transfer-encoding"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.arrayBuffer()
    : undefined;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "transfer-encoding") {
      resHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}
