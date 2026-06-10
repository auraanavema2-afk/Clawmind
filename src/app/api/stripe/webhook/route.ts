import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    return Response.json({ error: msg }, { status: 400 });
  }

  const supabase = await createClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const planId = session.metadata?.plan as PlanId;

    if (userId && planId && PLANS[planId]) {
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          plan: planId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;

    // Find plan by matching price ID
    const priceId = sub.items.data[0]?.price.id;
    const planEntry = Object.entries(PLANS).find(
      ([, p]) => p.stripePriceId === priceId
    );
    const planId = (planEntry?.[0] ?? "spark") as PlanId;

    const status =
      event.type === "customer.subscription.deleted"
        ? "canceled"
        : (sub.status as "active" | "past_due" | "trialing" | "canceled");

    await supabase
      .from("subscriptions")
      .update({
        plan: status === "canceled" ? "spark" : planId,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", sub.id);
  }

  return Response.json({ received: true });
}
