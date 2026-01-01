import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { v4 as uuid } from "uuid";
import {
	createRegistryItem,
	getOrCreateUser,
	getRegistryItem,
} from "@/lib/db";
import { headerRateLimiter } from "@/lib/header-rate-limiter";
import { getRegistryUrl } from "@/utils/utils";

const responseHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Content-Type": "application/json",
};

export const Route = createFileRoute("/r/$id.json")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const id = params["id.json"];
				const registryId = id?.endsWith(".json") ? id?.slice(0, -5) : id;
				try {
					const registryItem = await getRegistryItem(env.DB, registryId);
					if (!registryItem) {
						return new Response("Registry item not found", {
							status: 404,
							headers: responseHeaders,
						});
					}
					return new Response(registryItem.data, {
						status: 200,
						headers: responseHeaders,
					});
				} catch (error) {
					console.error(error);
					return new Response("Something went wrong", {
						status: 500,
						headers: responseHeaders,
					});
				}
			},
			POST: async ({ request }) => {
				const { allowed, info } = headerRateLimiter.check(request);

				if (!allowed) {
					return new Response(
						JSON.stringify({
							data: null,
							error:
								"Rate limit exceeded. You can make 3 requests per hour. Please try again later. or Copy the code manually",
						}),
						{
							status: 429,
							headers: {
								...responseHeaders,
								...headerRateLimiter.getHeaders(info),
								"X-Last-Request-Time": Date.now().toString(),
							},
						},
					);
				}

				try {
					// Get or create user from cookie/fingerprint
					const { user, cookieHeader } = await getOrCreateUser(
						env.DB,
						request,
					);

					const body = (await request.json()) as {
						registryDependencies: string[];
						dependencies: string[];
						files: {
							path: string;
							content: string;
							type: string;
							target: string;
						}[];
						name: string;
					};
					const { registryDependencies, dependencies, files, name } = body;
					const id = `${name}-${uuid()}`;
					const registry = {
						$schema: "https://ui.shadcn.com/schema/registry.json",
						homepage: "https://tanstack-form-builder.dev",
						author: "tanstack-form-builder (https://tanstack-form-builder.dev)",
						name,
						dependencies,
						registryDependencies,
						type: "registry:block",
						files,
					};

					// Store in D1 instead of KV
					await createRegistryItem(env.DB, user.id, {
						id,
						name,
						type: "form",
						data: JSON.stringify(registry),
					});

					const responseHeadersWithCookie: Record<string, string> = {
						...responseHeaders,
						...headerRateLimiter.getHeaders(info),
						"X-Last-Request-Time": Date.now().toString(),
					};

					// Set cookie if user is new or cookie was missing
					if (cookieHeader) {
						responseHeadersWithCookie["Set-Cookie"] = cookieHeader;
					}

					return new Response(
						JSON.stringify({
							data: {
								id: `${getRegistryUrl()}/r/${id}.json`,
							},
							error: null,
						}),
						{
							status: 200,
							headers: responseHeadersWithCookie,
						},
					);
				} catch (error: unknown) {
					console.error(error);
					return new Response(
						JSON.stringify({
							data: null,
							error:
								error instanceof Error ? error.message : "Something went wrong",
						}),
						{
							status: 500,
							headers: {
								...responseHeaders,
								...headerRateLimiter.getHeaders(info),
								"X-Last-Request-Time": Date.now().toString(),
							},
						},
					);
				}
			},
		},
	},
});
