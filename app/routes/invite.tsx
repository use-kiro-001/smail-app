import { useState } from "react";
import { data, Link, redirect, useFetcher } from "react-router";
import { getSession } from "~/.server/session";
import type { Route } from "./+types/invite";
import { customAlphabet } from "nanoid";

const generateInviteCode = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

type Invite = {
    code: string;
    max_uses: number;
    used_count: number;
    created_at: number;
    expires_at: number | null;
    bound_session: string | null;
};

export function meta() {
    return [{ title: "Invite Codes – smail.pw" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    if (!session.get("authed")) {
        throw redirect("/login");
    }
    if (session.get("role") !== "admin") {
        throw redirect("/");
    }

    const { results } = await context.cloudflare.env.D1
        .prepare("SELECT * FROM invites ORDER BY created_at DESC LIMIT 100")
        .all<Invite>();

    return { invites: results };
}

export async function action({ request, context }: Route.ActionArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    if (!session.get("authed") || session.get("role") !== "admin") {
        throw new Response("Forbidden", { status: 403 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const maxUses = Number(formData.get("maxUses")) || 5;
        const expiresInDays = Number(formData.get("expiresInDays")) || 0;
        const code = generateInviteCode();
        const now = Date.now();
        const expiresAt = expiresInDays > 0 ? now + expiresInDays * 24 * 60 * 60 * 1000 : null;

        await context.cloudflare.env.D1
            .prepare("INSERT INTO invites (code, max_uses, used_count, created_at, expires_at) VALUES (?, ?, 0, ?, ?)")
            .bind(code, maxUses, now, expiresAt)
            .run();

        return data({ success: true, code });
    }

    if (intent === "delete") {
        const code = formData.get("code") as string;
        if (code) {
            await context.cloudflare.env.D1
                .prepare("DELETE FROM invites WHERE code = ?")
                .bind(code)
                .run();
        }
        return data({ success: true });
    }

    return data({ error: "Unknown intent" }, { status: 400 });
}

export default function InvitePage({ loaderData }: Route.ComponentProps) {
    const fetcher = useFetcher();
    const [maxUses, setMaxUses] = useState(5);
    const [expiresInDays, setExpiresInDays] = useState(7);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const invites = loaderData.invites;
    const isSubmitting = fetcher.state === "submitting";
    const newCode = (fetcher.data as { code?: string } | undefined)?.code;

    const copyToClipboard = async (code: string) => {
        const url = `${window.location.origin}/login?token=${code}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        } catch {
            // ignore
        }
    };

    return (
        <div className="flex flex-1 flex-col py-3 sm:py-4">
            <div className="flex flex-1 flex-col gap-4 w-full max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                    <h1 className="font-display text-xl font-bold text-theme-primary">
                        Invite Codes
                    </h1>
                    <Link to="/" className="neo-button-secondary px-3 py-1.5 text-xs">
                        ← Back
                    </Link>
                </div>

                {/* 创建新邀请码 */}
                <section className="glass-panel p-4 sm:p-5">
                    <h2 className="text-theme-faint text-[11px] font-semibold uppercase tracking-[0.16em] mb-4">
                        Create New Invite
                    </h2>
                    <fetcher.Form method="post" className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="intent" value="create" />
                        <div className="space-y-1">
                            <label className="text-theme-faint text-[10px] font-semibold uppercase tracking-wide">
                                Max Uses
                            </label>
                            <input
                                type="number"
                                name="maxUses"
                                min={1}
                                max={100}
                                value={maxUses}
                                onChange={(e) => setMaxUses(Number(e.target.value))}
                                className="w-20 rounded-lg border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm text-theme-primary outline-none focus:border-[var(--line-strong)]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-theme-faint text-[10px] font-semibold uppercase tracking-wide">
                                Expires In (days, 0 = never)
                            </label>
                            <input
                                type="number"
                                name="expiresInDays"
                                min={0}
                                max={365}
                                value={expiresInDays}
                                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                                className="w-24 rounded-lg border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm text-theme-primary outline-none focus:border-[var(--line-strong)]"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="neo-button px-4 py-2 text-sm"
                        >
                            {isSubmitting ? "Creating..." : "Create"}
                        </button>
                    </fetcher.Form>

                    {newCode && (
                        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <p className="text-sm text-theme-primary mb-2">
                                New invite code created:
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 rounded bg-theme-subtle text-sm font-mono text-theme-primary break-all">
                                    {window.location.origin}/login?token={newCode}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(newCode)}
                                    className="neo-button-secondary px-3 py-2 text-xs shrink-0"
                                >
                                    {copiedCode === newCode ? "Copied!" : "Copy"}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* 邀请码列表 */}
                <section className="glass-panel p-4 sm:p-5">
                    <h2 className="text-theme-faint text-[11px] font-semibold uppercase tracking-[0.16em] mb-4">
                        Existing Invites ({invites.length})
                    </h2>
                    {invites.length === 0 ? (
                        <p className="text-theme-muted text-sm">No invite codes yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {invites.map((invite) => {
                                const isExpired = invite.expires_at !== null && invite.expires_at < Date.now();
                                const isExhausted = invite.used_count >= invite.max_uses;
                                const status = isExpired ? "expired" : isExhausted ? "exhausted" : "active";

                                return (
                                    <div
                                        key={invite.code}
                                        className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${status === "active"
                                                ? "border-[var(--line-soft)] bg-theme-subtle"
                                                : "border-red-500/20 bg-red-500/5"
                                            }`}
                                    >
                                        <code className="font-mono text-sm text-theme-primary">
                                            {invite.code}
                                        </code>
                                        <span className="text-xs text-theme-faint">
                                            {invite.used_count}/{invite.max_uses} used
                                        </span>
                                        {invite.expires_at && (
                                            <span className="text-xs text-theme-faint">
                                                {isExpired
                                                    ? "Expired"
                                                    : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                                            </span>
                                        )}
                                        {invite.bound_session && (
                                            <span className="text-xs text-theme-faint">
                                                🔒 Bound
                                            </span>
                                        )}
                                        <span
                                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${status === "active"
                                                    ? "bg-green-500/20 text-green-600"
                                                    : "bg-red-500/20 text-red-500"
                                                }`}
                                        >
                                            {status}
                                        </span>
                                        <div className="flex-1" />
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(invite.code)}
                                            className="neo-button-secondary px-2 py-1 text-[10px]"
                                        >
                                            {copiedCode === invite.code ? "✓" : "Copy"}
                                        </button>
                                        <fetcher.Form method="post">
                                            <input type="hidden" name="intent" value="delete" />
                                            <input type="hidden" name="code" value={invite.code} />
                                            <button
                                                type="submit"
                                                className="neo-button-secondary px-2 py-1 text-[10px] text-red-500"
                                            >
                                                Delete
                                            </button>
                                        </fetcher.Form>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
