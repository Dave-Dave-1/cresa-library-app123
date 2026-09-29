# Cresa E-library Flutter app

This is the Flutter mobile client for the Cresa E-library web application. It uses the same Node/MySQL API and mirrors the core web workflows: authentication, catalogue browsing, saved resources, Community, CresaBot, notifications, profile settings, and lecturer tools.

## Prerequisites

Install Flutter 3.22 or newer, Android Studio, and an Android emulator or physical device. Flutter was not installed in the web workspace when this client was generated, so run `flutter create .` inside this folder once Flutter is available to generate the Android/iOS platform runners.

## Configure the API

The phone must be on the same Wi-Fi network as the computer running the API. Start the web API, then run the mobile client with the computer LAN address:

```powershell
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.96.165.217:3001
```

Replace the IP with the current computer address. Do not use `localhost` on a physical phone.

## Included mobile flows

- Student and lecturer sign in/register
- Overview and catalogue browsing
- Search and saved resources
- Community posts, comments, reactions, circles, mention suggestions, and live notification stream fallback polling
- Account-scoped notification popover
- Profile, Unit, preferences, password, and photo selection
- Lecturer dashboard account and catalogue entry points
- CresaBot conversation panel using the same `/api/ai/chat` contract

The client intentionally uses the existing backend rather than duplicating business logic in Dart.
