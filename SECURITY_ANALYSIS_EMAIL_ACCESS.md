# 邮箱地址伪造与非法收取邮件 - 安全分析报告

## 🔴 核心安全问题：**存在严重的邮件非法访问风险**

### 问题 1：邮箱地址可预测性导致的越权访问

#### 攻击场景分析（修正）
1. **邮箱地址生成算法可预测**
   - 位置：`app/utils/mail.ts`
   - 生成逻辑：`${randomName()}-${nanoSuffix()}@itshuai.cc`
   - `randomName()` 来自 `@scaleway/random-name`（有限词库组合）
   - `nanoSuffix()` 仅 6 位小写字母+数字（36^6 ≈ 21 亿种组合）

2. **攻击者猜测地址的实际影响（重要修正）**
   ```
   步骤 1: 攻击者尝试猜测其他用户的邮箱地址
   步骤 2: 即使猜中地址，攻击者也无法直接查看邮件
   步骤 3: 原因：邮件访问需要该地址在攻击者的 Session.addressMap 中
   步骤 4: addressMap 只能通过 action({ intent: "generate" }) 添加
   步骤 5: generate 会调用 generateEmailAddress() 生成新地址
   步骤 6: 攻击者无法手动指定要生成的地址
   
   结论：❌ 猜中地址 ≠ 能访问邮件（Session 隔离有效）
   ```

#### 当前防护机制分析

**✅ 已有的防护（有效）：**
1. **Session 校验** - `app/routes/api.email.ts` L86-88
   ```typescript
   const addressMap: Record<string, number> = session.get("addressMap") ?? {};
   if (!(mail.to_address in addressMap)) {
       throw new Response("Unauthorized", { status: 403 });
   }
   ```
   - 只能访问自己 Session 中的邮箱地址
   - 这是**主要的安全屏障**

2. **邮件列表查询** - `app/routes/home.tsx` L580-583
   ```typescript
   "SELECT * FROM emails WHERE to_address = ? ORDER BY time DESC LIMIT 100"
   ```
   - 必须提供 `to_address` 参数
   - 不能遍历所有邮件

**❌ 存在的漏洞：**

### ✅ 已修正：邮箱地址枚举攻击（实际不可行）

**原错误分析：**
- 误认为攻击者猜中地址后可以直接访问邮件

**实际情况：**
```typescript
// app/routes/home.tsx - action
case "generate": {
    const newAddr = generateEmailAddress(); // ← 系统生成，用户无法指定
    addressMap = { ...addressMap, [newAddr]: now };
    break;
}

// app/routes/api.email.ts - loader
const addressMap: Record<string, number> = session.get("addressMap") ?? {};
if (!(mail.to_address in addressMap)) {
    throw new Response("Unauthorized", { status: 403); // ← 严格校验
}
```

**攻击不可行的原因：**
1. ❌ 用户无法手动指定要生成的邮箱地址
2. ❌ addressMap 只能通过系统的 generateEmailAddress() 添加
3. ❌ 攻击者无法将"猜中的地址"添加到自己的 Session
4. ✅ Session Cookie 有签名，无法伪造
5. ✅ 即使知道他人的邮箱地址，也无法访问其邮件

**风险等级：低（理论上不可行）**
- 前提：需要伪造 Session Cookie（几乎不可能，除非 SESSION_SECRET 泄露）
- 影响：Session 隔离机制有效防护

### 漏洞 2：邮件 ID 可枚举

**问题：**
- 邮件 ID 使用 `nanoid()` 生成（默认 21 字符）
- 位置：`workers/app.ts` L32
- 虽然 nanoid 有足够的熵，但如果攻击者知道某个邮件 ID，可以尝试访问

**攻击场景：**
```typescript
// 攻击者尝试访问邮件
fetch('/api/email/SOME_GUESSED_ID', { credentials: 'include' })

// 当前防护：
// 1. 先查询邮件的 to_address
// 2. 检查 to_address 是否在 session.addressMap 中
// 3. 如果不在，返回 403
```

**当前防护有效性：✅ 有效**
- 即使猜中邮件 ID，也必须拥有对应邮箱地址的权限

### 漏洞 3：邮箱地址泄露风险

**问题：**
邮箱地址可能通过以下途径泄露：
1. **URL 参数泄露** - `?addr=xxx@itshuai.cc`
   - 位置：`app/routes/home.tsx` L598
   - 地址出现在 URL 中，可能被浏览器历史、代理、日志记录
   
2. **Referer 头泄露**
   - 用户从首页跳转到其他网站时，Referer 可能包含邮箱地址
   
3. **邮件发送方可见**
   - 任何向该地址发送邮件的人都知道这个地址
   - 如果发送方是攻击者，他们知道地址但无法访问邮件（受 Session 保护）

### 漏洞 4：邮箱地址碰撞（真实风险）

**问题：**
- Worker 接收邮件时，**不验证该地址是否已被某个用户"注册"**
- 位置：`workers/app.ts` L27-40
- 多个用户可能生成相同的邮箱地址（虽然概率极低）

**真实攻击场景：**
```
时间线：
T1: 用户 A 生成邮箱 test-abc123@itshuai.cc
T2: 用户 B 恰好也生成了 test-abc123@itshuai.cc（碰撞）
T3: 发往该地址的邮件会被存储到 D1
T4: 用户 A 和用户 B 都能看到这些邮件（因为都在各自的 addressMap 中）
T5: 隐私泄露：两个用户共享同一个收件箱
```

**碰撞概率分析：**
- `randomName()` 词库大小：约 1000-2000 个词汇组合
- `nanoSuffix()` 空间：36^6 = 2,176,782,336
- 总空间：约 2-4 万亿
- **生日悖论**：当有 √(2-4万亿) ≈ 150-200 万个地址时，碰撞概率约 50%
- **实际风险**：如果系统有数十万活跃地址，碰撞概率仍然很低但非零

**注意**：攻击者无法"主动"制造碰撞，只能依赖随机碰撞

### 漏洞 5：邮件接收无认证

**严重问题：**
```typescript
// workers/app.ts - email handler
async email(msg, env) {
    // ❌ 没有任何验证！
    // 任何发往 @itshuai.cc 的邮件都会被存储
    const id = nanoid();
    await env.D1.prepare(
        "INSERT INTO emails (id, to_address, from_name, from_address, subject, time) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, msg.to, ...).run();
    await env.R2.put(id, ab);
}
```

**攻击场景：**
1. **邮箱地址碰撞攻击**
   - 攻击者向 `test-abc123@itshuai.cc` 发送邮件
   - 如果这个地址恰好是某个用户生成的，邮件会被存储
   - 但攻击者无法读取（受 Session 保护）
   
2. **资源耗尽攻击**
   - 攻击者向大量随机地址发送邮件
   - 所有邮件都会被存储到 D1 和 R2
   - 消耗存储资源和费用

3. **垃圾邮件污染**
   - 攻击者向用户的邮箱发送大量垃圾邮件
   - 用户收件箱被污染

## 🔍 深度分析：Session 安全性

### Session 保护机制
```typescript
// app/.server/session.ts
sessionStorage = createWorkersKVSessionStorage<SessionData>({
    cookie: createCookie("__session", {
        httpOnly: true,      // ✅ 防止 XSS 读取
        sameSite: "lax",     // ✅ 部分 CSRF 保护
        secure: true,        // ✅ 仅 HTTPS
        maxAge: SESSION_MAX_AGE,
        secrets: [secret],   // ✅ Cookie 签名
    }),
    kv: env.KV,
});
```

**安全性评估：**
- ✅ Cookie 有签名，攻击者无法伪造
- ✅ httpOnly 防止 XSS 窃取
- ❌ 但如果攻击者能获取合法 Cookie（如 XSS、中间人攻击），就能访问该 Session 的所有邮箱

### 关键问题：addressMap 的信任边界

```typescript
// 用户生成邮箱时
const newAddr = generateEmailAddress();
addressMap = { ...addressMap, [newAddr]: now };
session.set("addressMap", addressMap);
```

**问题：**
- addressMap 完全由客户端操作控制
- 虽然 Session 有签名保护，但**没有验证地址的真实所有权**
- 如果攻击者能修改 Session（理论上不可能，但如果 SESSION_SECRET 泄露就可以）

## 🎯 实际攻击可行性评估（修正版）

### ❌ 攻击 1：暴力枚举邮箱地址后越权访问
**可行性：几乎不可能**
- 即使猜中他人的邮箱地址，也无法访问其邮件
- 原因：addressMap 只能通过系统生成，无法手动添加
- Session Cookie 有签名保护，无法伪造
- **结论：Session 隔离机制有效**

### ⚠️ 攻击 2：邮箱地址随机碰撞
**可行性：极低（但非零）**
- 两个用户随机生成相同地址的概率：1 / (2-4万亿)
- 生日悖论：150-200 万地址时碰撞概率约 50%
- **影响**：如果发生碰撞，两个用户会共享收件箱
- **注意**：这是被动风险，攻击者无法主动制造

### ⚠️ 攻击 3：URL 参数泄露
**可行性：中（但影响有限）**
- 邮箱地址出现在 URL `?addr=xxx@itshuai.cc`
- 可能被代理、日志、浏览器历史记录
- **但**：知道地址 ≠ 能访问邮件（需要对应的 Session）
- **实际影响**：隐私泄露（地址本身），但无法读取邮件内容

### 🔴 攻击 4：资源耗尽（真实高危）
**可行性：高**
- 攻击者可以向任意 @itshuai.cc 地址发送邮件
- 所有邮件都会被存储到 D1 和 R2
- 没有速率限制或地址验证
- **影响**：消耗存储资源和费用，可能导致服务不可用

## 🛡️ 修复建议（按优先级）

### P0 - 立即修复

#### 1. 添加邮箱地址白名单验证
```typescript
// workers/app.ts - email handler
async email(msg, env) {
    // 验证地址是否在活跃用户的 addressMap 中
    const isValidAddress = await verifyAddressExists(env.KV, msg.to);
    if (!isValidAddress) {
        // 拒绝接收或标记为垃圾邮件
        return;
    }
    // ... 继续处理
}
```

**实现方案：**
- 在 KV 中维护一个 `active_addresses` 集合
- 用户生成邮箱时添加到集合
- 地址过期时从集合移除
- Worker 接收邮件前检查地址是否在集合中

#### 2. 增强邮箱地址随机性
```typescript
// app/utils/mail.ts
const nanoSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12); // 6 -> 12

export function generateEmailAddress() {
    // 添加时间戳混淆
    const timestamp = Date.now().toString(36).slice(-4);
    return `${randomName()}-${timestamp}${nanoSuffix()}@itshuai.cc`;
}
```

#### 3. 添加邮件接收速率限制
```typescript
// workers/app.ts
async email(msg, env) {
    // 检查该地址最近接收邮件的频率
    const recentCount = await getRateLimit(env.KV, msg.to);
    if (recentCount > 10) { // 每分钟最多 10 封
        return; // 拒绝接收
    }
    // ...
}
```

### P1 - 短期修复

#### 4. 移除 URL 中的邮箱地址
```typescript
// 使用地址索引而不是完整地址
// 从: ?addr=test-abc123@itshuai.cc
// 改为: ?idx=0
```

#### 5. 添加邮件访问审计日志
```typescript
// app/routes/api.email.ts
export async function loader({ request, params, context }: Route.LoaderArgs) {
    // ... 权限检查后
    
    // 记录访问日志
    await logEmailAccess(context.cloudflare.env.D1, {
        emailId: id,
        sessionId: session.id,
        timestamp: Date.now(),
        ip: request.headers.get('CF-Connecting-IP'),
    });
    
    // ...
}
```

#### 6. 实现邮箱地址"锁定"机制
```typescript
// 用户首次生成地址时，在 D1 中记录所有权
CREATE TABLE address_ownership (
    address TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

// Worker 接收邮件时验证
const owner = await env.D1.prepare(
    "SELECT session_id FROM address_ownership WHERE address = ? AND expires_at > ?"
).bind(msg.to, Date.now()).first();

if (!owner) {
    return; // 地址未注册或已过期
}
```

### P2 - 长期优化

#### 7. 实现邮箱地址"激活"机制
- 用户生成地址后，需要"激活"才能接收邮件
- 防止攻击者预先占用地址

#### 8. 添加邮件发送方验证
- 记录每个邮箱地址的"信任发送方"列表
- 拒绝来自未知发送方的邮件

#### 9. 实现邮件内容扫描
- 检测垃圾邮件、钓鱼邮件
- 自动隔离可疑邮件

## 📊 风险总结

| 风险项 | 严重程度 | 可行性 | 当前防护 | 实际影响 | 建议优先级 |
|--------|---------|--------|---------|---------|-----------|
| 邮箱地址枚举越权 | 低 | 几乎不可能 | ✅ Session 隔离 | 无法访问他人邮件 | P3（已有效防护）|
| 邮箱地址随机碰撞 | 中 | 极低 | ❌ 无 | 两用户共享收件箱 | P2 |
| 资源耗尽攻击 | 高 | 高 | ❌ 无 | 存储费用、服务不可用 | P0 |
| 收件箱垃圾邮件污染 | 中 | 高 | ❌ 无 | 用户体验差 | P1 |
| URL 参数泄露 | 低 | 中 | ✅ Session 校验 | 地址泄露但无法读邮件 | P2 |
| 邮件 ID 枚举 | 低 | 低 | ✅ Session 校验 | 无法访问他人邮件 | P3（已有效防护）|

## 🎯 核心结论（修正版）

**当前系统的安全性评估：**
1. ✅ **Session Cookie 签名**（有效防止伪造）
2. ✅ **addressMap 权限检查**（有效防止越权访问邮件）
3. ✅ **Session 隔离机制**（攻击者无法读取他人邮件）
4. ⚠️ **邮箱地址碰撞风险**（概率极低但非零）
5. 🔴 **缺少邮件接收验证**（资源耗尽高危）
6. 🔴 **缺少速率限制**（可被滥用）

**重要修正：**
- ❌ 之前错误认为：猜中地址 = 能访问邮件
- ✅ 实际情况：即使知道他人地址，也无法访问其邮件
- ✅ Session 隔离机制工作正常，防护有效

**真正的安全问题：**
1. **资源耗尽攻击（P0 - 最严重）**
   - 攻击者可以向任意 @itshuai.cc 地址发送大量邮件
   - 所有邮件都会被存储，消耗 D1/R2 资源
   - 没有任何验证或速率限制
   
2. **收件箱污染（P1）**
   - 攻击者可以向用户的邮箱发送垃圾邮件
   - 用户体验受影响
   
3. **地址碰撞（P2 - 概率极低）**
   - 两个用户可能生成相同地址
   - 会共享收件箱，导致隐私泄露
   - 但这是被动风险，无法主动攻击

**建议立即实施（按优先级）：**
1. **P0**：添加邮件接收速率限制（防止资源耗尽）
2. **P0**：实现邮箱地址白名单验证（只接收已注册地址的邮件）
3. **P1**：增加地址随机性（6位 -> 12位，降低碰撞概率）
4. **P2**：添加地址唯一性检查（防止碰撞）
