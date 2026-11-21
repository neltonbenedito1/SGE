# Testes de Carga e SLO — SGE Multi-Tenant (Fase 7)

Este directório contém os cenários automatizados de teste de carga em **k6** e **Locust** para validar o comportamento do SGE sob picos simultâneos:

1. **Entrada simultânea de milhares de utilizadores** (leituras principais em portal e filas).
2. **Abertura de matrículas** (verificação de quotas por plano e recálculo assíncrono de vagas/capacidade com chave de idempotência).
3. **Lançamento de notas** (actualização de agregados e exportação de pautas em fila assíncrona).
4. **Notificações em massa** (envio em lote com idempotência e verificação de persistência na fila).

## Metas SLO Obrigatórias

- **Latência p95 nas leituras principais:** inferior a `500 ms`
- **Taxa de perda de dados sob carga:** `0` (`sge_data_loss_count == 0`, nenhuma resposta `5xx` em escritas críticas e toda operação assíncrona devolvendo `HTTP 202` com `jobId` persistido ou `HTTP 429` controlado por quota sem corrupção)

## Variáveis de Ambiente

- `SGE_BASE_URL`: URL base da instância alvo (omissão: `http://127.0.0.1:3000`).
- `SGE_AUTH_TOKEN`: Token Firebase/JWT válido de um utilizador de teste (admin/director ou super_admin) para autenticar rotas protegidas.
- `SGE_TENANT_IDS`: Lista de `tenant_id` separados por vírgula para distribuir carga isolada entre escolas (omissão: `tenant_escola_a,tenant_escola_b,tenant_univ_c`).
- `SGE_SCALE_FACTOR`: Factor multiplicador dos utilizadores virtuais no k6 (use `0.05` para smoke test local ou `1` para carga completa).

## Executar com k6

Teste rápido local (smoke test):

```bash
SGE_BASE_URL="http://127.0.0.1:3000" SGE_SCALE_FACTOR="0.05" k6 run load-tests/k6/sge_peak_load.js
```

Teste de carga completa (milhares de utilizadores em simultâneo):

```bash
SGE_BASE_URL="https://sua-instancia.run.app" \
SGE_AUTH_TOKEN="SEU_TOKEN_VALIDO" \
SGE_TENANT_IDS="escola_alpha,escola_beta,instituto_gama" \
SGE_SCALE_FACTOR="1" \
k6 run load-tests/k6/sge_peak_load.js
```

## Executar com Locust

Modo headless (CI/CD com verificação automática de saída):

```bash
SGE_AUTH_TOKEN="SEU_TOKEN_VALIDO" \
SGE_TENANT_IDS="escola_alpha,escola_beta,instituto_gama" \
locust -f load-tests/locust/locustfile.py \
  --host http://127.0.0.1:3000 \
  --users 1000 \
  --spawn-rate 50 \
  --run-time 3m \
  --headless
```

## Observabilidade em Tempo Real durante o Teste

- **Painel Web:** Portal SuperAdmin -> separador **Observabilidade & SLO** (consome `/api/observability/metrics`).
- **Endpoint Prometheus:** `GET /metrics` (autenticado com `OBSERVABILITY_METRICS_TOKEN` ou sessão `super_admin`) para ingestão em Prometheus/Grafana e disparo de alertas automáticos.
