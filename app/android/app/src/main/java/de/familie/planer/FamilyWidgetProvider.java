package de.familie.planer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Homescreen-Widget „Heute“: Status der Eltern, Betreuungs-Ampel, nächste Termine, Einkaufsliste.
 * Die App liefert Daten für die nächsten Tage; das Widget wählt daraus den heutigen Tag
 * (und aktualisiert sich dadurch auch ohne App-Start, solange die Daten reichen).
 */
public class FamilyWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "familienplaner_widget";
    public static final String KEY_DATA = "data";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    public static void refreshAll(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        int[] ids = manager.getAppWidgetIds(new ComponentName(ctx, FamilyWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(ctx);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static int coverageColor(String cov) {
        if ("ok".equals(cov)) return Color.parseColor("#2E9E6A");
        if ("maybe".equals(cov)) return Color.parseColor("#C98B00");
        if ("gap".equals(cov)) return Color.parseColor("#D64545");
        return Color.parseColor("#888888");
    }

    private static void setText(RemoteViews v, int id, String text) {
        if (text == null || text.length() == 0) {
            v.setViewVisibility(id, View.GONE);
        } else {
            v.setViewVisibility(id, View.VISIBLE);
            v.setTextViewText(id, text);
        }
    }

    static RemoteViews build(Context ctx) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_family);

        // Tippen öffnet die App
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);

        try {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String json = sp.getString(KEY_DATA, null);
            if (json == null) throw new IllegalStateException("noch keine Daten");

            JSONObject root = new JSONObject(json);
            JSONArray days = root.getJSONArray("days");
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(new Date());
            JSONObject d = null;
            for (int i = 0; i < days.length(); i++) {
                JSONObject x = days.getJSONObject(i);
                if (today.equals(x.getString("date"))) {
                    d = x;
                    break;
                }
            }
            if (d == null) throw new IllegalStateException("Daten veraltet");

            String cov = d.optString("cov", "none");
            v.setTextViewText(R.id.tv_date, d.optString("label", "Heute"));
            setText(v, R.id.tv_cov, d.optString("covText", ""));
            v.setTextColor(R.id.tv_cov, coverageColor(cov));
            setText(v, R.id.tv_parents, d.optString("parents", ""));
            setText(v, R.id.tv_need, d.optString("need", ""));
            if ("gap".equals(cov)) v.setTextColor(R.id.tv_need, coverageColor(cov));

            JSONArray next = d.optJSONArray("next");
            StringBuilder sb = new StringBuilder();
            if (next != null) {
                for (int i = 0; i < next.length(); i++) {
                    if (i > 0) sb.append('\n');
                    sb.append(next.getString(i));
                }
            }
            setText(v, R.id.tv_next, sb.toString());
            setText(v, R.id.tv_shop, root.optString("shop", ""));
            setText(v, R.id.tv_updated, root.optString("updated", ""));
        } catch (Exception e) {
            v.setTextViewText(R.id.tv_date, "Familienplaner");
            v.setViewVisibility(R.id.tv_cov, View.GONE);
            v.setViewVisibility(R.id.tv_need, View.GONE);
            v.setViewVisibility(R.id.tv_next, View.GONE);
            v.setViewVisibility(R.id.tv_shop, View.GONE);
            v.setViewVisibility(R.id.tv_updated, View.GONE);
            v.setViewVisibility(R.id.tv_parents, View.VISIBLE);
            v.setTextViewText(R.id.tv_parents, "Bitte die App öffnen, um das Widget zu füllen.");
        }
        return v;
    }
}
