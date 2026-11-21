import { useState } from 'react';
import { actions, useStore } from '../store/store';
import { useMoney } from '../components/useMoney';
import { Field, Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { parseMoney } from '../lib/pricing';
import { cx, uid } from '../lib/util';
import type { MenuItem } from '../lib/types';

export default function MenuManager() {
  const money = useMoney();
  const { menu, categories } = useStore((s) => ({ menu: s.menu, categories: s.categories }));
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [q, setQ] = useState('');
  const [newCat, setNewCat] = useState<string | null>(null);

  const blank = (): MenuItem => ({ id: uid('m'), name: '', categoryId: categories[0]?.id ?? '', price: 0, available: true, station: 'kitchen' });
  const match = (m: MenuItem) => m.name.toLowerCase().includes(q.trim().toLowerCase());

  return (
    <>
      <div className="page-head">
        <h1>Menu</h1>
        <span className="muted">{menu.length} items · {menu.filter((m) => !m.available).length} unavailable</span>
        <div className="spacer" />
        <input className="input search" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setNewCat('')}>+ Category</button>
        <button className="btn primary" onClick={() => setEditing(blank())}>+ Item</button>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        {categories.map((c) => {
          const items = menu.filter((m) => m.categoryId === c.id && match(m));
          if (q && !items.length) return null;
          return (
            <div className="card" key={c.id}>
              <div className="card-head"><h2>{c.name}</h2><span className="muted small">{items.length} items</span></div>
              {items.length === 0 ? (
                <div className="empty">No items yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Item</th><th>Station</th><th style={{ textAlign: 'right' }}>Price</th><th>Available</th><th /></tr></thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div style={{ fontWeight: 500 }} className={cx(!m.available && 'muted')}>{m.name}</div>
                            {m.description && <div className="small muted">{m.description}</div>}
                          </td>
                          <td><span className={cx('pill', m.station === 'bar' ? 'violet' : 'neutral')}>{m.station}</span></td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(m.price)}</td>
                          <td>
                            <input
                              type="checkbox"
                              className="toggle"
                              checked={m.available}
                              aria-label={`${m.name} available`}
                              onChange={() => {
                                actions.toggleAvailable(m.id);
                                toast(m.available ? `${m.name} marked 86'd` : `${m.name} back on`);
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}><button className="btn sm ghost" onClick={() => setEditing(m)}>Edit</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && <ItemForm initial={editing} onClose={() => setEditing(null)} />}
      {newCat !== null && (
        <Modal
          title="New category"
          onClose={() => setNewCat(null)}
          footer={<><button className="btn" onClick={() => setNewCat(null)}>Cancel</button><button className="btn primary" disabled={!newCat.trim()} onClick={() => { actions.addCategory(newCat.trim()); setNewCat(null); }}>Add</button></>}
        >
          <Field label="Name"><input className="input" autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Specials" /></Field>
        </Modal>
      )}
    </>
  );
}

function ItemForm({ initial, onClose }: { initial: MenuItem; onClose: () => void }) {
  const { categories, exists } = useStore((s) => ({ categories: s.categories, exists: s.menu.some((m) => m.id === initial.id) }));
  const [m, setM] = useState(initial);
  const [price, setPrice] = useState(initial.price ? String(initial.price / 100) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parsed = parseMoney(price);
  const valid = m.name.trim() && m.categoryId && parsed > 0;

  return (
    <Modal
      title={exists ? 'Edit item' : 'New item'}
      onClose={onClose}
      footer={
        <>
          {exists && (
            confirmDelete ? (
              <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { actions.deleteMenuItem(m.id); toast('Item deleted'); onClose(); }}>Confirm delete</button>
            ) : (
              <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDelete(true)}>Delete</button>
            )
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={() => { actions.upsertMenuItem({ ...m, name: m.name.trim(), price: parsed }); toast('Menu saved'); onClose(); }}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="full"><Field label="Name"><input className="input" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} autoFocus /></Field></div>
        <Field label="Category">
          <select className="input" value={m.categoryId} onChange={(e) => setM({ ...m, categoryId: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Price" hint={price && Number.isNaN(parsed) ? 'Enter a number like 1250 or 12.50' : undefined}>
          <input className="input num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Prep station">
          <select className="input" value={m.station} onChange={(e) => setM({ ...m, station: e.target.value as MenuItem['station'] })}>
            <option value="kitchen">Kitchen</option>
            <option value="bar">Bar</option>
          </select>
        </Field>
        <Field label="Available">
          <input type="checkbox" className="toggle" checked={m.available} onChange={(e) => setM({ ...m, available: e.target.checked })} />
        </Field>
        <div className="full"><Field label="Description"><textarea className="input" rows={2} value={m.description ?? ''} onChange={(e) => setM({ ...m, description: e.target.value || undefined })} /></Field></div>
      </div>
    </Modal>
  );
}
