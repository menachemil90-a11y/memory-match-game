// Deletes the photo cards of online photo rooms that are over: the room
// closed or is gone, or the card is older than 24 hours (see migration
// 20261119000006_photo_rooms.sql). Called every 5 minutes by pg_cron.
//
// It only removes what is already due, so it is safe to call at any time
// (deployed with JWT verification off; the cron job sends no key). Files are
// removed through the Storage API so the stored bytes are deleted too.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'room-photos';
const BATCH = 500;
const MAX_ROUNDS = 20;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 500);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.rpc('expired_room_photos', { p_limit: BATCH });
    if (error) {
      console.error('expired_room_photos failed', error.message);
      return json({ error: 'list_failed', deleted }, 500);
    }
    const names = (data ?? []) as string[];
    if (names.length === 0) break;
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(names);
    if (removeError) {
      console.error('remove failed', removeError.message);
      return json({ error: 'remove_failed', deleted }, 500);
    }
    deleted += names.length;
    if (names.length < BATCH) break;
  }
  return json({ deleted });
});
