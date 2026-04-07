import { redirect } from "react-router";
import { destroySession, getSession } from "~/.server/session";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    const headers = new Headers();
    headers.set("Set-Cookie", await destroySession(session));
    throw redirect("/login", { headers });
}

// GET 直接跳回首页（防止直接访问）
export async function loader() {
    throw redirect("/");
}
