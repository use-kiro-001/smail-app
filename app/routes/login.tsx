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
    return {};
}

export async function action({ request, context }: Route.ActionArgs) {
    const formData = await request.formData();
    const token = (formData.get("token") as string) ?? "";
    const redirectTo = (formData.get("redirectTo") as string) || "/";

    const accessToken = (context.cloudflare.env as Record<string, string>).ACCESS_TOKEN;
    if (!verifyToken(token, accessToken)) {
        return data({ error: "Invalid access token." }, { status: 401 });
    }

    const session = await getSession(request.headers.get("Cookie"));
    session.set("authed", true);
    const headers = new Headers();
    headers.set("Set-Cookie", await commitSession(session));
    throw redirect(redirectTo, { headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
    return (
        <div className="flex min-h-dvh items-center justify-center px-4">
            <div className="glass-panel w-full max-w-sm space-y-6 px-6 py-8">
                <div className="space-y-1 text-center">
                    <h1 className="font-display text-theme-primary text-2xl font-bold">
                        smail.pw
                    </h1>
                    <p className="text-theme-secondary text-sm">
                        Enter your access token to continue.
                    </p>
                </div>

                <form method="post" className="space-y-4">
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
