import db from "../db.server";

// Simple uptime check: confirms the server and database respond.
export const loader = async () => {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up" });
  } catch (e) {
    console.error("healthz db error", e);
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
};
