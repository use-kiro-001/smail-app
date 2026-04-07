/**
 * 纯 Node.js 测试脚本，无需任何依赖
 * 运行：node tests/run.mjs
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toContain(item) {
            if (!actual.includes(item)) {
                throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
            }
        },
        not: {
            toContain(item) {
                if (actual.includes(item)) {
                    throw new Error(`Expected array NOT to contain ${JSON.stringify(item)}`);
                }
            },
        },
    };
}

// ─── 从源码复制的逻辑（避免 import 路径问题）────────────────────────────────

const ADDRESS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAIL_RETENTION_MS = 24 * 60 * 60 * 1000;

function isAddressExpired(issuedAt, now = Date.now()) {
    return now - issuedAt >= ADDRESS_RETENTION_MS;
}

function verifyToken(input, token) {
    if (!token) return false;
    return input === token;
}

// ─── verifyToken ─────────────────────────────────────────────────────────────

console.log("\nverifyToken");
test("正确 token 返回 true", () => expect(verifyToken("secret123", "secret123")).toBe(true));
test("错误 token 返回 false", () => expect(verifyToken("wrong", "secret123")).toBe(false));
test("token 未配置（undefined）返回 false", () => expect(verifyToken("anything", undefined)).toBe(false));
test("空字符串 token 返回 false", () => expect(verifyToken("", "secret123")).toBe(false));
test("空字符串与 undefined 不匹配", () => expect(verifyToken("", undefined)).toBe(false));

// ─── isAddressExpired ─────────────────────────────────────────────────────────

console.log("\nisAddressExpired");
const now = Date.now();
test("刚签发的地址未过期", () => expect(isAddressExpired(now, now)).toBe(false));
test("6 天前签发的地址未过期", () => expect(isAddressExpired(now - 6 * 24 * 60 * 60 * 1000, now)).toBe(false));
test("恰好 7 天前签发的地址已过期", () => expect(isAddressExpired(now - ADDRESS_RETENTION_MS, now)).toBe(true));
test("8 天前签发的地址已过期", () => expect(isAddressExpired(now - 8 * 24 * 60 * 60 * 1000, now)).toBe(true));

// ─── 常量值 ───────────────────────────────────────────────────────────────────

console.log("\n常量值");
test("邮件保留时间为 24 小时", () => expect(MAIL_RETENTION_MS).toBe(24 * 60 * 60 * 1000));
test("地址保留时间为 7 天", () => expect(ADDRESS_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000));

// ─── addressMap 多邮箱逻辑 ────────────────────────────────────────────────────

console.log("\naddressMap 多邮箱管理逻辑");

test("生成新地址后 map 中包含该地址", () => {
    const map = {};
    const addr = "test-abc@itshuai.cc";
    map[addr] = now;
    expect(Object.keys(map)).toContain(addr);
});

test("删除指定地址后 map 中不再包含该地址", () => {
    const addr1 = "addr1@itshuai.cc";
    const addr2 = "addr2@itshuai.cc";
    const map = { [addr1]: now, [addr2]: now };
    delete map[addr1];
    expect(Object.keys(map)).not.toContain(addr1);
    expect(Object.keys(map)).toContain(addr2);
});

test("过期地址被清理，有效地址保留", () => {
    const validAddr = "valid@itshuai.cc";
    const expiredAddr = "expired@itshuai.cc";
    const map = {
        [validAddr]: now,
        [expiredAddr]: now - ADDRESS_RETENTION_MS - 1000,
    };
    const cleaned = {};
    for (const [addr, issuedAt] of Object.entries(map)) {
        if (!isAddressExpired(issuedAt, now)) cleaned[addr] = issuedAt;
    }
    expect(Object.keys(cleaned)).toContain(validAddr);
    expect(Object.keys(cleaned)).not.toContain(expiredAddr);
});

test("多个地址可以共存", () => {
    const map = {};
    for (let i = 0; i < 5; i++) map[`addr${i}@itshuai.cc`] = now;
    expect(Object.keys(map).length).toBe(5);
});

test("邮件归属校验：地址在 map 中则有权访问", () => {
    const map = { "owner@itshuai.cc": now };
    expect("owner@itshuai.cc" in map).toBe(true);
    expect("other@itshuai.cc" in map).toBe(false);
});

// ─── 结果 ─────────────────────────────────────────────────────────────────────

console.log(`\n结果：${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
