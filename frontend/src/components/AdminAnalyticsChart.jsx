import React, { useEffect, useRef } from "react";
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
} from "chart.js";

Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
);

const SOLENNIA_COLORS = {
    primary: "#7a5d47",
    palette: ["#7a5d47", "#c9bda4", "#e8ddae", "#5b4636"],
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

export default function AdminAnalyticsChart({ analytics }) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        if (!analytics || !canvasRef.current) return;

        const vendors = analytics.total_vendors || 0;
        const venues = analytics.total_venues || 0;
        const clients = analytics.total_clients || (analytics.total_users || 0) - vendors;

        const labels = ["Clients", "Suppliers", "Venues"];
        const data = [clients > 0 ? clients : 0, vendors, venues];

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        chartRef.current = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Count",
                        data,
                        backgroundColor: SOLENNIA_COLORS.palette.slice(0, 3),
                        borderColor: SOLENNIA_COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 4,
                        barThickness: 40,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: "#f3f4f6", // lighter grid
                        },
                        ticks: {
                            stepSize: 1,
                            font: { family: "'Inter', sans-serif", size: 11 },
                            color: "#6b7280"
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: "'Inter', sans-serif", size: 12, weight: 600 },
                            color: "#5b4636"
                        },
                        border: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#5b4636",
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: { family: "'Inter', sans-serif", size: 13 },
                        bodyFont: { family: "'Inter', sans-serif", size: 13 },
                        callbacks: {
                            label: (ctx) => ` ${ctx.raw} ${ctx.label.toLowerCase()}`,
                        }
                    },
                },
            },
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [analytics]);

    const handleDownloadPNG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            const dataUrl = canvas.toDataURL("image/png");
            fetch(dataUrl)
                .then((r) => r.blob())
                .then((b) => downloadBlob(b, `solennia-platform-overview-${new Date().toISOString().slice(0, 10)}.png`));
        } catch (e) {
            console.error("Download chart PNG failed:", e);
        }
    };

    const handleDownloadCSV = () => {
        if (!analytics) return;
        const vendors = analytics.total_vendors || 0;
        const venues = analytics.total_venues || 0;
        const clients = analytics.total_clients || (analytics.total_users || 0) - vendors;

        const rows = [
            ["Category", "Count"],
            ["Clients", String(clients > 0 ? clients : 0)],
            ["Vendors", String(vendors)],
            ["Venues", String(venues)]
        ];

        const csv = rows.map((r) => r.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, `solennia-platform-overview-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    if (!analytics) return null;

    return (
        <div className="bg-white rounded-xl p-6 border border-[#c9bda4] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-sm font-semibold text-[#5b4636] uppercase tracking-wide">Platform Overview</h3>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={handleDownloadPNG}
                        className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] transition-colors"
                    >
                        Download chart (PNG)
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadCSV}
                        className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] transition-colors"
                    >
                        Download data (CSV)
                    </button>
                </div>
            </div>
            <div className="w-full h-[200px]">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}
