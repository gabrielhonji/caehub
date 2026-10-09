import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, ErrorState, Eyebrow, LoadingState } from '../components/primitives';
import { SpaceSummary } from '../components/SpaceSummary';
import type { Board, BoardCard, Space, TaskPreview } from '../domain/types';
import { getBoards, getSpaces, getTaskPreviews } from '../services/spaces';

type Status = 'loading' | 'ready' | 'error';
type FoundationData = { status: Status; spaces: Space[]; tasks: TaskPreview[]; boards: Board[]; load: () => void };

function useFoundationData(): FoundationData {
  const [status, setStatus] = useState<Status>('loading');
  const [spaceList, setSpaces] = useState<Space[]>([]);
  const [taskList, setTasks] = useState<TaskPreview[]>([]);
  const [boardList, setBoards] = useState<Board[]>([]);
  const load = () => { setStatus('loading'); Promise.all([getSpaces(), getTaskPreviews(), getBoards()]).then(([nextSpaces, nextTasks, nextBoards]) => { setSpaces(nextSpaces); setTasks(nextTasks); setBoards(nextBoards); setStatus('ready'); }).catch(() => setStatus('error')); };
  useEffect(load, []);
  return { status, spaces: spaceList, tasks: taskList, boards: boardList, load };
}

function Crumb({ children }: { children: ReactNode }) { return <nav className="breadcrumbs" aria-label="Caminho"><a href="#/espacos">Espaços</a><span aria-hidden="true">/</span><span>{children}</span></nav>; }
function cardTone(column: string) { return column === 'Em andamento' ? 'active' : column === 'Aguardando' ? 'waiting' : 'neutral'; }

function Dashboard({ spaces, tasks }: { spaces: Space[]; tasks: TaskPreview[] }) {
  const workflow = [['Ideias', 8], ['Planejado', 5], ['Em andamento', 3], ['Aguardando', 2], ['Concluído', 12]] as const;
  const departments = ['RH/RE', 'Marketing', 'Produtos', 'Eventos', 'Secretaria', 'Financeiro'];
  return <>
    <section className="dashboard-intro"><div className="dashboard-intro-main"><Eyebrow>CAEHUB / VISÃO GERAL</Eyebrow><h1>O trabalho do CAECOMP,<br /><em>em um só lugar.</em></h1><p>Acompanhe os espaços, cartões e responsabilidades que estão movimentando a organização.</p></div><aside className="context-note"><Eyebrow>AMBIENTE DE DESENVOLVIMENTO</Eyebrow><strong>Dados demonstrativos</strong><p>A estrutura representa o MVP de Gestão. Nenhuma informação real do grupo está publicada aqui.</p></aside></section>
    <section className="dashboard-block overview-section" aria-labelledby="overview-title"><div className="compact-heading"><div><Eyebrow>HOJE</Eyebrow><h2 id="overview-title">Panorama</h2></div><span>Atualizado com dados fictícios</span></div><div className="overview"><div><Eyebrow>ESPAÇOS ATIVOS</Eyebrow><strong>{spaces.length}</strong><span>contextos em desenvolvimento</span></div><div><Eyebrow>PRÓXIMAS AÇÕES</Eyebrow><strong>{tasks.length}</strong><span>itens para acompanhar</span></div><div><Eyebrow>DEPARTAMENTOS</Eyebrow><strong>6</strong><span>áreas da organização</span></div></div></section>
    <section className="dashboard-grid"><div className="work-panel"><div className="compact-heading"><div><Eyebrow>ACOMPANHAMENTO</Eyebrow><h2>Em foco</h2></div><a href="#/espacos">Ver espaços <span aria-hidden="true">→</span></a></div><div className="task-list">{tasks.map((task, index) => <article key={task.id} className="task-row"><div className="task-index">{String(index + 1).padStart(2, '0')}</div><div className="task-main"><Badge tone={task.status === 'Em andamento' ? 'active' : task.status === 'Aguardando' ? 'waiting' : 'neutral'}>{task.status}</Badge><h3>{task.title}</h3><p>{task.space} · {task.helpers} auxiliares</p></div><time>{task.due}</time></article>)}</div></div><aside className="workflow-panel"><div className="compact-heading"><div><Eyebrow>FLUXO GERAL</Eyebrow><h2>Cartões</h2></div><strong>30</strong></div><ol className="workflow-list">{workflow.map(([label, count]) => <li key={label}><span>{label}</span><strong>{count}</strong><i style={{ '--progress': `${count / 12 * 100}%` } as CSSProperties} /></li>)}</ol></aside></section>
    <section className="section spaces-section"><div className="section-heading editorial-heading"><div><Eyebrow>ESPAÇOS</Eyebrow><h2>Onde o trabalho<br /><em>ganha contexto.</em></h2></div><p>Cada espaço reúne participantes e quadros de uma frente do CAECOMP.</p></div><div className="spaces-grid">{spaces.map((space, index) => <SpaceSummary key={space.id} space={space} index={index} />)}</div></section>
    <section className="organization-strip" aria-labelledby="departments-title"><div><Eyebrow>ORGANIZAÇÃO</Eyebrow><h2 id="departments-title">Seis departamentos,<br />uma visão compartilhada.</h2></div><ul>{departments.map((department, index) => <li key={department}><span>{String(index + 1).padStart(2, '0')}</span>{department}</li>)}</ul></section>
  </>;
}

function SpacesPage({ spaces }: { spaces: Space[] }) { return <><section className="page-header"><Eyebrow>GESTÃO · ESPAÇOS</Eyebrow><h1>Cada frente,<br /><em>um contexto claro.</em></h1><p>Espaços reúnem participantes, quadros e calendário. Estes dados são fictícios e servem apenas ao desenvolvimento.</p></section>{spaces.length ? <div className="spaces-grid">{spaces.map((space, index) => <SpaceSummary key={space.id} space={space} index={index} />)}</div> : <EmptyState title="Ainda não há espaços para mostrar.">Quando um contexto for criado e você tiver acesso, ele aparecerá aqui.</EmptyState>}</>; }

function CardPreview({ card }: { card: BoardCard }) { return <a className="board-card" href={`#/cartoes/${card.id}`}><Badge tone={cardTone(card.column)}>{card.column}</Badge><h3>{card.title}</h3><p>{card.summary}</p><footer><span>{card.assignee}</span>{card.helpers ? <span>{card.helpers} auxiliares</span> : <span>Sem auxiliares</span>}</footer></a>; }

function SpacePage({ space, board }: { space: Space; board?: Board }) {
  if (!board) return <section className="state"><Crumb>{space.name}</Crumb><Eyebrow>SEM QUADRO</Eyebrow><h1>Este espaço ainda não tem um quadro para mostrar.</h1><p>Quando um quadro for disponibilizado, ele aparecerá neste contexto.</p></section>;
  return <><section className="space-heading"><Crumb>{space.name}</Crumb><div><div><Eyebrow>{space.department} · {space.participants} PARTICIPANTES</Eyebrow><h1>{space.name}</h1><p>{space.description}</p></div><div className="development-note"><Eyebrow>VISUALIZAÇÃO</Eyebrow><span>Quadro demonstrativo</span></div></div></section><section className="board-section"><div className="compact-heading"><div><Eyebrow>QUADRO</Eyebrow><h2>{board.name}</h2></div><span>{board.columns.length} colunas</span></div><p className="board-guidance">Os cartões abaixo são dados fictícios. Movimentação, edição e atribuições serão liberadas somente com as regras de autorização aprovadas.</p><div className="board-scroll" tabIndex={0} aria-label="Quadro Kanban de demonstração"><div className="board-grid">{board.columns.map((column) => <section className="board-column" key={column.id}><header><h3>{column.label}</h3><span>{column.cards.length}</span></header>{column.cards.length ? column.cards.map((card) => <CardPreview card={card} key={card.id} />) : <p className="column-empty">Nenhum cartão neste estágio.</p>}</section>)}</div></div></section></>;
}

function CardPage({ card, space }: { card: BoardCard; space?: Space }) { return <section className="card-detail"><Crumb>{space?.name ?? 'Cartão'}</Crumb><div className="card-detail-grid"><article><Eyebrow>CARTÃO · {card.column.toUpperCase()}</Eyebrow><h1>{card.title}</h1><p className="card-summary">{card.summary}</p><div className="detail-block"><Eyebrow>CONTEXTO</Eyebrow><p>{space ? `${space.name} · ${space.department}` : 'Espaço de origem indisponível'}</p></div><div className="detail-block"><Eyebrow>VISIBILIDADE</Eyebrow><Badge>{card.visibility}</Badge></div></article><aside className="card-sidebar"><div><Eyebrow>RESPONSÁVEL PRINCIPAL</Eyebrow><strong>{card.assignee}</strong></div><div><Eyebrow>AUXILIARES</Eyebrow><strong>{card.helpers || 'Nenhum'}</strong></div><div><Eyebrow>PRAZO</Eyebrow><strong>{card.due ?? 'Sem prazo definido'}</strong></div><p>Dados demonstrativos. O CAEHUB não habilita alterações neste protótipo.</p></aside></div></section>; }

function NotFound() { return <section className="state"><Eyebrow>PÁGINA NÃO ENCONTRADA</Eyebrow><h1>Este caminho não existe.</h1><p>Volte para a visão geral do CAEHUB.</p><a className="button button-primary" href="#/">Ir para o início</a></section>; }

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('caehub-theme') === 'dark' ? 'dark' : 'light');
  const [route, setRoute] = useState(location.hash || '#/');
  const data = useFoundationData();
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('caehub-theme', theme); }, [theme]);
  useEffect(() => { const update = () => setRoute(location.hash || '#/'); addEventListener('hashchange', update); return () => removeEventListener('hashchange', update); }, []);
  let content: ReactNode;
  const parts = route.replace(/^#\//, '').split('/').filter(Boolean);
  if (data.status === 'loading') content = <LoadingState />;
  else if (data.status === 'error') content = <ErrorState onRetry={data.load} />;
  else if (!parts.length) content = <Dashboard spaces={data.spaces} tasks={data.tasks} />;
  else if (parts[0] === 'espacos' && !parts[1]) content = <SpacesPage spaces={data.spaces} />;
  else if (parts[0] === 'espacos' && parts[1]) { const space = data.spaces.find((item) => item.id === parts[1]); content = space ? <SpacePage space={space} board={data.boards.find((item) => item.spaceId === space.id)} /> : <NotFound />; }
  else if (parts[0] === 'cartoes' && parts[1]) { const board = data.boards.find((item) => item.columns.some((column) => column.cards.some((card) => card.id === parts[1]))); const card = board?.columns.flatMap((column) => column.cards).find((item) => item.id === parts[1]); content = card ? <CardPage card={card} space={data.spaces.find((item) => item.id === board?.spaceId)} /> : <NotFound />; }
  else content = <NotFound />;
  return <AppShell theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{content}</AppShell>;
}
