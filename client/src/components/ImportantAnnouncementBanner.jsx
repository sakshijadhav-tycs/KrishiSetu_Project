import { useEffect, useMemo, useState } from "react";

const TimeBox = ({ label, value }) => (
  <div className="min-w-[52px] rounded-md border border-white/25 bg-black/15 px-2.5 py-1.5 text-center">
    <div className="text-sm font-black leading-none sm:text-base">
      {String(value).padStart(2, "0")}
    </div>
    <div className="mt-1 text-[10px] text-white/85">{label}</div>
  </div>
);

const ImportantAnnouncementBanner = ({
  title = "Important Announcement",
  subtitle = "",
  expiryAt,
  isPermanent = false,
  topOffsetClass = "top-20",
  onDismiss,
  onExpire,
}) => {
  const targetTime = useMemo(() => new Date(expiryAt).getTime(), [expiryAt]);
  const [visible, setVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ total: 0, hours: 0, minutes: 0, seconds: 0 });

  const computeTimeLeft = () => {
    const total = targetTime - Date.now();
    const safe = Math.max(total, 0);
    return {
      total,
      hours: Math.floor((safe / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((safe / (1000 * 60)) % 60),
      seconds: Math.floor((safe / 1000) % 60),
    };
  };

  const closeBanner = () => {
    setVisible(false);
    if (typeof onDismiss === "function") onDismiss();
  };

  useEffect(() => {
    if (isPermanent) {
      setVisible(true);
      return;
    }

    if (!expiryAt || Number.isNaN(targetTime)) {
      setVisible(false);
      return;
    }

    const first = computeTimeLeft();
    setTimeLeft(first);
    if (first.total <= 0) {
      setVisible(false);
      if (typeof onExpire === "function") onExpire();
      return;
    }

    const interval = setInterval(() => {
      const next = computeTimeLeft();
      setTimeLeft(next);
      if (next.total <= 0) {
        clearInterval(interval);
        setVisible(false);
        if (typeof onExpire === "function") onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryAt, targetTime, isPermanent]);

  if (!visible) return null;

  return (
    <div className={`sticky ${topOffsetClass} z-40 px-3 pt-2 sm:px-4 sm:pt-3`}>
      <div className="mx-auto w-full max-w-7xl rounded-2xl border border-white/25 bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 text-white shadow-[0_16px_35px_rgba(239,68,68,0.22)] animate-[pulse_4s_ease-in-out_infinite]">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold leading-tight sm:text-base">{title}</h2>
            <p className="mt-0.5 text-xs text-white/95 sm:text-sm">
              {subtitle || "Please take action before this announcement expires."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
            {!isPermanent ? (
              <div className="flex items-center gap-2">
                <TimeBox label="HRS" value={timeLeft.hours} />
                <span className="font-black">:</span>
                <TimeBox label="MIN" value={timeLeft.minutes} />
                <span className="font-black">:</span>
                <TimeBox label="SEC" value={timeLeft.seconds} />
              </div>
            ) : (
              <div className="rounded-md border border-white/25 bg-black/15 px-3 py-2 text-xs font-bold">
                Permanent Notice
              </div>
            )}
            <button
              type="button"
              onClick={closeBanner}
              className="rounded-md border border-white/35 bg-white/20 px-3 py-2 text-xs font-semibold transition hover:bg-white/30"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportantAnnouncementBanner;
