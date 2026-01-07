import React, { useEffect, useRef, useState, useMemo, DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadDesignAssets, createDesignOrder, CreateDesignDto } from '../../api/designs';
import { fetchAccountProfile } from '../../api/account';
import { useNavigate } from 'react-router-dom';

export type CreateDesignModalProps = {
  open: boolean;
  onClose: () => void;
};

type Subtype = {
  key: string;
  label: string;
  credits: number;
  description?: string;
};

const SUBTYPES: Subtype[] = [
  { key: 'design_2d', label: '2D Design', credits: 1, description: 'Flat 2D artwork' },
  { key: 'design_3d', label: '3D Design', credits: 2, description: '3D rendering / mock' },
  { key: 'embroidery_text', label: 'Embroidery — Text', credits: 1.25, description: 'Text-only embroidery' },
  { key: 'embroidery_image', label: 'Embroidery — Image', credits: 1.75, description: 'Image embroidery' },
  { key: 'sidebow', label: 'Sidebow', credits: 1.5, description: 'Decorative sidebow' },
  { key: 'poster', label: 'Poster / Canvas', credits: 1.5, description: 'Poster or canvas print design' },
];

export const CreateDesignModal = ({ open, onClose }: CreateDesignModalProps) => {
  const [selected, setSelected] = useState<string | null>(SUBTYPES[0].key);
  const [files, setFiles] = useState<File[]>([]);
  const [instructions, setInstructions] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // fetch user account (for balance)
  const { data: account, isLoading: accountLoading } = useQuery({ queryKey: ['account','profile'], queryFn: fetchAccountProfile });

  const uploadMutation = useMutation({ mutationFn: (files: File[]) => uploadDesignAssets(files) });
  const createMutation = useMutation({
    mutationFn: (dto: CreateDesignDto) => createDesignOrder(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
    },
  });

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setInstructions('');
      setSelected(SUBTYPES[0].key);
      uploadMutation.reset();
      createMutation.reset();
    }
  }, [open]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt) return;
    const list = Array.from(dt.files).filter((f) => /image\/(png|jpeg|jpg)|application\/pdf/.test(f.type));
    if (list.length) setFiles((cur) => [...cur, ...list]);
  };

  const onSelectFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => /image\/(png|jpeg|jpg)|application\/pdf/.test(f.type));
    if (arr.length) setFiles((cur) => [...cur, ...arr]);
  };

  const removeFile = (index: number) => setFiles((f) => f.filter((_, i) => i !== index));

  const subtypeObj = SUBTYPES.find((s) => s.key === selected) ?? SUBTYPES[0];

  const estimatedCredits = useMemo(() => {
    const unit = subtypeObj?.credits ?? 0;
    return +(unit * Math.max(1, files.length)).toFixed(2);
  }, [subtypeObj, files.length]);

  const currentBalance = account?.totals?.balance ?? 0;
  const balanceAfter = +(currentBalance - estimatedCredits).toFixed(2);

  const disabled = !selected || files.length === 0 || currentBalance < estimatedCredits || uploadMutation.isLoading || createMutation.isLoading;

  const handleSubmit = async () => {
    if (!selected) return alert('Please select a design type');
    if (files.length === 0) return alert('Please attach at least one file');
    if (currentBalance < estimatedCredits) return alert('Insufficient credits');

    try {
      const upload = await uploadMutation.mutateAsync(files);
      const dto: CreateDesignDto = {
        designSubtype: selected,
        assetUrls: upload.urls,
        adminNote: instructions || undefined,
      };
      await createMutation.mutateAsync(dto);
      // simple success feedback then redirect
      navigate('/orders?view=design');
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to create design order');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold">Create design order</h3>
            <p className="text-sm text-slate-500">Choose a design type, attach assets, and submit. Credits are deducted when the studio accepts.</p>
          </div>
          <div>
            <button className="text-sm rounded-md px-3 py-1 hover:bg-slate-50" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* LEFT: Inputs */}
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold">Design type</label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {SUBTYPES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSelected(s.key)}
                    className={`text-left rounded-lg border p-3 hover:shadow-sm transition ${selected === s.key ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'}`}
                    aria-pressed={selected === s.key}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{s.label}</div>
                        <div className="text-xs text-slate-500">{s.description}</div>
                      </div>
                      <div className="text-sm font-semibold">{s.credits} cr</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Assets</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="mt-3 rounded-lg border-2 border-dashed border-slate-200 p-4 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" className="hidden" multiple accept="image/png,image/jpeg,application/pdf" onChange={(e) => onSelectFiles(e.target.files)} />
                <div className="text-sm text-slate-600">Drag & drop files here, or click to select. JPG, PNG, PDF. Multiple files allowed.</div>
              </div>

              <div className="mt-3 grid gap-2">
                {files.map((f, i) => (
                  <div key={f.name + i} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="flex items-center gap-3">
                      {f.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-slate-100 flex items-center justify-center text-xs">PDF</div>
                      )}
                      <div className="text-sm">
                        <div className="font-medium truncate max-w-xs">{f.name}</div>
                        <div className="text-xs text-slate-500">{(f.size / 1024).toFixed(0)} KB</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-rose-600" onClick={() => removeFile(i)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Instructions (optional)</label>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="mt-2 w-full rounded-lg border p-3 text-sm" placeholder="Tell the designer what you need (colors, size, reference links)..." />
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-md bg-sky-600 px-4 py-2 text-white font-semibold hover:bg-sky-700 disabled:opacity-60" onClick={handleSubmit} disabled={disabled}>
                {(uploadMutation.isLoading || createMutation.isLoading) ? 'Submitting…' : 'Submit design request'}
              </button>
              <button className="text-sm rounded-md px-3 py-2 hover:bg-slate-50" onClick={onClose}>Cancel</button>
            </div>
          </div>

          {/* RIGHT: Pricing summary */}
          <aside className="space-y-4">
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Pricing summary</h4>
              <div className="mt-3 text-sm text-slate-700">
                <div className="flex justify-between"><span>Design type</span><span className="font-semibold">{subtypeObj.label}</span></div>
                <div className="flex justify-between mt-2"><span>Credit cost</span><span className="font-semibold">{subtypeObj.credits} cr / unit</span></div>
                <div className="flex justify-between mt-2"><span>Files</span><span className="font-semibold">{files.length}</span></div>
                <div className="flex justify-between mt-3 border-t pt-3"><span>Total estimated</span><span className="font-semibold">{estimatedCredits} cr</span></div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Your balance</h4>
              <div className="mt-3 text-sm text-slate-700">
                <div className="flex justify-between"><span>Current</span><span className="font-semibold">{accountLoading ? 'Loading…' : `${currentBalance} cr`}</span></div>
                <div className="flex justify-between mt-2"><span>After submit</span><span className={`font-semibold ${balanceAfter < 0 ? 'text-rose-600' : ''}`}>{accountLoading ? '—' : `${balanceAfter} cr`}</span></div>
                <div className="mt-3 text-xs text-slate-500">Credits are deducted when the studio accepts the order.</div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Estimated processing time</h4>
              <div className="mt-2 text-xs text-slate-500">Typical turnaround: 24–72 hours depending on queue and complexity.</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CreateDesignModal;
