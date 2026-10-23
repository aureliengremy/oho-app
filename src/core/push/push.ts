/**
 * Notifications push côté appareil (lot 10) : support, permission, abonnement.
 * Le navigateur est derrière `PushPlatform` pour que les tests le remplacent.
 */

export type PushSupport = 'ok' | 'unsupported' | 'needs-install'

export interface PushKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPlatform {
  support(): PushSupport
  permission(): NotificationPermission
  requestPermission(): Promise<NotificationPermission>
  /** L'abonnement de ce navigateur, s'il existe. */
  current(): Promise<PushKeys | null>
  subscribe(applicationServerKey: Uint8Array<ArrayBuffer>): Promise<PushKeys>
  unsubscribe(): Promise<void>
  /** « Pixel, Chrome » pour la liste des appareils. */
  deviceLabel(): string
}

/** Clé VAPID publique (base64url) → octets, comme l'attend pushManager.subscribe. */
export function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** « Android, Chrome », « iPhone, Safari », « Mac, Firefox ». */
export function deviceLabel(userAgent: string): string {
  const device = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone/.test(userAgent)
      ? 'iPhone'
      : /iPad/.test(userAgent)
        ? 'iPad'
        : /Mac OS X/.test(userAgent)
          ? 'Mac'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'Appareil'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /SamsungBrowser\//.test(userAgent)
        ? 'Samsung Internet'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'navigateur'
  return `${device}, ${browser}`
}

const keysOf = (subscription: PushSubscription): PushKeys => {
  const json = subscription.toJSON()
  return { endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }
}

const registration = () => navigator.serviceWorker.ready

export const browserPush: PushPlatform = {
  support() {
    const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (capable) return 'ok'
    // Sur iPhone, le push n'existe que pour l'app ajoutée à l'écran d'accueil.
    const ios = /iPhone|iPad/.test(navigator.userAgent)
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    return ios && !standalone ? 'needs-install' : 'unsupported'
  },
  permission: () => Notification.permission,
  requestPermission: () => Notification.requestPermission(),
  async current() {
    const subscription = await (await registration()).pushManager.getSubscription()
    return subscription ? keysOf(subscription) : null
  },
  async subscribe(applicationServerKey) {
    const subscription = await (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
    return keysOf(subscription)
  },
  async unsubscribe() {
    await (await (await registration()).pushManager.getSubscription())?.unsubscribe()
  },
  deviceLabel: () => deviceLabel(navigator.userAgent),
}

/** Réglage du module : la plateforme et la clé publique (remplacées dans les tests). */
export const pushConfig: { platform: PushPlatform; vapidKey: string | undefined } = {
  platform: browserPush,
  vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || undefined,
}
