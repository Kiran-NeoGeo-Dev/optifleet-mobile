import { useRef, useState, useCallback } from "react";
import * as Speech from "expo-speech";

export interface PopupData {
  vehicleId:      string;
  status:         string;
  driverName:     string;
  speed:          string;
  overspeed:      string;
  smoking:        string;
  mobileUsage:    string;
  drowsiness:     string;
  routeDeviation: string;
}

export interface AlertNotification {
  id:      string;
  emoji:   string;
  color:   string;
  label:   string;
  vehicle: string;
  driver:  string;
  status:  string;
  detail:  string;
  time:    string; // HH:MM
  read:    boolean;
}

const ALERT_CONFIG: {
  key: keyof PopupData;
  emoji: string;
  color: string;
  label: string;
  trigger: (v: string) => boolean;
  voice: (vehicle: string, driver: string) => string;
}[] = [
  {
    key: "overspeed", emoji: "🚨", color: "#EF4444", label: "Overspeed",
    trigger: v => v === "Yes" || v === "True",
    voice: (v, d) => `Alert! Vehicle ${v}, driver ${d} is overspeeding.`,
  },
  {
    key: "routeDeviation", emoji: "📍", color: "#F97316", label: "Route Deviation",
    trigger: v => v === "Yes" || v === "True",
    voice: (v, d) => `Warning! Vehicle ${v}, driver ${d} has deviated from the route.`,
  },
  {
    key: "drowsiness", emoji: "😴", color: "#EAB308", label: "Drowsiness",
    trigger: v => v === "Fatigue" || v === "Yes",
    voice: (v, d) => `Alert! Driver ${d} on vehicle ${v} is showing signs of drowsiness.`,
  },
  {
    key: "mobileUsage", emoji: "📱", color: "#3B82F6", label: "Mobile Usage",
    trigger: v => v === "Yes" || v === "True",
    voice: (v, d) => `Warning! Driver ${d} on vehicle ${v} is using a mobile phone.`,
  },
  {
    key: "smoking", emoji: "🚭", color: "#6B7280", label: "Smoking",
    trigger: v => v === "Yes" || v === "True",
    voice: (v, d) => `Alert! Driver ${d} on vehicle ${v} is smoking.`,
  },
];

const AUTO_DISMISS_MS = 7000;

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const useAlertNotifications = () => {
  // toasts — auto-dismissed floating cards (top-right)
  const [toasts, setToasts]           = useState<AlertNotification[]>([]);
  // bell history — persistent list, never auto-dismissed
  const [bellHistory, setBellHistory] = useState<AlertNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Prevent re-firing same alert on every 5s poll
  const lastSeenRef = useRef<Record<string, string>>({});

  const processPopup = useCallback((popup: PopupData | null) => {
    if (!popup) return;
    const newAlerts: AlertNotification[] = [];

    for (const cfg of ALERT_CONFIG) {
      const value    = String(popup[cfg.key] ?? "");
      const cacheKey = `${popup.vehicleId}_${cfg.key}`;

      if (cfg.trigger(value) && lastSeenRef.current[cacheKey] !== value) {
        lastSeenRef.current[cacheKey] = value;
        const alert: AlertNotification = {
          id:      `${cacheKey}_${Date.now()}`,
          emoji:   cfg.emoji,
          color:   cfg.color,
          label:   cfg.label,
          vehicle: popup.vehicleId,
          driver:  popup.driverName,
          status:  popup.status ?? "Moving",
          detail:  `${cfg.label}: ${value}`,
          time:    nowTime(),
          read:    false,
        };
        newAlerts.push(alert);

        // Voice announcement
        Speech.speak(cfg.voice(popup.vehicleId, popup.driverName), { language: "en-IN" });
      } else if (!cfg.trigger(value)) {
        delete lastSeenRef.current[cacheKey];
      }
    }

    if (newAlerts.length === 0) return;

    // Add to toasts (auto-dismiss)
    setToasts(prev => [...prev, ...newAlerts]);
    newAlerts.forEach(a => {
      setTimeout(() => setToasts(prev => prev.filter(n => n.id !== a.id)), AUTO_DISMISS_MS);
    });

    // Add to bell history (persistent)
    setBellHistory(prev => [...newAlerts, ...prev]);
    setUnreadCount(prev => prev + newAlerts.length);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setBellHistory(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setBellHistory([]);
    setUnreadCount(0);
  }, []);

  return { toasts, bellHistory, unreadCount, processPopup, dismissToast, markAllRead, clearAll };
};
