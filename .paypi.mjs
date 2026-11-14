import Stripe from "stripe";
import pg from "pg";
const s = new Stripe("proxy-injected", { httpClient: Stripe.createFetchHttpClient() });
const c = new pg.Client({ connectionString: "postgresql://postgres@localhost:5432/keyvaga" }); await c.connect();
const [table, col, id] = process.argv.slice(2);
const { rows } = await c.query(`select "stripeId" from "${table}" where "${col}"=$1 and status='PENDING' order by "createdAt" desc limit 1`, [id]);
const pi = await s.paymentIntents.confirm(rows[0].stripeId, { payment_method: "pm_card_visa", return_url: "https://example.com" });
console.log("  (test card payment:", pi.status + ")"); await c.end();
