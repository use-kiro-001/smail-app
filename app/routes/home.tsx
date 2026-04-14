import { useEffect, useState } from "react";
import {
	data,
	Link,
	redirect,
	useFetcher,
	useRevalidator,
} from "react-router";
import { requireAuth } from "~/.server/auth";
import { commitSession, getSession } from "~/.server/session";
import {
	DEFAULT_LOCALE,
	type Locale,
	resolveLocaleParam,
	stripDefaultLocalePrefix,
	toIntlLocale,
	toLocalePath,
} from "~/i18n/config";
import { getDictionary } from "~/i18n/messages";
import { BASE_URL } from "~/seo.config";
import type { Email, EmailDetail } from "~/types/email";
import { generateEmailAddress } from "~/utils/mail";
import { ADDRESS_RETENTION_MS, MAIL_RETENTION_MS } from "~/utils/mail-retention";
import { mergeRouteMeta } from "~/utils/meta";
import type { Route } from "./+types/home";

function getLocaleFromParams(lang: string | undefined): Locale {
	const { locale } = resolveLocaleParam(lang);
	return locale;
}

function formatRefreshTime(timestamp: number, locale: Locale): string {
	return new Date(timestamp).toLocaleTimeString(toIntlLocale(locale), {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "UTC",
	});
}

const SEO_GUIDES_COPY: Record<
	Locale,
	{ title: string; items: Array<{ label: string; path: string }> }
> = {
	en: {
		title: "Popular temporary email guides",
		items: [
			{ label: "24 Hour Temporary Email", path: "/temporary-email-24-hours" },
			{
				label: "Temporary Email No Registration",
				path: "/temporary-email-no-registration",
			},
			{
				label: "Disposable Email for Verification",
				path: "/disposable-email-for-verification",
			},
			{
				label: "Temporary Email for Registration",
				path: "/temporary-email-for-registration",
			},
			{ label: "Online Temporary Email", path: "/online-temporary-email" },
		],
	},
	zh: {
		title: "热门临时邮箱指南",
		items: [
			{ label: "24 小时临时邮箱", path: "/temporary-email-24-hours" },
			{ label: "免注册临时邮箱", path: "/temporary-email-no-registration" },
			{ label: "验证码一次性邮箱", path: "/disposable-email-for-verification" },
			{ label: "临时邮箱注册指南", path: "/temporary-email-for-registration" },
			{ label: "在线临时邮箱", path: "/online-temporary-email" },
		],
	},
	es: {
		title: "Guías populares de correo temporal",
		items: [
			{ label: "Correo temporal 24 horas", path: "/temporary-email-24-hours" },
			{
				label: "Correo temporal sin registro",
				path: "/temporary-email-no-registration",
			},
			{
				label: "Correo desechable para verificación",
				path: "/disposable-email-for-verification",
			},
			{
				label: "Correo temporal para registro",
				path: "/temporary-email-for-registration",
			},
			{ label: "Correo temporal online", path: "/online-temporary-email" },
		],
	},
	fr: {
		title: "Guides populaires d'email temporaire",
		items: [
			{
				label: "Email temporaire 24 heures",
				path: "/temporary-email-24-hours",
			},
			{
				label: "Email temporaire sans inscription",
				path: "/temporary-email-no-registration",
			},
			{
				label: "Email jetable pour vérification",
				path: "/disposable-email-for-verification",
			},
			{
				label: "Email temporaire pour inscription",
				path: "/temporary-email-for-registration",
			},
			{ label: "Email temporaire en ligne", path: "/online-temporary-email" },
		],
	},
	de: {
		title: "Beliebte Temp-Mail-Anleitungen",
		items: [
			{
				label: "24-Stunden-Temporäre E-Mail",
				path: "/temporary-email-24-hours",
			},
			{
				label: "Temporäre E-Mail ohne Registrierung",
				path: "/temporary-email-no-registration",
			},
			{
				label: "Wegwerf-E-Mail für Verifizierung",
				path: "/disposable-email-for-verification",
			},
			{
				label: "Temporäre E-Mail für Registrierung",
				path: "/temporary-email-for-registration",
			},
			{ label: "Online-Temporäre E-Mail", path: "/online-temporary-email" },
		],
	},
	ja: {
		title: "人気の一時メールガイド",
		items: [
			{ label: "24時間一時メール", path: "/temporary-email-24-hours" },
			{
				label: "登録不要の一時メール",
				path: "/temporary-email-no-registration",
			},
			{
				label: "認証用使い捨てメール",
				path: "/disposable-email-for-verification",
			},
			{
				label: "登録向け一時メール",
				path: "/temporary-email-for-registration",
			},
			{ label: "オンライン一時メール", path: "/online-temporary-email" },
		],
	},
	ko: {
		title: "인기 임시 이메일 가이드",
		items: [
			{ label: "24시간 임시 이메일", path: "/temporary-email-24-hours" },
			{
				label: "가입 없는 임시 이메일",
				path: "/temporary-email-no-registration",
			},
			{
				label: "인증용 일회용 이메일",
				path: "/disposable-email-for-verification",
			},
			{
				label: "가입용 임시 이메일",
				path: "/temporary-email-for-registration",
			},
			{ label: "온라인 임시 이메일", path: "/online-temporary-email" },
		],
	},
	ru: {
		title: "Популярные гайды по временной почте",
		items: [
			{
				label: "Временная почта на 24 часа",
				path: "/temporary-email-24-hours",
			},
			{
				label: "Временная почта без регистрации",
				path: "/temporary-email-no-registration",
			},
			{
				label: "Одноразовая почта для верификации",
				path: "/disposable-email-for-verification",
			},
			{
				label: "Временная почта для регистрации",
				path: "/temporary-email-for-registration",
			},
			{ label: "Онлайн временная почта", path: "/online-temporary-email" },
		],
	},
	pt: {
		title: "Guias populares de email temporário",
		items: [
			{ label: "Email temporário 24 horas", path: "/temporary-email-24-hours" },
			{
				label: "Email temporário sem cadastro",
				path: "/temporary-email-no-registration",
			},
			{
				label: "Email descartável para verificação",
				path: "/disposable-email-for-verification",
			},
			{
				label: "Email temporário para cadastro",
				path: "/temporary-email-for-registration",
			},
			{ label: "Email temporário online", path: "/online-temporary-email" },
		],
	},
	ar: {
		title: "أدلة البريد المؤقت الشائعة",
		items: [
			{ label: "بريد مؤقت لمدة 24 ساعة", path: "/temporary-email-24-hours" },
			{
				label: "بريد مؤقت بدون تسجيل",
				path: "/temporary-email-no-registration",
			},
			{
				label: "بريد مؤقت لرموز التحقق",
				path: "/disposable-email-for-verification",
			},
			{ label: "بريد مؤقت للتسجيل", path: "/temporary-email-for-registration" },
			{ label: "بريد مؤقت أونلاين", path: "/online-temporary-email" },
		],
	},
};

function getSeoGuides(locale: Locale): {
	title: string;
	items: Array<{ label: string; path: string }>;
} {
	return SEO_GUIDES_COPY[locale] ?? SEO_GUIDES_COPY.en;
}

type SeoNarrative = {
	title: string;
	description: string;
	points: string[];
};

const SEO_NARRATIVE_COPY: Record<Locale, SeoNarrative> = {
	en: {
		title: "Why use smail.pw temporary email",
		description:
			"smail.pw is a free temporary email generator (temp mail) for low-risk sign-ups, OTP verification, and one-time downloads. Create a 24-hour disposable inbox in seconds.",
		points: [
			"Works well for temporary email registration and verification code workflows",
			"No sign-up or password setup for quick temp mail access",
			"Useful when users search smail temp mail or no-registration disposable inbox",
			"Use a permanent mailbox for banking, work, and identity-critical accounts",
		],
	},
	zh: {
		title: "为什么选择 smail.pw 临时邮箱",
		description:
			"smail.pw 是免费临时邮箱生成器，覆盖临时邮箱、一次性邮箱、24小时邮箱等常见场景。适合临时邮箱注册、验证码（OTP）接收和在线临时收信。",
		points: [
			"适合临时邮箱注册、活动领取、下载验证等低风险场景",
			"免注册、免密码，作为免费临时邮箱快速使用，减少真实邮箱暴露",
			"部分站点会限制临时邮箱域名，收不到信可尝试重发与刷新",
			"银行、工作和重要账号请务必使用长期邮箱",
		],
	},
	es: {
		title: "Por qué usar el correo temporal de smail.pw",
		description:
			"smail.pw ofrece correo temporal gratis (temp mail) para registros rápidos, verificación OTP y descargas puntuales con retención de 24 horas.",
		points: [
			"Útil para flujos de registro y verificación de bajo riesgo",
			"Sin cuenta ni contraseña para empezar de inmediato",
			"Si no llega el correo, prueba reenviar y actualizar la bandeja",
		],
	},
	fr: {
		title: "Pourquoi utiliser l'email temporaire smail.pw",
		description:
			"smail.pw fournit un email temporaire gratuit (temp mail) pour inscription rapide, OTP et usages ponctuels avec rétention de 24h.",
		points: [
			"Adapté aux inscriptions et vérifications à faible risque",
			"Aucun compte ni mot de passe requis pour commencer",
			"En cas de non-réception, renvoyez le code puis rafraîchissez la boîte",
		],
	},
	de: {
		title: "Warum temporäre E-Mail von smail.pw",
		description:
			"smail.pw bietet kostenlose Temp Mail für schnelle Registrierungen, OTP-Verifizierung und einmalige Nutzung mit 24h Aufbewahrung.",
		points: [
			"Ideal für risikoarme Registrierung und Verifizierung",
			"Kein Konto und kein Passwort für den Sofortstart",
			"Bei fehlender Zustellung: erneut senden und Posteingang aktualisieren",
		],
	},
	ja: {
		title: "smail.pw の一時メールを使う理由",
		description:
			"smail.pw は無料の一時メール（temp mail）です。登録・OTP認証・短期利用向けに24時間の受信箱をすぐ作成できます。",
		points: [
			"低リスクの登録と認証フローに最適",
			"アカウント登録やパスワード設定が不要",
			"届かない場合は再送と受信箱更新を試してください",
		],
	},
	ko: {
		title: "smail.pw 임시 이메일을 쓰는 이유",
		description:
			"smail.pw는 무료 임시 이메일(temp mail) 서비스로, 가입/OTP 인증/일회성 사용에 맞춘 24시간 메일함을 즉시 제공합니다.",
		points: [
			"저위험 가입 및 인증 흐름에 적합",
			"계정 생성과 비밀번호 없이 바로 사용",
			"메일이 안 오면 재전송 후 받은편지함을 새로고침",
		],
	},
	ru: {
		title: "Почему стоит использовать временную почту smail.pw",
		description:
			"smail.pw — бесплатный temp mail для быстрых регистраций, OTP-подтверждений и одноразовых задач с хранением до 24 часов.",
		points: [
			"Подходит для низкорисковых регистраций и подтверждений",
			"Без аккаунта и пароля — можно начать сразу",
			"Если письмо не пришло, попробуйте повторную отправку и обновление",
		],
	},
	pt: {
		title: "Por que usar o email temporário do smail.pw",
		description:
			"smail.pw oferece temp mail grátis para cadastro rápido, OTP e uso pontual, com caixa descartável por 24 horas.",
		points: [
			"Bom para cadastro e verificação de baixo risco",
			"Sem conta e sem senha para começar imediatamente",
			"Se o email atrasar, reenvie e atualize a caixa de entrada",
		],
	},
	ar: {
		title: "لماذا تستخدم البريد المؤقت من smail.pw",
		description:
			"يوفر smail.pw بريدًا مؤقتًا مجانيًا (temp mail) للتسجيل السريع ورموز OTP والاستخدام القصير مع احتفاظ لمدة 24 ساعة.",
		points: [
			"مناسب لعمليات التسجيل والتحقق منخفضة المخاطر",
			"بدون حساب أو كلمة مرور لبدء الاستخدام فورًا",
			"عند تأخر الرسالة جرّب إعادة الإرسال ثم تحديث الوارد",
		],
	},
};

function getSeoNarrative(locale: Locale): SeoNarrative {
	return SEO_NARRATIVE_COPY[locale] ?? SEO_NARRATIVE_COPY.en;
}

function getHomeJsonLd(locale: Locale) {
	const localizedHomeUrl = `${BASE_URL}${toLocalePath("/", locale)}`;
	const descriptionByLocale: Record<Locale, string> = {
		en: "smail.pw provides free temporary email (temp mail) inboxes for sign-up and OTP verification with 24-hour auto cleanup.",
		zh: "smail.pw 提供免费临时邮箱（一次性邮箱）服务，适合临时邮箱注册和验证码接收，邮件 24 小时后自动清理。",
		es: "smail.pw ofrece correo temporal gratis (temp mail) para registros y códigos OTP con limpieza automática en 24 horas.",
		fr: "smail.pw propose un email temporaire gratuit (temp mail) pour inscription et OTP avec suppression automatique après 24h.",
		de: "smail.pw bietet kostenlose temporäre E-Mail (Temp Mail) für Registrierung und OTP mit automatischer 24h-Bereinigung.",
		ja: "smail.pw は登録とOTP認証に使える無料の一時メール（temp mail）を提供し、24時間後に自動削除されます。",
		ko: "smail.pw는 가입과 OTP 인증에 쓰는 무료 임시 이메일(temp mail)을 제공하며 24시간 후 자동 정리됩니다.",
		ru: "smail.pw предоставляет бесплатную временную почту (temp mail) для регистрации и OTP с автоочисткой через 24 часа.",
		pt: "smail.pw oferece email temporário grátis (temp mail) para cadastro e OTP com limpeza automática após 24h.",
		ar: "يوفر smail.pw بريدًا مؤقتًا مجانيًا (temp mail) للتسجيل ورموز OTP مع حذف تلقائي بعد 24 ساعة.",
	};
	const description = descriptionByLocale[locale] ?? descriptionByLocale.en;

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				name: "smail.pw",
				url: localizedHomeUrl,
				inLanguage: locale,
				description,
				potentialAction: {
					"@type": "UseAction",
					target: localizedHomeUrl,
				},
			},
			{
				"@type": "WebApplication",
				name: "smail.pw Temporary Email",
				url: localizedHomeUrl,
				applicationCategory: "UtilitiesApplication",
				operatingSystem: "Web",
				inLanguage: locale,
				description,
				offers: {
					"@type": "Offer",
					price: "0",
					priceCurrency: "USD",
				},
			},
		],
	};
}

export function meta({ params, matches }: Route.MetaArgs) {
	const locale = getLocaleFromParams(params.lang);
	const copy = getDictionary(locale).home;

	return mergeRouteMeta(matches, [
		{
			title: copy.title,
		},
		{
			name: "description",
			content: copy.description,
		},
		{
			name: "keywords",
			content: copy.keywords,
		},
		{
			name: "robots",
			content: "index, follow",
		},
	]);
}


function EmailModal({
	email,
	onClose,
	copy,
}: {
	email: Email;
	onClose: () => void;
	copy: ReturnType<typeof getDictionary>["home"]["modal"];
}) {
	const [detail, setDetail] = useState<EmailDetail | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetch(`/api/email/${email.id}`, {
			credentials: "include",
		})
			.then((res) => res.json() as Promise<EmailDetail>)
			.then((emailDetail) => {
				setDetail(emailDetail);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [email.id]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<div
			className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="email-preview-title"
				className="glass-panel modal-sheet flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="border-theme-soft flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
					<div className="space-y-1">
						<div className="text-theme-faint text-[11px] font-semibold uppercase tracking-[0.16em]">
							{copy.title}
						</div>
						<div
							id="email-preview-title"
							className="text-theme-primary font-display max-w-xl truncate pr-2 text-base font-semibold sm:text-[1.05rem]"
						>
							{email.subject}
						</div>
					</div>
					<button
						type="button"
						aria-label="Close email preview"
						onClick={onClose}
						className="border-theme-strong text-theme-secondary bg-theme-soft inline-flex h-8 w-8 items-center justify-center rounded-full border hover:brightness-95"
					>
						<svg
							viewBox="0 0 20 20"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							className="h-4 w-4"
							aria-hidden="true"
						>
							<path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
						</svg>
					</button>
				</div>

				<div className="border-theme-soft text-theme-secondary grid gap-2.5 border-b px-4 py-3 text-[12px] leading-relaxed sm:grid-cols-2 sm:px-5">
					<div className="border-theme-soft bg-theme-subtle min-w-0 rounded-lg border px-3 py-2.5">
						<span className="text-theme-faint block text-[11px] font-semibold uppercase tracking-[0.1em]">
							{copy.from}
						</span>
						<p className="mt-1 break-all">
							{email.from_name} &lt;{email.from_address}&gt;
						</p>
					</div>
					<div className="border-theme-soft bg-theme-subtle rounded-lg border px-3 py-2.5">
						<span className="text-theme-faint block text-[11px] font-semibold uppercase tracking-[0.1em]">
							{copy.time}
						</span>
						<p className="mt-1">{new Date(email.time).toLocaleString()}</p>
					</div>
				</div>

				<div className="p-4 sm:p-5">
					{loading ? (
						<div className="text-theme-muted flex h-[min(62vh,700px)] items-center justify-center rounded-xl border border-dashed border-theme-soft text-[13px]">
							{copy.loading}
						</div>
					) : detail?.body ? (
						<iframe
							srcDoc={detail.body}
							title="Email content"
							className="border-theme-soft h-[min(62vh,700px)] w-full overflow-hidden rounded-xl border bg-white"
							sandbox=""
							referrerPolicy="no-referrer"
						/>
					) : (
						<div className="text-theme-muted flex h-[min(62vh,700px)] items-center justify-center rounded-xl border border-dashed border-theme-soft text-[13px]">
							{copy.empty}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function formatTime(
	timestamp: number,
	locale: Locale,
	referenceNow: number,
): string {
	const intlLocale = toIntlLocale(locale);
	const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
	const diffSeconds = Math.round((timestamp - referenceNow) / 1000);

	if (Math.abs(diffSeconds) < 60) {
		return relative.format(diffSeconds, "second");
	}

	const diffMinutes = Math.round(diffSeconds / 60);
	if (Math.abs(diffMinutes) < 60) {
		return relative.format(diffMinutes, "minute");
	}

	const diffHours = Math.round(diffMinutes / 60);
	if (Math.abs(diffHours) < 24) {
		return relative.format(diffHours, "hour");
	}

	const diffDays = Math.round(diffHours / 24);
	if (Math.abs(diffDays) < 7) {
		return relative.format(diffDays, "day");
	}

	return new Date(timestamp).toLocaleDateString(intlLocale, {
		timeZone: "UTC",
	});
}

async function getEmails(d1: D1Database, toAddress: string) {
	const { results } = await d1
		.prepare(
			"SELECT * FROM emails WHERE to_address = ? ORDER BY time DESC LIMIT 100",
		)
		.bind(toAddress)
		.all();
	return results as Email[];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireAuth(request);
	const { locale, shouldRedirectToDefault, isInvalid } = resolveLocaleParam(
		params.lang,
	);
	if (isInvalid) {
		throw new Response("Not Found", { status: 404 });
	}
	if (shouldRedirectToDefault) {
		const url = new URL(request.url);
		const normalizedPath = stripDefaultLocalePrefix(url.pathname);
		throw redirect(`${normalizedPath}${url.search}`, 301);
	}

	const url = new URL(request.url);
	const selectedAddress = url.searchParams.get("addr") ?? null;

	const cookieHeader = request.headers.get("Cookie");
	const session = await getSession(cookieHeader);
	const now = Date.now();

	// 迁移旧 session 格式 -> addressMap
	let addressMap: Record<string, number> = session.get("addressMap") ?? {};
	const legacyAddresses = session.get("addresses");
	const legacyIssuedAt = session.get("addressIssuedAt");
	let shouldCommitSession = false;

	if (legacyAddresses && legacyAddresses.length > 0 && Object.keys(addressMap).length === 0) {
		for (const addr of legacyAddresses) {
			addressMap[addr] = legacyIssuedAt ?? now;
		}
		session.set("addressMap", addressMap);
		session.unset("addresses" as never);
		session.unset("addressIssuedAt" as never);
		shouldCommitSession = true;
	}

	// 清理已过期的地址
	const validAddressMap: Record<string, number> = {};
	for (const [addr, issuedAt] of Object.entries(addressMap)) {
		if (now - issuedAt < ADDRESS_RETENTION_MS) {
			validAddressMap[addr] = issuedAt;
		}
	}
	if (Object.keys(validAddressMap).length !== Object.keys(addressMap).length) {
		addressMap = validAddressMap;
		session.set("addressMap", addressMap);
		shouldCommitSession = true;
	}

	const addresses = Object.keys(addressMap);
	const activeAddress = addresses.includes(selectedAddress ?? "")
		? selectedAddress!
		: (addresses[0] ?? null);

	const emails =
		activeAddress
			? await getEmails(context.cloudflare.env.D1, activeAddress)
			: [];

	// 查询所有地址的备注
	const notes: Record<string, string> = {};
	if (addresses.length > 0) {
		const placeholders = addresses.map(() => "?").join(", ");
		const { results } = await context.cloudflare.env.D1
			.prepare(`SELECT address, note FROM address_notes WHERE address IN (${placeholders})`)
			.bind(...addresses)
			.all<{ address: string; note: string }>();
		for (const row of results) {
			notes[row.address] = row.note;
		}
	}

	// 获取用户角色和邀请码剩余额度
	const role = session.get("role") ?? "admin"; // 兼容旧 session
	const inviteCode = session.get("inviteCode");
	let inviteQuota: { remaining: number; max: number } | null = null;

	if (role === "invite" && inviteCode) {
		const invite = await context.cloudflare.env.D1
			.prepare("SELECT max_uses, used_count FROM invites WHERE code = ?")
			.bind(inviteCode)
			.first<{ max_uses: number; used_count: number }>();
		if (invite) {
			inviteQuota = {
				remaining: Math.max(0, invite.max_uses - invite.used_count),
				max: invite.max_uses,
			};
		}
	}

	const responseData = {
		addressMap,
		addresses,
		activeAddress,
		emails,
		notes,
		locale,
		renderedAt: now,
		role,
		inviteQuota,
	};

	if (shouldCommitSession) {
		const headers = new Headers();
		headers.set("Set-Cookie", await commitSession(session));
		return data(responseData, { headers });
	}

	return responseData;
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");
	const cookieHeader = request.headers.get("Cookie");
	const session = await getSession(cookieHeader);
	let addressMap: Record<string, number> = session.get("addressMap") ?? {};
	const now = Date.now();

	switch (intent) {
		case "generate": {
			// 如果是邀请码用户，检查并消耗额度
			const role = session.get("role");
			const inviteCode = session.get("inviteCode");

			if (role === "invite" && inviteCode) {
				// 原子操作：检查并递增 used_count
				const result = await context.cloudflare.env.D1
					.prepare(
						"UPDATE invites SET used_count = used_count + 1 WHERE code = ? AND used_count < max_uses AND (expires_at IS NULL OR expires_at > ?)",
					)
					.bind(inviteCode, now)
					.run();

				if (result.meta.changes === 0) {
					// 额度已用完或邀请码已过期
					return data({ addressMap, error: "quotaExhausted" });
				}
			}

			const newAddr = generateEmailAddress();
			addressMap = { ...addressMap, [newAddr]: now };

			// 写入白名单，记录所有者
			await context.cloudflare.env.D1
				.prepare(
					"INSERT INTO active_addresses (address, session_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
				)
				.bind(newAddr, session.id, now, now + ADDRESS_RETENTION_MS)
				.run();

			break;
		}
		case "delete": {
			const addr = formData.get("address") as string;
			if (addr && addr in addressMap) {
				const next = { ...addressMap };
				delete next[addr];
				addressMap = next;

				// 从白名单移除
				await context.cloudflare.env.D1
					.prepare("DELETE FROM active_addresses WHERE address = ?")
					.bind(addr)
					.run();
			}
			break;
		}
	}

	session.set("addressMap", addressMap);
	const cookie = await commitSession(session);
	const headers = new Headers();
	headers.set("Set-Cookie", cookie);
	return data({ addressMap }, { headers });
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
	const fetcher = useFetcher<typeof actionData>();
	const noteFetcher = useFetcher();
	const revalidator = useRevalidator();
	const [copied, setCopied] = useState<string | null>(null);
	const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
	const [addressSearch, setAddressSearch] = useState("");
	const [notes, setNotes] = useState<Record<string, string>>(() => loaderData.notes ?? {});
	const [editingNote, setEditingNote] = useState<string | null>(null);
	const [lastInboxRefreshAt, setLastInboxRefreshAt] = useState(() =>
		loaderData.renderedAt,
	);
	const locale = loaderData.locale || DEFAULT_LOCALE;
	const copy = getDictionary(locale).home;
	const homeJsonLd = getHomeJsonLd(locale);

	const addressMap: Record<string, number> =
		(fetcher.data as { addressMap?: Record<string, number> } | undefined)?.addressMap
		?? loaderData.addressMap;
	const addresses = Object.keys(addressMap);
	const filteredAddresses = addressSearch.trim()
		? addresses.filter((a) => a.toLowerCase().includes(addressSearch.toLowerCase()))
		: addresses;
	const emails = loaderData.emails;
	const activeAddress = loaderData.activeAddress;
	const isSubmitting = fetcher.state === "submitting";
	const submittingIntent = fetcher.formData?.get("intent");
	const isRefreshingInbox = revalidator.state !== "idle";

	// 邀请码用户的额度信息
	const role = loaderData.role;
	const inviteQuota = loaderData.inviteQuota;
	const fetcherError = (fetcher.data as { error?: string } | undefined)?.error;
	const isQuotaExhausted = inviteQuota?.remaining === 0 || fetcherError === "quotaExhausted";

	useEffect(() => {
		setLastInboxRefreshAt(loaderData.renderedAt);
	}, [loaderData.renderedAt]);

	useEffect(() => {
		setNotes(loaderData.notes ?? {});
	}, [loaderData.notes]);

	return (
		<div className="flex flex-1 flex-col py-3 sm:py-4">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
			/>
			<div className="flex flex-1 flex-col gap-4 w-full">

				<section className="glass-panel flex flex-1 flex-col overflow-hidden">
					{/* 左右分栏：移动端竖排，桌面端横排 */}
					<div className="flex min-h-0 flex-1 flex-col sm:flex-row sm:divide-x sm:divide-[var(--line-soft)]">

						{/* 左栏：地址管理 */}
						<div className="flex w-full flex-col sm:w-64 sm:shrink-0 lg:w-72">
							{/* 左栏头部 */}
							<div className="flex items-center justify-between gap-2 border-b border-[var(--line-soft)] px-4 py-3">
								<div>
									<p className="text-theme-faint text-[11px] font-semibold uppercase tracking-[0.16em]">
										{copy.currentAddress}
									</p>
									{inviteQuota && (
										<p className={`text-[10px] mt-0.5 ${isQuotaExhausted ? "text-red-500" : "text-theme-faint"}`}>
											{isQuotaExhausted
												? (locale === "zh" ? "额度已用完" : "Quota exhausted")
												: (locale === "zh" ? `剩余 ${inviteQuota.remaining} 次` : `${inviteQuota.remaining} left`)}
										</p>
									)}
								</div>
								<button
									type="button"
									className="neo-button px-3 py-1.5 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
									onClick={() => fetcher.submit({ intent: "generate" }, { method: "post" })}
									disabled={isSubmitting || isQuotaExhausted}
								>
									{submittingIntent === "generate" && isSubmitting ? copy.generating : "+ New"}
								</button>
							</div>

							{/* 搜索框 */}
							{addresses.length > 0 && (
								<div className="border-b border-[var(--line-soft)] px-3 py-2">
									<input
										type="search"
										value={addressSearch}
										onChange={(e) => setAddressSearch(e.target.value)}
										placeholder="Search addresses..."
										className="w-full rounded-lg border border-[var(--line-soft)] bg-transparent px-3 py-1.5 text-[12px] text-theme-primary placeholder:text-theme-faint outline-none focus:border-[var(--line-strong)] focus:ring-1 focus:ring-[var(--line-strong)]"
									/>
								</div>
							)}

							{/* 地址列表 */}
							<div className="flex-1 overflow-y-auto p-2">
								{addresses.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
										<p className="text-theme-primary text-sm font-semibold">{copy.noAddressTitle}</p>
										<p className="text-theme-muted text-xs leading-relaxed">{copy.noAddressDescription}</p>
										<button
											type="button"
											className="neo-button px-4 py-2 text-xs"
											onClick={() => fetcher.submit({ intent: "generate" }, { method: "post" })}
											disabled={isSubmitting}
										>
											{submittingIntent === "generate" && isSubmitting ? copy.generating : copy.generateAddress}
										</button>
									</div>
								) : (
									<div className="space-y-1">
										{filteredAddresses.length === 0 ? (
											<p className="px-3 py-4 text-center text-[11px] text-theme-faint">
												No results for "{addressSearch}"
											</p>
										) : filteredAddresses.map((addr) => {
											const isActive = addr === activeAddress;
											const issuedAt = addressMap[addr]!;
											const daysLeft = Math.max(
												0,
												Math.ceil((issuedAt + ADDRESS_RETENTION_MS - loaderData.renderedAt) / (1000 * 60 * 60 * 24)),
											);
											return (
												<div key={addr} className={`group relative rounded-xl transition-colors ${isActive ? "bg-theme-soft border border-[var(--line-strong)]" : "border border-transparent hover:bg-theme-subtle"}`}>
													<Link
														to={`?addr=${encodeURIComponent(addr)}`}
														prefetch="intent"
														className="block min-w-0 px-3 py-2.5"
													>
														<p className={`truncate text-[13px] font-semibold ${isActive ? "text-theme-primary" : "text-theme-secondary"}`}>
															{addr}
														</p>
														<p className="text-theme-faint mt-0.5 text-[10px]">
															{daysLeft > 0 ? `${daysLeft}d left` : "Expires today"}
														</p>
													</Link>
													{/* 备注区域 */}
													{editingNote === addr ? (
														<div className="px-3 pb-2.5" onClick={(e) => e.preventDefault()}>
															<input
																autoFocus
																type="text"
																defaultValue={notes[addr] ?? ""}
																placeholder="Add a note..."
																className="w-full rounded-lg border border-[var(--line-soft)] bg-transparent px-2 py-1 text-[11px] text-theme-primary placeholder:text-theme-faint outline-none focus:border-[var(--line-strong)]"
																onBlur={(e) => {
																	const val = e.target.value.trim();
																	setNotes((prev) => ({ ...prev, [addr]: val }));
																	setEditingNote(null);
																	noteFetcher.submit(
																		JSON.stringify({ address: addr, note: val }),
																		{ method: "post", action: "/api/note", encType: "application/json" },
																	);
																}}
																onKeyDown={(e) => {
																	if (e.key === "Enter") e.currentTarget.blur();
																	if (e.key === "Escape") setEditingNote(null);
																}}
															/>
														</div>
													) : (
														<button
															type="button"
															className="w-full px-3 pb-2 text-left"
															onClick={(e) => { e.preventDefault(); setEditingNote(addr); }}
														>
															<p className="truncate text-[10px] text-theme-faint italic">
																{notes[addr] ? notes[addr] : "＋ note"}
															</p>
														</button>
													)}
													{/* 操作按钮：hover 时显示 */}
													<div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
														<button
															type="button"
															title={copy.copy}
															className="neo-button-secondary flex h-6 w-6 items-center justify-center rounded-lg p-0 text-[10px]"
															onClick={async (e) => {
																e.preventDefault();
																if (typeof navigator !== "undefined" && navigator.clipboard) {
																	try {
																		await navigator.clipboard.writeText(addr);
																		setCopied(addr);
																		setTimeout(() => setCopied(null), 1500);
																	} catch { /* ignore */ }
																}
															}}
														>
															{copied === addr ? "✓" : "⎘"}
														</button>
														<button
															type="button"
															title={copy.deleteAddress}
															className="neo-button-secondary flex h-6 w-6 items-center justify-center rounded-lg p-0 text-[10px]"
															onClick={() => fetcher.submit({ intent: "delete", address: addr }, { method: "post" })}
															disabled={isSubmitting}
														>
															✕
														</button>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* 安全提示 */}
							{addresses.length > 0 && (
								<div className="border-t border-[var(--line-soft)] px-4 py-3">
									<p className="text-theme-faint text-[10px] leading-relaxed">{copy.safetyHint}</p>
								</div>
							)}
						</div>

						{/* 右栏：收件箱 */}
						<div className="flex min-w-0 flex-1 flex-col">
							{/* 右栏头部 */}
							<div className="flex items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
								<div className="min-w-0">
									<p className="text-theme-faint text-[11px] font-semibold uppercase tracking-[0.16em]">
										{copy.inboxTag}
									</p>
									{activeAddress && (
										<p className="text-theme-secondary mt-0.5 truncate text-[12px] font-medium">
											{activeAddress}
										</p>
									)}
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<p className="text-theme-faint hidden text-[10px] sm:block">
										{copy.lastRefresh}: {formatRefreshTime(lastInboxRefreshAt, locale)}
									</p>
									<button
										type="button"
										className="theme-badge px-3 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
										onClick={() => revalidator.revalidate()}
										disabled={isRefreshingInbox}
									>
										{isRefreshingInbox ? copy.refreshingInbox : copy.refreshInbox}
									</button>
								</div>
							</div>

							{/* 邮件列表 */}
							<div className="flex min-h-[600px] flex-1 flex-col gap-0 overflow-y-auto">
								{emails.length === 0 ? (
									<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
										<p className="text-theme-primary font-display text-base font-semibold">
											{copy.emptyInboxTitle}
										</p>
										<p className="text-theme-muted text-sm">{copy.emptyInboxDescription}</p>
									</div>
								) : (
									emails.map((email, i) => (
										<button
											key={email.id}
											type="button"
											className={`w-full px-4 py-3 text-left transition-colors hover:bg-theme-subtle ${i !== 0 ? "border-t border-[var(--line-soft)]" : ""}`}
											onClick={() => setSelectedEmail(email)}
										>
											<div className="flex items-start justify-between gap-3">
												<p className="text-theme-primary truncate text-sm font-semibold">
													{email.subject}
												</p>
												<p className="text-theme-faint shrink-0 whitespace-nowrap text-[11px]">
													{formatTime(email.time, locale, loaderData.renderedAt)}
												</p>
											</div>
											<p className="text-theme-muted mt-0.5 truncate text-xs">
												{email.from_name}{" "}
												<span className="text-theme-faint">&lt;{email.from_address}&gt;</span>
											</p>
										</button>
									))
								)}
							</div>
						</div>
					</div>
				</section>
			</div>

			{selectedEmail && (
				<EmailModal
					email={selectedEmail}
					onClose={() => setSelectedEmail(null)}
					copy={copy.modal}
				/>
			)}
		</div>
	);
}



