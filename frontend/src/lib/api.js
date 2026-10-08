import axios from "axios";

const rawBackend = process.env.REACT_APP_BACKEND_URL || "";
export const BACKEND_URL = rawBackend.replace(/\/+$/, "");
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const fmtMoney = (n, currency = "USD", compact = true) => {
  if (n == null || isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 2 : 0,
    }).format(n);
  } catch {
    return `${currency} ${Number(n).toLocaleString()}`;
  }
};

export const fmtNum = (n, compact = true) => {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(n);
};

export default api;
