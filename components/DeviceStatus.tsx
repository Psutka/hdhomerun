"use client";

import { useEffect, useState } from "react";

export default function DeviceStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [deviceName, setDeviceName] = useState("");

  useEffect(() => {
    fetch("/api/device")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setStatus("offline");
        } else {
          setStatus("online");
          setDeviceName(d.FriendlyName || d.ModelNumber || "HDHomerun");
        }
      })
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-2 h-2 rounded-full transition-colors ${
          status === "checking"
            ? "bg-yellow-400 animate-pulse"
            : status === "online"
            ? "bg-accent-green"
            : "bg-accent-red"
        }`}
      />
      <span className="text-text-secondary">
        {status === "checking"
          ? "Connecting..."
          : status === "online"
          ? deviceName
          : "Device offline"}
      </span>
    </div>
  );
}
