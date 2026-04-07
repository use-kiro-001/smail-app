export const MAIL_RETENTION_HOURS = 24;
export const MAIL_RETENTION_MS = MAIL_RETENTION_HOURS * 60 * 60 * 1000;

// 邮箱地址本身的过期时间：7 天
export const ADDRESS_RETENTION_DAYS = 7;
export const ADDRESS_RETENTION_MS = ADDRESS_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function getRetentionCutoff(now = Date.now()): number {
	return now - MAIL_RETENTION_MS;
}

export function isAddressExpired(issuedAt: number, now = Date.now()): boolean {
	return now - issuedAt >= ADDRESS_RETENTION_MS;
}
