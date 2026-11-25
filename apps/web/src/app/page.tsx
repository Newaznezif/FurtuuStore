"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowUpRight, Check, Copy, Eye, EyeOff, Fingerprint, KeyRound, LockKeyhole,
  LogOut, Plus, Search, ShieldCheck, Trash2, UnlockKeyhole, X,
} from "lucide-react";
import {
  createVault, decryptItem, encryptItem, unlockVault,
  type EncryptedRecord, type VaultItem, type VaultRecord,
} from "@/lib/crypto";
import { getSupabase } from "@/lib/supabase";

type ViewState = "loading" | "signed-out" | "setup" | "locked" | "open";
const emptyItem = (): VaultItem => ({
  id: crypto.randomUUID(), title: "", username: "", password: "", url: "", notes: "", category: "Login",
});

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [configError, setConfigError] = useState("");
  const [view, setView] = useState<ViewState>("loading");
  const [vaultRecord, setVaultRecord] = useState<VaultRecord | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Supabase configuration is missing.");
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (authError) setError(authError.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError("");
      setMessage("");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!session?.user) {
      setView("signed-out");
      setVaultRecord(null);
      setVaultKey(null);
      setItems([]);
      return;
    }
    let cancelled = false;
    setView("loading");
    getSupabase().from("vaults").select("*").eq("user_id", session.user.id).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setView("locked");
          return;
        }
        if (!data) {
          setVaultRecord(null);
          setView("setup");
        } else {
          setVaultRecord(data as VaultRecord);
          setView("locked");
        }
      });
    return () => { cancelled = true; };
  }, [authReady, session?.user.id]);

  const lockVault = useCallback(() => {
    setVaultKey(null);
    setItems([]);
    setEditing(null);
    setMasterPassword("");
    setShowPassword({});
    setView(session ? "locked" : "signed-out");
  }, [session]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && vaultKey) lockVault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [vaultKey, lockVault]);

  const loadEncryptedItems = async (key: CryptoKey) => {
    if (!session?.user) throw new Error("Your session has expired. Sign in again.");
    const { data, error: queryError } = await getSupabase()
      .from("vault_items").select("*").eq("user_id", session.user.id).order("updated_at", { ascending: false });
    if (queryError) throw queryError;
    const decrypted = await Promise.all((data as EncryptedRecord[]).map((record) => decryptItem(record, key)));
    setItems(decrypted);
  };

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: signInError } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (signInError) throw signInError;
      setMessage("Check your email for the secure sign-in link. Keep this tab open.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the sign-in link.");
    } finally { setBusy(false); }
  };

  const handleCreateVault = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.user) return;
    setBusy(true); setError("");
    try {
      const { record, key } = await createVault(session.user.id, masterPassword);
      const { error: insertError } = await getSupabase().from("vaults").insert(record);
      if (insertError) throw insertError;
      setVaultRecord(record);
      setVaultKey(key);
      setItems([]);
      setMasterPassword("");
      setView("open");
      setMessage("Vault created. Your master password cannot be reset by FurtuuStore.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your vault.");
    } finally { setBusy(false); }
  };

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vaultRecord) return;
    setBusy(true); setError("");
    try {
      const key = await unlockVault(vaultRecord, masterPassword);
      await loadEncryptedItems(key);
      setVaultKey(key);
      setMasterPassword("");
      setView("open");
    } catch {
      setError("Unable to unlock. Check your master password or verify that the encrypted vault has not been changed.");
    } finally { setBusy(false); }
  };

  const handleSignOut = async () => {
    lockVault();
    await getSupabase().auth.signOut();
  };

  const saveItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.user || !vaultKey || !editing) return;
    setBusy(true); setError("");
    try {
      if (!editing.title.trim()) throw new Error("Add a name for this login.");
      const now = new Date().toISOString();
      const item = { ...editing, title: editing.title.trim(), updated_at: now, created_at: editing.created_at ?? now };
      const encrypted = await encryptItem(item, session.user.id, vaultKey);
      const { error: saveError } = await getSupabase().from("vault_items").upsert(encrypted, { onConflict: "id" });
      if (saveError) throw saveError;
      setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)].sort((a, b) => a.title.localeCompare(b.title)));
      setEditing(null);
      setMessage("Encrypted item saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this item.");
    } finally { setBusy(false); }
  };

  const deleteItem = async (item: VaultItem) => {
    if (!session?.user || !window.confirm(`Delete “${item.title}” from your vault?`)) return;
    setError("");
    const { error: deleteError } = await getSupabase().from("vault_items").delete().eq("id", item.id).eq("user_id", session.user.id);
    if (deleteError) setError(deleteError.message);
    else setItems((current) => current.filter((entry) => entry.id !== item.id));
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch { setError("Clipboard access was blocked by your browser."); }
  };

  const GateIcon = view === "setup" ? Fingerprint : UnlockKeyhole;

  const visibleItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter((item) => [item.title, item.username, item.url, item.category].some((v) => v.toLowerCase().includes(q)));
  }, [items, search]);

  if (!authReady || view === "loading") return <main className="screen-center"><div className="brand"><span className="brand-mark"><Fingerprint size={20} /></span>furtuu<span>store</span></div><p>Preparing your private vault…</p></main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FurtuuStore home"><span className="brand-mark"><Fingerprint size={20} /></span>furtuu<span>store</span></a>
        <div className="top-actions">
          {view === "open" && <span className="secure-label"><span className="status-dot" /> UNLOCKED ON THIS DEVICE</span>}
          {session && <button className="icon-button" onClick={view === "open" ? lockVault : handleSignOut} title={view === "open" ? "Lock vault" : "Sign out"}>{view === "open" ? <LockKeyhole size={17} /> : <LogOut size={17} />}</button>}
          <a className="github-link" href="https://github.com/NewazNezif/FurtuuStore" target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} /></a>
        </div>
      </header>

      {configError ? <section className="auth-panel"><div className="panel-icon"><ShieldCheck /></div><h1>Connection setup needed.</h1><p>{configError}</p><p className="muted">The project owner must configure the Supabase URL and publishable key in the deployment environment.</p></section> :
      view === "signed-out" ? <section className="auth-panel">
        <div className="eyebrow"><span className="pulse" /> PRIVATE BY DESIGN</div>
        <div className="panel-icon"><KeyRound size={25} /></div>
        <h1>Your passwords.<br /><em>Your control.</em></h1>
        <p>Sign in with an email link. Your master password is separate and is used only on this device to unlock your encrypted vault.</p>
        <form onSubmit={handleEmailSignIn} className="stack-form">
          <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="primary-button full" disabled={busy}>{busy ? "Sending link…" : "Send secure sign-in link"} <ArrowUpRight size={16} /></button>
        </form>
        <div className="notice"><LockKeyhole size={15} /> Email authentication does not encrypt your vault. Your master password does.</div>
      </section> :
      view === "setup" || view === "locked" ? <section className="auth-panel">
        <div className="panel-icon"><GateIcon size={25} /></div>
        <div className="eyebrow">{view === "setup" ? "FIRST-TIME SETUP" : "VAULT LOCKED"}</div>
        <h1>{view === "setup" ? <>Create your <em>private vault.</em></> : <>Welcome <em>back.</em></>}</h1>
        <p>{view === "setup" ? "Create a strong master password. It derives the key that encrypts your vault. FurtuuStore never receives it." : "Enter your master password to decrypt your vault locally on this device."}</p>
        <form onSubmit={view === "setup" ? handleCreateVault : handleUnlock} className="stack-form">
          <label htmlFor="master-password">Master password</label>
          <div className="password-input"><input id="master-password" type={showMasterPassword ? "text" : "password"} autoComplete="current-password" minLength={view === "setup" ? 12 : undefined} required value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder={view === "setup" ? "At least 12 characters" : "Enter your master password"} /><button type="button" className="reveal-button" onClick={() => setShowMasterPassword((v) => !v)} aria-label={showMasterPassword ? "Hide password" : "Show password"}>{showMasterPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <button className="primary-button full" disabled={busy}>{busy ? "Working…" : view === "setup" ? "Create encrypted vault" : "Unlock vault"} <ArrowUpRight size={16} /></button>
        </form>
        {view === "setup" && <div className="notice warning"><ShieldCheck size={15} /> There is no master-password reset. If you lose it, your encrypted vault cannot be recovered.</div>}
      </section> :
      <section className="workspace">
        <div className="workspace-heading"><div><div className="eyebrow"><span className="pulse" /> ZERO-KNOWLEDGE VAULT</div><h1>Your <em>vault.</em></h1><p>Secrets are encrypted in your browser before syncing.</p></div><button className="primary-button" onClick={() => setEditing(emptyItem())}><Plus size={17} /> Add login</button></div>
        <div className="stats-row"><div className="stat-card"><span>ITEMS</span><strong>{items.length}</strong></div><div className="stat-card"><span>ENCRYPTION</span><strong>AES-256-GCM</strong></div><div className="stat-card"><span>KEY DERIVATION</span><strong>ARGON2ID</strong></div></div>
        <div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles, usernames, websites…" /></div><span>{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}</span></div>
        {visibleItems.length ? <div className="item-grid">{visibleItems.map((item) => <article className="item-card" key={item.id}>
          <div className="item-head"><div className="item-symbol"><KeyRound size={19} /></div><div className="item-title"><h3>{item.title}</h3><span>{item.category || "Login"}</span></div><button className="subtle-icon danger" onClick={() => deleteItem(item)} title="Delete item"><Trash2 size={16} /></button></div>
          {item.url && <a className="item-url" href={item.url.startsWith("http") ? item.url : `https://${item.url}`} target="_blank" rel="noreferrer">{item.url} <ArrowUpRight size={12} /></a>}
          <div className="secret-row"><span className="field-label">USERNAME</span><div><span className="secret-value">{item.username || "—"}</span><button className="copy-button" onClick={() => copyValue(item.username, item.id + "-u")} aria-label="Copy username">{copied === item.id + "-u" ? <Check size={14} /> : <Copy size={14} />}</button></div></div>
          <div className="secret-row"><span className="field-label">PASSWORD</span><div><span className="secret-value">{showPassword[item.id] ? item.password : "••••••••••••"}</span><button className="copy-button" onClick={() => setShowPassword((v) => ({ ...v, [item.id]: !v[item.id] }))} aria-label="Toggle password visibility">{showPassword[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}</button><button className="copy-button" onClick={() => copyValue(item.password, item.id + "-p")} aria-label="Copy password">{copied === item.id + "-p" ? <Check size={14} /> : <Copy size={14} />}</button></div></div>
          {item.notes && <p className="item-notes">{item.notes}</p>}
          <button className="edit-button" onClick={() => setEditing({ ...item })}>Edit details</button>
        </article>)}</div> : <div className="empty-state"><div className="panel-icon"><LockKeyhole size={24} /></div><h2>{search ? "No matching entries." : "Your vault is empty."}</h2><p>{search ? "Try another search term." : "Add your first login. It will be encrypted before it leaves this browser."}{""}</p>{!search && <button className="primary-button" onClick={() => setEditing(emptyItem())}><Plus size={16} /> Add your first login</button>}</div>}
      </section>}

      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}><section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><div className="eyebrow">ENCRYPTED ENTRY</div><h2 id="modal-title">{items.some((i) => i.id === editing.id) ? "Edit login" : "New login"}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button></div>
        <form className="stack-form" onSubmit={saveItem}>
          <label>Title<input autoFocus required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Email account" /></label>
          <div className="form-two"><label>Username / email<input value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} autoComplete="off" /></label><label>Category<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}><option>Login</option><option>Banking</option><option>Work</option><option>Social</option><option>Identity</option><option>Other</option></select></label></div>
          <label>Password<div className="password-input"><input value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} autoComplete="new-password" /><button type="button" className="reveal-button" onClick={() => setEditing({ ...editing, password: generatePassword() })}>Generate</button></div></label>
          <label>Website URL<input type="text" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://example.com" /></label>
          <label>Notes<textarea rows={3} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Encrypting…" : "Encrypt & save"} <Check size={16} /></button></div>
        </form>
      </section></div>}

      {(error || message) && <div className={`toast ${error ? "toast-error" : ""}`} role="status">{error || message}<button onClick={() => { setError(""); setMessage(""); }} aria-label="Dismiss"><X size={15} /></button></div>}
      <footer className="app-footer"><span>FURTUUSTORE · YOUR KEYS. YOUR PRIVACY.</span><span>Encrypted locally · Synced privately</span></footer>
    </main>
  );
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
