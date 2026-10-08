# CAEHUB

Fundação React do hub de Gestão do CAECOMP, integrada futuramente ao ecossistema Honji.

## Executar

O desenvolvimento ocorre em container e não publica portas no host:

```sh
docker compose -f compose.dev.yml run --rm web npm run build
docker compose -f compose.dev.yml up web
```

Para visualizar o Vite em desenvolvimento, use um túnel SSH para a rede/serviço Docker, conforme a política do ambiente.

## Estrutura

- `docs/caehub/`: planejamento original e decisões complementares.
- `src/components/`: primitives, shell e elementos reutilizáveis.
- `src/domain/`: tipos e dados fictícios exclusivamente de desenvolvimento.
- `src/services/`: fronteira preparada para futura integração.

O app não implementa autenticação, autorização real, Kanban funcional, Agenda ou Comercial.
