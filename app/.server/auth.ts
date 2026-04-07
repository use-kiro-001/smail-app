import { redirect } from "react-router";
import { getSession } from "./session";

/**
 * 校验请求是否已通过凭证认证。
 * 未认证时抛出重定向到 /login（保留 redirectTo 参数）。
 */
export async function requireAuth(request: Request): Promise<void> {
    const session = await getSession(request.headers.get("Cookie"));
    if (!session.get("authed")) {
        const url = new URL(request.url);
        const redirectTo = encodeURIComponent(url.pathname + url.search);
        throw redirect(`/login?redirectTo=${redirectTo}`);
    }
}

/**
 * 校验用户输入的 token 是否与环境变量中的 ACCESS_TOKEN 匹配。
 */
export function verifyToken(input: string, token: string | undefined): boolean {
    if (!token) return false;
    return input === token;
}
