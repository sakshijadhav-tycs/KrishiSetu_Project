const getStatusClasses = (status) => {
  const s = (status || "").toLowerCase();
  if (["pending", "open"].includes(s)) {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }
  if (["accepted", "completed", "resolved", "approved", "active"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
  if (["rejected", "cancelled", "suspended", "closed"].includes(s)) {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }
  if (["in_review", "in review"].includes(s)) {
    return "bg-sky-50 text-sky-700 border-sky-100";
  }
  return "bg-gray-50 text-gray-600 border-gray-100";
};

const StatusBadge = ({ status }) => {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.18em] ${getStatusClasses(
        status
      )}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;

