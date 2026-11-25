"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
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
  const [accountPassword, setAccountPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationPending, setVerificationPending] = useState(false);
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
      if (nextSession) setVerificationPending(false);
      setError("");
      setMessage("");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      setView("signed-out");
      setVaultRecord(null);
      setVaultKey(null);
      setItems([]);
      return;
    }
    let cancelled = false;
    setView("loading");
    getSupabase().from("vaults").select("*").eq("user_id", userId).maybeSingle()
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
  }, [authReady, userId]);

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

  const handleAccountAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const client = getSupabase();
      if (authMode === "signup") {
        if (accountPassword.length < 8) throw new Error("Use at least 8 characters for your account password.");
        if (accountPassword !== confirmPassword) throw new Error("The account passwords do not match.");
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password: accountPassword,
          options: { emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || window.location.origin },
        });
        if (signUpError) throw signUpError;
        setAccountPassword(""); setConfirmPassword("");
        if (data.session) {
          setVerificationPending(false);
          setMessage("Account created. Now create your separate master password to protect your vault.");
        } else {
          setVerificationPending(true);
          setMessage("Registration was accepted, but email delivery is not confirmed. Check your inbox and spam folder. If no verification email arrives, use Resend verification below. Supabase may temporarily block repeated email requests.");
        }
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password: accountPassword });
        if (signInError) throw signInError;
        setAccountPassword("");
      }
    } catch (e) {
      setError(getAuthErrorMessage(e, "Authentication failed. Please try again."));
    } finally { setBusy(false); }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || resendCooldown > 0 || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: resendError } = await getSupabase().auth.resend({ type: "signup", email: email.trim(), options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || window.location.origin,
      }});
      if (resendError) throw resendError;
      setResendCooldown(60);
      setMessage("Supabase accepted the verification request, but cannot confirm inbox delivery. Check your inbox and spam folder.");
    } catch (e) {
      setError(getAuthErrorMessage(e, "Could not resend the verification email."));
    } finally { setBusy(false); }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || window.location.origin,
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for that email, a password-reset message has been sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request a password reset.");
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
        <Link className="brand" href="/" aria-label="FurtuuStore home"><span className="brand-mark"><Fingerprint size={20} /></span>furtuu<span>store</span></Link>
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
        <h1>{authMode === "signin" ? <>Your passwords.<br /><em>Your control.</em></> : <>Create your <em>account.</em></>}</h1>
        <p>{authMode === "signin" ? "Sign in with your email and account password. Your separate master password unlocks the encrypted vault." : "Create an account with your email and a password. You will use this password for future sign-ins."}</p>
        <form onSubmit={handleAccountAuth} className="stack-form">
          <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <label htmlFor="account-password">Account password</label><input id="account-password" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={8} required value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="At least 8 characters" />
          {authMode === "signup" && <><label htmlFor="confirm-password">Confirm account password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter the same password again" /></>}
          <button className="primary-button full" disabled={busy}>{busy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"} <ArrowUpRight size={16} /></button>
        </form>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:17,fontSize:12}}>
          <button type="button" className="edit-button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); setConfirmPassword(""); }}>{authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
          {authMode === "signin" && <button type="button" className="edit-button" disabled={busy} onClick={handlePasswordReset}>Forgot password?</button>}
          {verificationPending && <button type="button" className="edit-button" disabled={busy || resendCooldown > 0} onClick={handleResendVerification}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}</button>}
        </div>
        <div className="notice"><LockKeyhole size={15} /> Your account password signs you in. Your separate master password encrypts and unlocks the vault.</div>
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

function getAuthErrorMessage(error: unknown, fallback: string) {
  const authError = error as { message?: string; code?: string; status?: number };
  const message = authError?.message ?? "";
  const code = authError?.code ?? "";
  if (authError?.status === 429 || code === "over_email_send_rate_limit" || /email rate limit exceeded|too many requests/i.test(message)) {
    return "Supabase is temporarily rate-limiting email delivery. No new email was confirmed as sent. Wait before retrying; repeated requests will keep failing.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "This account's email is not verified yet. Resend the verification email and complete that step before signing in.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Email or account password is incorrect. If you just registered, verify your email first. If this account was created before password sign-in was added, use Forgot password to set an account password.";
  }
  return message || fallback;
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";
  const limit = 256 - (256 % alphabet.length);
  const output: string[] = [];
  while (output.length < 24) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    for (const byte of bytes) {
      if (byte < limit) output.push(alphabet[byte % alphabet.length]);
      if (output.length === 24) break;
    }
  }
  return output.join("");
}
