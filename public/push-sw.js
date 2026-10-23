// Notifications push (lot 10), chargé par le service worker généré (workbox.importScripts).
// Le message vient de la fonction serveur « push-send » : { title, body, url, tag }.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'OhO', {
      body: data.body || '',
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      lang: 'fr',
      data: { url: data.url || '/' },
    }),
  )
})

// Toucher la notification ouvre l'écran de l'outil, dans une fenêtre déjà ouverte si possible.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(url) : c))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
