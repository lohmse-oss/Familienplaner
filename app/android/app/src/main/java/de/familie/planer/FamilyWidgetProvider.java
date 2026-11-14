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
 * Homescreen-Widget „Heute“ im Nothing-Stil: Punktmatrix-Schrift, Schwarz/Weiß, rote Warnfarbe.
 * Hintergrund wählbar: transparent, Glas, dunkel, hell (Einstellung in der App).
 * Die App liefert Daten für die nächsten Tage; das Widget wählt daraus den heutigen Tag
 * (und aktualisiert sich dadurch auch ohne App-Start, solange die Daten reichen).
 */
public class FamilyWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "familienplaner_widget";
    public static final String KEY_DATA = "data";

    private static final int[] ALL_TEXT = {
        R.id.tv_date, R.id.tv_cov, R.id.tv_sub, R.id.tv_sep1, R.id.tv_p1n, R.id.tv_p1s, R.id.tv_p2n, R.id.tv_p2s,
        R.id.tv_need, R.id.tv_sep2, R.id.tv_next, R.id.tv_shop, R.id.tv_updated
    };
    private static final int[] SECONDARY = { R.id.tv_sub, R.id.tv_sep1, R.id.tv_sep2, R.id.tv_shop, R.id.tv_updated };

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

    private static void setText(RemoteViews v, int id, String text) {
        if (text == null || text.length() == 0) {
            v.setViewVisibility(id, View.GONE);
        } else {
            v.setViewVisibility(id, View.VISIBLE);
            v.setTextViewText(id, text);
        }
    }

    static RemoteViews build(Context ctx) {
        String style = "dark";
        JSONObject root = null;
        try {
            String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
            if (json != null) {
                root = new JSONObject(json);
                style = root.optString("style", "dark");
            }
        } catch (Exception ignored) {
            root = null;
        }

        boolean shadow = "transparent".equals(style) || "glass".equals(style);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), shadow ? R.layout.widget_family_shadow : R.layout.widget_family);

        // Farben je Stil (Nothing: Weiß auf Schwarz, Rot als einzige Akzentfarbe)
        int primary;
        int secondary;
        int accent;
        if ("light".equals(style)) {
            primary = Color.parseColor("#0A0A0A");
            secondary = Color.parseColor("#6B6B70");
            accent = Color.parseColor("#D71921");
            v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_light);
        } else if ("glass".equals(style)) {
            primary = Color.WHITE;
            secondary = Color.parseColor("#C9C9CE");
            accent = Color.parseColor("#FF4D55");
            v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_glass);
        } else if ("transparent".equals(style)) {
            primary = Color.WHITE;
            secondary = Color.parseColor("#D9D9DE");
            accent = Color.parseColor("#FF4D55");
            v.setInt(R.id.widget_root, "setBackgroundColor", Color.TRANSPARENT);
        } else {
            primary = Color.WHITE;
            secondary = Color.parseColor("#8E8E93");
            accent = Color.parseColor("#D71921");
            v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_dark);
        }
        for (int id : ALL_TEXT) v.setTextColor(id, primary);
        for (int id : SECONDARY) v.setTextColor(id, secondary);

        // Tippen öffnet die App
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);

        try {
            if (root == null) throw new IllegalStateException("noch keine Daten");
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
            String covText = d.optString("covText", "");
            String glyph = "gap".equals(cov) ? "● " : "maybe".equals(cov) ? "◐ " : "ok".equals(cov) ? "○ " : "";
            v.setTextViewText(R.id.tv_date, d.optString("label", "Heute"));
            setText(v, R.id.tv_sub, d.optString("sub", ""));
            setText(v, R.id.tv_cov, covText.length() == 0 ? "" : glyph + covText);
            v.setTextColor(R.id.tv_cov, "gap".equals(cov) ? accent : "maybe".equals(cov) ? primary : secondary);

            JSONArray parents = d.optJSONArray("parents");
            int[] names = { R.id.tv_p1n, R.id.tv_p2n };
            int[] stats = { R.id.tv_p1s, R.id.tv_p2s };
            for (int i = 0; i < 2; i++) {
                if (parents != null && i < parents.length()) {
                    JSONArray pair = parents.getJSONArray(i);
                    setText(v, names[i], pair.getString(0));
                    setText(v, stats[i], pair.getString(1));
                } else {
                    v.setViewVisibility(names[i], View.GONE);
                    v.setViewVisibility(stats[i], View.GONE);
                }
            }

            setText(v, R.id.tv_need, d.optString("need", ""));
            if ("gap".equals(cov)) v.setTextColor(R.id.tv_need, accent);

            JSONArray next = d.optJSONArray("next");
            StringBuilder sb = new StringBuilder();
            if (next != null) {
                for (int i = 0; i < next.length(); i++) {
                    if (i > 0) sb.append('\n');
                    sb.append(next.getString(i));
                }
            }
            setText(v, R.id.tv_next, sb.toString());
            v.setViewVisibility(R.id.tv_sep2, sb.length() == 0 ? View.GONE : View.VISIBLE);
            setText(v, R.id.tv_shop, root.optString("shop", ""));
            setText(v, R.id.tv_updated, root.optString("updated", ""));
        } catch (Exception e) {
            v.setTextViewText(R.id.tv_date, "Familie");
            v.setViewVisibility(R.id.tv_cov, View.GONE);
            v.setViewVisibility(R.id.tv_sub, View.GONE);
            v.setViewVisibility(R.id.tv_p2n, View.GONE);
            v.setViewVisibility(R.id.tv_p2s, View.GONE);
            v.setViewVisibility(R.id.tv_need, View.GONE);
            v.setViewVisibility(R.id.tv_sep2, View.GONE);
            v.setViewVisibility(R.id.tv_next, View.GONE);
            v.setViewVisibility(R.id.tv_shop, View.GONE);
            v.setViewVisibility(R.id.tv_updated, View.GONE);
            v.setViewVisibility(R.id.tv_p1n, View.GONE);
            v.setViewVisibility(R.id.tv_p1s, View.VISIBLE);
            v.setTextViewText(R.id.tv_p1s, "Bitte die App öffnen, um das Widget zu füllen.");
        }
        return v;
    }
}
