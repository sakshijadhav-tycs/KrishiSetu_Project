const AdminCard = ({ title, value, subtitle, icon: Icon, accent = "green", onClick }) => {
  const accentClasses =
    accent === "green"
      ? "bg-emerald-50 text-emerald-600"
      : accent === "orange"
      ? "bg-orange-50 text-orange-600"
      : accent === "red"
      ? "bg-rose-50 text-rose-600"
      : "bg-sky-50 text-sky-600";

  const baseClasses =
    "bg-white rounded-2xl shadow-md border border-green-100 p-6 flex flex-col gap-3 transform transition-all duration-300";
  const interactiveClasses = onClick
    ? "hover:shadow-xl hover:scale-[1.02] cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/40"
    : "hover:shadow-xl hover:scale-[1.02]";

  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-500">
          {title}
        </p>
        {Icon && (
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs ${accentClasses}`}
          >
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-green-800">{value}</p>
      {subtitle && (
        <p className="text-xs font-medium text-gray-500">{subtitle}</p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} ${interactiveClasses} text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={`${baseClasses} ${interactiveClasses}`}>{content}</div>;
};

export default AdminCard;

