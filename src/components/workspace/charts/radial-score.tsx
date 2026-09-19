"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

/** Renders a percentage score as a configurable radial progress chart. */
export function RadialScore({
  score,
  fill = "#2f7d18",
  backgroundFill = "#e8efdf",
  innerRadius = "72%",
  outerRadius = "100%",
  cornerRadius = 10,
}: {
  score: number;
  fill?: string;
  backgroundFill?: string;
  innerRadius?: string;
  outerRadius?: string;
  cornerRadius?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        data={[{ value: score, fill }]}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={90}
        endAngle={-270}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" background={{ fill: backgroundFill }} cornerRadius={cornerRadius} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
