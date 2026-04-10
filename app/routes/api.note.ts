import { data } from "react-router";
import { requireAuth } from "~/.server/auth";
import { getSession } from "~/.server/session";
import type { Route } from "./+types/api.note";

export async function loader({ request, context }: Route.LoaderArgs) {
    await requireAuth(request);
    const session = await getSession(request.headers.get("Cookie"));
    const addressMap: Record<string, number> = session.get("addressMap") ?? {};
    const addresses = Object.keys(addressMap);
    if (addresses.length === 0) return { notes: {} };

    const placeholders = addresses.map(() => "?").join(", ");
    const { results } = await context.cloudflare.env.D1
        .prepare(`SELECT address, note FROM address_notes WHERE address IN (${placeholders})`)
        .bind(...addresses)
        .all<{ address: string; note: string }>();

    const notes: Record<string, string> = {};
    for (const row of results) {
        notes[row.address] = row.note;
    }
    return { notes };
}

export async function action({ request, context }: Route.ActionArgs) {
    await requireAuth(request);
    const session = await getSession(request.headers.get("Cookie"));
    const addressMap: Record<string, number> = session.get("addressMap") ?? {};

    const { address, note } = await request.json() as { address: string; note: string };

    if (!(address in addressMap)) {
        throw new Response("Unauthorized", { status: 403 });
    }

    await context.cloudflare.env.D1
        .prepare(
            "INSERT INTO address_notes (address, note, updated_at) VALUES (?, ?, ?) ON CONFLICT(address) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at",
        )
        .bind(address, note ?? "", Date.now())
        .run();

    return data({ ok: true });
}
