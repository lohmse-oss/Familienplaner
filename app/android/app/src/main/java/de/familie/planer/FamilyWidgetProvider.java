package de.familie.planer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;
import androidx.core.content.res.ResourcesCompat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Homescreen-Widget „Heute“ im Nothing-Stil – nur Grafik:
 * drei rollierende Tage (heute, morgen, übermorgen), die Einkaufsliste und die aktiven Aufgaben als Kreise mit Zahlen.
 *   leerer Ring      = nichts los
 *   gefüllter Kreis  = es stehen Einträge an (Zahl = Anzahl)
 *   roter Kreis      = Betreuung ungeklärt (bzw. Aufgaben heute fällig oder überfällig)
 * Jeder Kreis ist antippbar: Tag-Kreise öffnen den Tag, Einkauf die Einkaufsliste, Aufgaben die Aufgaben.
 * Die App liefert Daten für die nächsten Tage; das Widget wählt daraus den heutigen Tag und aktualisiert sich
 * dadurch auch ohne App-Start, solange die Daten reichen.
 */
public class FamilyWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "familienplaner_widget";
    public static final String KEY_DATA = "data";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) update(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        update(context, manager, appWidgetId);
    }

    public static void refreshAll(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        int[] ids = manager.getAppWidgetIds(new ComponentName(ctx, FamilyWidgetProvider.class));
        if (ids == null) return;
        for (int id : ids) update(ctx, manager, id);
    }

    private static void update(Context ctx, AppWidgetManager manager, int id) {
        Bundle o = manager.getAppWidgetOptions(id);
        float density = ctx.getResources().getDisplayMetrics().density;
        int wDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) : 250;
        int hDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80) : 80;
        manager.updateAppWidget(id, build(ctx, Math.max(200, (int) (wDp * density)), Math.max(70, (int) (hDp * density))));
    }

    static RemoteViews build(Context ctx, int w, int h) {
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

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_family);
        if ("light".equals(style)) v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_light);
        else if ("glass".equals(style)) v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_glass);
        else if ("transparent".equals(style)) v.setInt(R.id.widget_root, "setBackgroundColor", Color.TRANSPARENT);
        else v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_dark);

        // Speicherlimit für Widget-Bitmaps im Blick behalten
        int maxPx = 700_000;
        if ((long) w * h > maxPx) {
            float f = (float) Math.sqrt((double) maxPx / ((long) w * h));
            w = (int) (w * f);
            h = (int) (h * f);
        }
        v.setImageViewBitmap(R.id.iv_graphic, render(ctx, root, style, w, h));

        PendingIntent pi = PendingIntent.getActivity(ctx, 0, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);

        // Direktsprünge: Tag-Kreise → Tag, Einkauf → Einkaufsliste, Aufgaben → Aufgaben
        int[] cells = { R.id.cell0, R.id.cell1, R.id.cell2, R.id.cell3, R.id.cell4 };
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        int idx = days != null ? todayIndex(days) : -1;
        for (int i = 0; i < cells.length; i++) {
            String uri;
            if (i == 3) uri = "de.familie.planer://shop";
            else if (i == 4) uri = "de.familie.planer://tasks";
            else if (idx >= 0) uri = "de.familie.planer://day/" + days.optJSONObject(Math.min(idx + i, days.length() - 1)).optString("date");
            else uri = "de.familie.planer://today";
            v.setOnClickPendingIntent(cells[i], link(ctx, 10 + i, uri));
        }
        return v;
    }

    private static PendingIntent link(Context ctx, int requestCode, String uri) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        i.setClass(ctx, MainActivity.class);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Heutiger Index in den Tagesdaten oder -1. */
    private static int todayIndex(JSONArray days) {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(new Date());
        for (int i = 0; i < days.length(); i++) {
            if (today.equals(days.optJSONObject(i).optString("date"))) return i;
        }
        return -1;
    }

    private static String weekday(String isoDate) {
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).parse(isoDate);
            String s = new SimpleDateFormat("EEE", Locale.GERMANY).format(d);
            return s.replace(".", "").toUpperCase(Locale.GERMANY);
        } catch (ParseException e) {
            return "";
        }
    }

    private static String shortDate(String isoDate) {
        return isoDate.length() >= 10 ? isoDate.substring(8, 10) + "." + isoDate.substring(5, 7) + "." : "";
    }

    private static void centered(Canvas c, Paint p, String text, float cx, float cy) {
        c.drawText(text, cx, cy - (p.ascent() + p.descent()) / 2f, p);
    }

    /** Text zentriert zeichnen und bei Bedarf so weit verkleinern, dass er in die Zelle passt. */
    private static void centeredFit(Canvas c, Paint p, String text, float cx, float cy, float size, float maxW) {
        p.setTextSize(size);
        float tw = p.measureText(text);
        if (tw > maxW) p.setTextSize(size * maxW / tw);
        centered(c, p, text, cx, cy);
    }

    static Bitmap render(Context ctx, JSONObject root, String style, int w, int h) {
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        // Farben (Nothing: Weiß auf Schwarz, Rot als einzige Akzentfarbe)
        int ink = Color.WHITE;
        int onInk = Color.BLACK;
        int dim = Color.parseColor("#8E8E93");
        int accent = Color.parseColor("#D71921");
        boolean shadow = false;
        if ("light".equals(style)) {
            ink = Color.parseColor("#0A0A0A");
            onInk = Color.WHITE;
            dim = Color.parseColor("#6B6B70");
        } else if ("glass".equals(style) || "transparent".equals(style)) {
            dim = Color.parseColor("#D4D4D9");
            accent = Color.parseColor("#FF4D55");
            shadow = true;
        }

        Typeface font = ResourcesCompat.getFont(ctx, R.font.doto_semibold);
        if (font == null) font = Typeface.DEFAULT_BOLD;

        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setTypeface(font);
        text.setTextAlign(Paint.Align.CENTER);
        Paint shape = new Paint(Paint.ANTI_ALIAS_FLAG);
        if (shadow) {
            text.setShadowLayer(h * 0.03f, 0, h * 0.01f, 0x99000000);
            shape.setShadowLayer(h * 0.03f, 0, h * 0.01f, 0x99000000);
        }

        JSONArray days = root != null ? root.optJSONArray("days") : null;
        int idx = days != null ? todayIndex(days) : -1;
        if (idx < 0) {
            text.setColor(dim);
            text.setTextSize(h * 0.2f);
            centered(c, text, "APP ÖFFNEN", w / 2f, h / 2f);
            return bmp;
        }

        float pad = h * 0.06f;
        float cellW = (w - 2 * pad) / 5f;
        float labelSize = Math.min(h * 0.14f, cellW * 0.26f);
        float r = Math.min(cellW * 0.36f, h * 0.27f);
        float cy = h * 0.52f;

        for (int i = 0; i < 5; i++) {
            float cx = pad + cellW * (i + 0.5f);
            String label;
            String foot;
            int n;
            String cov = "none";
            boolean counter = i >= 3; // Einkauf und Aufgaben sind reine Zähler
            boolean alert = false;
            if (i == 3) {
                label = "EINKAUF";
                foot = "OFFEN";
                n = root.optInt("shopN", 0);
            } else if (i == 4) {
                label = "AUFGABEN";
                foot = "AKTIV";
                n = root.optInt("taskN", 0);
                // Rot, sobald heute etwas fällig ist oder schon überfällig ist
                int overdue = root.optInt("taskOverdue", 0);
                int dueToday = root.optInt("taskToday", 0);
                alert = overdue > 0 || dueToday > 0;
                if (overdue > 0) foot = "ÜBERFÄLLIG";
                else if (dueToday > 0) foot = "HEUTE FÄLLIG";
            } else {
                JSONObject d = days.optJSONObject(Math.min(idx + i, days.length() - 1));
                // Reicht die Datenmenge nicht mehr, bleibt der letzte bekannte Tag stehen
                label = i == 0 ? "HEUTE" : weekday(d.optString("date"));
                foot = shortDate(d.optString("date"));
                n = d.optInt("n", 0);
                cov = d.optString("cov", "none");
            }

            // Beschriftung oben und unten
            float maxW = cellW * 0.94f;
            text.setColor(i == 0 ? ink : dim);
            centeredFit(c, text, label, cx, h * 0.15f, labelSize, maxW);
            text.setColor(dim);
            centeredFit(c, text, foot, cx, h * 0.90f, labelSize * 0.8f, maxW);

            // Kreis
            float sw = Math.max(2f, r * 0.14f);
            if (n <= 0) {
                shape.setStyle(Paint.Style.STROKE);
                shape.setStrokeWidth(sw);
                shape.setColor(dim);
                c.drawCircle(cx, cy, r - sw / 2f, shape);
                shape.setStyle(Paint.Style.FILL);
                c.drawCircle(cx, cy, sw * 0.7f, shape);
            } else {
                boolean gap = alert || (!counter && "gap".equals(cov));
                boolean maybe = !counter && "maybe".equals(cov);
                shape.setStyle(Paint.Style.FILL);
                shape.setColor(gap ? accent : ink);
                c.drawCircle(cx, cy, maybe ? r - sw : r, shape);
                if (maybe) {
                    shape.setStyle(Paint.Style.STROKE);
                    shape.setStrokeWidth(sw * 0.8f);
                    shape.setColor(accent);
                    c.drawCircle(cx, cy, r - sw * 0.4f, shape);
                }
                String num = String.valueOf(n);
                text.setColor(gap ? Color.WHITE : onInk);
                text.setTextSize(num.length() == 1 ? r * 1.15f : num.length() == 2 ? r * 0.95f : r * 0.7f);
                text.clearShadowLayer();
                centered(c, text, num, cx, cy);
                if (shadow) text.setShadowLayer(h * 0.03f, 0, h * 0.01f, 0x99000000);
            }
        }

        // gepunktete Trennlinie vor der Einkaufsliste
        shape.setStyle(Paint.Style.FILL);
        shape.setColor(dim);
        float sx = pad + cellW * 3f;
        for (float y = h * 0.22f; y < h * 0.84f; y += h * 0.07f) c.drawCircle(sx, y, Math.max(1.5f, h * 0.012f), shape);
        return bmp;
    }
}
