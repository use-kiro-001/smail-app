import { nanoid } from "nanoid";
import Parser from "postal-mime";
import { createRequestHandler } from "react-router";
import { getRetentionCutoff } from "../app/utils/mail-retention";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
	async email(msg, env) {
		// 验证地址是否在白名单中（防止资源滥用）
		const owner = await env.D1.prepare(
			"SELECT session_id FROM active_addresses WHERE address = ? AND expires_at > ?",
		)
			.bind(msg.to, Date.now())
			.first<{ session_id: string }>();

		if (!owner) {
			console.log(`Rejected email to unregistered address: ${msg.to}`);
			return;
		}

		// 先把 ReadableStream 完整读取为 ArrayBuffer
		const ab = await new Response(msg.raw).arrayBuffer();
		const parser = new Parser();
		const parsed = await parser.parse(ab);
		const id = nanoid();

		await env.D1.prepare(
			"INSERT INTO emails (id, to_address, from_name, from_address, subject, time) VALUES (?, ?, ?, ?, ?, ?)",
		)
			.bind(id, msg.to, parsed.from?.name ?? null, parsed.from?.address ?? null, parsed.subject ?? null, Date.now())
			.run();

		await env.R2.put(id, ab);
	},
	async scheduled(_, env) {
		// 清理 24h 前的过期邮件（D1 元数据 + R2 原始内容）
		const cutoff = getRetentionCutoff();
		const { results } = await env.D1.prepare(
			"SELECT id FROM emails WHERE time < ?",
		)
			.bind(cutoff)
			.all<{ id: string }>();

		if (results.length > 0) {
			// 批量删除 R2 对象
			await Promise.all(results.map((row) => env.R2.delete(row.id)));
			// 批量删除 D1 记录
			const placeholders = results.map(() => "?").join(", ");
			await env.D1.prepare(`DELETE FROM emails WHERE id IN (${placeholders})`)
				.bind(...results.map((row) => row.id))
				.run();
		}

		// 清理过期的邀请码
		await env.D1.prepare(
			"DELETE FROM invites WHERE expires_at IS NOT NULL AND expires_at < ?",
		)
			.bind(Date.now())
			.run();

		// 清理过期的邮箱地址
		await env.D1.prepare(
			"DELETE FROM active_addresses WHERE expires_at < ?",
		)
			.bind(Date.now())
			.run();
	},
} satisfies ExportedHandler<Env>;
