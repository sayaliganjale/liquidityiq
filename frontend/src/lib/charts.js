import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  Title,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  Title
);

export const gridColor = "rgba(14, 165, 233, 0.07)";
export const tickColor = "#94A3B8";
export const ACCENT = "#0EA5E9";
export const ACCENT_FILL = "rgba(14, 165, 233, 0.14)";
export const EMERALD = "#10B981";
export const AMBER = "#F59E0B";
export const RED = "#EF4444";
export const ROSE = "#E11D48";

// Light-theme global chart defaults
ChartJS.defaults.font.family = "Inter, sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = tickColor;
ChartJS.defaults.borderColor = gridColor;
ChartJS.defaults.plugins.tooltip.backgroundColor = "rgba(255,255,255,0.97)";
ChartJS.defaults.plugins.tooltip.titleColor = "#0F172A";
ChartJS.defaults.plugins.tooltip.bodyColor = "#475569";
ChartJS.defaults.plugins.tooltip.borderColor = "rgba(226,232,240,1)";
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.padding = 12;
ChartJS.defaults.plugins.tooltip.cornerRadius = 10;
ChartJS.defaults.plugins.tooltip.displayColors = true;
ChartJS.defaults.plugins.tooltip.boxPadding = 4;
ChartJS.defaults.plugins.legend.labels.color = "#64748B";

export default ChartJS;
