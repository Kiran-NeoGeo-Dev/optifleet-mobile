import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
import type { AlertNotification } from "../hooks/useAlertNotifications";

interface RawNotification {
  key:         string;
  source:      string;
  vehicleId:   string;
  driverName:  string;
  alertType:   string;
  description: string;
  lat:         number | null;
  lng:         number | null;
  timestamp:   string | null;
  isResolved:  boolean;
}

const ALERT_META: Record<string, { emoji: string; color: string; label: string }> = {
  OVERSPEED:          { emoji: "🚨", color: "#EF4444", label: "Overspeed"          },
  ROUTE_DEVIATION:    { emoji: "📍", color: "#F97316", label: "Route Deviation"    },
  DROWSINESS:         { emoji: "😴", color: "#EAB308", label: "Drowsiness"         },
  MOBILE_USAGE:       { emoji: "📱", color: "#3B82F6", label: "Mobile Usage"       },
  SMOKING:            { emoji: "🚭", color: "#6B7280", label: "Smoking"            },
  HARSH_BRAKING:      { emoji: "🛑", color: "#DC2626", label: "Harsh Braking"      },
  HARSH_ACCELERATION: { emoji: "⚡", color: "#D97706", label: "Harsh Acceleration" },
  RASH_TURNING:       { emoji: "↪️", color: "#DB2777", label: "Rash Turning"       },
};

const toHHMM = (ts: string | null): string => {
  if (!ts) return "--:--";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "--:--";
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch { return "--:--"; }
};

/**
 * Fetches notifications and merges with existing read state.
 * readKeys: Set of notification keys the user has already read.
 */
export const fetchNotifications = async (
  readKeys: Set<string> = new Set()
): Promise<AlertNotification[]> => {
  const res = await api.get<RawNotification[]>(ENDPOINTS.NOTIFICATIONS);
  return res.data.map((r) => {
    const meta = ALERT_META[r.alertType] ?? { emoji: "🔔", color: "#94A3B8", label: r.alertType };
    const key  = r.key ?? `${r.vehicleId}_${r.alertType}_${r.timestamp ?? ""}`;
    return {
      id:      key,
      emoji:   meta.emoji,
      color:   meta.color,
      label:   meta.label,
      vehicle: r.vehicleId  ?? "Unknown",
      driver:  r.driverName ?? "Unknown",
      status:  r.isResolved ? "Resolved" : "Active",
      detail:  r.description ?? meta.label,
      time:    toHHMM(r.timestamp),
      read:    readKeys.has(key),
      isActive: !r.isResolved,
    };
  });
};

// Notifications are derived from live ThingsBoard telemetry and are not persisted.
// These functions are intentional no-ops — read/clear state is managed locally in each screen.
export const markAllNotificationsRead = async (): Promise<void> => {};

export const clearAllNotifications = async (): Promise<void> => {};
