import { createWorkersKVSessionStorage } from "@react-router/cloudflare";
import { createCookie } from "react-router";

type SessionData = {
	// 地址 -> 签发时间戳 的 map
	addressMap?: Record<string, number>;
	authed?: boolean;
	// 用户角色：admin 为管理员，invite 为邀请码用户
	role?: "admin" | "invite";
	// 邀请码用户绑定的邀请码
	inviteCode?: string;
	// 兼容旧字段，迁移后可移除
	addresses?: string[];
	addressIssuedAt?: number;
};

// Session Cookie 有效期与地址保留期一致：30 天
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 秒

let sessionStorage: ReturnType<
	typeof createWorkersKVSessionStorage<SessionData>
> | null = null;

async function getSessionStorage() {
	if (!sessionStorage) {
		// 延迟到运行时才 import cloudflare:workers，避免 build 时报错
		const { env } = await import("cloudflare:workers");
		const secret = (env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET;
		if (!secret) {
			throw new Error("SESSION_SECRET environment variable is required");
		}
		sessionStorage = createWorkersKVSessionStorage<SessionData>({
			cookie: createCookie("__session", {
				httpOnly: true,
				sameSite: "lax",
				secure: true,
				maxAge: SESSION_MAX_AGE,
				secrets: [secret],
			}),
			kv: env.KV,
		});
	}
	return sessionStorage;
}

export async function getSession(
	...args: Parameters<
		ReturnType<typeof createWorkersKVSessionStorage<SessionData>>["getSession"]
	>
) {
	const storage = await getSessionStorage();
	return storage.getSession(...args);
}

export async function commitSession(
	...args: Parameters<
		ReturnType<
			typeof createWorkersKVSessionStorage<SessionData>
		>["commitSession"]
	>
) {
	const storage = await getSessionStorage();
	return storage.commitSession(...args);
}

export async function destroySession(
	...args: Parameters<
		ReturnType<
			typeof createWorkersKVSessionStorage<SessionData>
		>["destroySession"]
	>
) {
	const storage = await getSessionStorage();
	return storage.destroySession(...args);
}
