/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Bug, 
  CheckCircle2, 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Clock, 
  Building2, 
  User as UserIcon, 
  Globe, 
  Code, 
  Check, 
  Eye, 
  X, 
  ShieldAlert,
  Server,
  Layers,
  FileJson
} from 'lucide-react';
import { LogErro, ErrorSeverity, ErrorStatus, ErrorOrigem } from '../types';
import { 
  fetchSystemErrors, 
  updateErrorStatus, 
  deleteErrorLog, 
  clearResolvedErrors, 
  exportErrorsToCsv, 
  exportErrorsToJson, 
  logSystemError, 
  subscribeToErrorLogs 
} from '../services/errorLoggingService';

interface ErrorLogsModuleProps {
  onNotify?: (msg: string, type?: 'sucesso' | 'erro' | 'aviso' | 'info') => void;
}

export function ErrorLogsModule({ onNotify }: ErrorLogsModuleProps) {
  const [logs, setLogs] = useState<LogErro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrigem, setFilterOrigem] = useState<string>('todos');
  const [filterSeveridade, setFilterSeveridade] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [selectedLog, setSelectedLog] = useState<LogErro | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simulatingError, setSimulatingError] = useState(false);

  // Load errors on mount and subscribe
  const loadLogs = async () => {
    setRefreshing(true);
    try {
      const data = await fetchSystemErrors();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load error logs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const unsubscribe = subscribeToErrorLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = log.mensagem?.toLowerCase().includes(q);
        const matchesMod = log.modulo?.toLowerCase().includes(q);
        const matchesAcao = log.acao?.toLowerCase().includes(q);
        const matchesTenant = (log.tenant_nome || log.tenant_id)?.toLowerCase().includes(q);
        const matchesUser = (log.usuario_email || log.usuario_nome)?.toLowerCase().includes(q);
        const matchesStack = log.stack_trace?.toLowerCase().includes(q);
        if (!matchesMsg && !matchesMod && !matchesAcao && !matchesTenant && !matchesUser && !matchesStack) {
          return false;
        }
      }

      // Origem filter
      if (filterOrigem !== 'todos' && log.origem !== filterOrigem) {
        return false;
      }

      // Severidade filter
      if (filterSeveridade !== 'todos' && log.severidade !== filterSeveridade) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'todos' && log.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, filterOrigem, filterSeveridade, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const criticos = logs.filter(l => l.severidade === 'critico' && l.status !== 'resolvido').length;
    const abertos = logs.filter(l => l.status === 'aberto').length;
    const superAdminErrors = logs.filter(l => l.origem === 'super_admin').length;
    const tenantErrors = logs.filter(l => l.origem === 'tenant_portal' || l.origem === 'tenant_admin').length;
    const resolvidos = logs.filter(l => l.status === 'resolvido').length;
    const resolucaoPct = total > 0 ? Math.round((resolvidos / total) * 100) : 100;

    return {
      total,
      criticos,
      abertos,
      superAdminErrors,
      tenantErrors,
      resolvidos,
      resolucaoPct
    };
  }, [logs]);

  // Actions
  const handleStatusChange = async (id: string, newStatus: ErrorStatus) => {
    await updateErrorStatus(id, newStatus, 'Super Admin', resolutionNote || undefined);
    if (selectedLog && selectedLog.id === id) {
      setSelectedLog({
        ...selectedLog,
        status: newStatus,
        resolvido_por: 'Super Admin',
        resolvido_em: newStatus === 'resolvido' ? new Date().toISOString() : selectedLog.resolvido_em,
        notas_resolucao: resolutionNote || selectedLog.notas_resolucao
      });
    }
    await loadLogs();
    onNotify?.(`Status do erro atualizado para "${newStatus}".`, 'sucesso');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este registro de log de erro?')) return;
    await deleteErrorLog(id);
    if (selectedLog?.id === id) setSelectedLog(null);
    await loadLogs();
    onNotify?.('Registro de erro removido com sucesso.', 'info');
  };

  const handleClearResolved = async () => {
    if (!confirm('Deseja remover todos os erros marcados como resolvidos?')) return;
    await clearResolvedErrors();
    await loadLogs();
    onNotify?.('Todos os erros resolvidos foram limpos do histórico.', 'sucesso');
  };

  const handleCopyStack = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    onNotify?.('Stack trace copiado para a área de transferência!', 'sucesso');
  };

  const handleSimulateTestError = async () => {
    setSimulatingError(true);
    try {
      await logSystemError({
        origem: 'super_admin',
        severidade: 'aviso',
        modulo: 'Simulação & Teste de Diagnóstico',
        acao: 'Teste de Registro Manual',
        mensagem: 'Erro de teste disparado manualmente pelo Super Administrador para validar o módulo de Logs de Erros.',
        detalhes: {
          simulado: true,
          ambiente: 'Cloudflare / Container Multi-tenant',
          timestamp: new Date().toISOString()
        }
      });
      await loadLogs();
      onNotify?.('Erro de teste registrado com sucesso no catálogo!', 'sucesso');
    } finally {
      setSimulatingError(false);
    }
  };

  // Severity badge renderer
  const renderSeverityBadge = (sev: ErrorSeverity) => {
    switch (sev) {
      case 'critico':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertOctagon className="w-3 h-3 text-rose-600" /> Crítico
          </span>
        );
      case 'erro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3 h-3 text-red-500" /> Erro
          </span>
        );
      case 'aviso':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Aviso
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <Info className="w-3 h-3 text-sky-500" /> Info
          </span>
        );
    }
  };

  // Status badge renderer
  const renderStatusBadge = (status: ErrorStatus) => {
    switch (status) {
      case 'aberto':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Aberto
          </span>
        );
      case 'investigando':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Em Análise
          </span>
        );
      case 'resolvido':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolvido
          </span>
        );
      case 'ignorado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Ignorado
          </span>
        );
    }
  };

  // Origin badge renderer
  const renderOrigemBadge = (origem: ErrorOrigem) => {
    switch (origem) {
      case 'super_admin':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">Super Admin</span>;
      case 'tenant_portal':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-100">Portal Tenant</span>;
      case 'tenant_admin':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-100">Admin Tenant</span>;
      case 'api':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">API / Backend</span>;
      case 'auth':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-100">Autenticação</span>;
      default:
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">Sistema</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Logs de Erros e Diagnósticos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento, catalogação e auditoria em tempo real de falhas no Super Admin e em todos os Tenants
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={refreshing}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Recarregar logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            onClick={() => exportErrorsToCsv(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>

          <button
            onClick={() => exportErrorsToJson(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar JSON"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>

          <button
            onClick={handleClearResolved}
            disabled={stats.resolvidos === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Limpar todos os erros resolvidos"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Resolvidos
          </button>

          <button
            onClick={handleSimulateTestError}
            disabled={simulatingError}
            className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {simulatingError ? 'Registrando...' : 'Simular Erro de Teste'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total de Ocorrências</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{stats.abertos} não resolvidos</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-rose-600 font-semibold">Críticos Ativos</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{stats.criticos}</h3>
            <p className="text-[11px] text-rose-400 mt-0.5">Requerem atenção imediata</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Erros nos Tenants</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.tenantErrors}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Unidades escolares</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600 font-semibold">Taxa de Resolução</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.resolucaoPct}%</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{stats.resolvidos} resolvidos</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por mensagem, módulo, ação, tenant, e-mail ou stack trace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Origem Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={filterOrigem}
              onChange={(e) => setFilterOrigem(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            >
              <option value="todos">Origem: Todas</option>
              <option value="super_admin">Super Admin</option>
              <option value="tenant_portal">Portal Tenant</option>
              <option value="tenant_admin">Admin Tenant</option>
              <option value="api">API / Backend</option>
              <option value="auth">Autenticação</option>
              <option value="sistema">Sistema</option>
            </select>

            {/* Severidade Filter */}
            <select
              value={filterSeveridade}
              onChange={(e) => setFilterSeveridade(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            >
              <option value="todos">Severidade: Todas</option>
              <option value="critico">Crítico</option>
              <option value="erro">Erro</option>
              <option value="aviso">Aviso</option>
              <option value="info">Info</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            >
              <option value="todos">Status: Todos</option>
              <option value="aberto">Aberto</option>
              <option value="investigando">Em Análise</option>
              <option value="resolvido">Resolvido</option>
              <option value="ignorado">Ignorado</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>Exibindo <strong>{filteredLogs.length}</strong> de <strong>{logs.length}</strong> erros registrados</span>
          {(filterOrigem !== 'todos' || filterSeveridade !== 'todos' || filterStatus !== 'todos' || searchQuery) && (
            <button
              onClick={() => {
                setFilterOrigem('todos');
                setFilterSeveridade('todos');
                setFilterStatus('todos');
                setSearchQuery('');
              }}
              className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Error Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-rose-500 mb-3" />
            <p className="text-xs font-semibold">Carregando catálogo de logs de erro...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Nenhum erro encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Nenhum registro corresponde aos filtros selecionados ou o sistema está operando sem falhas reportadas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Severidade</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4">Módulo & Ação</th>
                  <th className="py-3 px-4">Descrição do Erro</th>
                  <th className="py-3 px-4">Instituição / Usuário</th>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderSeverityBadge(log.severidade)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderOrigemBadge(log.origem)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 text-[11px]">{log.modulo || 'Sistema'}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[130px]">{log.acao || 'Execução'}</div>
                    </td>

                    <td className="py-3 px-4 max-w-[280px]">
                      <p className="font-semibold text-slate-900 line-clamp-2 leading-tight">
                        {log.mensagem}
                      </p>
                      {log.stack_trace && (
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block truncate max-w-[260px]">
                          {log.stack_trace.split('\n')[0]}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.tenant_nome ? (
                        <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">{log.tenant_nome}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Super Admin</span>
                      )}
                      {log.usuario_email && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {log.usuario_email}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(log.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-slate-400 ml-4">
                        {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(log.status)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setResolutionNote(log.notas_resolucao || '');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Ver detalhes completos e stack trace"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>

                      {log.status !== 'resolvido' ? (
                        <button
                          onClick={() => handleStatusChange(log.id, 'resolvido')}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Marcar como resolvido"
                        >
                          <Check className="w-3 h-3" /> Resolver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(log.id, 'aberto')}
                          className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Reabrir erro"
                        >
                          Reabrir
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Excluir log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Detailed Error Viewer & Inspector */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">Detalhes do Erro e Diagnóstico</h3>
                    {renderSeverityBadge(selectedLog.severidade)}
                    {renderStatusBadge(selectedLog.status)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {selectedLog.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Error Message Box */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mensagem do Erro</label>
                <div className="p-3 bg-rose-50/60 border border-rose-200 text-rose-900 rounded-xl font-medium mt-1 select-text">
                  {selectedLog.mensagem}
                </div>
              </div>

              {/* Context Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Origem</span>
                  <div className="mt-1">{renderOrigemBadge(selectedLog.origem)}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Módulo</span>
                  <p className="font-bold text-slate-800 mt-1">{selectedLog.modulo || 'Geral'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Ação</span>
                  <p className="font-bold text-slate-800 mt-1">{selectedLog.acao || 'N/A'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Tenant</span>
                  <p className="font-bold text-slate-800 mt-1">{selectedLog.tenant_nome || selectedLog.tenant_id || 'Super Admin'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Usuário</span>
                  <p className="font-bold text-slate-800 mt-1 truncate" title={selectedLog.usuario_email || ''}>
                    {selectedLog.usuario_email || selectedLog.usuario_nome || 'Anônimo / Sistema'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Data / Hora</span>
                  <p className="font-bold text-slate-800 mt-1">{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* URL & User Agent */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-600">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-[11px]">URL:</span>
                  <span className="font-mono text-[10px] text-slate-700 truncate">{selectedLog.url || window.location.href}</span>
                </div>
                {selectedLog.user_agent && (
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    UA: {selectedLog.user_agent}
                  </div>
                )}
              </div>

              {/* Stack Trace */}
              {selectedLog.stack_trace && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Stack Trace & Depuração</label>
                    <button
                      onClick={() => handleCopyStack(selectedLog.stack_trace!, selectedLog.id)}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === selectedLog.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedId === selectedLog.id ? 'Copiado!' : 'Copiar Stack Trace'}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-200 font-mono text-[10px] rounded-xl overflow-x-auto max-h-48 whitespace-pre-wrap select-text">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}

              {/* Resolution Notes & Actions */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">Gestão e Resolução do Erro</h4>
                
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Notas de Resolução / Investigação:</label>
                  <textarea
                    rows={2}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Adicione notas técnicas sobre o motivo do erro e como foi mitigado..."
                    className="w-full mt-1 p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Alterar Status:</span>
                    <select
                      value={selectedLog.status}
                      onChange={(e) => handleStatusChange(selectedLog.id, e.target.value as ErrorStatus)}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-700"
                    >
                      <option value="aberto">Aberto</option>
                      <option value="investigando">Em Análise</option>
                      <option value="resolvido">Resolvido</option>
                      <option value="ignorado">Ignorado</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStatusChange(selectedLog.id, 'resolvido')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Marcar como Resolvido
                    </button>
                    <button
                      onClick={() => handleDelete(selectedLog.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
