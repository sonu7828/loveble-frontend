import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supa.functions.invoke("send-transactional-email", {
    body: {
      templateName: "post-visit-review",
      recipientEmail: "kiemovero@gmail.com",
      idempotencyKey: `sample-postvisit-ultherapy-${Date.now()}`,
      templateData: {
        clientFirstName: "Friend",
        serviceName: "Ultherapy",
        providerName: "Your Radiantilyk Provider",
        locationName: "Radiantilyk Aesthetic — San Jose",
        reviewUrl: "https://g.page/r/CXsampleSanJose/review",
        rebookUrl: "https://bookrka.com/book",
        feedbackUrl: "https://bookrka.com/feedback/sample-token",
      },
    },
  });
  return new Response(JSON.stringify({ data, error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
