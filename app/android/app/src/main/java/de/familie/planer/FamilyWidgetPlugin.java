package de.familie.planer;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Brücke zwischen App (JavaScript) und Android:
 *  - update:     Daten fürs Homescreen-Widget ablegen und das Widget neu zeichnen
 *  - configure:  Zugangsdaten für den Hintergrund-Abgleich (Hinweise vom Partner) hinterlegen und planen
 *  - getSeen / markSeen: bis zu welcher Server-Revision schon gemeldet wurde (verhindert doppelte Hinweise)
 */
@CapacitorPlugin(name = "FamilyWidget")
public class FamilyWidgetPlugin extends Plugin {

    private SharedPreferences syncPrefs() {
        return getContext().getSharedPreferences(PartnerSync.PREFS, Context.MODE_PRIVATE);
    }

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
        FamilyWidgetStandardProvider.refreshAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void configure(PluginCall call) {
        JSObject d = call.getData();
        SharedPreferences sp = syncPrefs();
        SharedPreferences.Editor e = sp.edit();
        e.putString("server", d.optString("server", ""));
        e.putString("code", d.optString("code", ""));
        e.putString("me", d.optString("me", ""));
        e.putBoolean("notify", d.optBoolean("notify", true));
        if (!sp.contains("seen")) e.putLong("seen", d.optLong("rev", 0));
        e.apply();
        PartnerSync.schedule(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getSeen(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("seen", syncPrefs().getLong("seen", 0));
        call.resolve(ret);
    }

    @PluginMethod
    public void markSeen(PluginCall call) {
        long rev = call.getData().optLong("rev", 0);
        SharedPreferences sp = syncPrefs();
        if (rev > sp.getLong("seen", 0)) sp.edit().putLong("seen", rev).apply();
        call.resolve();
    }
}
