import { data, redirect } from "react-router";
import { verifyToken } from "~/.server/auth";
import { commitSession, getSession } from "~/.server/session";
import type { Route } from "./+types/login";

export function meta() {
    return [{ title: "Login – smail.pw" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    if (session.get("authed")) {
        throw redirect("/");
    }

    // 读取 URL 中的 token 参数
    const url = new URL(request.url);
    const tokenFromUrl = url.searchParams.get("token");

    return { tokenFromUrl };
}

export async function action({ request, context }: Route.ActionArgs) {
    const formData = await request.formData();
    const token = (formData.get("token") as string) ?? "";
    const redirectTo = (formData.get("redirectTo") as string) || "/";

    const accessToken = (context.cloudflare.env as unknown as { ACCESS_TOKEN?: string }).ACCESS_TOKEN;
    const session = await getSession(request.headers.get("Cookie"));
    const headers = new Headers();

    // 先检查是否是管理员 token
    if (verifyToken(token, accessToken)) {
        session.set("authed", true);
        session.set("role", "admin");
        headers.set("Set-Cookie", await commitSession(session));
        throw redirect(redirectTo, { headers });
    }

    // 不是管理员 token，尝试作为邀请码查询
    const now = Date.now();
    const invite = await context.cloudflare.env.D1
        .prepare("SELECT * FROM invites WHERE code = ?")
        .bind(token)
        .first<{
            code: string;
            max_uses: number;
            used_count: number;
            created_at: number;
            expires_at: number | null;
            bound_session: string | null;
        }>();

    if (!invite) {
        return data({ error: "Invalid access token or invite code." }, { status: 401 });
    }

    // 检查是否过期
    if (invite.expires_at !== null && invite.expires_at < now) {
        return data({ error: "This invite code has expired." }, { status: 401 });
    }

    // 检查是否已用完
    if (invite.used_count >= invite.max_uses) {
        return data({ error: "This invite code has been fully used." }, { status: 401 });
    }

    // 检查是否已绑定到其他 session
    const sessionId = session.id;
    if (invite.bound_session !== null && invite.bound_session !== sessionId) {
        return data({ error: "This invite code is already in use by another user." }, { status: 401 });
    }

    // 首次使用时绑定 session
    if (invite.bound_session === null) {
        await context.cloudflare.env.D1
            .prepare("UPDATE invites SET bound_session = ? WHERE code = ?")
            .bind(sessionId, token)
            .run();
    }

    session.set("authed", true);
    session.set("role", "invite");
    session.set("inviteCode", token);
    headers.set("Set-Cookie", await commitSession(session));
    throw redirect(redirectTo, { headers });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
    const tokenFromUrl = loaderData?.tokenFromUrl;

    return (
        <div className="flex min-h-dvh items-center justify-center px-4">
            <div className="glass-panel w-full max-w-sm space-y-6 px-6 py-8">
                <div className="space-y-1 text-center">
                    <h1 className="font-display text-theme-primary text-2xl font-bold">
                        smail.pw
                    </h1>
                    <p className="text-theme-secondary text-sm">
                        {tokenFromUrl ? "Logging you in..." : "Enter your access token to continue."}
                    </p>
                </div>

                <form method="post" className="space-y-4" ref={(form) => {
                    // 如果 URL 中有 token，自动提交表单
                    if (tokenFromUrl && form && !actionData?.error) {
                        form.submit();
                    }
                }}>
                    <input
                        type="hidden"
                        name="redirectTo"
                        value={
                            typeof window !== "undefined"
                                ? (new URL(window.location.href).searchParams.get("redirectTo") ?? "/")
                                : "/"
                        }
                    />
                    <div className="space-y-1.5">
                        <label
                            htmlFor="token"
                            className="text-theme-faint block text-[11px] font-semibold uppercase tracking-[0.16em]"
                        >
                            Access Token
                        </label>
                        <input
                            id="token"
                            name="token"
                            type="password"
                            required
                            autoFocus
                            autoComplete="current-password"
                            defaultValue={tokenFromUrl || ""}
                            className="border-theme-strong bg-theme-subtle text-theme-primary w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                            placeholder="••••••••"
                        />
                    </div>

                    {actionData?.error && (
                        <p className="text-xs text-red-500">{actionData.error}</p>
                    )}

                    <button type="submit" className="neo-button w-full justify-center">
                        Sign in
                    </button>
                </form>
            </div>
        </div>
    );
}
