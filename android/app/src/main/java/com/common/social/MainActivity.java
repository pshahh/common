package com.common.social;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyLightStatusBarIcons();
    }

    // Capacitor's own edge-to-edge/splash-screen handling can reset the
    // system bar appearance shortly after onCreate runs, so re-apply it
    // whenever the window regains focus (e.g. after the splash screen is
    // dismissed, or when returning to the app) rather than relying on a
    // single call at startup.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyLightStatusBarIcons();
        }
    }

    private void applyLightStatusBarIcons() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
    }
}
