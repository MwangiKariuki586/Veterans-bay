"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(value / 100)
    .replace("KES", "KSh");
}

type PerformanceKey = "revenue" | "jobsCompleted" | "enquiries" | "quoteConversion";

export function PerformanceAreaChart({
  series,
  active,
}: {
  series: Array<Record<PerformanceKey, number | null> & { day: string }>;
  active: PerformanceKey;
}) {
  const formatAxisTick = (value: number) => {
    if (active === "quoteConversion") return `${value}%`;
    const display = active === "revenue" ? value / 100 : value;
    if (Math.abs(display) >= 1000) {
      return `${Math.round(display / 1000)}K`;
    }
    return String(Math.round(display));
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e7ecef" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(value: string) =>
            new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
            })
          }
          tick={{ fontSize: 11, fill: "#68717b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={40}
          tickFormatter={formatAxisTick}
          tick={{ fontSize: 11, fill: "#68717b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: unknown) =>
            active === "revenue"
              ? formatMoney(Number(value))
              : active === "quoteConversion"
                ? `${value}%`
                : Number(value).toLocaleString()
          }
          labelFormatter={(value: unknown) =>
            new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-KE", {
              dateStyle: "medium",
            })
          }
        />
        <Area
          type="monotone"
          dataKey={active}
          stroke="#347b1e"
          fill="#e7f1df"
          strokeWidth={2.5}
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index } = props;
            if (cx == null || cy == null || index !== series.length - 1) {
              return <g key={`dot-${index}`} />;
            }
            return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill="#347b1e" stroke="#ffffff" strokeWidth={2} />;
          }}
          activeDot={{ r: 5, fill: "#347b1e" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
