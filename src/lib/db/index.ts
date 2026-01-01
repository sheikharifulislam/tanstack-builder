import { v4 as uuid } from "uuid";

// Cookie configuration
export const USER_COOKIE_NAME = "tancn_user_id";
export const USER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds
export const REGISTRY_ITEM_TTL_MS = 60 * 60 * 24 * 1000; // 24 hours in milliseconds

// Types
export interface User {
	id: string;
	fingerprint: string | null;
	created_at: number;
}

export interface RegistryItem {
	id: string;
	user_id: string | null;
	name: string;
	type: "form" | "table";
	data: string;
	created_at: number;
	expires_at: number;
}

export interface RegistryItemInput {
	id: string;
	name: string;
	type: "form" | "table";
	data: string;
}

/**
 * Generate a fingerprint hash from IP and User-Agent
 */
export function generateFingerprint(request: Request): string {
	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const userAgent = request.headers.get("user-agent") || "unknown";

	// Simple hash - in production you might want a more robust hash
	const combined = `${ip}:${userAgent}`;
	let hash = 0;
	for (let i = 0; i < combined.length; i++) {
		const char = combined.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Parse user ID from cookie header
 */
export function getUserIdFromCookie(request: Request): string | null {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) return null;

	const cookies = cookieHeader.split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		const [name, value] = cookie.split("=");
		if (name === USER_COOKIE_NAME) {
			return value;
		}
	}
	return null;
}

/**
 * Generate Set-Cookie header value
 */
export function generateUserCookieHeader(userId: string): string {
	return `${USER_COOKIE_NAME}=${userId}; Path=/; Max-Age=${USER_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`;
}

/**
 * Get or create a user based on cookie/fingerprint
 * Returns { user, isNewUser, cookieHeader }
 */
export async function getOrCreateUser(
	db: D1Database,
	request: Request,
): Promise<{
	user: User;
	isNewUser: boolean;
	cookieHeader: string | null;
}> {
	// First, try to get user from cookie
	const cookieUserId = getUserIdFromCookie(request);

	if (cookieUserId) {
		const existingUser = await db
			.prepare("SELECT * FROM users WHERE id = ?")
			.bind(cookieUserId)
			.first<User>();

		if (existingUser) {
			return { user: existingUser, isNewUser: false, cookieHeader: null };
		}
	}

	// Generate fingerprint for fallback identification
	const fingerprint = generateFingerprint(request);

	// Try to find user by fingerprint (fallback if cookie is missing but user exists)
	const userByFingerprint = await db
		.prepare("SELECT * FROM users WHERE fingerprint = ?")
		.bind(fingerprint)
		.first<User>();

	if (userByFingerprint) {
		// User exists by fingerprint, set cookie for future requests
		return {
			user: userByFingerprint,
			isNewUser: false,
			cookieHeader: generateUserCookieHeader(userByFingerprint.id),
		};
	}

	// Create new user
	const newUserId = uuid();
	const now = Date.now();

	await db
		.prepare("INSERT INTO users (id, fingerprint, created_at) VALUES (?, ?, ?)")
		.bind(newUserId, fingerprint, now)
		.run();

	const newUser: User = {
		id: newUserId,
		fingerprint,
		created_at: now,
	};

	return {
		user: newUser,
		isNewUser: true,
		cookieHeader: generateUserCookieHeader(newUserId),
	};
}

/**
 * Create a new registry item
 */
export async function createRegistryItem(
	db: D1Database,
	userId: string | null,
	item: RegistryItemInput,
): Promise<RegistryItem> {
	const now = Date.now();
	const expiresAt = now + REGISTRY_ITEM_TTL_MS;

	await db
		.prepare(
			`INSERT INTO registry_items (id, user_id, name, type, data, created_at, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(item.id, userId, item.name, item.type, item.data, now, expiresAt)
		.run();

	return {
		id: item.id,
		user_id: userId,
		name: item.name,
		type: item.type,
		data: item.data,
		created_at: now,
		expires_at: expiresAt,
	};
}

/**
 * Get a registry item by ID
 * Returns null if not found or expired
 */
export async function getRegistryItem(
	db: D1Database,
	id: string,
): Promise<RegistryItem | null> {
	const now = Date.now();

	const item = await db
		.prepare("SELECT * FROM registry_items WHERE id = ? AND expires_at > ?")
		.bind(id, now)
		.first<RegistryItem>();

	return item || null;
}

/**
 * Get all registry items for a user
 */
export async function getUserRegistryItems(
	db: D1Database,
	userId: string,
): Promise<RegistryItem[]> {
	const now = Date.now();

	const result = await db
		.prepare(
			`SELECT * FROM registry_items
			 WHERE user_id = ? AND expires_at > ?
			 ORDER BY created_at DESC`,
		)
		.bind(userId, now)
		.all<RegistryItem>();

	return result.results || [];
}

/**
 * Delete expired items (for scheduled cleanup)
 */
export async function cleanupExpiredItems(db: D1Database): Promise<number> {
	const now = Date.now();

	const result = await db
		.prepare("DELETE FROM registry_items WHERE expires_at <= ?")
		.bind(now)
		.run();

	return result.meta.changes || 0;
}
