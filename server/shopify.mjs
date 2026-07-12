// Shopify — real order + product lookup, so the crew answers "where's my order"
// and returns/stock questions from the live store instead of guessing.
//
// Credentials (from a Shopify custom app with read_orders + read_products):
//   SHOPIFY_STORE=your-store.myshopify.com
//   SHOPIFY_ADMIN_TOKEN=shpat_...
// Gated on both being present; returns a compact summary the specialist can use.

const STORE = (process.env.SHOPIFY_STORE || "")
	.replace(/^https?:\/\//, "")
	.replace(/\/$/, "");
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const API = process.env.SHOPIFY_API_VERSION || "2024-10";

export const shopifyEnabled = () => Boolean(STORE && TOKEN);

async function api(path) {
	const res = await fetch(`https://${STORE}/admin/api/${API}/${path}`, {
		headers: {
			"X-Shopify-Access-Token": TOKEN,
			"Content-Type": "application/json",
		},
	});
	if (!res.ok)
		throw new Error(
			`shopify ${res.status}: ${(await res.text()).slice(0, 160)}`,
		);
	return res.json();
}

// Look up an order by name ("#1001"/"1001") or by customer email.
export async function lookupOrder(query) {
	if (!shopifyEnabled()) throw new Error("staged (no SHOPIFY creds)");
	const q = String(query || "").trim();
	let orders = [];
	if (q.includes("@")) {
		orders =
			(
				await api(
					`orders.json?email=${encodeURIComponent(q)}&status=any&limit=5`,
				)
			).orders ?? [];
	} else {
		const name = q.replace(/^#/, "");
		orders =
			(
				await api(
					`orders.json?name=${encodeURIComponent(name)}&status=any&limit=5`,
				)
			).orders ?? [];
	}
	if (!orders.length)
		return { found: false, summary: `No order found matching "${q}".` };
	const o = orders[0];
	const items = (o.line_items ?? [])
		.map((li) => `${li.quantity}× ${li.title}`)
		.join("; ");
	const tracking = (o.fulfillments ?? [])
		.flatMap((f) => f.tracking_numbers ?? [])
		.join(", ");
	const summary =
		`Order ${o.name} — payment: ${o.financial_status || "—"}, fulfillment: ${o.fulfillment_status || "unfulfilled"}. ` +
		`Items: ${items || "—"}. ${tracking ? `Tracking: ${tracking}.` : "No tracking yet."} ` +
		`Placed ${o.created_at?.slice(0, 10) ?? "?"}. Total ${o.total_price ?? "?"} ${o.currency ?? ""}.`;
	return { found: true, summary, order: o };
}

// Quick product/stock check by title keyword.
export async function lookupProduct(query) {
	if (!shopifyEnabled()) throw new Error("staged (no SHOPIFY creds)");
	const data = await api(
		`products.json?title=${encodeURIComponent(query)}&limit=3`,
	);
	const products = data.products ?? [];
	if (!products.length)
		return { found: false, summary: `No product matching "${query}".` };
	const lines = products.map((p) => {
		const stock = (p.variants ?? [])
			.map(
				(v) =>
					`${v.title}: ${v.inventory_quantity ?? "?"} in stock @ ${v.price}`,
			)
			.join(", ");
		return `${p.title} — ${stock}`;
	});
	return { found: true, summary: lines.join(" | ") };
}
