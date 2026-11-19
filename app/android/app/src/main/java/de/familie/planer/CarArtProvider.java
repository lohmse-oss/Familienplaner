package de.familie.planer;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;

/**
 * Liefert Android Auto die Grafiken der Medien-App (Kacheln, Symbole, Karten) als PNG.
 * Android Auto lädt Bilder nur über content://-Adressen; der Dienst gibt dem Auto-Host Leserechte (grantUriPermission).
 * Die Bilder werden bei Bedarf gezeichnet (CarArt) und kurz im Cache abgelegt.
 * Adresse: content://<paket>.carart/<pfad>.png?v=<Datenstand> – der Datenstand sorgt dafür, dass das Auto neue Bilder lädt.
 */
public class CarArtProvider extends ContentProvider {

    static Uri uri(android.content.Context ctx, String path, String version) {
        return new Uri.Builder()
                .scheme("content")
                .authority(ctx.getPackageName() + ".carart")
                .path(path + ".png")
                .appendQueryParameter("v", version)
                .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        String path = uri.getPath();
        if (path == null) throw new FileNotFoundException();
        if (path.startsWith("/")) path = path.substring(1);
        if (path.endsWith(".png")) path = path.substring(0, path.length() - 4);
        if (path.contains("..")) throw new FileNotFoundException();
        File dir = new File(getContext().getCacheDir(), "carart");
        if (!dir.exists() && !dir.mkdirs()) throw new FileNotFoundException();
        String version = uri.getQueryParameter("v");
        File f = new File(dir, (path + "_" + (version != null ? version : "")).replaceAll("[^A-Za-z0-9_.-]", "_") + ".png");
        if (!f.exists()) {
            Bitmap b = CarArt.render(getContext(), path);
            try (FileOutputStream out = new FileOutputStream(f)) {
                b.compress(Bitmap.CompressFormat.PNG, 100, out);
            } catch (Exception e) {
                throw new FileNotFoundException(e.getMessage());
            } finally {
                b.recycle();
            }
            trimCache(dir, f);
        }
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    /** Alte Bilder aufräumen (älter als 2 Tage oder mehr als 300 Dateien). */
    private static void trimCache(File dir, File keep) {
        File[] files = dir.listFiles();
        if (files == null) return;
        long cut = System.currentTimeMillis() - 2L * 24 * 3600 * 1000;
        for (File f : files) if (!f.equals(keep) && (f.lastModified() < cut || files.length > 300)) f.delete();
    }

    @Override
    public String getType(Uri uri) {
        return "image/png";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
