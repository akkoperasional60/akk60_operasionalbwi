import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Search, 
  HelpCircle, 
  ArrowRight, 
  Check, 
  Ship, 
  Truck, 
  Store,
  RefreshCw
} from 'lucide-react';
import { AreaMappingEntry, OfficialAreaItem, areaAutoMapper } from '../services/areaAutoMapper';

interface AreaAutoMappingSectionProps {
  areaMappings: Record<string, AreaMappingEntry>;
  officialAreas: OfficialAreaItem[];
  onMappingChange: (rawArea: string, targetOfficialArea: string) => void;
  onRequestCreateArea: (rawArea: string) => void;
  className?: string;
}

export const AreaAutoMappingSection: React.FC<AreaAutoMappingSectionProps> = ({
  areaMappings,
  officialAreas,
  onMappingChange,
  onRequestCreateArea,
  className = ''
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'unmapped' | 'suggested' | 'matched'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const mappingList = useMemo(() => {
    return Object.values(areaMappings);
  }, [areaMappings]);

  // Aggregate counters
  const counts = useMemo(() => {
    let matched = 0;
    let suggested = 0;
    let unmapped = 0;

    mappingList.forEach(m => {
      if (m.confidence === 'exact' || m.confidence === 'high') matched++;
      else if (m.confidence === 'suggested') suggested++;
      else unmapped++;
    });

    return { total: mappingList.length, matched, suggested, unmapped };
  }, [mappingList]);

  // Filtered mapping items
  const filteredItems = useMemo(() => {
    return mappingList.filter(item => {
      // Tab filter
      if (filterTab === 'matched' && item.confidence !== 'exact' && item.confidence !== 'high') return false;
      if (filterTab === 'suggested' && item.confidence !== 'suggested') return false;
      if (filterTab === 'unmapped' && item.confidence !== 'unmapped') return false;

      // Search query
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const rawMatch = item.rawArea.toLowerCase().includes(q);
        const officialMatch = item.matchedOfficialArea?.toLowerCase().includes(q);
        const reasonMatch = item.similarityReason.toLowerCase().includes(q);
        if (!rawMatch && !officialMatch && !reasonMatch) return false;
      }

      return true;
    });
  }, [mappingList, filterTab, searchTerm]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Header with Stats & Filter Tabs */}
      <div className="bg-slate-50 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Pemetaan Area Cerdas (Auto-Mapping)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                  {counts.matched}/{counts.total} Terpetakan
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mendeteksi nama area spreadsheet &amp; menyelaraskannya dengan daftar resmi tabel &lsquo;Jadwal Pengiriman &amp; Muat&rsquo;.
              </p>
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari area spreadsheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs focus:border-emerald-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Quick status tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900'
            }`}
          >
            Semua ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('matched')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'matched'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Terpetakan Otomatis ({counts.matched})</span>
          </button>

          {counts.suggested > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab('suggested')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'suggested'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Saran Cerdas ({counts.suggested})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterTab('unmapped')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'unmapped'
                ? 'bg-rose-600 text-white shadow-xs'
                : counts.unmapped > 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60 font-black animate-pulse'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Belum Terdaftar ({counts.unmapped})</span>
          </button>
        </div>
      </div>

      {/* 2. Mapping Items Table / List */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <th className="p-3 w-48 border-r border-slate-200 dark:border-slate-800">Area Asli di Spreadsheet</th>
              <th className="p-3 w-36 border-r border-slate-200 dark:border-slate-800">Status Deteksi</th>
              <th className="p-3 border-r border-slate-200 dark:border-slate-800">Target Area Resmi di Jadwal</th>
              <th className="p-3 w-36 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  Tidak ada area yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isMatched = item.confidence === 'exact' || item.confidence === 'high';
                const isSuggested = item.confidence === 'suggested';
                const isUnmapped = item.confidence === 'unmapped';

                return (
                  <tr 
                    key={item.rawArea}
                    className={`transition-colors ${
                      isUnmapped 
                        ? 'bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/60' 
                        : isSuggested 
                          ? 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Raw Area Cell */}
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{item.rawArea}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                        {item.occurrenceCount} ritase di spreadsheet
                      </span>
                    </td>

                    {/* Status Badge Cell */}
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                      {isMatched && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Terpetakan ({item.confidenceScore}%)</span>
                          </span>
                          <span className="text-[9px] text-slate-500 block leading-tight">
                            {item.similarityReason}
                          </span>
                        </div>
                      )}

                      {isSuggested && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                            <HelpCircle className="w-3 h-3 text-amber-600" />
                            <span>Saran ({item.confidenceScore}%)</span>
                          </span>
                          <span className="text-[9px] text-slate-500 block leading-tight">
                            {item.similarityReason}
                          </span>
                        </div>
                      )}

                      {isUnmapped && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Belum Dikenali</span>
                          </span>
                          <span className="text-[9px] text-rose-600 dark:text-rose-400 block leading-tight">
                            Belum ada di katalog jadwal
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Official Target Select Cell */}
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.matchedOfficialArea || ''}
                          onChange={(e) => {
                            if (e.target.value === '__CREATE_NEW__') {
                              onRequestCreateArea(item.rawArea);
                            } else {
                              onMappingChange(item.rawArea, e.target.value);
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold transition focus:outline-hidden ${
                            isUnmapped
                              ? 'bg-rose-50 dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-emerald-500'
                          }`}
                        >
                          <option value="">-- Pilih Area Resmi Jadwal --</option>
                          <option value="__CREATE_NEW__" className="text-emerald-600 font-black">
                            + [Buat Area Baru untuk &apos;{item.rawArea}&apos;...]
                          </option>
                          <optgroup label="Daftar Area Resmi di Jadwal:">
                            {officialAreas.map((area) => (
                              <option key={area.id} value={area.name}>
                                {area.name} ({area.city} - {area.island})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {item.matchedOfficialArea && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-emerald-500" />
                          <span>Akan disimpan ke jadwal sebagai: <strong>{item.matchedOfficialArea}</strong></span>
                        </div>
                      )}
                    </td>

                    {/* Action Cell */}
                    <td className="p-3 text-center">
                      {isUnmapped ? (
                        <button
                          type="button"
                          onClick={() => onRequestCreateArea(item.rawArea)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap active:scale-95"
                          title="Buat area baru sekarang"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Buat Area</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRequestCreateArea(item.rawArea)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                          title="Atau buat area kustom baru"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Buat Baru</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
