# Tauri Plugin Predictive Back

Android predictive-back ("peek") gesture support for Cadence, ported from Threshold's plugin of the same name.

This plugin bridges Android's `OnBackAnimationCallback` (API 34+ — `OnBackInvokedDispatcher` registration itself dates to API 33, but the animated callback with progress wasn't added until API 34) to the webview, letting the React frontend render a real-time, scrubbable back-gesture animation instead of a discrete back-button press. Below API 34, the system back button behaves as it always has.

## Android Permissions

None required — the plugin only uses `Activity.getOnBackInvokedDispatcher()`, a standard platform API with no manifest permission of its own. The manifest injection pattern (`build.rs`) is still implemented, with an empty permission block, so the mechanism is ready if that ever changes.

The other manifest requirement, `android:enableOnBackInvokedCallback="true"` on the `<application>` tag, ships in the plugin's own `android/src/main/AndroidManifest.xml` and merges into the consuming app's final manifest automatically via Android's standard Gradle library-manifest merge. No consumer-side wiring is needed.

## Setup

1. Add the plugin to `apps/cadence/src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-predictive-back = { path = "../../../plugins/predictive-back" }
```

2. Enable the capability in `capabilities/default.json`:

```json
"permissions": [
  "predictive-back:default"
]
```

3. `guest-js/index.ts` isn't published as its own workspace package, since Cadence has a single consuming app today, and a plain relative import across the `plugins/` boundary can't resolve `@tauri-apps/api` (it isn't hoisted to a shared ancestor `node_modules`). Cadence's own copy of these bindings lives inline in `apps/cadence/src/predictiveBackController.ts` — keep the two in sync by hand if either changes. Should a second consumer (e.g. `cadence-wear`) ever need this, that's the point to promote `guest-js/` to a real workspace package instead.

## Usage

```ts
import { listen } from '@tauri-apps/api/event';
import { setCanGoBack, PREDICTIVE_BACK_EVENT, type PredictiveBackEvent } from '...';

await setCanGoBack(true);

const unlisten = await listen<PredictiveBackEvent>(PREDICTIVE_BACK_EVENT, (event) => {
	console.log(event.payload.type, event.payload.progress);
});
```
