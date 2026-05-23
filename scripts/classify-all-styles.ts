import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const CHUNK_SIZE = 5; // tune down if the edge function still times out

interface StyleRow {
  id: string;
  name: string;
  image_url: string;
}

async function listUnclassifiedStyles(
  supabaseUrl: string,
  anonKey: string
): Promise<StyleRow[]> {
  // Fetch all active styles lacking tryon_attributes via PostgREST.
  const url = `${supabaseUrl}/rest/v1/style_gallery?select=id,name,image_url&is_active=eq.true&tryon_attributes=is.null`;
  const res = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list styles: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as StyleRow[];
}

interface ChunkResult {
  updated: number;
  failed: number;
  total: number;
  log: string[];
  error?: string;
  httpStatus?: number;
}

async function classifyChunk(
  supabaseUrl: string,
  anonKey: string,
  chunk: StyleRow[]
): Promise<ChunkResult> {
  const res = await fetch(`${supabaseUrl}/functions/v1/analyze-style-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ styleIds: chunk.map((s) => s.id) }),
  });
  if (!res.ok) {
    return {
      updated: 0,
      failed: chunk.length,
      total: chunk.length,
      log: chunk.map((s) => `ERROR: ${s.name} — HTTP ${res.status}`),
      httpStatus: res.status,
      error: (await res.text()).slice(0, 300),
    };
  }
  const data = await res.json();
  return {
    updated: data.updated ?? 0,
    failed: data.failed ?? 0,
    total: data.total ?? chunk.length,
    log: data.log ?? [],
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }

  console.log(`Fetching unclassified active styles from ${supabaseUrl}...`);
  const styles = await listUnclassifiedStyles(supabaseUrl, anonKey);
  console.log(`Found ${styles.length} styles needing classification.`);
  if (styles.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  let totalUpdated = 0;
  let totalFailed = 0;
  const aggregateLog: string[] = [];

  for (let i = 0; i < styles.length; i += CHUNK_SIZE) {
    const chunk = styles.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(styles.length / CHUNK_SIZE);
    console.log(`\n[chunk ${chunkNum}/${totalChunks}] classifying ${chunk.length} styles...`);

    const result = await classifyChunk(supabaseUrl, anonKey, chunk);
    totalUpdated += result.updated;
    totalFailed += result.failed;
    aggregateLog.push(...result.log);

    if (result.error) {
      console.error(`[chunk ${chunkNum}] HTTP ${result.httpStatus} — ${result.error}`);
    } else {
      console.log(`[chunk ${chunkNum}] updated=${result.updated} failed=${result.failed}`);
      for (const line of result.log.slice(0, 3)) console.log(`  ${line}`);
      if (result.log.length > 3) console.log(`  ...and ${result.log.length - 3} more`);
    }

    // Small delay between chunks to avoid hammering the Gemini API.
    if (i + CHUNK_SIZE < styles.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== Final ===`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Failed:  ${totalFailed}`);
  console.log(`Total:   ${styles.length}`);
  if (totalFailed > 0) {
    console.log(`\nFailure log:`);
    for (const line of aggregateLog.filter((l) => !l.startsWith("OK:"))) {
      console.log(`  ${line}`);
    }
  }

  process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
