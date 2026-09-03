import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function ReportTrendChart({ trendData }) {
  if (!trendData || !trendData.length) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
        <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
        <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
          formatter={(val) => [`${val}%`, "Tỷ lệ đúng giờ"]}
        />
        <Bar dataKey="attendance_rate" fill="var(--primary)" radius={[6, 6, 0, 0]}>
          {trendData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={(entry.attendance_rate ?? entry.on_time_rate) >= 90 ? "#10b981" : (entry.attendance_rate ?? entry.on_time_rate) >= 80 ? "#3b82f6" : "#f59e0b"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
