import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Layers3, Menu, Search } from 'lucide-react';
import { MarkdownView } from './MarkdownView.tsx';
import { sectionForAnchor } from './navigation.ts';
import type { Guide } from './types.ts';

const sourceBase = 'https://github.com/gitpavleenbali/azure-cost-optimizer-workshop/blob/main/';

export default function PublicGuide() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [selected, setSelected] = useState(location.hash.slice(1) || 'azure-cost-optimizer-workshop');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'guide.json').then(response => {
      if (!response.ok) throw new Error('Guide unavailable.');
      return response.json();
    }).then(setGuide);
  }, []);
  useEffect(() => {
    const changed = () => setSelected(location.hash.slice(1) || 'azure-cost-optimizer-workshop');
    addEventListener('hashchange', changed);
    addEventListener('popstate', changed);
    return () => {
      removeEventListener('hashchange', changed);
      removeEventListener('popstate', changed);
    };
  }, []);
  const current = guide ? sectionForAnchor(guide.sections, selected) ?? guide.sections[0] : null;
  const visible = useMemo(() => guide?.sections.filter(section => section.title.toLowerCase().includes(query.toLowerCase())) ?? [], [guide, query]);
  const currentIndex = current && guide ? guide.sections.indexOf(current) : -1;
  function navigate(id: string) {
    history.pushState(null, '', '#' + id);
    setSelected(id);
    setMenu(false);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }
  return (
    <div className="public-shell">
      <a className="skip-link" href="#public-main">Skip to content</a>
      {menu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenu(false)} />}
      <aside className={'public-sidebar ' + (menu ? 'is-open' : '')} aria-label="Workshop navigation">
        <a className="brand" href="#azure-cost-optimizer-workshop" onClick={() => setMenu(false)}>
          <span className="brand-mark"><Layers3 size={27} /></span>
          <span><strong>Azure Cost<br />Intelligence</strong><small>PUBLIC WORKSHOP GUIDE</small></span>
        </a>
        <div className="public-mode"><BookOpen size={18} /><div><strong>Read-only public guide</strong><span>Progress and facilitator tools run only in the secure tracker.</span></div></div>
        <label className="search-box nav-search"><Search size={16} /><input aria-label="Search workshop sections" placeholder="Find a section" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <nav className="public-nav" aria-label="Guide sections">
          {visible.map(section => <button key={section.id} className={section.id === current?.id ? 'active' : ''} aria-current={section.id === current?.id ? 'page' : undefined} onClick={() => navigate(section.id)}><span>{section.step ? String(section.step).padStart(2, '0') : '•'}</span>{section.title.replace(/^Step \d+: /, '')}</button>)}
        </nav>
        <a className="source-link" href="https://github.com/gitpavleenbali/azure-cost-optimizer-workshop">View source on GitHub</a>
      </aside>
      <section className="public-workspace">
        <header className="public-topbar"><button className="icon-button public-menu" aria-label="Open navigation" onClick={() => setMenu(true)}><Menu /></button><div><span className="eyebrow">HANDS-ON · TWO SPRINTS</span><strong>Azure Cost Optimizer Workshop</strong></div><span className="workshop-pill">Public field guide</span></header>
        <main id="public-main">
          {!current ? <div className="empty-state"><h1>Opening the field guide…</h1></div> : <article className="page-content guide-content">
            <div className="article-heading"><div><span className="eyebrow">{current.step ? `REQUIRED CHECKPOINT ${String(current.step).padStart(2, '0')} / 15` : 'OPTIONAL READING'}</span><h1>{current.title.replace(/^Step \d+: /, '').replace(/^Architecture \d+: /, '')}</h1></div></div>
            <MarkdownView section={current} progress={[]} signedIn={false} navigate={navigate} onTask={() => {}} referenceBase={sourceBase} readOnly />
            <nav className="page-navigation" aria-label="Adjacent sections">
              {currentIndex > 0 ? <button onClick={() => navigate(guide!.sections[currentIndex - 1].id)}><ArrowLeft /><span><small>Previous</small>{guide!.sections[currentIndex - 1].title.replace(/^Step \d+: /, '')}</span></button> : <span />}
              {guide && currentIndex < guide.sections.length - 1 && <button onClick={() => navigate(guide.sections[currentIndex + 1].id)}><span><small>Next</small>{guide.sections[currentIndex + 1].title.replace(/^Step \d+: /, '')}</span><ArrowRight /></button>}
            </nav>
          </article>}
        </main>
      </section>
    </div>
  );
}