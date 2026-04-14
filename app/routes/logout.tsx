import { redirect } from "react-router";
import { destroySession, getSession } from "~/.server/session";
import type { Route } from "./+types/logout";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    const headers = new Headers();

    // 清除 Session Cookie
    const sessionCookie = await destroySession(session);
    headers.append("Set-Cookie", sessionCookie);

    // 清除邀请码 Cookie
    const inviteCookie = "smail_invite_code=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
    headers.append("Set-Cookie", inviteCookie);

    // 重定向到登录页
    throw redirect("/login?logout=1", { headers });
}
