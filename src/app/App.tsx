import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, ErrorState, Eyebrow, LoadingState } from '../components/primitives';
import { SpaceSummary } from '../components/SpaceSummary';
import type { Space, TaskPreview } from '../domain/types';
import { getSpaces, getTaskPreviews } from '../services/spaces';

type Status = 'loading' | 'ready' | 'error';

function useFoundationData() {
  const [status, setStatus] = useState<Status>('loading');
  const [spaceList, setSpaces] = useState<Space[]>([]);
  const [taskList, setTasks] = useState<TaskPreview[]>([]);
  const load = () => {
    setStatus('loading');
    Promise.all([getSpaces(), getTaskPreviews()])
      .then(([nextSpaces, nextTasks]) => { setSpaces(nextSpaces); setTasks(nextTasks); setStatus('ready'); })
      .catch(() => setStatus('error'));
  };
  useEffect(load, []);
  return { status, spaceList, taskList, load };
}

function GiroArtwork() {
  return <div className="giro-art" aria-hidden="true"><span className="art-label">HONJI / GIRO ORIGINAL</span><svg viewBox="0 0 64 64"><use href="/assets/honji-symbol.svg#mark" /></svg><div className="art-meta"><span>CAEHUB</span><span>01 / 03</span></div></div>;
}

function Dashboard({ spaces, tasks }: { spaces: Space[]; tasks: TaskPreview[] }) {
  return <>
    <section className="hero">
      <div className="hero-kicker"><Eyebrow>CAEHUB / GESTÃO</Eyebrow><span>01 — UM PONTO DE PARTIDA</span></div>
      <div className="hero-body">
        <div className="hero-copy"><p className="hero-author">CAECOMP em movimento.</p><h1>Organizar para<br /><em>fazer acontecer.</em></h1><p>Um espaço comum para acompanhar iniciativas, responsabilidades e os próximos passos da organização.</p><a className="button button-primary" href="#/espacos">Explorar espaços <span aria-hidden="true">↓</span></a></div>
        <GiroArtwork />
      </div>
      <div className="hero-foot"><span>6 DEPARTAMENTOS · CERCA DE 33 MEMBROS</span><span>IDEIAS QUE GANHAM CONTEXTO</span></div>
    </section>

    <section className="section overview-section">
      <div className="section-heading editorial-heading"><div><Eyebrow>01 / PANORAMA</Eyebrow><h2>O trabalho visível.<br /><em>O contexto preservado.</em></h2></div><p>Uma leitura rápida do que existe agora, sem transformar cada informação em decoração.</p></div>
      <div className="overview"><div><Eyebrow>ESPAÇOS ATIVOS</Eyebrow><strong>{spaces.length}</strong><span>contextos em desenvolvimento</span></div><div><Eyebrow>PRÓXIMAS AÇÕES</Eyebrow><strong>{tasks.length}</strong><span>itens para acompanhar</span></div><div><Eyebrow>DEPARTAMENTOS</Eyebrow><strong>6</strong><span>áreas da organização</span></div></div>
    </section>

    <section className="section">
      <div className="section-heading editorial-heading"><div><Eyebrow>02 / EM FOCO</Eyebrow><h2>O que está<br /><em>em movimento.</em></h2></div><a href="#/espacos">Ver todos os espaços <span aria-hidden="true">→</span></a></div>
      <div className="task-list">{tasks.map((task, index) => <article key={task.id} className="task-row"><div className="task-index">{String(index + 1).padStart(2, '0')}</div><div className="task-main"><Badge tone={task.status === 'Em andamento' ? 'active' : task.status === 'Aguardando' ? 'waiting' : 'neutral'}>{task.status}</Badge><h3>{task.title}</h3><p>{task.space} · {task.helpers} auxiliares</p></div><time>{task.due}</time></article>)}</div>
    </section>

    <section className="section">
      <div className="section-heading editorial-heading"><div><Eyebrow>03 / ESPAÇOS</Eyebrow><h2>Diferentes frentes.<br /><em>Uma mesma organização.</em></h2></div><p>Cada espaço encontra seu ritmo. Todos partem de uma linguagem comum.</p></div>
      <div className="spaces-grid">{spaces.slice(0, 3).map((space, index) => <SpaceSummary key={space.id} space={space} index={index} />)}</div>
    </section>
  </>;
}

function SpacesPage({ spaces }: { spaces: Space[] }) {
  return <><section className="page-header"><Eyebrow>GESTÃO · ESPAÇOS</Eyebrow><h1>Cada frente,<br /><em>um contexto claro.</em></h1><p>Espaços reúnem participantes, quadros e calendário. Estes dados são fictícios e servem apenas ao desenvolvimento.</p></section>{spaces.length ? <div className="spaces-grid">{spaces.map((space, index) => <SpaceSummary key={space.id} space={space} index={index} />)}</div> : <EmptyState title="Ainda não há espaços para mostrar.">Quando um contexto for criado e você tiver acesso, ele aparecerá aqui.</EmptyState>}</>;
}

function NotFound() { return <section className="state"><Eyebrow>PÁGINA NÃO ENCONTRADA</Eyebrow><h1>Este caminho não existe.</h1><p>Volte para a visão geral do CAEHUB.</p><a className="button button-primary" href="#/">Ir para o início</a></section>; }

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('caehub-theme') === 'dark' ? 'dark' : 'light');
  const [route, setRoute] = useState(location.hash || '#/');
  const data = useFoundationData();
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('caehub-theme', theme); }, [theme]);
  useEffect(() => { const update = () => setRoute(location.hash || '#/'); addEventListener('hashchange', update); return () => removeEventListener('hashchange', update); }, []);
  const content = data.status === 'loading' ? <LoadingState /> : data.status === 'error' ? <ErrorState onRetry={data.load} /> : route === '#/' ? <Dashboard spaces={data.spaceList} tasks={data.taskList} /> : route === '#/espacos' ? <SpacesPage spaces={data.spaceList} /> : <NotFound />;
  return <AppShell theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{content}</AppShell>;
}
