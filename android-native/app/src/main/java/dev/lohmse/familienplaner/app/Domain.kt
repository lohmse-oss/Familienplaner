package dev.lohmse.familienplaner.app

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.TimeZone

// ---------- Datenmodell (JSON-kompatibel zur Web-App) ----------

data class Ferien(val name: String, val von: String, val bis: String)

data class Mitglied(
  val id: String,
  var name: String,
  var rolle: String,
  var farbe: String,
  var urlaubstage: Int = 30,
  var resturlaubVorjahr: Int = 0
)

data class Eintrag(
  val id: String,
  val mitgliedId: String,
  val typ: String,
  val von: String,
  val bis: String,
  val titel: String = "",
  val notiz: String = "",
  val jaehrlich: Boolean = false,
  val monat: Int? = null,
  val tag: Int? = null,
  val gcalId: String? = null
)

data class Einstellungen(
  var fronleichnamRegional: Boolean = false,
  var gcalClientId: String = "",
  var syncUrl: String = "",
  var syncToken: String = "",
  var geraetName: String = ""
)

data class AppState(
  var version: Int = 1,
  var ansicht: String = "wand",
  val wandModus: MutableMap<String, String> = mutableMapOf(),
  var jahr: Int = 0,
  val mitglieder: MutableList<Mitglied> = mutableListOf(),
  val eintraege: MutableList<Eintrag> = mutableListOf(),
  val eigeneFerien: MutableList<Ferien> = mutableListOf(),
  val einstellungen: Einstellungen = Einstellungen(),
  var filterMitglied: String = "alle",
  var updatedAt: Long = 0,
  var updatedBy: String = ""
)

// ---------- Konstanten ----------

const val JAHR_MIN = 2027
const val JAHR_MAX = 2031

val FERIEN_SACHSEN = listOf(
  Ferien("Weihnachtsferien 2026/27", "2026-12-23", "2027-01-02"),
  Ferien("Winterferien 2027", "2027-02-08", "2027-02-19"),
  Ferien("Osterferien 2027", "2027-03-26", "2027-04-02"),
  Ferien("Pfingstferien 2027", "2027-05-15", "2027-05-18"),
  Ferien("Sommerferien 2027", "2027-07-10", "2027-08-20"),
  Ferien("Herbstferien 2027", "2027-10-11", "2027-10-23"),
  Ferien("Weihnachtsferien 2027/28", "2027-12-23", "2028-01-01"),
  Ferien("Winterferien 2028", "2028-02-14", "2028-02-26"),
  Ferien("Osterferien 2028", "2028-04-14", "2028-04-22"),
  Ferien("Pfingstferien 2028", "2028-05-26", "2028-05-26"),
  Ferien("Sommerferien 2028", "2028-07-22", "2028-09-01"),
  Ferien("Herbstferien 2028", "2028-10-23", "2028-11-03"),
  Ferien("Weihnachtsferien 2028/29", "2028-12-23", "2029-01-03"),
  Ferien("Winterferien 2029", "2029-02-05", "2029-02-16"),
  Ferien("Osterferien 2029", "2029-03-29", "2029-04-06"),
  Ferien("Pfingstferien 2029", "2029-05-19", "2029-05-22"),
  Ferien("Sommerferien 2029", "2029-07-21", "2029-08-31"),
  Ferien("Herbstferien 2029", "2029-10-22", "2029-11-02"),
  Ferien("Weihnachtsferien 2029/30", "2029-12-22", "2030-01-04"),
  Ferien("Winterferien 2030", "2030-02-18", "2030-03-01"),
  Ferien("Osterferien 2030", "2030-04-19", "2030-04-26"),
  Ferien("Pfingstferien 2030", "2030-06-08", "2030-06-11"),
  Ferien("Unterrichtsfreier Tag 2030", "2030-05-31", "2030-05-31"),
  Ferien("Sommerferien 2030", "2030-07-13", "2030-08-23")
)

val TYP_LABEL = mapOf(
  "urlaub" to "Urlaub",
  "schulfrei" to "Schulfrei (flexibel)",
  "betreuung" to "Betreuung / Ferienlager (Kind)",
  "termin" to "Besonderer Tag / Termin",
  "abwesenheit" to "Abwesenheit"
)

val MODUS_OPTIONEN = mapOf(
  "elternteil" to listOf("urlaub", "abwesenheit", "termin"),
  "kind" to listOf("schulfrei", "betreuung", "abwesenheit", "termin")
)

val MONATSNAMEN = listOf("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember")
val WOCHENTAG_KURZ = listOf("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")

fun typLabel(typ: String) = TYP_LABEL[typ] ?: typ

fun defaultState(): AppState {
  val now = Calendar.getInstance()
  val jahr = now.get(Calendar.YEAR).coerceIn(JAHR_MIN, JAHR_MAX)
  return AppState(
    jahr = jahr,
    mitglieder = mutableListOf(
      Mitglied("m1", "Betty", "elternteil", "#2563eb", 30, 0),
      Mitglied("m2", "Sebastian", "elternteil", "#db2777", 30, 0),
      Mitglied("m3", "Ida", "kind", "#16a34a"),
      Mitglied("m4", "Irma", "kind", "#d97706")
    )
  )
}

// ---------- Datums-Helfer (Keys: "yyyy-MM-dd") ----------

fun pad(n: Int) = n.toString().padStart(2, '0')

fun toKey(c: Calendar): String =
  "${c.get(Calendar.YEAR)}-${pad(c.get(Calendar.MONTH) + 1)}-${pad(c.get(Calendar.DAY_OF_MONTH))}"

fun fromKey(k: String): Calendar {
  val p = k.split("-").map { it.toInt() }
  return GregorianCalendar(p[0], p[1] - 1, p[2])
}

fun addDaysKey(k: String, n: Int): String {
  val c = fromKey(k)
  c.add(Calendar.DAY_OF_MONTH, n)
  return toKey(c)
}

fun daysBetween(a: String, b: String): Int {
  val ca = fromKey(a); val cb = fromKey(b)
  return ((cb.timeInMillis - ca.timeInMillis) / 86400000L).toInt() + 1
}

fun isWerktag(k: String): Boolean {
  val dow = fromKey(k).get(Calendar.DAY_OF_WEEK)
  return dow in Calendar.MONDAY..Calendar.FRIDAY
}

fun fmtDeutsch(k: String): String {
  val c = fromKey(k)
  return "${c.get(Calendar.DAY_OF_MONTH)}.${c.get(Calendar.MONTH) + 1}.${c.get(Calendar.YEAR)}"
}

// ---------- Feiertage Sachsen ----------

fun ostern(jahr: Int): Calendar {
  val a = jahr % 19
  val b = jahr / 100
  val c = jahr % 100
  val d = b / 4
  val e = b % 4
  val f = (b + 8) / 25
  val g = (b - f + 1) / 3
  val h = (19 * a + b - d - g + 15) % 30
  val i = c / 4
  val k = c % 4
  val l = (32 + 2 * e + 2 * i - h - k) % 7
  val m = (a + 11 * h + 22 * l) / 451
  val monat = (h + l - 7 * m + 114) / 31
  val tag = (h + l - 7 * m + 114) % 31 + 1
  return GregorianCalendar(jahr, monat - 1, tag)
}

fun bussUndBettag(jahr: Int): Calendar? {
  for (tag in 16..22) {
    val d = GregorianCalendar(jahr, Calendar.NOVEMBER, tag)
    if (d.get(Calendar.DAY_OF_WEEK) == Calendar.WEDNESDAY) return d
  }
  return null
}

data class Feiertag(val key: String, val name: String)

fun feiertageSachsen(jahr: Int, mitFronleichnam: Boolean): List<Feiertag> {
  val e = ostern(jahr)
  val liste = mutableListOf<Feiertag>()
  fun push(c: Calendar, name: String) { liste.add(Feiertag(toKey(c), name)) }
  fun pushOffset(days: Int, name: String) {
    val c = e.clone() as Calendar
    c.add(Calendar.DAY_OF_MONTH, days)
    push(c, name)
  }
  push(GregorianCalendar(jahr, Calendar.JANUARY, 1), "Neujahr")
  pushOffset(-2, "Karfreitag")
  pushOffset(1, "Ostermontag")
  push(GregorianCalendar(jahr, Calendar.MAY, 1), "Tag der Arbeit")
  pushOffset(39, "Christi Himmelfahrt")
  pushOffset(50, "Pfingstmontag")
  if (mitFronleichnam) pushOffset(60, "Fronleichnam (regional, sorbische Gemeinden)")
  push(GregorianCalendar(jahr, Calendar.OCTOBER, 3), "Tag der Deutschen Einheit")
  push(GregorianCalendar(jahr, Calendar.OCTOBER, 31), "Reformationstag")
  bussUndBettag(jahr)?.let { push(it, "Buß- und Bettag") }
  push(GregorianCalendar(jahr, Calendar.DECEMBER, 25), "1. Weihnachtstag")
  push(GregorianCalendar(jahr, Calendar.DECEMBER, 26), "2. Weihnachtstag")
  return liste
}

fun feiertagMap(jahr: Int, mitFronleichnam: Boolean): Map<String, String> =
  feiertageSachsen(jahr, mitFronleichnam).associate { it.key to it.name }

fun istHalbtag(key: String, jahr: Int) = key == "$jahr-12-24" || key == "$jahr-12-31"

// ---------- Urlaubstage / Blöcke ----------

fun urlaubstageImJahr(von0: String, bis0: String, jahr: Int, fmap: Map<String, String>): Double {
  val jahrStart = "$jahr-01-01"
  val jahrEnde = "$jahr-12-31"
  val von = maxOf(von0, jahrStart)
  val bis = minOf(bis0, jahrEnde)
  var count = 0.0
  var k = von
  while (k <= bis) {
    if (isWerktag(k) && fmap[k] == null) count += if (istHalbtag(k, jahr)) 0.5 else 1.0
    k = addDaysKey(k, 1)
  }
  return count
}

fun hatWerktagZwischen(a: String, b: String, fmap: Map<String, String>): Boolean {
  var k = addDaysKey(a, 1)
  while (k < b) {
    if (isWerktag(k) && fmap[k] == null) return true
    k = addDaysKey(k, 1)
  }
  return false
}

data class Block(val von: String, val bis: String, val kalendertage: Int, val urlaubstage: Double, val ferien: List<String>)

fun mergeBloecke(ranges: List<Pair<String, String>>, fmap: Map<String, String>): List<Pair<String, String>> {
  val sortiert = ranges.sortedBy { it.first }
  val merged = mutableListOf<Pair<String, String>>()
  for (r in sortiert) {
    val last = merged.lastOrNull()
    if (last != null && !hatWerktagZwischen(last.second, r.first, fmap)) {
      if (r.second > last.second) merged[merged.size - 1] = last.first to r.second
    } else {
      merged.add(r)
    }
  }
  return merged
}

fun alleFerien(state: AppState) = FERIEN_SACHSEN + state.eigeneFerien

fun ferienAm(key: String, state: AppState): List<String> {
  val namen = mutableListOf<String>()
  for (f in alleFerien(state)) if (key in f.von..f.bis && f.name !in namen) namen.add(f.name)
  return namen
}

fun ferienIn(von: String, bis: String, state: AppState): List<String> {
  val namen = mutableListOf<String>()
  for (f in alleFerien(state)) if (f.bis >= von && f.von <= bis && f.name !in namen) namen.add(f.name)
  return namen
}

fun eintraegeImJahr(state: AppState, jahr: Int): List<Eintrag> {
  val out = mutableListOf<Eintrag>()
  for (e in state.eintraege) {
    if (e.jaehrlich && e.monat != null && e.tag != null) {
      val mo = e.monat
      var tag = e.tag
      val tageImMonat = GregorianCalendar(jahr, mo, 0).get(Calendar.DAY_OF_MONTH)
      if (tag > tageImMonat) tag = tageImMonat
      val key = "$jahr-${pad(mo)}-${pad(tag)}"
      out.add(e.copy(von = key, bis = key))
    } else {
      out.add(e)
    }
  }
  return out
}

fun bloeckeFor(state: AppState, mitgliedId: String, typ: String, jahr: Int): List<Block> {
  val fmap = feiertagMap(jahr, state.einstellungen.fronleichnamRegional)
  val jahrStart = "$jahr-01-01"
  val jahrEnde = "$jahr-12-31"
  val ranges = eintraegeImJahr(state, jahr)
    .filter { it.mitgliedId == mitgliedId && it.typ == typ && it.von <= jahrEnde && it.bis >= jahrStart }
    .map { maxOf(it.von, jahrStart) to minOf(it.bis, jahrEnde) }
  return mergeBloecke(ranges, fmap).map { (von, bis) ->
    Block(von, bis, daysBetween(von, bis), urlaubstageImJahr(von, bis, jahr, fmap), ferienIn(von, bis, state))
  }
}

fun urlaubVerbraucht(state: AppState, mitgliedId: String, jahr: Int): Double =
  bloeckeFor(state, mitgliedId, "urlaub", jahr).sumOf { it.urlaubstage }

fun schulfreieTageKind(state: AppState, mitgliedId: String, jahr: Int): Int {
  val fmap = feiertagMap(jahr, state.einstellungen.fronleichnamRegional)
  val tage = mutableSetOf<String>()
  val jahrStart = "$jahr-01-01"
  val jahrEnde = "$jahr-12-31"
  for (f in alleFerien(state)) {
    val von = maxOf(f.von, jahrStart)
    val bis = minOf(f.bis, jahrEnde)
    var k = von
    while (k <= bis) { if (isWerktag(k)) tage.add(k); k = addDaysKey(k, 1) }
  }
  for (k in fmap.keys) if (k in jahrStart..jahrEnde && isWerktag(k)) tage.add(k)
  for (e in eintraegeImJahr(state, jahr)) {
    if (e.mitgliedId == mitgliedId && e.typ == "schulfrei") {
      val von = maxOf(e.von, jahrStart)
      val bis = minOf(e.bis, jahrEnde)
      var k = von
      while (k <= bis) { if (isWerktag(k)) tage.add(k); k = addDaysKey(k, 1) }
    }
  }
  return tage.size
}

fun isoKW(key: String): Int {
  val c = fromKey(key)
  val utc = TimeZone.getTimeZone("UTC")
  val date = GregorianCalendar(utc)
  date.clear()
  date.set(c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH))
  val dayNum = (date.get(Calendar.DAY_OF_WEEK) + 5) % 7 // Mo=0
  date.add(Calendar.DAY_OF_MONTH, -dayNum + 3)
  val firstThursday = GregorianCalendar(utc)
  firstThursday.clear()
  firstThursday.set(date.get(Calendar.YEAR), Calendar.JANUARY, 4)
  val fd = (firstThursday.get(Calendar.DAY_OF_WEEK) + 5) % 7
  firstThursday.add(Calendar.DAY_OF_MONTH, -fd + 3)
  return 1 + ((date.timeInMillis - firstThursday.timeInMillis) / (7 * 86400000L)).toInt()
}

fun heuteKey(): String = toKey(Calendar.getInstance())

fun wochentagKurz(key: String): String {
  val dow = (fromKey(key).get(Calendar.DAY_OF_WEEK) + 6) % 7 // Mo=0
  return WOCHENTAG_KURZ[dow]
}
