import { RealtimeEventBus } from '../events/eventBus';
import { createRealtimeNetworkMonitor } from '../network/networkMonitor';
import { SubscriptionRegistry } from '../subscriptions/subscriptionRegistry';
import { RealtimeConnectionManager } from './connectionManager';
import { createNoopRealtimeTransport } from './transport';
import { createApiRealtimeTransport } from './apiTransport';
import { hasApi } from '@/services/api/config';

export const realtimeEventBus = new RealtimeEventBus();
export const realtimeSubscriptions = new SubscriptionRegistry({ eventBus: realtimeEventBus });
export const realtimeNetwork = createRealtimeNetworkMonitor();
export const realtimeGateway = new RealtimeConnectionManager({
  transport: hasApi ? createApiRealtimeTransport('customer') : createNoopRealtimeTransport(),
  eventBus: realtimeEventBus,
  subscriptions: realtimeSubscriptions,
  network: realtimeNetwork,
});
