# SysEdu SaaS - Política e Manual de Backup e Recuperação de Desastres (DR)

## 1. Política de Backup Automático do Firestore

- **Frequência**: Diária às 03:00 UTC (horário de menor tráfego).
- **Destino**: Google Cloud Storage (`gs://sysedu-backups-[PROJECT_ID]/firestore/`).
- **Retenção**: 30 dias com exclusão automática via regra de ciclo de vida (Object Lifecycle Management) no bucket GCS.
- **RPO (Recovery Point Objective)**: 24 horas (ou contínuo com Point-in-Time Recovery - PITR ativado).
- **RTO (Recovery Time Objective)**: < 2 horas para restauração completa de um tenant ou de toda a base.

## 2. Configuração no Google Cloud Console

### Passo A: Criar o Bucket de Backups com Retenção de 30 dias
```bash
# 1. Criar o bucket com acesso restrito e sem acesso público
gsutil mb -p sentinel-fef50 -c NEARLINE -l europe-west2 gs://sysedu-backups-sentinel-fef50/

# 2. Configurar política de ciclo de vida (excluir backups com mais de 30 dias)
cat <<EOF > /tmp/lifecycle.json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://sysedu-backups-sentinel-fef50/
```

### Passo B: Agendar no Cloud Scheduler (ou cron job)
```bash
gcloud scheduler jobs create http firestore-daily-backup \
  --schedule="0 3 * * *" \
  --time-zone="UTC" \
  --uri="https://firestore.googleapis.com/v1/projects/sentinel-fef50/databases/ai-studio-sistemadegerenci-28932b91-5d0c-465c-a833-bdfb1270cde1:exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email="service-account@sentinel-fef50.iam.gserviceaccount.com" \
  --message-body="{\"outputUriPrefix\":\"gs://sysedu-backups-sentinel-fef50/firestore/\"}"
```

## 3. Procedimento de Restauração (Disaster Recovery Runbook)

### Restauração Completa da Base de Dados
```bash
# 1. Localizar o backup mais recente
gsutil ls gs://sysedu-backups-sentinel-fef50/firestore/

# 2. Executar a importação
gcloud firestore import gs://sysedu-backups-sentinel-fef50/firestore/[TIMESTAMP_DO_BACKUP] \
  --project=sentinel-fef50 \
  --database=ai-studio-sistemadegerenci-28932b91-5d0c-465c-a833-bdfb1270cde1
```

### Restauração Parcial de Coleções Específicas (ex.: Apenas Alunos e Pautas)
```bash
gcloud firestore import gs://sysedu-backups-sentinel-fef50/firestore/[TIMESTAMP_DO_BACKUP] \
  --collection-ids="estudantes","pautas","pauta_geral" \
  --project=sentinel-fef50 \
  --database=ai-studio-sistemadegerenci-28932b91-5d0c-465c-a833-bdfb1270cde1
```
