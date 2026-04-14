/**
 * 邀请码功能测试用例
 *
 * 运行方式：
 *   pnpm run test
 *
 * 注意：这些是纯逻辑单元测试，不依赖 Cloudflare 运行时。
 * 实际的 D1 操作需要在集成测试或本地 wrangler dev 环境中验证。
 */

import { describe, expect, it } from "vitest";
import { customAlphabet } from "nanoid";

const generateInviteCode = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

// ─── 邀请码生成 ────────────────────────────────────────────────────────────

describe("邀请码生成", () => {
    it("应该生成 8 位字符的邀请码", () => {
        const code = generateInviteCode();
        expect(code).toHaveLength(8);
    });

    it("生成的邀请码只包含小写字母和数字", () => {
        const code = generateInviteCode();
        expect(code).toMatch(/^[a-z0-9]+$/);
    });

    it("多次生成应该产生不同的邀请码", () => {
        const codes = new Set<string>();
        for (let i = 0; i < 100; i++) {
            codes.add(generateInviteCode());
        }
        // 100 次生成应该至少有 95 个不同的码（允许极小概率重复）
        expect(codes.size).toBeGreaterThan(95);
    });
});

// ─── 邀请码额度逻辑 ────────────────────────────────────────────────────────

describe("邀请码额度管理", () => {
    type Invite = {
        code: string;
        max_uses: number;
        used_count: number;
        created_at: number;
        expires_at: number | null;
        bound_session: string | null;
    };

    function canUseInvite(invite: Invite, now: number): boolean {
        // 检查是否已用完
        if (invite.used_count >= invite.max_uses) {
            return false;
        }
        // 检查是否过期
        if (invite.expires_at !== null && invite.expires_at < now) {
            return false;
        }
        return true;
    }

    function consumeInvite(invite: Invite): boolean {
        if (invite.used_count < invite.max_uses) {
            invite.used_count += 1;
            return true;
        }
        return false;
    }

    it("新创建的邀请码 used_count 为 0", () => {
        const invite: Invite = {
            code: "test1234",
            max_uses: 5,
            used_count: 0,
            created_at: Date.now(),
            expires_at: null,
            bound_session: null,
        };
        expect(invite.used_count).toBe(0);
    });

    it("消耗一次后 used_count 增加 1", () => {
        const invite: Invite = {
            code: "test1234",
            max_uses: 5,
            used_count: 0,
            created_at: Date.now(),
            expires_at: null,
            bound_session: null,
        };
        const success = consumeInvite(invite);
        expect(success).toBe(true);
        expect(invite.used_count).toBe(1);
    });

    it("额度用完后无法继续消耗", () => {
        const invite: Invite = {
            code: "test1234",
            max_uses: 2,
            used_count: 2,
            created_at: Date.now(),
            expires_at: null,
            bound_session: null,
        };
        const success = consumeInvite(invite);
        expect(success).toBe(false);
        expect(invite.used_count).toBe(2); // 不应该增加
    });

    it("未过期且有额度的邀请码可用", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            max_uses: 5,
            used_count: 2,
            created_at: now,
            expires_at: now + 7 * 24 * 60 * 60 * 1000, // 7 天后过期
            bound_session: null,
        };
        expect(canUseInvite(invite, now)).toBe(true);
    });

    it("已过期的邀请码不可用", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            max_uses: 5,
            used_count: 2,
            created_at: now - 10 * 24 * 60 * 60 * 1000,
            expires_at: now - 1000, // 已过期
            bound_session: null,
        };
        expect(canUseInvite(invite, now)).toBe(false);
    });

    it("额度用完的邀请码不可用", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            max_uses: 3,
            used_count: 3,
            created_at: now,
            expires_at: null,
            bound_session: null,
        };
        expect(canUseInvite(invite, now)).toBe(false);
    });

    it("永不过期的邀请码只要有额度就可用", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            max_uses: 10,
            used_count: 5,
            created_at: now - 365 * 24 * 60 * 60 * 1000, // 一年前创建
            expires_at: null, // 永不过期
            bound_session: null,
        };
        expect(canUseInvite(invite, now)).toBe(true);
    });
});

// ─── Session 绑定逻辑 ──────────────────────────────────────────────────────

describe("邀请码 Session 绑定", () => {
    type Invite = {
        code: string;
        bound_session: string | null;
    };

    function canBindSession(invite: Invite, sessionId: string): boolean {
        // 未绑定或绑定的是同一个 session
        return invite.bound_session === null || invite.bound_session === sessionId;
    }

    function bindSession(invite: Invite, sessionId: string): boolean {
        if (invite.bound_session === null) {
            invite.bound_session = sessionId;
            return true;
        }
        return false;
    }

    it("未绑定的邀请码可以绑定任意 session", () => {
        const invite: Invite = {
            code: "test1234",
            bound_session: null,
        };
        expect(canBindSession(invite, "session-abc")).toBe(true);
        expect(canBindSession(invite, "session-xyz")).toBe(true);
    });

    it("首次绑定后 bound_session 被设置", () => {
        const invite: Invite = {
            code: "test1234",
            bound_session: null,
        };
        const success = bindSession(invite, "session-abc");
        expect(success).toBe(true);
        expect(invite.bound_session).toBe("session-abc");
    });

    it("已绑定的邀请码只允许同一个 session", () => {
        const invite: Invite = {
            code: "test1234",
            bound_session: "session-abc",
        };
        expect(canBindSession(invite, "session-abc")).toBe(true);
        expect(canBindSession(invite, "session-xyz")).toBe(false);
    });

    it("已绑定的邀请码无法重新绑定", () => {
        const invite: Invite = {
            code: "test1234",
            bound_session: "session-abc",
        };
        const success = bindSession(invite, "session-xyz");
        expect(success).toBe(false);
        expect(invite.bound_session).toBe("session-abc"); // 保持原样
    });
});

// ─── 过期清理逻辑 ──────────────────────────────────────────────────────────

describe("邀请码过期清理", () => {
    type Invite = {
        code: string;
        expires_at: number | null;
    };

    function shouldCleanup(invite: Invite, now: number): boolean {
        return invite.expires_at !== null && invite.expires_at < now;
    }

    it("过期的邀请码应该被清理", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            expires_at: now - 1000,
        };
        expect(shouldCleanup(invite, now)).toBe(true);
    });

    it("未过期的邀请码不应该被清理", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            expires_at: now + 1000,
        };
        expect(shouldCleanup(invite, now)).toBe(false);
    });

    it("永不过期的邀请码不应该被清理", () => {
        const now = Date.now();
        const invite: Invite = {
            code: "test1234",
            expires_at: null,
        };
        expect(shouldCleanup(invite, now)).toBe(false);
    });

    it("批量清理只删除过期的邀请码", () => {
        const now = Date.now();
        const invites: Invite[] = [
            { code: "expired1", expires_at: now - 1000 },
            { code: "valid1", expires_at: now + 1000 },
            { code: "expired2", expires_at: now - 5000 },
            { code: "never", expires_at: null },
        ];

        const remaining = invites.filter((inv) => !shouldCleanup(inv, now));

        expect(remaining).toHaveLength(2);
        expect(remaining.map((inv) => inv.code)).toEqual(["valid1", "never"]);
    });
});

// ─── 角色权限逻辑 ──────────────────────────────────────────────────────────

describe("用户角色与权限", () => {
    type SessionData = {
        authed: boolean;
        role?: "admin" | "invite";
        inviteCode?: string;
    };

    function canCreateInvite(session: SessionData): boolean {
        return session.authed && session.role === "admin";
    }

    function needsQuotaCheck(session: SessionData): boolean {
        return session.role === "invite";
    }

    it("管理员可以创建邀请码", () => {
        const session: SessionData = {
            authed: true,
            role: "admin",
        };
        expect(canCreateInvite(session)).toBe(true);
    });

    it("邀请码用户不能创建邀请码", () => {
        const session: SessionData = {
            authed: true,
            role: "invite",
            inviteCode: "test1234",
        };
        expect(canCreateInvite(session)).toBe(false);
    });

    it("未登录用户不能创建邀请码", () => {
        const session: SessionData = {
            authed: false,
        };
        expect(canCreateInvite(session)).toBe(false);
    });

    it("管理员生成地址不需要检查额度", () => {
        const session: SessionData = {
            authed: true,
            role: "admin",
        };
        expect(needsQuotaCheck(session)).toBe(false);
    });

    it("邀请码用户生成地址需要检查额度", () => {
        const session: SessionData = {
            authed: true,
            role: "invite",
            inviteCode: "test1234",
        };
        expect(needsQuotaCheck(session)).toBe(true);
    });
});

// ─── 并发安全模拟 ──────────────────────────────────────────────────────────

describe("并发消耗额度模拟", () => {
    type Invite = {
        code: string;
        max_uses: number;
        used_count: number;
    };

    // 模拟原子操作：只有在 used_count < max_uses 时才递增
    function atomicConsume(invite: Invite): boolean {
        if (invite.used_count < invite.max_uses) {
            invite.used_count += 1;
            return true;
        }
        return false;
    }

    it("顺序消耗不会超发", () => {
        const invite: Invite = {
            code: "test1234",
            max_uses: 3,
            used_count: 0,
        };

        const results = [];
        for (let i = 0; i < 5; i++) {
            results.push(atomicConsume(invite));
        }

        const successCount = results.filter((r) => r).length;
        expect(successCount).toBe(3);
        expect(invite.used_count).toBe(3);
    });

    it("模拟并发场景：5 个请求争抢 3 个额度", () => {
        const invite: Invite = {
            code: "test1234",
            max_uses: 3,
            used_count: 0,
        };

        // 模拟 5 个并发请求（实际在 D1 中由 SQL 原子操作保证）
        const results = [];
        for (let i = 0; i < 5; i++) {
            results.push(atomicConsume(invite));
        }

        const successCount = results.filter((r) => r).length;
        const failCount = results.filter((r) => !r).length;

        expect(successCount).toBe(3);
        expect(failCount).toBe(2);
        expect(invite.used_count).toBe(3);
    });
});
