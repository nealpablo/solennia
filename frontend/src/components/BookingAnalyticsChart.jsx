/**
 * BookingAnalyticsChart.jsx
 * Renders booking analytics graphs using Chart.js (npm package: chart.js).
 * Used in Profile dashboard and anywhere we need booking status breakdown.
 * Supports downloading the chart as PNG and analytics data as CSV.
 */
import { useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from "react";
import {
  Chart,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
} from "chart.js";

Chart.register(
  DoughnutController,
  BarController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const SOLENNIA_COLORS = {
  primary: "#7a5d47",
  palette: ["#7a5d47", "#9a7b5c", "#c9bda4", "#5b4636", "#b8a990", "#e8ddae"],
  border: "#f6f0e8",
};

/** Trigger browser download of a blob with the given filename */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Builds labels and values from client/vendor analytics for status breakdown.
 * @param {Object} analytics - { upcoming_bookings, completed_bookings, cancelled_bookings, rejected_bookings? }
 * @returns {{ labels: string[], data: number[] }}
 */
export function getBookingStatusData(analytics) {
  if (!analytics) return { labels: [], data: [] };
  const upcoming = analytics.upcoming_bookings ?? 0;
  const completed = analytics.completed_bookings ?? 0;
  const cancelled = analytics.cancelled_bookings ?? 0;
  const rejected = analytics.rejected_bookings ?? 0;
  const labels = ["Upcoming", "Completed", "Cancelled", "Rejected"];
  const data = [upcoming, completed, cancelled, rejected];
  if (data.every((d) => d === 0)) {
    return { labels: ["No data"], data: [1] };
  }
  return { labels, data };
}

/**
 * Doughnut chart: booking count by status (Solennia styling).
 * Forwards the canvas ref so parent can export as PNG.
 */
export const BookingStatusDoughnut = forwardRef(function BookingStatusDoughnut(
  { analytics, className = "", height = 192 },
  forwardedRef
) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current, []);

  useLayoutEffect(() => {
    if (!analytics) return;
    const { labels, data } = getBookingStatusData(analytics);
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const existing = chartRef.current || Chart.getChart(canvas);
    if (existing) {
      existing.destroy();
      chartRef.current = null;
    }
    const w = Math.max(container.offsetWidth || 320, 280);
    const h = Math.max(container.offsetHeight || height, 180);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = "100%";
    canvas.style.height = `${h}px`;
    canvas.style.maxHeight = `${height}px`;
    try {
      chartRef.current = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: SOLENNIA_COLORS.palette.slice(0, data.length),
              borderColor: SOLENNIA_COLORS.border,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.raw} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    } catch (err) {
      console.error("BookingStatusDoughnut error:", err);
    }
    return () => {
      const existing = chartRef.current || (canvas && Chart.getChart(canvas));
      if (existing) {
        existing.destroy();
        chartRef.current = null;
      }
    };
  }, [analytics, height]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minWidth: 280,
        minHeight: `${height}px`,
        height: `${height}px`,
        maxHeight: `${height}px`,
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label="Bookings by status chart" />
    </div>
  );
});

/**
 * Bar chart: same booking status breakdown (alternative view for analytics).
 */
export function BookingStatusBar({ analytics, className = "", height = 220 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!analytics || !canvasRef.current) return;

    const { labels, data } = getBookingStatusData(analytics);
    if (labels[0] === "No data" && data[0] === 1) return; // skip bar when no data

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const t = setTimeout(() => {
      if (!canvasRef.current) return;
      try {
        chartRef.current = new Chart(canvasRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Bookings",
                data,
                backgroundColor: SOLENNIA_COLORS.palette.slice(0, data.length),
                borderColor: SOLENNIA_COLORS.primary,
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.raw} booking(s)`,
                },
              },
            },
          },
        });
      } catch (err) {
        console.error("BookingStatusBar error:", err);
      }
    }, 50);

    return () => {
      clearTimeout(t);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [analytics]);

  return (
    <div className={className} style={{ minHeight: `${height}px`, height: `${height}px` }}>
      <canvas ref={canvasRef} className="w-full" style={{ maxHeight: `${height}px` }} />
    </div>
  );
}

/**
 * Combined analytics block: title + doughnut (and optional bar).
 * Use this in Profile or dashboards for a ready-made “Bookings by status” section.
 */
/** Mini bar chart: last 4 weeks booking count */
function Last4WeeksChart({ last4Weeks, height = 140 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!last4Weeks || last4Weeks.length !== 4) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const existing = chartRef.current || Chart.getChart(canvas);
    if (existing) {
      existing.destroy();
      chartRef.current = null;
    }
    const t = setTimeout(() => {
      if (!canvasRef.current) return;
      try {
        chartRef.current = new Chart(canvasRef.current, {
          type: "bar",
          data: {
            labels: ["Week 4 ago", "Week 3 ago", "Week 2 ago", "Last week"],
            datasets: [{
              label: "Bookings",
              data: last4Weeks,
              backgroundColor: SOLENNIA_COLORS.palette.slice(0, 4),
              borderColor: SOLENNIA_COLORS.primary,
              borderWidth: 1,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { legend: { display: false } },
          },
        });
      } catch (err) {
        console.error("Last4WeeksChart error:", err);
      }
    }, 100);
    return () => {
      clearTimeout(t);
      const c = canvasRef.current;
      const existing = chartRef.current || (c && Chart.getChart(c));
      if (existing) {
        existing.destroy();
        chartRef.current = null;
      }
    };
  }, [last4Weeks]);
  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function BookingAnalyticsChart({ analytics, showBarChart = false, title = "Bookings by status" }) {
  const chartCanvasRef = useRef(null);

  const handleDownloadPNG = () => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      fetch(dataUrl)
        .then((r) => r.blob())
        .then((b) => downloadBlob(b, `solennia-bookings-chart-${new Date().toISOString().slice(0, 10)}.png`));
    } catch (e) {
      console.error("Download chart PNG failed:", e);
    }
  };

  const handleDownloadCSV = () => {
    const { labels, data } = getBookingStatusData(analytics);
    const total = data.reduce((a, b) => a + b, 0);
    const rows = [
      ["Status", "Count", "Percentage"],
      ...labels.map((label, i) => [
        label,
        String(data[i] ?? 0),
        total ? `${((data[i] / total) * 100).toFixed(1)}%` : "0%",
      ]),
      ["Total", String(total), "100%"],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `solennia-bookings-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (!analytics) return null;

  const weekCount = analytics.bookings_this_week ?? 0;
  const monthCount = analytics.bookings_this_month ?? 0;
  const last4Weeks = analytics.last_4_weeks;

  return (
    <div className="bg-white rounded-xl p-4 border border-[#c9bda4]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#5b4636]">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPNG}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] transition-colors"
          >
            Download chart (PNG)
          </button>
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] transition-colors"
          >
            Download data (CSV)
          </button>
        </div>
      </div>
      {(typeof weekCount === "number" || typeof monthCount === "number") && (
        <div className="mb-4 p-3 rounded-lg bg-[#f6f0e8] border border-[#c9bda4]">
          <p className="text-xs font-semibold text-[#5b4636] mb-2">Tally</p>
          <p className="text-sm text-gray-700">
            This week: <strong className="text-[#7a5d47]">{weekCount}</strong>
            {" · "}
            This month: <strong className="text-[#7a5d47]">{monthCount}</strong>
          </p>
        </div>
      )}
      {Array.isArray(last4Weeks) && last4Weeks.length === 4 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#5b4636] mb-2">Bookings in the last 4 weeks</p>
          <Last4WeeksChart last4Weeks={last4Weeks} height={140} />
        </div>
      )}
      <div className="w-full min-w-[280px] min-h-[192px] max-h-[192px]" style={{ position: "relative" }}>
        <BookingStatusDoughnut ref={chartCanvasRef} analytics={analytics} height={192} />
      </div>
      {showBarChart && (
        <>
          <h3 className="text-sm font-semibold text-[#5b4636] mb-3 mt-6">Count by status</h3>
          <div className="w-full min-h-[200px]">
            <BookingStatusBar analytics={analytics} height={200} />
          </div>
        </>
      )}
    </div>
  );
}
