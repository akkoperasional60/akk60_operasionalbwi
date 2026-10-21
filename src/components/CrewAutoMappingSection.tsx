import React, { useState, useMemo } from 'react';
import { 
  User, 
  Users, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Search, 
  ArrowRight, 
  Check, 
  Shield, 
  Phone
} from 'lucide-react';
import { CrewMappingEntry, OfficialCrewItem } from '../services/crewAutoMapper';

interface CrewAutoMappingSectionProps {
  crewMappings: Record<string, CrewMappingEntry>;
  officialCrews: OfficialCrewItem[];
  onMappingChange: (rawCrewName: string, targetCrewName: string) => void;
  onRequestCreateCrew: (rawCrewName: string, roleHint?: 'Driver' | 'Helper') => void;
  className?: string;
}

export const CrewAutoMappingSection: React.FC<CrewAutoMappingSectionProps> = ({
  crewMappings,
  officialCrews,
  onMappingChange,
  onRequestCreateCrew,
  className = ''
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'unmapped' | 'suggested' | 'matched'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const mappingList = useMemo(() => {
    return Object.values(crewMappings);
  }, [crewMappings]);

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
        const rawMatch = item.rawName.toLowerCase().includes(q);
        const officialMatch = item.matchedCrewName?.toLowerCase().includes(q);
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
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Pemetaan Kru Cerdas (Driver &amp; Helper)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50">
                  {counts.matched}/{counts.total} Terpetakan
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mendeteksi nama pengemudi &amp; kernet dari spreadsheet dan menyelaraskannya dengan database resmi AKK.
              </p>
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama kru..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs focus:border-blue-500 focus:outline-hidden"
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
            Semua Kru ({counts.total})
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
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Perlu Ditinjau ({counts.suggested})</span>
            </button>
          )}

          {counts.unmapped > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab('unmapped')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'unmapped'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Belum Terdaftar ({counts.unmapped})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Mapping Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <th className="p-3 w-1/4">Nama Kru di Spreadsheet</th>
              <th className="p-3 w-1/4">Status Deteksi Cerdas</th>
              <th className="p-3 w-2/5">Target Kru Resmi di Database AKK</th>
              <th className="p-3 w-24 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-medium bg-white dark:bg-slate-900/40">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  Tidak ada kru yang sesuai dengan filter pencarian saat ini.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isExact = item.confidence === 'exact';
                const isHigh = item.confidence === 'high';
                const isSuggested = item.confidence === 'suggested';
                const isUnmapped = item.confidence === 'unmapped';

                return (
                  <tr 
                    key={item.rawName}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-850/50 transition ${
                      isUnmapped ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Raw Name Cell */}
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">
                            {item.rawName}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {item.occurrenceCount} penugasan di spreadsheet
                            {item.roleHint && ` • Posisi: ${item.roleHint}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Confidence Status Cell */}
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                      {(isExact || isHigh) && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Terpetakan ({item.confidenceScore}%)</span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                            {item.similarityReason}
                          </span>
                        </div>
                      )}

                      {isSuggested && (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Saran ({item.confidenceScore}%)</span>
                          </span>
                          <span className="text-[10px] text-amber-700 dark:text-amber-300/80 block leading-tight">
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
                            Belum ada di database kru resmi
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Official Target Select Cell */}
                    <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.matchedCrewName || ''}
                          onChange={(e) => {
                            if (e.target.value === '__CREATE_NEW__') {
                              onRequestCreateCrew(item.rawName, item.roleHint);
                            } else {
                              onMappingChange(item.rawName, e.target.value);
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold transition focus:outline-hidden ${
                            isUnmapped
                              ? 'bg-rose-50 dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500'
                          }`}
                        >
                          <option value="">-- Pilih Kru Resmi Database --</option>
                          <option value="__CREATE_NEW__" className="text-blue-600 font-black">
                            + [Daftarkan Kru Baru &apos;{item.rawName}&apos;...]
                          </option>
                          <optgroup label={`Daftar Kru Resmi AKK (${officialCrews.length} Personel):`}>
                            {officialCrews.map((crew) => (
                              <option key={crew.id} value={crew.name}>
                                {crew.name} ({crew.role} • SIM {crew.licenseType})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {item.matchedCrewName && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-blue-500" />
                          <span>Akan dicatat sebagai: <strong>{item.matchedCrewName}</strong></span>
                        </div>
                      )}
                    </td>

                    {/* Action Cell */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRequestCreateCrew(item.rawName, item.roleHint)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                        title="Daftarkan kru baru"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isUnmapped ? 'Daftar' : 'Buat Baru'}</span>
                      </button>
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
