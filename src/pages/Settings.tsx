import { useRef, useState } from 'react';
import { actions, getState, useStore } from '../store/store';
import { Field, Modal } from '../components/Modal';
import { toast } from '../components/Toast';

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const [form, setForm] = useState(settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const pctOk = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  const valid = form.restaurantName.trim() && /^[A-Z]{3}$/.test(form.currency) && pctOk(form.taxPct) && pctOk(form.serviceChargePct);

  function backup() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' }));
    a.download = `tableturn-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(file: File) {
    try {
      actions.importState(JSON.parse(await file.text()));
      setForm(getState().settings);
      toast('Backup restored');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read backup', 'err');
    }
  }

  return (
    <>
      <div className="page-head"><h1>Settings</h1></div>
      <div className="grid" style={{ maxWidth: 720 }}>
        <div className="card">
          <div className="card-head"><h2>Restaurant</h2></div>
          <div className="card-pad form-grid">
            <div className="full"><Field label="Restaurant name"><input className="input" value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} /></Field></div>
            <Field label="Currency (ISO code)" hint="e.g. PKR, USD, GBP, AED"><input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
            <div />
            <Field label="Sales tax %"><input className="input num" type="number" min={0} max={100} step={0.5} value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: Number(e.target.value) })} /></Field>
            <Field label="Service charge %"><input className="input num" type="number" min={0} max={100} step={0.5} value={form.serviceChargePct} onChange={(e) => setForm({ ...form, serviceChargePct: Number(e.target.value) })} /></Field>
          </div>
          <div className="modal-foot">
            <button className="btn" disabled={!dirty} onClick={() => setForm(settings)}>Discard</button>
            <button className="btn primary" disabled={!dirty || !valid} onClick={() => { actions.updateSettings({ ...form, restaurantName: form.restaurantName.trim() }); toast('Settings saved'); }}>Save changes</button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Data</h2></div>
          <div className="card-pad stack">
            <p className="muted" style={{ margin: 0 }}>All data is stored locally in this browser. Download a backup regularly, or restore one on another device.</p>
            <div className="row-flex" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={backup}>Download backup</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>Restore backup…</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
              <button className="btn danger" onClick={() => setConfirmReset(true)}>Reset demo data</button>
            </div>
          </div>
        </div>
      </div>

      {confirmReset && (
        <Modal
          title="Reset to demo data?"
          onClose={() => setConfirmReset(false)}
          footer={<><button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button><button className="btn primary" style={{ background: 'var(--err)', borderColor: 'var(--err)' }} onClick={() => { actions.resetDemo(); setForm(getState().settings); setConfirmReset(false); toast('Demo data restored'); }}>Reset everything</button></>}
        >
          <p style={{ margin: 0 }}>This replaces all orders, menu, guests and bookings in this browser with the sample restaurant. It can't be undone unless you have a backup.</p>
        </Modal>
      )}
    </>
  );
}
