const AdminTable = ({ columns, rows, getRowId, emptyMessage }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-green-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  {emptyMessage || "No data available."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  className="border-t border-gray-50 hover:bg-green-50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminTable;

