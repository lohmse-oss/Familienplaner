package de.familie.planer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Homescreen-Widget im Standard-Android-Stil: moderne Kachel mit Icons – Titel mit App-Icon,
 * heutiger Tag (Einträge + Ampel), darunter Einkauf und Aufgaben mit Icon und Zahl.
 * Nutzt dieselben Daten wie das Nothing-Widget (SharedPreferences). Antippen öffnet die App.
 * Nur RemoteViews-erlaubte Views (LinearLayout/TextView/ImageView) – sonst "Widget kann nicht geladen werden".
 */
public class FamilyWidgetStandardProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) manager.updateAppWidget(id, build(context));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        manager.updateAppWidget(appWidgetId, build(context));
    }

    public static void refreshAll(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        int[] ids = manager.getAppWidgetIds(new ComponentName(ctx, FamilyWidgetStandardProvider.class));
        if (ids == null) return;
        for (int id : ids) manager.updateAppWidget(id, build(ctx));
    }

    static RemoteViews build(Context ctx) {
        try {
            return buildInner(ctx);
        } catch (Exception e) {
            // nie "Widget kann nicht geladen werden" riskieren – Fallback-Kachel
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_standard);
            v.setTextViewText(R.id.widget_title, "Familienplaner");
            v.setTextViewText(R.id.widget_today, "App öffnen");
            v.setTextViewText(R.id.widget_updated, "");
            v.setTextViewText(R.id.widget_shop, "");
            v.setTextViewText(R.id.widget_tasks, "");
            PendingIntent pi = PendingIntent.getActivity(ctx, 0, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.widget_root_std, pi);
            return v;
        }
    }

    private static RemoteViews buildInner(Context ctx) {
        String style = "dark";
        JSONObject root = null;
        try {
            String json = ctx.getSharedPreferences(FamilyWidgetProvider.PREFS, Context.MODE_PRIVATE).getString(FamilyWidgetProvider.KEY_DATA, null);
            if (json != null) {
                root = new JSONObject(json);
                style = root.optString("style", "dark");
            }
        } catch (Exception ignored) {
            root = null;
        }

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_standard);
        boolean light = "light".equals(style);
        int ink = light ? Color.parseColor("#0A0A0A") : Color.WHITE;
        int dim = light ? Color.parseColor("#6B6B70") : Color.parseColor("#C8C8CD");
        int accent = light ? Color.parseColor("#B3121B") : Color.parseColor("#FF4D55");
        if (light) v.setInt(R.id.widget_root_std, "setBackgroundResource", R.drawable.widget_bg_light);
        else if ("glass".equals(style)) v.setInt(R.id.widget_root_std, "setBackgroundResource", R.drawable.widget_bg_glass);
        else if ("transparent".equals(style)) v.setInt(R.id.widget_root_std, "setBackgroundColor", Color.TRANSPARENT);
        else v.setInt(R.id.widget_root_std, "setBackgroundResource", R.drawable.widget_bg_dark);

        float scale = (float) (root != null ? root.optDouble("scaleStandard", 1.0) : 1.0);
        v.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, 16f * scale);
        v.setTextViewTextSize(R.id.widget_updated, TypedValue.COMPLEX_UNIT_SP, 12f * scale);
        v.setTextViewTextSize(R.id.widget_today, TypedValue.COMPLEX_UNIT_SP, 14f * scale);
        v.setTextViewTextSize(R.id.widget_shop, TypedValue.COMPLEX_UNIT_SP, 13f * scale);
        v.setTextViewTextSize(R.id.widget_tasks, TypedValue.COMPLEX_UNIT_SP, 13f * scale);
        v.setInt(R.id.widget_icon, "setColorFilter", ink);
        v.setInt(R.id.widget_ic_shop, "setColorFilter", dim);
        v.setInt(R.id.widget_ic_tasks, "setColorFilter", dim);

        v.setTextViewText(R.id.widget_title, "Familienplaner");
        v.setTextColor(R.id.widget_title, ink);
        v.setTextViewText(R.id.widget_updated, root != null ? root.optString("updated", "") : "");
        v.setTextColor(R.id.widget_updated, dim);

        JSONArray days = root != null ? root.optJSONArray("days") : null;
        int idx = days != null ? FamilyWidgetProvider.todayIndex(days) : -1;
        JSONObject d = idx >= 0 ? days.optJSONObject(idx) : null;
        boolean alert = false;
        String todayLine;
        String shopLine;
        String tasksLine;
        if (d == null) {
            todayLine = "App öffnen für Details";
            shopLine = "";
            tasksLine = "";
        } else {
            String cov = d.optString("cov", "none");
            String covText = "ok".equals(cov) ? "Betreuung gesichert" : "maybe".equals(cov) ? "nur Homeoffice" : "gap".equals(cov) ? "Betreuung ungeklärt!" : "keine Betreuung nötig";
            alert = "gap".equals(cov);
            int n = d.optInt("n", 0);
            todayLine = "Heute (" + FamilyWidgetProvider.shortDate(d.optString("date")) + "): " + n + (n == 1 ? " Eintrag" : " Einträge") + " · " + covText;
            int shopN = root.optInt("shopN", 0);
            int taskN = root.optInt("taskN", 0);
            int overdue = root.optInt("taskOverdue", 0);
            shopLine = shopN == 0 ? "alles besorgt" : shopN + (shopN == 1 ? " Artikel offen" : " Artikel offen");
            tasksLine = taskN + (taskN == 1 ? " aktiv" : " aktiv");
            if (overdue > 0) {
                tasksLine += " · " + overdue + " überfällig!";
                alert = true;
            }
        }
        v.setTextViewText(R.id.widget_today, todayLine);
        v.setTextColor(R.id.widget_today, alert ? accent : ink);
        v.setTextViewText(R.id.widget_shop, shopLine);
        v.setTextColor(R.id.widget_shop, dim);
        v.setTextViewText(R.id.widget_tasks, tasksLine);
        v.setTextColor(R.id.widget_tasks, alert ? accent : dim);
        if (alert) {
            v.setInt(R.id.widget_ic_tasks, "setColorFilter", accent);
        }

        PendingIntent pi = PendingIntent.getActivity(ctx, 0, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root_std, pi);
        return v;
    }
}
