import { redirect } from "react-router";
import { destroySession, getSession } from "~/.server/session";
import type { Route } from "./+types/logout";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    const headers = new Headers();
    headers.set("Set-Cookie", await destroySession(session));

    // 重定向到登录页，并带上清除 localStorage 的标记
    throw redirect("/login?logout=1", { headers });
}
