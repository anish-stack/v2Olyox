package com.olyoxpvt.OlyoxDriverApp

import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BubbleModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public BubbleModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "BubbleModule";
    }

    @ReactMethod
    public void startBubbleService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + reactContext.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
        } else {
            Intent serviceIntent = new Intent(reactContext, FloatingBubbleService.class);
            reactContext.startService(serviceIntent);
        }
    }

    @ReactMethod
    public void stopBubbleService() {
        Intent serviceIntent = new Intent(reactContext, FloatingBubbleService.class);
        reactContext.stopService(serviceIntent);
    }
}
