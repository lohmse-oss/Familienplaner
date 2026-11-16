package de.familie.planer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigenes Plugin: die App schickt die Daten für das Homescreen-Widget
        registerPlugin(FamilyWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
