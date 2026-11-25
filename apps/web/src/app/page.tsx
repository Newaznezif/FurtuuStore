import { ArrowUpRight, Fingerprint, KeyRound, ShieldCheck, LockKeyhole, Github } from "lucide-react";

const principles = [
  { icon: LockKeyhole, title: "Client-side encryption", body: "Vault contents are designed to be encrypted before they leave your device." },
  { icon: KeyRound, title: "Your keys stay yours", body: "The master password is never intended to reach the server." },
  { icon: ShieldCheck, title: "No hidden backdoor", body: "Recovery is designed around user-controlled recovery material." },
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="/" aria-label="FurtuuStore home"><span className="brand-mark"><Fingerprint size={21} /></span>furtuu<span>store</span></a>
        <a className="github-link" href="https://github.com/Newaznezif/FurtuuStore" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={15} /></a>
      </nav>
      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> PRIVATE BY DESIGN · IN DEVELOPMENT</div>
        <h1>Your keys.<br /><em>Your privacy.</em></h1>
        <p className="hero-copy">A password manager built around a simple principle: your secrets should remain yours. Encrypted on your device. Controlled by you.</p>
        <div className="hero-actions">
          <a className="primary-button" href="https://github.com/Newaznezif/FurtuuStore" target="_blank" rel="noreferrer">Explore the project <ArrowUpRight size={16} /></a>
          <span className="availability"><span className="status-dot" /> Early development</span>
        </div>
        <div className="vault-card" aria-label="Vault preview illustration">
          <div className="vault-top"><div className="window-dots"><i /><i /><i /></div><span>FURTUU VAULT <span className="vault-lock"><LockKeyhole size={12} /> LOCKED</span></span></div>
          <div className="vault-content"><div className="vault-icon"><Fingerprint size={29} /></div><div><div className="vault-title">Your vault, your control.</div><div className="vault-subtitle">Encryption architecture is under development.</div></div></div>
          <div className="vault-lines"><span /><span /><span /></div>
          <div className="vault-foot"><span>ZERO-KNOWLEDGE DIRECTION</span><span>FORMAT v0.1</span></div>
        </div>
      </section>
      <section className="principles">
        <div className="section-kicker">THE FOUNDATION</div>
        <h2>Privacy is not a feature.<br /><em>It is the architecture.</em></h2>
        <div className="principle-grid">{principles.map(({ icon: Icon, title, body }) => <article className="principle" key={title}><div className="principle-icon"><Icon size={19} /></div><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>
      <footer><a className="brand footer-brand" href="/">furtuu<span>store</span></a><span>Built with privacy at the core. Not yet for storing real credentials.</span><a href="https://github.com/Newaznezif/FurtuuStore" target="_blank" rel="noreferrer"><Github size={17} /></a></footer>
    </main>
  );
}
