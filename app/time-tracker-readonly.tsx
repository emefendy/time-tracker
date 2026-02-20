"use client";

import { useEffect, useRef, useState } from "react";

interface TimeEntry {
  id: number;
  category: string;
  seconds: number;
  user_id: string;
  created_at: string;
  color: string;
}

interface TimeTrackerReadOnlyProps {
  entries: TimeEntry[];
}

const colors = [
  "#667eea",
  "#764ba2",
  "#f093fb",
  "#4facfe",
  "#43e97b",
  "#fa709a",
  "#fee140",
  "#30cfd0",
  "#a8edea",
  "#fed6e3",
  "#c471f5",
  "#12c2e9",
];

interface AggregatedEntry {
  name: string;
  seconds: number;
  color: string;
}

interface Slice {
  startAngle: number;
  endAngle: number;
  name: string;
  seconds: number;
  percentage: string;
}

export default function TimeTrackerReadOnly({ entries }: TimeTrackerReadOnlyProps) {
  const [aggregatedEntries, setAggregatedEntries] = useState<AggregatedEntry[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeFormatted = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateFormatted} at ${timeFormatted}`;
  };

  // Aggregate entries by category for the pie chart
  const aggregateEntries = (dbEntries: TimeEntry[]): AggregatedEntry[] => {
    const aggregated = new Map<string, number>();

    dbEntries.forEach((entry) => {
      const categoryLower = entry.category.toLowerCase();
      const current = aggregated.get(categoryLower) ?? 0;
      aggregated.set(categoryLower, current + entry.seconds);
    });

    const result: AggregatedEntry[] = [];
    let colorIndex = 0;

    aggregated.forEach((seconds, name) => {
      result.push({
        name,
        seconds,
        color: colors[colorIndex % colors.length] ?? "#667eea",
      });
      colorIndex++;
    });

    return result;
  };

  const renderPieChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.parentElement?.offsetWidth ?? 500;
    canvas.width = width;
    canvas.height = width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (aggregatedEntries.length === 0) {
      ctx.fillStyle = "#ccc";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data to display", canvas.width / 2, canvas.height / 2);
      return;
    }

    const total = aggregatedEntries.reduce((sum, entry) => sum + entry.seconds, 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.6; // Smaller radius to make room for labels

    let currentAngle = -Math.PI / 2;

    // Draw slices
    aggregatedEntries.forEach((entry) => {
      const sliceAngle = (entry.seconds / total) * 2 * Math.PI;

      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      // Draw percentage inside slice if it's large enough
      if (sliceAngle > 0.2) {
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.6);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.6);
        const percentage = ((entry.seconds / total) * 100).toFixed(0);

        ctx.fillStyle = "white";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${percentage}%`, labelX, labelY);
      }

      currentAngle += sliceAngle;
    });

    // Draw labels with leader lines
    currentAngle = -Math.PI / 2;
    aggregatedEntries.forEach((entry) => {
      const sliceAngle = (entry.seconds / total) * 2 * Math.PI;
      const midAngle = currentAngle + sliceAngle / 2;

      // Point on the edge of the pie
      const edgeX = centerX + Math.cos(midAngle) * radius;
      const edgeY = centerY + Math.sin(midAngle) * radius;

      // Extended point for the line
      const lineExtend = radius * 0.2;
      const lineX = centerX + Math.cos(midAngle) * (radius + lineExtend);
      const lineY = centerY + Math.sin(midAngle) * (radius + lineExtend);

      // Label position
      const labelOffset = 10;
      const isRightSide = Math.cos(midAngle) > 0;
      const labelX = lineX + (isRightSide ? labelOffset : -labelOffset);
      const labelY = lineY;

      // Draw leader line
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(edgeX, edgeY);
      ctx.lineTo(lineX, lineY);
      ctx.stroke();

      // Draw label text
      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.textAlign = isRightSide ? "left" : "right";
      ctx.textBaseline = "middle";

      const labelText = `${entry.name} (${formatTime(entry.seconds)})`;
      ctx.fillText(labelText, labelX, labelY);

      currentAngle += sliceAngle;
    });
  };

  useEffect(() => {
    setAggregatedEntries(aggregateEntries(entries));
  }, [entries]);

  useEffect(() => {
    renderPieChart();

    const handleResize = () => {
      renderPieChart();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregatedEntries]);

  // Create a color map based on aggregated entries
  const colorMap = new Map<string, string>();
  aggregatedEntries.forEach((entry) => {
    colorMap.set(entry.name, entry.color);
  });

  // Get color for an entry based on its category
  const getColorForEntry = (category: string): string => {
    return colorMap.get(category.toLowerCase()) ?? "#667eea";
  };

  return (
    <div className="my-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Entries List */}
      <div className="max-h-[500px] overflow-y-auto rounded-[15px] bg-gray-50 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <h2 className="sticky top-0 mb-4 bg-gray-50 text-xl font-semibold text-gray-800">Time Entries</h2>
        <div>
          {entries.length === 0 ? (
            <div className="mt-12 text-center text-xl text-gray-400">No entries yet. Log in to start tracking!</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="mb-3 flex items-center gap-4 rounded-lg bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
              >
                <div
                  className="h-5 w-5 flex-shrink-0 rounded"
                  style={{ backgroundColor: getColorForEntry(entry.category) }}
                />
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-gray-800">{entry.category}</div>
                  <div className="text-sm text-gray-600">{formatTime(entry.seconds)}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatDateTime(entry.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex flex-col items-center justify-center">
        <div className="relative aspect-square w-full max-w-[500px]">
          <canvas ref={canvasRef} className="h-auto max-w-full" />
        </div>
      </div>
    </div>
  );
}
