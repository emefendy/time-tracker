"use client";

import { useState, useEffect, useRef } from "react";

type TimeEntry = {
  id: number;
  category: string;
  seconds: number;
  user_id: string;
  created_at: string;
  color: string;
};

type TimeTrackerReadOnlyProps = {
  entries: TimeEntry[];
};

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

type AggregatedEntry = {
  name: string;
  seconds: number;
  color: string;
};

type Slice = {
  startAngle: number;
  endAngle: number;
  name: string;
  seconds: number;
  percentage: string;
};

export default function TimeTrackerReadOnly({ entries }: TimeTrackerReadOnlyProps) {
  const [aggregatedEntries, setAggregatedEntries] = useState<AggregatedEntry[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [slices, setSlices] = useState<Slice[]>([]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const timeFormatted = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    return `${dateFormatted} at ${timeFormatted}`;
  };

  // Aggregate entries by category for the pie chart
  const aggregateEntries = (dbEntries: TimeEntry[]): AggregatedEntry[] => {
    const aggregated = new Map<string, number>();

    dbEntries.forEach((entry) => {
      const categoryLower = entry.category.toLowerCase();
      const current = aggregated.get(categoryLower) || 0;
      aggregated.set(categoryLower, current + entry.seconds);
    });

    const result: AggregatedEntry[] = [];
    let colorIndex = 0;

    aggregated.forEach((seconds, name) => {
      result.push({
        name,
        seconds,
        color: colors[colorIndex % colors.length],
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

    const width = canvas.parentElement?.offsetWidth || 500;
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
    const radius = Math.min(centerX, centerY) - 20;

    let currentAngle = -Math.PI / 2;
    const newSlices: Slice[] = [];

    aggregatedEntries.forEach((entry) => {
      const sliceAngle = (entry.seconds / total) * 2 * Math.PI;

      newSlices.push({
        startAngle: currentAngle,
        endAngle: currentAngle + sliceAngle,
        name: entry.name,
        seconds: entry.seconds,
        percentage: ((entry.seconds / total) * 100).toFixed(1),
      });

      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      if (sliceAngle > 0.1) {
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        const percentage = ((entry.seconds / total) * 100).toFixed(1);

        ctx.fillStyle = "white";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${percentage}%`, labelX, labelY);
      }

      currentAngle += sliceAngle;
    });

    setSlices(newSlices);
  };

  const getSliceAtPosition = (x: number, y: number): Slice | null => {
    const canvas = canvasRef.current;
    if (!canvas || slices.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = x - rect.left;
    const mouseY = y - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > radius) return null;

    let angle = Math.atan2(dy, dx);
    angle = angle + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    for (const slice of slices) {
      let start = slice.startAngle;
      let end = slice.endAngle;

      if (start < 0) start += 2 * Math.PI;
      if (end < 0) end += 2 * Math.PI;

      if (end < start) {
        if (angle >= start || angle <= end) {
          return slice;
        }
      } else {
        if (angle >= start && angle <= end) {
          return slice;
        }
      }
    }

    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const slice = getSliceAtPosition(e.clientX, e.clientY);
    const tooltip = tooltipRef.current;
    const canvas = canvasRef.current;

    if (tooltip && canvas && slice) {
      tooltip.textContent = `${slice.name} - ${formatTime(slice.seconds)} (${slice.percentage}%)`;
      const rect = canvas.getBoundingClientRect();
      tooltip.style.left = e.clientX - rect.left + 15 + "px";
      tooltip.style.top = e.clientY - rect.top + 15 + "px";
      tooltip.style.opacity = "1";
    } else if (tooltip) {
      tooltip.style.opacity = "0";
    }
  };

  const handleMouseLeave = () => {
    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltip.style.opacity = "0";
    }
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
  }, [aggregatedEntries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-8">
      {/* Entries List */}
      <div className="bg-gray-50 p-6 rounded-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.05)] max-h-[500px] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 sticky top-0 bg-gray-50">
          Time Entries
        </h2>
        <div>
          {entries.length === 0 ? (
            <div className="text-center text-gray-400 text-xl mt-12">
              No entries yet. Log in to start tracking!
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white p-4 mb-3 rounded-lg flex items-center gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
              >
                <div
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 mb-1">
                    {entry.category}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatTime(entry.seconds)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDateTime(entry.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-[500px] aspect-square relative">
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="max-w-full h-auto cursor-pointer"
          />
          <div
            ref={tooltipRef}
            className="absolute bg-black/80 text-white px-3 py-2 rounded-md text-sm pointer-events-none opacity-0 transition-opacity whitespace-nowrap z-[1000]"
          />
        </div>
      </div>
    </div>
  );
}
