"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatChartTick(value: string) {
  try {
    const d = new Date(`${value}T00:00:00`);
    return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  } catch {
    return value;
  }
}

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(minor / 100)
    .replace("KES", "KSh");
}

export function SpendingAreaChart({ series }: { series: Array<{ day: string; value: number }> }) {
  if (!series.length) {
    return <div className="grid h-full place-items-center type-caption text-muted-foreground">No spending in range</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ left: 0, right: 6, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f3" vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickFormatter={formatChartTick}
          tick={{ fontSize: 11, fill: "#68717b" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          width={36}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v / 100))}
          tick={{ fontSize: 11, fill: "#68717b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: unknown) => [formatMoney(Number(value) * 100), "Spend"] as [string, string]}
          labelFormatter={(label: unknown) =>
            new Date(`${String(label)}T00:00:00`).toLocaleDateString("en-KE", { dateStyle: "medium" })
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2f7d18"
          fill="#eaf5e5"
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: "#2f7d18",
            stroke: "#fff",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
