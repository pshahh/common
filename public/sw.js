self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    
    const title = data.title || 'common';
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192.png',
      data: {
        url: data.url || '/',
      },
      tag: data.tag || 'common-notification',
      renotify: true,
    };
  
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  });
  
  self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(function(clientList) {
          // If common is already open, focus it and navigate
          for (const client of clientList) {
            if (client.url.includes('common-social.com') && 'focus' in client) {
              client.focus();
              client.navigate(url);
              return;
            }
          }
          // Otherwise open a new window
          return clients.openWindow(url);
        })
    );
  });