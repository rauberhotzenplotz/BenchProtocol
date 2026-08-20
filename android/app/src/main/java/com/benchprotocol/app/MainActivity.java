package com.benchprotocol.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Der schmale Scroll-Balken rechts kommt von der WebView selbst, nicht
    // von der Seite (CSS scrollbar-width:none in global.css blendet nur
    // von Inhalten gezeichnete Scrollbars aus, nicht diese native
    // Android-View-Anzeige) - lässt sich nur hier abschalten, nicht per CSS.
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setVerticalScrollBarEnabled(false);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);
    }
}
