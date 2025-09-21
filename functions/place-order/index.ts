// Supabase Edge Function: place-order
// 作用：处理下单，强制轮次限制逻辑

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 使用服务端密钥（需要在 Supabase 环境变量里设置）
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const { user_id, product_id, total_price, profit } = await req.json();

    if (!user_id || !product_id) {
      return new Response(JSON.stringify({ error: "缺少参数 user_id 或 product_id" }), {
        status: 400,
      });
    }

    // 查找最近一轮
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("*")
      .eq("user_id", user_id)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw roundError;

    const now = new Date();
    let round_id = round?.id;
    let canOrder = false;

    if (!round || now > new Date(round.end_time)) {
      // ❌ 没有 round 或者冷却时间过了 -> 开新一轮
      const { data: newRound, error: newRoundError } = await supabase
        .from("rounds")
        .insert({
          user_id,
          current_round: (round?.current_round || 0) + 1,
          order_count: 1,
          start_time: now.toISOString(),
          end_time: new Date(now.getTime() + 10000).toISOString(), // 默认 10 秒
        })
        .select()
        .single();

      if (newRoundError) throw newRoundError;

      round_id = newRound.id;
      canOrder = true;
    } else if (round.order_count < round.max_orders) {
      // ✅ 当前 round 内还有额度
      const { error: updateError } = await supabase
        .from("rounds")
        .update({ order_count: round.order_count + 1 })
        .eq("id", round.id);

      if (updateError) throw updateError;

      round_id = round.id;
      canOrder = true;
    } else {
      // ❌ 当前轮次已满，进入冷却
      const waitSeconds = Math.ceil(
        (new Date(round.end_time).getTime() - now.getTime()) / 1000
      );
      return new Response(
        JSON.stringify({ error: `当前轮次已满，请等待 ${waitSeconds} 秒后再下单` }),
        { status: 429 } // 429 Too Many Requests
      );
    }

    if (canOrder) {
      // 插入订单
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id,
          product_id,
          total_price: total_price || 100,
          profit: profit || 20,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      return new Response(JSON.stringify({ order, round_id }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "未知错误" }), { status: 500 });
  } catch (err) {
    console.error("place-order error:", err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
    });
  }
});
