package de.familie.planer;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;
import androidx.core.content.res.ResourcesCompat;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Grafiken für Android Auto (Medien-App): Tages-Kacheln im Stil des Homescreen-Widgets (Kreis mit Zahl, rot = Betreuung
 * ungeklärt), Symbole je Eintragsart in der Farbe der Person und große Karten (Tagesübersicht, Eintrag) für die
 * „Läuft gerade“-Ansicht. Alles wird zur Laufzeit mit Canvas gezeichnet – keine Bilddateien nötig.
 *
 * Pfade (siehe CarArtProvider):
 *   tile/day/<datum>/<label> · tile/shop · tile/tasks · tile/week
 *   icon/<art>/<modus>/<farbe ohne #> · card/day/<datum> · card/entry/<datum>/<index>
 */
final class CarArt {
    private CarArt() {}

    static final int BG = Color.parseColor("#14213D");
    static final int CARD = Color.parseColor("#1F2A44");
    static final int INK = Color.WHITE;
    static final int DIM = Color.parseColor("#9AA3B5");
    static final int RED = Color.parseColor("#E5484D");
    static final int AMBER = Color.parseColor("#E3A312");
    static final int GREEN = Color.parseColor("#2E9E6A");

    /** Emoji je Eintragsart – farbig, ohne eigene Bilddateien. */
    static String glyph(String kind, String mode) {
        switch (kind) {
            case "event": return "📅";
            case "info": return "🎫";
            case "task": return "✅";
            case "birthday": return "🎂";
            case "presence": return "trip".equals(mode) ? "✈️" : "homeoffice".equals(mode) ? "🏠" : "🌴";
            case "care": return "🧸";
            case "cover": return "🤝";
            case "shop": return "🛒";
            case "week": return "🗓️";
            default: return "•";
        }
    }

    static int kindColor(String kind) {
        switch (kind) {
            case "event": return Color.parseColor("#2A6F9E");
            case "info": return Color.parseColor("#8E6BC4");
            case "task": return Color.parseColor("#C8741C");
            case "birthday": return Color.parseColor("#C2336B");
            case "presence": return Color.parseColor("#2A8A5B");
            case "care": return RED;
            case "cover": return GREEN;
            default: return Color.parseColor("#1B4965");
        }
    }

    static Bitmap render(Context ctx, String path) {
        String[] p = path.split("/");
        JSONObject root = FamilyCarAppService.loadData(ctx);
        try {
            if (p.length >= 2 && "tile".equals(p[0])) {
                if ("day".equals(p[1]) && p.length >= 3) return dayTile(ctx, root, p[2], p.length >= 4 ? p[3] : "");
                if ("shop".equals(p[1])) return countTile(ctx, "🛒", "EINKAUF", root != null ? root.optInt("shopN", 0) : 0, false);
                if ("tasks".equals(p[1])) {
                    int n = root != null ? root.optInt("taskN", 0) : 0;
                    boolean alert = root != null && (root.optInt("taskOverdue", 0) > 0 || root.optInt("taskToday", 0) > 0);
                    return countTile(ctx, "✅", "AUFGABEN", n, alert);
                }
                if ("week".equals(p[1])) return countTile(ctx, "🗓️", "WEITERE TAGE", -1, false);
            }
            if (p.length >= 2 && "icon".equals(p[0])) {
                String kind = p[1];
                String mode = p.length >= 3 ? p[2] : "";
                String col = p.length >= 4 ? p[3] : "";
                return icon(kind, mode, col.isEmpty() ? kindColor(kind) : Color.parseColor("#" + col), "late".equals(mode));
            }
            if (p.length >= 3 && "card".equals(p[0])) {
                if ("day".equals(p[1])) return dayCard(ctx, root, p[2]);
                if ("entry".equals(p[1]) && p.length >= 4) return entryCard(ctx, root, p[2], Integer.parseInt(p[3]));
            }
        } catch (Exception ignored) {
            // fällt auf leere Kachel zurück
        }
        return countTile(ctx, "📅", "FAMILIENPLANER", -1, false);
    }

    // ---- Kacheln (Raster auf der Startseite) -----------------------------------------------------

    private static Typeface doto(Context ctx) {
        Typeface f = null;
        try {
            f = ResourcesCompat.getFont(ctx, R.font.doto_semibold);
        } catch (Exception ignored) {
            // Schrift nicht verfügbar
        }
        return f != null ? f : Typeface.DEFAULT_BOLD;
    }

    private static Bitmap canvasBitmap(int size) {
        return Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    }

    private static void roundBg(Canvas c, int size, int color) {
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setColor(color);
        c.drawRoundRect(new RectF(0, 0, size, size), size * 0.16f, size * 0.16f, bg);
    }

    private static void centered(Canvas c, Paint p, String s, float cx, float cy) {
        c.drawText(s, cx, cy - (p.ascent() + p.descent()) / 2f, p);
    }

    private static void fit(Paint p, String s, float size, float maxW) {
        p.setTextSize(size);
        float w = p.measureText(s);
        if (w > maxW) p.setTextSize(size * maxW / w);
    }

    /** Tag wie im Widget: oben Wochentag/„HEUTE“, Kreis mit Anzahl (rot = Betreuung ungeklärt, Ring = nur Homeoffice), unten Datum. */
    static Bitmap dayTile(Context ctx, JSONObject root, String date, String label) {
        int s = 256;
        Bitmap b = canvasBitmap(s);
        Canvas c = new Canvas(b);
        roundBg(c, s, BG);
        JSONObject d = findDay(root, date);
        int n = d != null ? d.optInt("n", 0) : 0;
        String cov = d != null ? d.optString("cov", "none") : "none";

        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
        t.setTypeface(doto(ctx));
        t.setTextAlign(Paint.Align.CENTER);
        t.setColor(INK);
        String top = label.isEmpty() ? weekdayShort(date).toUpperCase() : label.toUpperCase();
        fit(t, top, s * 0.15f, s * 0.86f);
        centered(c, t, top, s / 2f, s * 0.15f);
        t.setColor(DIM);
        fit(t, shortDate(date), s * 0.12f, s * 0.8f);
        centered(c, t, shortDate(date), s / 2f, s * 0.88f);

        float r = s * 0.24f;
        float cy = s * 0.52f;
        Paint sh = new Paint(Paint.ANTI_ALIAS_FLAG);
        if (n <= 0) {
            sh.setStyle(Paint.Style.STROKE);
            sh.setStrokeWidth(s * 0.03f);
            sh.setColor(DIM);
            c.drawCircle(s / 2f, cy, r, sh);
            sh.setStyle(Paint.Style.FILL);
            c.drawCircle(s / 2f, cy, s * 0.025f, sh);
        } else {
            boolean gap = "gap".equals(cov);
            boolean maybe = "maybe".equals(cov);
            sh.setStyle(Paint.Style.FILL);
            sh.setColor(gap ? RED : INK);
            c.drawCircle(s / 2f, cy, maybe ? r * 0.88f : r, sh);
            if (maybe) {
                sh.setStyle(Paint.Style.STROKE);
                sh.setStrokeWidth(s * 0.03f);
                sh.setColor(RED);
                c.drawCircle(s / 2f, cy, r, sh);
            }
            t.setColor(gap ? Color.WHITE : BG);
            String num = String.valueOf(n);
            fit(t, num, r * 1.25f, r * 1.6f);
            centered(c, t, num, s / 2f, cy);
        }
        return b;
    }

    /** Kachel mit großem Symbol und Zahl-Plakette (Einkauf, Aufgaben) bzw. nur Symbol (count < 0). */
    static Bitmap countTile(Context ctx, String glyph, String label, int count, boolean alert) {
        int s = 256;
        Bitmap b = canvasBitmap(s);
        Canvas c = new Canvas(b);
        roundBg(c, s, BG);
        Paint e = new Paint(Paint.ANTI_ALIAS_FLAG);
        e.setTextAlign(Paint.Align.CENTER);
        e.setTextSize(s * 0.36f);
        centered(c, e, glyph, s / 2f, s * 0.48f);
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG);
        t.setTypeface(doto(ctx));
        t.setTextAlign(Paint.Align.CENTER);
        t.setColor(DIM);
        fit(t, label, s * 0.12f, s * 0.86f);
        centered(c, t, label, s / 2f, s * 0.86f);
        if (count >= 0) {
            Paint badge = new Paint(Paint.ANTI_ALIAS_FLAG);
            badge.setColor(alert ? RED : (count > 0 ? INK : DIM));
            float br = s * 0.12f;
            c.drawCircle(s * 0.74f, s * 0.24f, br, badge);
            t.setColor(alert ? Color.WHITE : BG);
            String num = count > 99 ? "99+" : String.valueOf(count);
            fit(t, num, br * 1.2f, br * 1.6f);
            centered(c, t, num, s * 0.74f, s * 0.24f);
        }
        return b;
    }

    /** Rundes Symbol für Listeneinträge: Emoji auf der Farbe der Person (oder der Art). */
    static Bitmap icon(String kind, String mode, int color, boolean alert) {
        int s = 128;
        Bitmap b = canvasBitmap(s);
        Canvas c = new Canvas(b);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setColor(color);
        c.drawCircle(s / 2f, s / 2f, s / 2f, bg);
        if (alert) {
            bg.setStyle(Paint.Style.STROKE);
            bg.setStrokeWidth(s * 0.07f);
            bg.setColor(RED);
            c.drawCircle(s / 2f, s / 2f, s / 2f - s * 0.035f, bg);
        }
        Paint e = new Paint(Paint.ANTI_ALIAS_FLAG);
        e.setTextAlign(Paint.Align.CENTER);
        e.setTextSize(s * 0.5f);
        centered(c, e, glyph(kind, mode), s / 2f, s / 2f);
        return b;
    }

    // ---- Große Karten („Läuft gerade“) -----------------------------------------------------------

    /** Tagesübersicht: Kopf mit Datum und Ampel, darunter die Einträge als Zeilen mit Symbol, Uhrzeit und Titel. */
    static Bitmap dayCard(Context ctx, JSONObject root, String date) {
        int s = 720;
        Bitmap b = canvasBitmap(s);
        Canvas c = new Canvas(b);
        roundBg(c, s, BG);
        JSONObject d = findDay(root, date);
        String cov = d != null ? d.optString("cov", "none") : "none";
        List<JSONObject> list = entriesOf(root, date);

        TextPaint h = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        h.setTypeface(doto(ctx));
        h.setColor(INK);
        h.setTextSize(s * 0.075f);
        c.drawText(longDate(date), s * 0.06f, s * 0.11f, h);
        // Ampel-Streifen
        if (!"none".equals(cov)) {
            Paint st = new Paint(Paint.ANTI_ALIAS_FLAG);
            st.setColor("gap".equals(cov) ? RED : "maybe".equals(cov) ? AMBER : GREEN);
            c.drawRoundRect(new RectF(s * 0.06f, s * 0.14f, s * 0.94f, s * 0.155f), 6, 6, st);
            TextPaint ct = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            ct.setColor(st.getColor());
            ct.setTextSize(s * 0.04f);
            ct.setFakeBoldText(true);
            c.drawText("gap".equals(cov) ? "Betreuung ungeklärt" : "maybe".equals(cov) ? "Betreuung nur per Homeoffice" : "Betreuung gesichert", s * 0.06f, s * 0.205f, ct);
        }
        float y = s * 0.27f;
        float row = s * 0.095f;
        int max = 7;
        if (list.isEmpty()) {
            TextPaint m = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            m.setColor(DIM);
            m.setTextSize(s * 0.055f);
            m.setTextAlign(Paint.Align.CENTER);
            c.drawText("Nichts geplant 🎉", s / 2f, s * 0.55f, m);
            return b;
        }
        for (int i = 0; i < list.size() && i < max; i++) {
            JSONObject e = list.get(i);
            if (i == max - 1 && list.size() > max) {
                TextPaint m = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                m.setColor(DIM);
                m.setTextSize(s * 0.045f);
                c.drawText("+ " + (list.size() - max + 1) + " weitere", s * 0.17f, y + row * 0.45f, m);
                break;
            }
            drawRow(c, e, s, y, row);
            y += row;
        }
        return b;
    }

    private static void drawRow(Canvas c, JSONObject e, int s, float y, float row) {
        int col = colorOf(e);
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
        dot.setColor(col);
        float cx = s * 0.1f;
        float cy = y + row * 0.4f;
        c.drawCircle(cx, cy, row * 0.38f, dot);
        Paint em = new Paint(Paint.ANTI_ALIAS_FLAG);
        em.setTextAlign(Paint.Align.CENTER);
        em.setTextSize(row * 0.4f);
        centered(c, em, glyph(e.optString("kind"), e.optString("mode")), cx, cy);

        TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(INK);
        tp.setTextSize(s * 0.046f);
        tp.setFakeBoldText(true);
        String time = e.optString("time", "");
        float x = s * 0.17f;
        if (!time.isEmpty()) {
            TextPaint tt = new TextPaint(tp);
            tt.setColor(AMBER);
            c.drawText(time, x, cy - s * 0.004f, tt);
            x += tt.measureText(time) + s * 0.02f;
        }
        String title = TextUtils.ellipsize(e.optString("title", ""), tp, s * 0.94f - x, TextUtils.TruncateAt.END).toString();
        c.drawText(title, x, cy - s * 0.004f, tp);
        String detail = e.optString("detail", "");
        if (!detail.isEmpty()) {
            TextPaint dp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            dp.setColor(DIM);
            dp.setTextSize(s * 0.033f);
            c.drawText(TextUtils.ellipsize(detail, dp, s * 0.77f, TextUtils.TruncateAt.END).toString(), s * 0.17f, cy + s * 0.038f, dp);
        }
    }

    /** Einzelner Eintrag groß: Symbol, Uhrzeit, Titel (zweizeilig), Details, Farbbalken der Person. */
    static Bitmap entryCard(Context ctx, JSONObject root, String date, int index) {
        int s = 720;
        Bitmap b = canvasBitmap(s);
        Canvas c = new Canvas(b);
        roundBg(c, s, BG);
        List<JSONObject> list = entriesOf(root, date);
        if (index < 0 || index >= list.size()) return dayCard(ctx, root, date);
        JSONObject e = list.get(index);
        int col = colorOf(e);
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
        bar.setColor(col);
        c.drawRoundRect(new RectF(0, 0, s * 0.035f, s), 0, 0, bar);
        c.drawCircle(s / 2f, s * 0.27f, s * 0.15f, bar);
        Paint em = new Paint(Paint.ANTI_ALIAS_FLAG);
        em.setTextAlign(Paint.Align.CENTER);
        em.setTextSize(s * 0.15f);
        centered(c, em, glyph(e.optString("kind"), e.optString("mode")), s / 2f, s * 0.27f);

        TextPaint d = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        d.setTypeface(doto(ctx));
        d.setColor(DIM);
        d.setTextAlign(Paint.Align.CENTER);
        d.setTextSize(s * 0.05f);
        String time = e.optString("time", "");
        c.drawText(longDate(date) + (time.isEmpty() ? "" : " · " + time), s / 2f, s * 0.52f, d);

        TextPaint t = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        t.setColor(INK);
        t.setFakeBoldText(true);
        t.setTextAlign(Paint.Align.CENTER);
        t.setTextSize(s * 0.075f);
        List<String> lines = wrap(e.optString("title", ""), t, s * 0.86f, 2);
        float y = s * 0.64f;
        for (String l : lines) {
            c.drawText(l, s / 2f, y, t);
            y += s * 0.09f;
        }
        String detail = e.optString("detail", "");
        if (!detail.isEmpty()) {
            TextPaint dp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            dp.setColor(DIM);
            dp.setTextAlign(Paint.Align.CENTER);
            dp.setTextSize(s * 0.045f);
            c.drawText(TextUtils.ellipsize(detail, dp, s * 0.86f, TextUtils.TruncateAt.END).toString(), s / 2f, y + s * 0.01f, dp);
        }
        return b;
    }

    // ---- Hilfen -------------------------------------------------------------------------------

    static int colorOf(JSONObject e) {
        String col = e.optString("color", "");
        try {
            if (!col.isEmpty()) return Color.parseColor(col);
        } catch (Exception ignored) {
            // ungültige Farbe → Farbe der Art
        }
        return kindColor(e.optString("kind", ""));
    }

    /** Text auf höchstens maxLines Zeilen umbrechen; was nicht passt, endet mit „…“. */
    private static List<String> wrap(String s, TextPaint p, float maxW, int maxLines) {
        List<String> out = new ArrayList<>();
        String[] words = s.split(" ");
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String w = words[i];
            String next = line.length() == 0 ? w : line + " " + w;
            if (p.measureText(next) <= maxW || line.length() == 0) {
                line = new StringBuilder(next);
            } else {
                out.add(line.toString());
                if (out.size() == maxLines - 1) {
                    StringBuilder rest = new StringBuilder(w);
                    for (int j = i + 1; j < words.length; j++) rest.append(' ').append(words[j]);
                    out.add(TextUtils.ellipsize(rest.toString(), p, maxW, TextUtils.TruncateAt.END).toString());
                    return out;
                }
                line = new StringBuilder(w);
            }
        }
        if (line.length() > 0) out.add(TextUtils.ellipsize(line.toString(), p, maxW, TextUtils.TruncateAt.END).toString());
        return out;
    }

    static JSONObject findDay(JSONObject root, String date) {
        JSONArray days = root != null ? root.optJSONArray("days") : null;
        if (days == null) return null;
        for (int i = 0; i < days.length(); i++) {
            JSONObject d = days.optJSONObject(i);
            if (d != null && date.equals(d.optString("date"))) return d;
        }
        return null;
    }

    static List<JSONObject> entriesOf(JSONObject root, String date) {
        List<JSONObject> list = new ArrayList<>();
        JSONArray entries = root != null ? root.optJSONArray("entries") : null;
        if (entries == null) return list;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject e = entries.optJSONObject(i);
            if (e != null && date.equals(e.optString("date"))) list.add(e);
        }
        return list;
    }

    private static String weekdayShort(String iso) {
        return fmt(iso, "EE").replace(".", "");
    }

    static String shortDate(String iso) {
        return fmt(iso, "dd.MM.");
    }

    static String longDate(String iso) {
        return fmt(iso, "EEEE, d. MMMM");
    }

    private static String fmt(String iso, String pattern) {
        try {
            java.util.Date d = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.GERMANY).parse(iso);
            return new java.text.SimpleDateFormat(pattern, java.util.Locale.GERMANY).format(d);
        } catch (Exception e) {
            return iso;
        }
    }
}
