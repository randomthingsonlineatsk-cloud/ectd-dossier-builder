import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCtx } from './ctx.js';
import { db, getUser, getMeta, setMeta, saveProject, saveAttempt } from './engine/db.js';
import Home from './screens/Home.jsx';
import Learn from './screens/Learn.jsx';
import Lesson from './screens/Lesson.jsx';
import Missions from './screens/Missions.jsx';
import Workspace from './screens/Workspace.jsx';
import Compare from './screens/Compare.jsx';
import QuizBank from './screens/QuizBank.jsx';
import Classroom from './screens/Classroom.jsx';
import Glossary from './screens/Glossary.jsx';
import Progress from './screens/Progress.jsx';
import Drills from './screens/Drills.jsx';
import { migrateProject } from './engine/model.js';

function useHashRoute() {
  const read = () => (window.location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => { setParts(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
export const go = (path) => { window.location.hash = path; };

export default function App() {
  const route = useHashRoute();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [lessonProgress, setLessonProgress] = useState({});
  const [theme, setTheme] = useState('system');
  const [toasts, setToasts] = useState([]);
  const [dbError, setDbError] = useState(null);

  const toast = useCallback((text, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'info' ? 3500 : 7000);
  }, []);

  const reload = useCallback(async () => {
    const [p, a] = await Promise.all([db.all('projects'), db.all('attempts')]);
    p.forEach(migrateProject);
    p.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
    setProjects(p); setAttempts(a);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setUser(await getUser());
        setLessonProgress(await getMeta('lessons', {}));
        setTheme(await getMeta('theme', 'system'));
        await reload();
      } catch (e) {
        setDbError('Your browser blocked local storage (IndexedDB). Projects cannot be saved in this window; try a normal, non-private window.');
      }
    })();
  }, [reload]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  }, [theme]);

  const ctx = useMemo(() => ({
    user, projects, attempts, lessonProgress, toast, reload,
    saveProject: async (p) => { await saveProject(p); await reload(); },
    saveLesson: async (id, score) => {
      const next = { ...lessonProgress, [id]: { best: Math.max(score, lessonProgress[id]?.best ?? 0), at: new Date().toISOString(), userId: user?.userId, classId: user?.classId ?? null } };
      setLessonProgress(next); await setMeta('lessons', next);
    },
    // Exercises outside missions (region comparison, quiz bank) are stored as attempts.
    saveExercise: async (kind, fields) => {
      const now = new Date().toISOString();
      await saveAttempt({ id: `a-${kind}-${Date.now().toString(36)}`, kind, userId: user?.userId ?? null, classId: user?.classId ?? null, startedAt: now, finishedAt: now, ...fields });
      await reload();
    },
  }), [user, projects, attempts, lessonProgress, toast, reload]);

  const [section, arg] = route;
  let screen;
  if (!section) screen = <Home />;
  else if (section === 'learn' && arg) screen = <Lesson id={Number(arg)} />;
  else if (section === 'learn') screen = <Learn />;
  else if (section === 'missions') screen = <Missions />;
  else if (section === 'glossary') screen = <Glossary />;
  else if (section === 'progress') screen = <Progress />;
  else if (section === 'drills') screen = <Drills />;
  else if (section === 'compare') screen = <Compare />;
  else if (section === 'quiz') screen = <QuizBank />;
  else if (section === 'classroom') screen = <Classroom />;
  else if (section === 'project' && arg) screen = <Workspace key={arg} id={arg} />;
  else screen = <div className="page"><h1>Page not found</h1><p><a href="#/">Go to the start page</a></p></div>;

  const cycleTheme = async () => {
    const next = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(next); try { await setMeta('theme', next); } catch { /* storage blocked */ }
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#/">
            <span className="brand-tabs" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((m) => <span key={m} style={{ background: `var(--m${m})` }} />)}
            </span>
            eCTD Dossier Builder
          </a>
          <nav className="nav" aria-label="Main">
            <a href="#/" aria-current={!section ? 'page' : undefined}>Projects</a>
            <a href="#/learn" aria-current={section === 'learn' ? 'page' : undefined}>Learn</a>
            <a href="#/missions" aria-current={section === 'missions' ? 'page' : undefined}>Missions</a>
            <a href="#/progress" aria-current={section === 'progress' ? 'page' : undefined}>Progress</a>
            <a href="#/glossary" aria-current={section === 'glossary' ? 'page' : undefined}>Glossary</a>
          </nav>
          <span className="spacer" />
          <button className="btn small ghost" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme`}>
            Theme: {theme}
          </button>
        </header>
        {dbError && <div className="callout bad" role="alert" style={{ margin: '1rem' }}>{dbError}</div>}
        <main>{user || dbError ? screen : <div className="page muted">Loading…</div>}</main>
        <footer className="footer">
          <span>Built by <strong>Khan Gulrez Shagufa Fazal Ahmed</strong></span>
          <span>Training only. Every product, company, document and person is fictional; nothing here is suitable for a real submission. Your work stays in this browser.</span>
          <span>Apache-2.0</span>
        </footer>
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
              <span>{t.text}</span>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">✕</button>
            </div>
          ))}
        </div>
      </div>
    </AppCtx.Provider>
  );
}
