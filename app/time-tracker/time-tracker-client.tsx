"use client";

import { createBrowserSupabaseClient } from "@/lib/client-utils";
import { useEffect, useRef, useState } from "react";

interface TimeEntry {
  id: number;
  category: string;
  seconds: number;
  user_id: string;
  created_at: string;
  color: string;
}

interface TimeTrackerClientProps {
  userId: string;
  initialEntries: TimeEntry[];
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
export default function TimeTrackerClient({ userId, initialEntries: _initialEntries }: TimeTrackerClientProps) {
  const [allEntries, setAllEntries] = useState<TimeEntry[]>(_initialEntries);
  const [entries, setEntries] = useState<AggregatedEntry[]>([]);
  const [category, setCategory] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [slices, setSlices] = useState<Slice[]>([]);
  const supabase = createBrowserSupabaseClient();

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
        color: colors[colorIndex % colors.length] ?? "#3b82f6",
      });
      colorIndex++;
    });

    return result;
  };

  const startTimer = () => {
    if (!category.trim()) {
      alert("Please enter a task name!");
      return;
    }

    const now = Date.now();
    setElapsedSeconds(0);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = Math.floor((currentTime - now) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);
  };

  const stopTimer = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsRunning(false);

    // Generate a color for this entry
    const entryColor = colors[Math.floor(Math.random() * colors.length)];

    // Save to database
    const { error } = await supabase.from("time_entries").insert({
      user_id: userId,
      category: category.trim(),
      seconds: elapsedSeconds,
      color: entryColor,
    });

    if (error) {
      console.error("Error saving time entry:", error);
      alert("Failed to save time entry");
      return;
    }

    // Fetch updated entries
    const { data: updatedEntries } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (updatedEntries) {
      setAllEntries(updatedEntries as TimeEntry[]);
      setEntries(aggregateEntries(updatedEntries as TimeEntry[]));
    }

    // Reset state
    setCategory("");
    setElapsedSeconds(0);
  };

  const deleteEntry = async (id: number) => {
    // Delete specific entry by ID
    const { error } = await supabase.from("time_entries").delete().eq("id", id).eq("user_id", userId);

    if (error) {
      console.error("Error deleting time entry:", error);
      alert("Failed to delete time entry");
      return;
    }

    // Fetch updated entries
    const { data: updatedEntries } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (updatedEntries) {
      setAllEntries(updatedEntries as TimeEntry[]);
      setEntries(aggregateEntries(updatedEntries as TimeEntry[]));
    }
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

    if (entries.length === 0) {
      ctx.fillStyle = "#ccc";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data to display", canvas.width / 2, canvas.height / 2);
      return;
    }

    const total = entries.reduce((sum, entry) => sum + entry.seconds, 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let currentAngle = -Math.PI / 2;
    const newSlices: Slice[] = [];

    entries.forEach((entry) => {
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
        if (angle >= start ?? angle <= end) {
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
    renderPieChart();

    const handleResize = () => {
      renderPieChart();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-5">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 text-center text-white">
          <h1 className="mb-2 text-4xl font-bold">⏱️ Time Tracker</h1>
          <p>Track what you&apos;re working on and visualize your time</p>
        </div>

        <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-2">
          {/* Left Panel */}
          <div className="flex flex-col gap-5">
            {/* Input Section */}
            <div className="rounded-[15px] bg-gray-50 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <h2 className="mb-4 text-xl font-semibold text-gray-800">What are you working on?</h2>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter task name..."
                disabled={isRunning}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isRunning) {
                    startTimer();
                  }
                }}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base transition-colors focus:border-[#667eea] focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <div className="my-5 text-center font-mono text-5xl font-bold text-[#667eea]">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={startTimer}
                  disabled={isRunning}
                  className="flex-1 cursor-pointer rounded-lg bg-green-600 px-5 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-green-700 disabled:transform-none disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Start Timer
                </button>
                <button
                  onClick={() => void stopTimer()}
                  disabled={!isRunning}
                  className="flex-1 cursor-pointer rounded-lg bg-red-500 px-5 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-red-600 disabled:transform-none disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Stop Timer
                </button>
              </div>
            </div>

            {/* Entries Section */}
            <div className="max-h-[400px] overflow-y-auto rounded-[15px] bg-gray-50 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <h2 className="sticky top-0 mb-4 text-xl font-semibold text-gray-800">Time Entries</h2>
              <div>
                {allEntries.length === 0 ? (
                  <div className="mt-12 text-center text-xl text-gray-400">No entries yet. Start tracking!</div>
                ) : (
                  allEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="mb-3 flex items-center justify-between rounded-lg bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-transform hover:translate-x-1"
                    >
                      <div className="flex flex-1 items-center gap-4">
                        <div className="h-5 w-5 flex-shrink-0 rounded" style={{ backgroundColor: entry.color }} />
                        <div className="flex-1">
                          <div className="mb-1 font-semibold text-gray-800">{entry.category}</div>
                          <div className="text-sm text-gray-600">{formatTime(entry.seconds)}</div>
                          <div className="mt-1 text-xs text-gray-500">{formatDateTime(entry.created_at)}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => void deleteEntry(entry.id)}
                        className="flex-shrink-0 rounded-md bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative aspect-square w-full max-w-[500px]">
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="h-auto max-w-full cursor-pointer"
              />
              <div
                ref={tooltipRef}
                className="pointer-events-none absolute z-[1000] whitespace-nowrap rounded-md bg-black/80 px-3 py-2 text-sm text-white opacity-0 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
