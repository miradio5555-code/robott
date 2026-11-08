// WhatsApp AI integration retired. No model calls or customer data processing.
Deno.serve(() => new Response(JSON.stringify({error:"integration_disabled"}), {
 status:410,headers:{"Content-Type":"application/json"}
}));
