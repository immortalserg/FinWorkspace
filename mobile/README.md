# FinWorkspace Mobile

Native Android/iOS client foundation built with Expo and React Native.

## Features implemented in this foundation

- Configurable remote HTTPS server and local server URLs.
- Multiple trusted Wi-Fi SSIDs with automatic local/remote selection.
- **Reachability checks** before switching to a local endpoint.
- Email/password login using the existing FinWorkspace backend.
- Refresh-token persistence using Expo SecureStore (never AsyncStorage).
- API client with authenticated requests and automatic refresh.
- Mobile-friendly login, dashboard and server settings.

## Setup

```sh
cd mobile
npm install
npx expo start
```

Open with an Expo development build to use Wi-Fi SSID detection. An Expo Go environment may not expose the native capabilities used by this app.

## Wi-Fi access permissions

- Android: connected SSID requires Location permission, the device's Location services enabled, and OS Wi-Fi access permissions. Android builds need to configure the appropriate permissions.
- iOS: reading the connected SSID is restricted by Apple. The app requests the necessary permission and uses the appropriate Wi-Fi entitlement; support depends on signing and device configuration. If inaccessible, it defaults to the remote server.

**An SSID alone is not trusted authentication**; it is only a hint for route selection. A local endpoint must answer the expected health endpoint. Always use HTTPS over untrusted networks and never expose credentials to an arbitrary endpoint. For production prefer an HTTPS local domain (split-horizon DNS) rather than a plain HTTP LAN IP.

## Authentication

FinWorkspace already implements access and refresh JWTs. The mobile client keeps both in SecureStore and refreshes them on demand. A production follow-up should implement rotating, server-side revocable per-device refresh sessions rather than using the existing stateless refresh JWTs. In particular the backend's current `/auth/logout` does not revoke tokens server-side.

## Push notifications

Existing FinWorkspace push uses browser Web Push subscriptions with VAPID. Native Android/iOS notifications require a **separate delivery adapter**, with per-device registration, authenticated token upsert/revoke endpoints, and FCM/APNs (or Expo's push gateway). This foundation intentionally **does not claim push delivery works yet**. Never include sensitive account amounts in lock-screen notifications by default. Make delivery opt-in and user-specific.

## Next steps

1. Add native device registration and server-side dispatch through FCM/APNs/Expo.
2. Register native notification tokens after user consent; refresh and unregister on logout.
3. Add deep links, notification preferences, and device management.
4. Add biometric unlock and server-side device session revocation.
5. Test physical Android and iOS devices with different SSIDs and VPN configurations.
