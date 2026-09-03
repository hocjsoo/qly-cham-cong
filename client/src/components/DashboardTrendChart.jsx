import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function DashboardTrendChart({ months, CustomTooltip }) {
  if (!months || !months.length) return null;
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={months} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        {CustomTooltip && <Tooltip content={<CustomTooltip />} />}
        <Bar dataKey="present" name="Có mặt" radius={[2, 2, 0, 0]}>
          {months.map((_, i) => (
            <Cell key={i} fill={i === months.length - 1 ? "var(--primary)" : "var(--green)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
