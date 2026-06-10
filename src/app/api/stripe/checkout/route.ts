import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const stripe = getStripe();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let planId: PlanId;
  try {
    const body = await request.json();
    planId = body.plan as PlanId;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const plan = PLANS[planId];
  if (!plan || !plan.stripePriceId) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Reuse existing Stripe customer if available
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  const origin = request.headers.get("origin") ?? "";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email!,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/app?upgraded=1`,
    cancel_url: `${origin}/app`,
    metadata: { user_id: user.id, plan: planId },
  });

  return Response.json({ url: session.url });
}
