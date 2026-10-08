import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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

function Dashboard({ spaces, tasks }: { spaces: Space[]; tasks: TaskPreview[] }) {
  const workflow = [
    ['Ideias', 8], ['Planejado', 5], ['Em andamento', 3], ['Aguardando', 2], ['Concluído', 12],
  ] as const;
  const departments = ['RH/RE', 'Marketing', 'Produtos', 'Eventos', 'Secretaria', 'Financeiro'];
  return <>
    <section className="dashboard-intro">
      <div className="dashboard-intro-main">
        <Eyebrow>CAEHUB / VISÃO GERAL</Eyebrow>
        <h1>O trabalho do CAECOMP,<br /><em>em um só lugar.</em></h1>
        <p>Acompanhe os espaços, cartões e responsabilidades que estão movimentando a organização.</p>
      </div>
      <aside className="context-note"><Eyebrow>AMBIENTE DE DESENVOLVIMENTO</Eyebrow><strong>Dados demonstrativos</strong><p>A estrutura representa o MVP de Gestão. Nenhuma informação real do grupo está publicada aqui.</p></aside>
    </section>

    <section className="dashboard-block overview-section" aria-labelledby="overview-title">
      <div className="compact-heading"><div><Eyebrow>HOJE</Eyebrow><h2 id="overview-title">Panorama</h2></div><span>Atualizado com dados fictícios</span></div>
      <div className="overview"><div><Eyebrow>ESPAÇOS ATIVOS</Eyebrow><strong>{spaces.length}</strong><span>contextos em desenvolvimento</span></div><div><Eyebrow>PRÓXIMAS AÇÕES</Eyebrow><strong>{tasks.length}</strong><span>itens para acompanhar</span></div><div><Eyebrow>DEPARTAMENTOS</Eyebrow><strong>6</strong><span>áreas da organização</span></div></div>
    </section>

    <section className="dashboard-grid">
      <div className="work-panel">
        <div className="compact-heading"><div><Eyebrow>ACOMPANHAMENTO</Eyebrow><h2>Em foco</h2></div><a href="#/espacos">Ver espaços <span aria-hidden="true">→</span></a></div>
        <div className="task-list">{tasks.map((task, index) => <article key={task.id} className="task-row"><div className="task-index" aria-label={`Item ${index + 1}`}>{String(index + 1).padStart(2, '0')}</div><div className="task-main"><Badge tone={task.status === 'Em andamento' ? 'active' : task.status === 'Aguardando' ? 'waiting' : 'neutral'}>{task.status}</Badge><h3>{task.title}</h3><p>{task.space} · {task.helpers} auxiliares</p></div><time>{task.due}</time></article>)}</div>
      </div>
      <aside className="workflow-panel">
        <div className="compact-heading"><div><Eyebrow>FLUXO GERAL</Eyebrow><h2>Cartões</h2></div><strong>30</strong></div>
        <ol className="workflow-list">{workflow.map(([label, count]) => <li key={label}><span>{label}</span><strong>{count}</strong><i style={{ '--progress': `${count / 12 * 100}%` } as CSSProperties} /></li>)}</ol>
      </aside>
    </section>

    <section className="section spaces-section">
      <div className="section-heading editorial-heading"><div><Eyebrow>ESPAÇOS</Eyebrow><h2>Onde o trabalho<br /><em>ganha contexto.</em></h2></div><p>Cada espaço reúne participantes e quadros de uma frente do CAECOMP.</p></div>
      <div className="spaces-grid">{spaces.slice(0, 3).map((space, index) => <SpaceSummary key={space.id} space={space} index={index} />)}</div>
    </section>

    <section className="organization-strip" aria-labelledby="departments-title"><div><Eyebrow>ORGANIZAÇÃO</Eyebrow><h2 id="departments-title">Seis departamentos,<br />uma visão compartilhada.</h2></div><ul>{departments.map((department, index) => <li key={department}><span>{String(index + 1).padStart(2, '0')}</span>{department}</li>)}</ul></section>
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
