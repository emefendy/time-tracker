"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/client-utils";

type TimeEntry = {
  id: number;
  category: string;
  seconds: number;
  user_id: string;
  created_at: string;
  color: string;
};

type TimeTrackerClientProps = {
  userId: string;
  initialEntries: TimeEntry[];
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

export default function TimeTrackerClient({ userId, initialEntries }: TimeTrackerClientProps) {
  const [entries, setEntries] = useState<AggregatedEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([]); // Track individual entries
  const [category, setCategory] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
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

  const startTimer = () => {
    if (!category.trim()) {
      alert("Please enter a task name!");
      return;
    }

    const now = Date.now();
    setStartTime(now);
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
      setAllEntries(updatedEntries);
      setEntries(aggregateEntries(updatedEntries));
    }

    // Reset state
    setCategory("");
    setElapsedSeconds(0);
    setStartTime(null);
  };

  const deleteEntry = async (id: number) => {
    // Delete specific entry by ID
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

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
      setAllEntries(updatedEntries);
      setEntries(aggregateEntries(updatedEntries));
    }
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
    setAllEntries(initialEntries);
    setEntries(aggregateEntries(initialEntries));
  }, []);

  useEffect(() => {
    renderPieChart();

    const handleResize = () => {
      renderPieChart();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
      <div className="max-w-7xl mx-auto bg-white rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden">
        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white p-8 text-center">
          <h1 className="text-4xl font-bold mb-2">⏱️ Time Tracker</h1>
          <p>Track what you're working on and visualize your time</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
          {/* Left Panel */}
          <div className="flex flex-col gap-5">
            {/* Input Section */}
            <div className="bg-gray-50 p-6 rounded-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                What are you working on?
              </h2>
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
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base transition-colors focus:outline-none focus:border-[#667eea] disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <div className="text-5xl font-bold text-[#667eea] text-center my-5 font-mono">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={startTimer}
                  disabled={isRunning}
                  className="flex-1 px-5 py-3 bg-green-600 text-white rounded-lg text-base font-semibold cursor-pointer transition-all hover:bg-green-700 hover:-translate-y-0.5 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Start Timer
                </button>
                <button
                  onClick={stopTimer}
                  disabled={!isRunning}
                  className="flex-1 px-5 py-3 bg-red-500 text-white rounded-lg text-base font-semibold cursor-pointer transition-all hover:bg-red-600 hover:-translate-y-0.5 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Stop Timer
                </button>
              </div>
            </div>

            {/* Entries Section */}
            <div className="bg-gray-50 p-6 rounded-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.05)] max-h-[400px] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 sticky top-0">
                Time Entries
              </h2>
              <div>
                {allEntries.length === 0 ? (
                  <div className="text-center text-gray-400 text-xl mt-12">
                    No entries yet. Start tracking!
                  </div>
                ) : (
                  allEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-white p-4 mb-3 rounded-lg flex justify-between items-center shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-transform hover:translate-x-1"
                    >
                      <div className="flex items-center gap-4 flex-1">
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
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-md text-sm flex-shrink-0 hover:bg-red-600 transition-colors"
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
      </div>
    </div>
  );
}
