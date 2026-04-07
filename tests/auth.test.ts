/**
 * 认证与多邮箱功能测试用例
 *
 * 运行方式（需先安装 vitest）：
 *   pnpm add -D vitest
 *   pnpm vitest --run tests/auth.test.ts
 *
 * 注意：这些是纯逻辑单元测试，不依赖 Cloudflare 运行时。
 */

import { describe, expect, it } from "vitest";
import { verifyToken } from "../app/.server/auth";
import {
    ADDRESS_RETENTION_MS,
    MAIL_RETENTION_MS,
    isAddressExpired,
} from "../app/utils/mail-retention";

// ─── verifyToken ────────────────────────────────────────────────────────────

describe("verifyToken", () => {
    it("正确 token 返回 true", () => {
        expect(verifyToken("secret123", "secret123")).toBe(true);
    });

    it("错误 token 返回 false", () => {
        expect(verifyToken("wrong", "secret123")).toBe(false);
    });

    it("token 未配置（undefined）返回 false", () => {
        expect(verifyToken("anything", undefined)).toBe(false);
    });

    it("空字符串 token 返回 false", () => {
        expect(verifyToken("", "secret123")).toBe(false);
    });

    it("空字符串与空字符串不匹配（未配置视为无效）", () => {
        expect(verifyToken("", undefined)).toBe(false);
    });
});

// ─── isAddressExpired ────────────────────────────────────────────────────────

describe("isAddressExpired", () => {
    const now = Date.now();

    it("刚签发的地址未过期", () => {
        expect(isAddressExpired(now, now)).toBe(false);
    });

    it("6 天前签发的地址未过期", () => {
        const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;
        expect(isAddressExpired(sixDaysAgo, now)).toBe(false);
    });

    it("恰好 7 天前签发的地址已过期", () => {
        const sevenDaysAgo = now - ADDRESS_RETENTION_MS;
        expect(isAddressExpired(sevenDaysAgo, now)).toBe(true);
    });

    it("8 天前签发的地址已过期", () => {
        const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
        expect(isAddressExpired(eightDaysAgo, now)).toBe(true);
    });
});

// ─── 邮件保留时间常量 ─────────────────────────────────────────────────────────

describe("mail retention constants", () => {
    it("邮件保留时间为 24 小时", () => {
        expect(MAIL_RETENTION_MS).toBe(24 * 60 * 60 * 1000);
    });

    it("地址保留时间为 7 天", () => {
        expect(ADDRESS_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
});

// ─── addressMap 逻辑模拟 ──────────────────────────────────────────────────────

describe("addressMap 多邮箱管理逻辑", () => {
    const now = Date.now();

    function filterExpired(
        map: Record<string, number>,
        currentTime = now,
    ): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [addr, issuedAt] of Object.entries(map)) {
            if (!isAddressExpired(issuedAt, currentTime)) {
                result[addr] = issuedAt;
            }
        }
        return result;
    }

    it("生成新地址后 map 中包含该地址", () => {
        const map: Record<string, number> = {};
        const newAddr = "test-abc@itshuai.cc";
        map[newAddr] = now;
        expect(Object.keys(map)).toContain(newAddr);
    });

    it("删除指定地址后 map 中不再包含该地址", () => {
        const addr1 = "addr1@itshuai.cc";
        const addr2 = "addr2@itshuai.cc";
        const map: Record<string, number> = { [addr1]: now, [addr2]: now };
        delete map[addr1];
        expect(Object.keys(map)).not.toContain(addr1);
        expect(Object.keys(map)).toContain(addr2);
    });

    it("过期地址被清理，有效地址保留", () => {
        const validAddr = "valid@itshuai.cc";
        const expiredAddr = "expired@itshuai.cc";
        const map: Record<string, number> = {
            [validAddr]: now,
            [expiredAddr]: now - ADDRESS_RETENTION_MS - 1000,
        };
        const cleaned = filterExpired(map, now);
        expect(Object.keys(cleaned)).toContain(validAddr);
        expect(Object.keys(cleaned)).not.toContain(expiredAddr);
    });

    it("多个地址可以共存", () => {
        const map: Record<string, number> = {};
        for (let i = 0; i < 5; i++) {
            map[`addr${i}@itshuai.cc`] = now;
        }
        expect(Object.keys(map).length).toBe(5);
    });

    it("邮件归属校验：地址在 map 中则有权访问", () => {
        const map: Record<string, number> = { "owner@itshuai.cc": now };
        expect("owner@itshuai.cc" in map).toBe(true);
        expect("other@itshuai.cc" in map).toBe(false);
    });
});
