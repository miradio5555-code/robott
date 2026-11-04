// Server-only phrasing for generic replies. No customer messages or order data.
import { createClient } from "jsr:@supabase/supabase-js@2";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const facts:Record<string,string>={
 menu:"Поздоровайся и предложи помочь с заказом, новой заявкой или связью с менеджером. Только одна тёплая короткая фраза без команд и нумерации.",
 conditions:"Объясни: принимаем заявки на товары; цену и сроки менеджер подтверждает после проверки товара и доставки; заявка сама по себе не означает оплату или подтверждение покупки. Не добавляй других условий. Два-три коротких предложения.",
};
let selectedModel:string|null=null;
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 let phase="auth";
 try{
  const body=await req.json();
  if(!/^[a-f0-9-]{36}$/.test(body.workspace||"")||!Object.hasOwn(facts,body.intent))return json({error:"invalid_request"},400);
  const key=req.headers.get("apikey")||"";
  if(!key)return json({error:"forbidden"},403);
  // Only the existing service credential can read this private table. Browser
  // owners and anonymous clients have no table privilege, even for their own ws.
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,key,{auth:{persistSession:false}});
  const {data:connection,error}=await sb.from("wa_connections").select("active").eq("workspace_id",body.workspace).maybeSingle();
  if(error||!connection?.active)return json({error:"forbidden"},403);
  const {data:settings}=await sb.from("wa_settings").select("enabled,bot_enabled").eq("workspace_id",body.workspace).maybeSingle();
  if(!settings?.enabled||!settings?.bot_enabled)return json({error:"disabled"},403);
  const apiKey=Deno.env.get("GEMINI_API_KEY");
  if(!apiKey)return json({error:"no_api_key"},503);
  phase="models";
  if(!selectedModel){
   const list=await fetch("https://generativelanguage.googleapis.com/v1beta/models",{headers:{"x-goog-api-key":apiKey},signal:AbortSignal.timeout(10000)});
   if(!list.ok)return json({error:"model_list_unavailable",provider_status:list.status},503);
   const models=await list.json();
   const available=new Set((models.models||[]).filter((m:{supportedGenerationMethods?:string[]})=>m.supportedGenerationMethods?.includes("generateContent")).map((m:{name:string})=>m.name.replace("models/","")));
   selectedModel=["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-2.5-flash-lite","gemini-2.5-flash"].find(m=>available.has(m))||null;
   if(!selectedModel)return json({error:"free_model_unavailable"},503);
  }
  const model=selectedModel;
  phase="generate";
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
   method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},signal:AbortSignal.timeout(10000),
   body:JSON.stringify({systemInstruction:{parts:[{text:"Ты редактор коротких ответов магазина в WhatsApp. Пиши по-русски естественно, доброжелательно, без канцелярита. Не утверждай, что ты человек. Не придумывай цены, сроки, скидки, наличие, оплату или статус заказа. Не добавляй ссылки, номера, имена, эмодзи и списки. Верни только текст ответа."}]},contents:[{role:"user",parts:[{text:facts[body.intent]}]}],generationConfig:{temperature:0.5,maxOutputTokens:256}}),
  });
  if(!response.ok)return json({error:response.status===429?"rate_limited":"ai_unavailable",provider_status:response.status},503);
  const result=await response.json();
  const text=(result.candidates?.[0]?.content?.parts||[]).filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text||"").join("").trim();
  if(!text||text.length>600||/[0-9]|https?:|www\.|@/i.test(text))return json({error:"invalid_response"},503);
  return json({answer:text});
 }catch(e){return json({error:phase+"_unavailable",kind:e instanceof Error?e.name:"Error"},503);}
});
