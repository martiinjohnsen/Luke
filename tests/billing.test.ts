import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { BILLING_SCOPE, SHARE_PLANS, paidCheckoutDetails } from "../src/lib/billing.ts";

const paid = () => ({
  id: "cs_test_example", mode: "payment", status: "complete", payment_status: "paid", currency: "nok", amount_total: 1900, livemode: false,
  payment_intent: "pi_example", metadata: { scope: BILLING_SCOPE, orderId: "bc000000-0000-4000-8000-000000000001", ownerId: "bc000000-0000-4000-8000-000000000002", calendarId: "calendar-one", kind: "person" },
});
test("a paid single invitation costs exactly NOK 19; the group costs NOK 29", () => {
  assert.equal(SHARE_PLANS.person.amount, 1900);
  assert.equal(SHARE_PLANS.group.amount, 2900);
  assert.equal(paidCheckoutDetails(paid(), false)?.kind, "person");
  const group = paid(); group.metadata.kind = "group"; group.amount_total = 2900;
  assert.equal(paidCheckoutDetails(group, false)?.amount, 2900);
});
test("returning from checkout or completing an unpaid asynchronous payment does not unlock sharing", () => {
  const session = paid(); session.payment_status = "unpaid";
  assert.equal(paidCheckoutDetails(session, false), null);
  session.payment_status = "no_payment_required";
  assert.equal(paidCheckoutDetails(session, false), null);
});
test("incorrect price, currency, status, mode, metadata and test/live mixtures are rejected", () => {
  for (const patch of [{ amount_total: 1 }, { amount_total: 2900 }, { currency: "usd" }, { status: "open" }, { mode: "subscription" }, { payment_intent: null }])
    assert.throws(() => paidCheckoutDetails({ ...paid(), ...patch }, false));
  assert.throws(() => paidCheckoutDetails(paid(), true));
  for (const patch of [{ scope: "other-product" }, { kind: "unlimited" }, { orderId: "not-an-order" }, { ownerId: "" }, { calendarId: "" }])
    assert.throws(() => paidCheckoutDetails({ ...paid(), metadata: { ...paid().metadata, ...patch } }, false));
});
test("Stripe signatures require the exact signed body and reject tampering, wrong secrets and stale deliveries", () => {
  const stripe = new Stripe("sk_test_fixture_only");
  const secret = "whsec_local_test_only", payload = JSON.stringify({ id: "evt_fixture", object: "event", type: "checkout.session.completed", data: { object: paid() } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, signature, secret).id, "evt_fixture");
  assert.throws(() => stripe.webhooks.constructEvent(payload.replace("1900", "1"), signature, secret));
  assert.throws(() => stripe.webhooks.constructEvent(payload, signature, "wrong-secret"));
  const expired = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 600 });
  assert.throws(() => stripe.webhooks.constructEvent(payload, expired, secret));
});
