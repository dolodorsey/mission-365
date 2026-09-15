import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// MISSION 365 ONLY.
// The legacy spreadsheet mirror embedded a reusable access token directly in
// deployed source and queried sensitive application data with service-role
// authority. That credential boundary is retired. Do not restore a static
// query-string bearer token or expose application PII from this endpoint.

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  return Response.json(
    {
      service: "mission-365",
      status: "retired",
      code: "application_sheet_feed_retired",
      message:
        "The legacy application spreadsheet feed is retired. Use an approved authenticated operations export with a rotated credential boundary.",
    },
    {
      status: 410,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json",
      },
    },
  );
});
