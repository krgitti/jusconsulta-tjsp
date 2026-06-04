/**
 * Serviço de monitoramento — integra o app com o backend
 * e gerencia tokens FCM via Capacitor Push Notifications
 */
import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_MONITOR_API || 'https://jusconsulta-monitor.onrender.com';

export interface MonitorItem {
  id: number;
  tipo: 'cpf' | 'cnpj' | 'numero' | 'nome';
  valor: string;
  label: string | null;
  email: string;
  fcm_token: string | null;
  ativo: number;
  criado_em: string;
}

// ── FCM Token ─────────────────────────────────────────────────────────────────

export async function getFcmToken(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return null;
    await PushNotifications.register();
    return new Promise(resolve => {
      PushNotifications.addListener('registration', token => resolve(token.value));
      PushNotifications.addListener('registrationError', () => resolve(null));
      setTimeout(() => resolve(null), 5000);
    });
  } catch {
    return null;
  }
}

export async function setupPushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('[PUSH] Recebido:', notification);
    });
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      console.log('[PUSH] Ação:', action);
    });
  } catch { /* web — ignora */ }
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function cadastrarMonitor(params: {
  tipo: 'cpf' | 'cnpj' | 'numero' | 'nome';
  valor: string;
  label?: string;
  email: string;
}): Promise<{ ok: boolean; monitorados: MonitorItem[] }> {
  const fcm_token = await getFcmToken();
  const res = await fetch(`${API_BASE}/api/monitor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, fcm_token }),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function listarMonitor(email: string): Promise<MonitorItem[]> {
  const res = await fetch(`${API_BASE}/api/monitor?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function removerMonitor(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/monitor/${id}`, { method: 'DELETE' });
}
