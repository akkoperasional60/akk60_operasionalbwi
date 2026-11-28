import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ClipboardCheck, Clock, Eraser, MapPin, PenTool, Truck, UserCheck, Users } from 'lucide-react';
import type { UserProfile } from '../../types';
import { branchStore } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';
import type { DepartureSignatureKey, DepartureValidationData, FieldTrip } from './crewModel';
import { Button, Dialog } from './CrewFieldUI';

interface SignatureBoxDef {
  key: DepartureSignatureKey;
  title: string;
  roleLabel: string;
}

const SIGNATURE_BOXES: SignatureBoxDef[] = [
  { key: 'spvLogistik', title: 'SPV Logistik', roleLabel: 'Validasi Keberangkatan' },
  { key: 'spvOperasional', title: 'SPV Operasional', roleLabel: 'Mengetahui' },
  { key: 'security', title: 'Security', roleLabel: 'Pemeriksa Gerbang' },
  { key: 'crew', title: 'Driver / Helper', roleLabel: 'Kru Pengiriman' }
];

function formatNowWib(): string {
  const now = new Date();
  const datePart = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
  const timePart = now
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      hour12: false
    })
    .replace('.', ':');
  return `${datePart} · ${timePart} WIB`;
}

function resolveBranchLabel(branchId: string): string {
  const b = branchStore.getBranchById(branchId);
  const raw = b?.name || (branchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara');
  return raw.replace(/^Cabang\s+/i, '').trim() || 'Nusantara';
}

function userMatchesBranchStrict(user: UserProfile, branchId: string): boolean {
  if (!branchId) return true;
  if (user.role === 'super_admin') {
    const bp = user.permissions?.branchPermissions;
    if (bp && Object.keys(bp).length > 0 && bp[branchId] !== undefined) {
      return Boolean(bp[branchId]?.enabled);
    }
    return true;
  }
  const bp = user.permissions?.branchPermissions;
  if (bp && Object.keys(bp).length > 0) {
    if (bp[branchId]?.enabled) return true;
    // Check if explicitly disabled when another branch is enabled
    const anyEnabledElsewhere = Object.entries(bp).some(([bId, entry]) => bId !== branchId && Boolean(entry?.enabled));
    if (anyEnabledElsewhere) return false;
  }
  const crewBranch = branchStore.getCrewBranchId(user.id, user.fullName);
  if (crewBranch) return crewBranch === branchId;
  return branchStore.canUserAccessBranch(user, branchId);
}

function resolveCandidatesByBox(
  users: UserProfile[],
  branchId: string,
  trip: FieldTrip,
  actorName: string
): Record<DepartureSignatureKey, string[]> {
  const approved = users.filter(u => u && u.status === 'approved' && String(u.fullName || '').trim());
  const inBranch = approved.filter(u => userMatchesBranchStrict(u, branchId));
  const pool = inBranch.length > 0 ? inBranch : approved;

  const uniqueNames = (list: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
      const clean = String(raw || '').trim();
      if (!clean || clean === '-') continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(clean);
      }
    }
    return out;
  };

  // 1. SPV Logistik
  const spvLogPrimary = pool.filter(u => u.role === 'spv_logistik');
  const spvLogFallback = inBranch.filter(
    u => u.role === 'dispatcher' || u.role === 'koordinator_driver'
  );
  const spvLogAny = approved.filter(u => u.role === 'spv_logistik');
  const spvLogistik = uniqueNames([
    ...spvLogPrimary.map(u => u.fullName),
    ...spvLogFallback.map(u => u.fullName),
    ...spvLogAny.map(u => u.fullName)
  ]);

  // 2. SPV Operasional (prioritize role 'operasional' or dept/title mentioning operasional in branch)
  const isOpUser = (u: UserProfile) =>
    u.role === 'operasional' ||
    String(u.department || '').toLowerCase().includes('operasional') ||
    String(u.notes || '').toLowerCase().includes('spv operasional');

  const spvOpPrimary = inBranch.filter(u => u.role === 'operasional');
  const spvOpSecondary = inBranch.filter(u => isOpUser(u) && u.role !== 'spv_logistik');
  const spvOpSuperAdmin = pool.filter(u => u.role === 'super_admin');
  const spvOpAny = approved.filter(u => u.role === 'operasional' || isOpUser(u));
  const spvOperasional = uniqueNames([
    ...spvOpPrimary.map(u => u.fullName),
    ...spvOpSecondary.map(u => u.fullName),
    ...spvOpSuperAdmin.map(u => u.fullName),
    ...spvOpAny.map(u => u.fullName)
  ]);

  // 3. Security
  const secPrimary = inBranch.filter(u => u.role === 'security');
  const secAny = approved.filter(u => u.role === 'security');
  const security = uniqueNames([
    ...secPrimary.map(u => u.fullName),
    ...secAny.map(u => u.fullName)
  ]);

  // 4. Driver / Helper
  const driverName = String(trip.driver?.name || '').trim();
  const helperName = String(trip.helper?.name || actorName || '').trim();
  const comboLabel =
    driverName && helperName && driverName.toLowerCase() !== helperName.toLowerCase()
      ? `${driverName} / ${helperName}`
      : driverName || helperName;
  const branchCrews = inBranch.filter(u => u.role === 'driver' || u.role === 'crew_helper');
  const crew = uniqueNames([
    comboLabel,
    driverName,
    helperName,
    ...branchCrews.map(u => u.fullName)
  ]);

  return { spvLogistik, spvOperasional, security, crew };
}

interface SignaturePadCardProps {
  def: SignatureBoxDef;
  value: string;
  signerName: string;
  candidates: string[];
  disabled?: boolean;
  onSignerChange: (key: DepartureSignatureKey, name: string) => void;
  onChange: (key: DepartureSignatureKey, dataUrl: string) => void;
}

const SignaturePadCard: React.FC<SignaturePadCardProps> = ({
  def,
  value,
  signerName,
  candidates,
  disabled,
  onSignerChange,
  onChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(200, Math.floor(rect.width || 220));
    const height = 104;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
    }
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    setupCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    const pt = getPoint(e);
    drawingRef.current = true;
    lastPointRef.current = pt;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
      ctx.stroke();
      hasStrokeRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
    hasStrokeRef.current = true;
  };

  const commitCanvas = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(def.key, dataUrl);
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(200, Math.floor(rect.width || 220));
      const height = 104;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
    }
    hasStrokeRef.current = false;
    onChange(def.key, '');
  };

  const signed = Boolean(value && value.startsWith('data:image/'));
  const selectOptions = useMemo(() => {
    const list = [...candidates];
    if (signerName && !list.some(c => c.toLowerCase() === signerName.toLowerCase())) {
      list.unshift(signerName);
    }
    return list;
  }, [candidates, signerName]);

  return (
    <div className={`cv75-sig-card ${signed ? 'cv75-sig-card--signed' : ''}`}>
      <div className="cv75-sig-head">
        <div className="cv75-sig-meta">
          <span className="cv75-sig-title">{def.title}</span>
          <span className="cv75-sig-role">{def.roleLabel}</span>
        </div>
        <div className="cv75-sig-actions">
          <span className={`cv75-badge ${signed ? 'cv75-badge--green' : 'cv75-badge--slate'}`}>
            {signed ? 'Sudah TTD' : 'Wajib'}
          </span>
          {signed && (
            <button
              type="button"
              className="cv75-clear-btn"
              disabled={disabled}
              aria-label={`Hapus tanda tangan ${def.title}`}
              onClick={handleClear}
            >
              <Eraser size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="cv75-sig-person">
        {selectOptions.length > 1 ? (
          <select
            className="cv75-sig-select"
            aria-label={`Pilih petugas ${def.title}`}
            value={signerName}
            disabled={disabled}
            onChange={e => onSignerChange(def.key, e.target.value)}
          >
            {selectOptions.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <div className="cv75-sig-name-row">
            <UserCheck size={12} />
            <span>{signerName || `Belum ada user ${def.title} di cabang ini`}</span>
          </div>
        )}
      </div>

      <div className="cv75-sig-pad-wrap">
        <canvas
          ref={canvasRef}
          className="cv75-sig-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitCanvas}
          onPointerCancel={commitCanvas}
          onPointerLeave={commitCanvas}
        />
        {!signed && (
          <span className="cv75-sig-placeholder">
            <PenTool size={13} /> Tanda tangan di sini
          </span>
        )}
      </div>
    </div>
  );
};

interface DepartureFormModalProps {
  trip: FieldTrip;
  actorName: string;
  busy?: boolean;
  qa?: boolean;
  notice?: React.ReactNode;
  onClose: () => void;
  onSubmit: (data: DepartureValidationData) => void;
}

export const DepartureFormModal: React.FC<DepartureFormModalProps> = ({
  trip,
  actorName,
  busy = false,
  qa = false,
  notice,
  onClose,
  onSubmit
}) => {
  const [users, setUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());
  const [signatures, setSignatures] = useState<Record<DepartureSignatureKey, string>>({
    spvLogistik: '',
    spvOperasional: '',
    security: '',
    crew: ''
  });
  const [signerNames, setSignerNames] = useState<Record<DepartureSignatureKey, string>>({
    spvLogistik: '',
    spvOperasional: '',
    security: '',
    crew: ''
  });
  const [clockLabel, setClockLabel] = useState<string>(() => formatNowWib());

  const branchName = useMemo(() => resolveBranchLabel(trip.branchId), [trip.branchId]);

  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      setUsers(logisticsStore.getUsers());
    });
    void logisticsStore.refreshUsersFromHostinger();
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setClockLabel(formatNowWib()), 15000);
    return () => clearInterval(t);
  }, []);

  const candidatesByBox = useMemo(
    () => resolveCandidatesByBox(users, trip.branchId, trip, actorName),
    [users, trip, actorName]
  );

  // Auto-fill signer names whenever role + branch candidates resolve, unless user manually picked another option
  useEffect(() => {
    setSignerNames(prev => {
      const next = { ...prev };
      let changed = false;
      (Object.keys(candidatesByBox) as DepartureSignatureKey[]).forEach(key => {
        const list = candidatesByBox[key];
        if (!next[key] && list.length > 0) {
          next[key] = list[0];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [candidatesByBox]);

  const signedCount = useMemo(
    () => SIGNATURE_BOXES.filter(box => Boolean(signatures[box.key]?.startsWith('data:image/'))).length,
    [signatures]
  );

  const isReady = signedCount === SIGNATURE_BOXES.length;

  const handleSigChange = useCallback((key: DepartureSignatureKey, dataUrl: string) => {
    setSignatures(prev => ({ ...prev, [key]: dataUrl }));
  }, []);

  const handleSignerChange = useCallback((key: DepartureSignatureKey, name: string) => {
    setSignerNames(prev => ({ ...prev, [key]: name }));
  }, []);

  const handleSave = () => {
    if (!isReady || busy) return;
    const nowIso = new Date().toISOString();
    const wibStamp = formatNowWib();
    const payload: DepartureValidationData = {
      summary: {
        branchId: trip.branchId,
        branchName,
        driverName: trip.driver?.name || '-',
        helperName: trip.helper?.name || actorName || '-',
        fleetLabel: trip.fleetLabel || '-',
        departureTime: trip.departureTime || '-',
        areaName: trip.area || '-',
        recordedAt: nowIso,
        recordedAtWib: wibStamp
      },
      checks: {
        waybillMatch: true,
        documentsReady: true
      },
      signerNames: {
        spvLogistik: signerNames.spvLogistik || candidatesByBox.spvLogistik[0] || '',
        spvOperasional: signerNames.spvOperasional || candidatesByBox.spvOperasional[0] || '',
        security: signerNames.security || candidatesByBox.security[0] || '',
        crew: signerNames.crew || candidatesByBox.crew[0] || ''
      },
      signatures: {
        spvLogistik: signatures.spvLogistik,
        spvOperasional: signatures.spvOperasional,
        security: signatures.security,
        crew: signatures.crew
      },
      signedAt: nowIso,
      signedBy: actorName || trip.helper?.name || 'Helper'
    };
    onSubmit(payload);
  };

  return (
    <Dialog title="Form Keluar & Validasi Keberangkatan" busy={busy} onClose={onClose}>
      {notice}

      <div className="cv75-flat-card cv75-summary-card">
        <div className="cv75-summary-head">
          <span className="cv75-badge cv75-badge--blue">
            <ClipboardCheck size={12} /> Ringkasan Keberangkatan
          </span>
          <span className="cv75-clock">{clockLabel}</span>
        </div>
        <div className="cv75-summary-grid">
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Building2 size={12} /> Cabang</span>
            <span className="cv75-summary-val">{branchName}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Clock size={12} /> Jam Berangkat</span>
            <span className="cv75-summary-val">{trip.departureTime ? `${trip.departureTime} WIB` : '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Truck size={12} /> Nama Driver</span>
            <span className="cv75-summary-val">{trip.driver?.name || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Users size={12} /> Nama Helper</span>
            <span className="cv75-summary-val">{trip.helper?.name || actorName || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Truck size={12} /> Mobil Kiriman</span>
            <span className="cv75-summary-val">{trip.fleetLabel || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><MapPin size={12} /> Area Kirim</span>
            <span className="cv75-summary-val">{trip.area || '-'}</span>
          </div>
        </div>
      </div>

      <div className="cv75-sig-section">
        <div className="cv75-sig-section-head">
          <span>Tanda Tangan Digital (4 Pihak · Cabang {branchName})</span>
          <span className={`cv75-badge ${signedCount === 4 ? 'cv75-badge--green' : 'cv75-badge--slate'}`}>
            {signedCount}/4 Lengkap
          </span>
        </div>
        <div className="cv75-sig-grid">
          {SIGNATURE_BOXES.map(def => (
            <SignaturePadCard
              key={def.key}
              def={def}
              value={signatures[def.key]}
              signerName={signerNames[def.key] || ''}
              candidates={candidatesByBox[def.key]}
              disabled={busy}
              onSignerChange={handleSignerChange}
              onChange={handleSigChange}
            />
          ))}
        </div>
      </div>

      <Button disabled={busy || !isReady} loading={busy} onClick={handleSave}>
        <Check size={18} />
        {isReady ? 'Simpan Form Keluar & Validasi' : `Lengkapi ${4 - signedCount} Tanda Tangan Tersisa`}
      </Button>
      {!qa && (
        <p className="cv66-meta cv66-gps">
          Waktu keluar, koordinat GPS, petugas validasi, dan 4 tanda tangan digital tersimpan ke server.
        </p>
      )}
    </Dialog>
  );
};
