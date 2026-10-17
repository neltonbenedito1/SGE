#!/usr/bin/env bash
# ==============================================================================
# SysEdu SaaS - Automated Firestore & Storage Export Script
# Execute via Google Cloud Scheduler / Cloud Functions or CI/CD runner
# ==============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-sentinel-fef50}"
DATABASE_ID="${FIRESTORE_DATABASE_ID:-ai-studio-sistemadegerenci-28932b91-5d0c-465c-a833-bdfb1270cde1}"
BACKUP_BUCKET="${BACKUP_GCS_BUCKET:-gs://sysedu-backups-${PROJECT_ID}}"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
EXPORT_PATH="${BACKUP_BUCKET}/firestore/${TIMESTAMP}"

echo "=========================================================="
echo "SysEdu Security Automation: Initiating Firestore Backup"
echo "Project:   ${PROJECT_ID}"
echo "Database:  ${DATABASE_ID}"
echo "Target:    ${EXPORT_PATH}"
echo "Timestamp: ${TIMESTAMP}"
echo "=========================================================="

# 1. Trigger export using gcloud command-line
if command -v gcloud &> /dev/null; then
  echo "[1/3] Triggering Firestore Export..."
  gcloud firestore export "${EXPORT_PATH}" \
    --project="${PROJECT_ID}" \
    --database="${DATABASE_ID}"

  echo "[2/3] Verifying export integrity..."
  gsutil ls "${EXPORT_PATH}" | grep -q "${TIMESTAMP}.overall_export_metadata"
  echo "✓ Integrity verification successful."

  echo "[3/3] Backup completed successfully at: ${EXPORT_PATH}"
else
  echo "[WARNING] gcloud CLI not found in local environment."
  echo "In Google Cloud Run / Console, configure a Cloud Scheduler trigger calling:"
  echo "POST https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}:exportDocuments"
  echo "Body: {\"outputUriPrefix\": \"${EXPORT_PATH}\"}"
fi
