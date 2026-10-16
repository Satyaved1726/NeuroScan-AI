import { useState, useMemo } from 'react';
import MaterialIcon from './MaterialIcon';
import EmptyState from './EmptyState';
import { useLanguage } from '../hooks/useLanguage';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

interface ClinicalTableProps {
  columns: TableColumn[];
  data: any[];
  searchKeys?: string[];
  searchPlaceholder?: string;
  renderRow: (row: any, index: number, visibleColumns: string[]) => React.ReactNode;
  title?: string;
  onExportCsvName?: string;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
}

export default function ClinicalTable({
  columns,
  data,
  searchKeys = [],
  searchPlaceholder = 'Search...',
  renderRow,
  title,
  onExportCsvName = 'export-report',
  searchQuery,
  onSearchQueryChange,
}: ClinicalTableProps) {
  const { t } = useLanguage();
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const isControlledSearch = searchQuery !== undefined;
  const activeSearchQuery = isControlledSearch ? searchQuery : localSearchQuery;
  const setActiveSearchQuery = isControlledSearch && onSearchQueryChange ? onSearchQueryChange : setLocalSearchQuery;
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSort = (key: string) => {
    if (sortField === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !hiddenColumns.includes(col.key));
  }, [columns, hiddenColumns]);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!activeSearchQuery.trim() || searchKeys.length === 0) return data;
    const query = activeSearchQuery.toLowerCase().trim();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [data, activeSearchQuery, searchKeys]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return sortDir === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortField, sortDir]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIdx, startIdx + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));

  // CSV Export utility
  const exportToCsv = () => {
    if (sortedData.length === 0) return;
    const activeHeaders = visibleColumns.map((col) => col.label).join(',');
    const rows = sortedData
      .map((row) =>
        visibleColumns
          .map((col) => {
            const cellVal = row[col.key];
            return cellVal !== undefined ? `"${String(cellVal).replace(/"/g, '""')}"` : '""';
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([activeHeaders + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${onExportCsvName}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans text-clinical-ink dark:text-white">

      {/* Control panel toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3.5 bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-clinical-border dark:border-slate-800 shadow-soft">

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-clinical-textSecondary">
            <MaterialIcon name="search" className="text-[16px]" />
          </span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={activeSearchQuery}
            onChange={(e) => {
              setActiveSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs font-semibold pl-9 pr-4 py-2 border border-clinical-border dark:border-slate-800 rounded-clinical bg-slate-50 dark:bg-slate-850 focus:outline-none focus:border-clinical-primary transition-colors text-clinical-ink dark:text-white placeholder-clinical-textSecondary"
          />
        </div>

        {/* Action controls */}
        <div className="flex gap-2 shrink-0">

          {/* Column Visibility Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="px-3.5 py-2 border border-clinical-border dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white text-xs font-bold rounded-clinical flex items-center gap-1.5 transition"
              title="Toggle Columns"
            >
              <MaterialIcon name="view_column" className="text-[16px]" />
              <span>{t('table_columns', 'Columns')}</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-[10px] border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] p-2.5 shadow-lg z-50 text-left space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block pb-1 border-b border-clinical-border dark:border-slate-700">
                  Select Visible Columns
                </span>
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-clinical-textPrimary dark:text-slate-350 select-none">
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-clinical-border text-clinical-primary focus:ring-clinical-primary h-3.5 w-3.5"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export to CSV button */}
          <button
            onClick={exportToCsv}
            disabled={sortedData.length === 0}
            className="px-3.5 py-2 border border-clinical-border dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white text-xs font-bold rounded-clinical flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download CSV report"
          >
            <MaterialIcon name="download" className="text-[16px]" />
            <span>{t('table_export', 'Export')}</span>
          </button>
        </div>

      </div>

      {/* Table grid layout container */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse responsive-table">

            {/* Sticky Table Header */}
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-clinical-border dark:border-slate-800 z-10">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`p-3.5 text-[10px] font-extrabold uppercase tracking-wider text-clinical-textSecondary select-none ${
                      col.sortable !== false ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.sortable !== false && sortField === col.key && (
                        <MaterialIcon
                          name={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          className="text-[12px] text-clinical-primary"
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body rows */}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {paginatedData.length > 0 ? (
                paginatedData.map((row, index) =>
                  renderRow(row, index, visibleColumns.map((c) => c.key))
                )
              ) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="p-8 text-center text-xs font-semibold text-clinical-textSecondary">
                    {t('table_no_records', 'No matching records found')}
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>

        {/* Interactive Pagination controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3.5 bg-slate-50/50 dark:bg-slate-805 border-t border-clinical-border dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="font-semibold text-clinical-textSecondary">
              Showing {Math.min(filteredData.length, (currentPage - 1) * rowsPerPage + 1)}-
              {Math.min(filteredData.length, currentPage * rowsPerPage)} of {filteredData.length} records
            </span>

            <div className="flex items-center gap-1.5">
              {/* Previous page */}
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-clinical-textSecondary disabled:opacity-40 transition"
              >
                <MaterialIcon name="chevron_left" className="text-[18px]" />
              </button>

              {/* Page indicator list */}
              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 rounded-clinical text-xs font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-clinical-primary text-white shadow-soft'
                        : 'text-clinical-textSecondary hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next page */}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-clinical-textSecondary disabled:opacity-40 transition"
              >
                <MaterialIcon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
