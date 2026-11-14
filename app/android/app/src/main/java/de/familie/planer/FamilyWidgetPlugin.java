package de.familie.planer;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Brücke zwischen App (JavaScript) und Homescreen-Widget:
 * Die App berechnet die Widget-Daten und legt sie hier als JSON ab, das Widget zeichnet sie.
 */
@CapacitorPlugin(name = "FamilyWidget")
public class FamilyWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json fehlt");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(FamilyWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(FamilyWidgetProvider.KEY_DATA, json)
            .apply();
        FamilyWidgetProvider.refreshAll(ctx);
        call.resolve();
    }
}
