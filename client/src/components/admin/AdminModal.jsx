const AdminModal = ({ title, children, onClose, primaryAction, secondaryAction }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-5 py-2 rounded-xl border border-green-600 text-xs font-bold text-green-700 hover:bg-green-50 transition shadow-sm"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="px-5 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminModal;

